import "server-only";

import { EncryptJWT, jwtDecrypt } from "jose";
import { z } from "zod";

import { getAuthConfig } from "@/config/auth/auth.server";
import { createAppError } from "@/errors/app-error";
import { ErrorKind } from "@/errors/error-kind";
import { SESSION_ROLE } from "@/model/session";

import { deriveSealKey, SEAL_HEADER } from "./seal-key";
import { TRANSACTION_MAX_AGE_SECONDS } from "./session-cookie";
import type { TestSessionSpec } from "./test-session-record";

/** 封緘した認可コードの中身。 */
const SealedCode = z.object({
  state: z.string(),
  sub: z.string(),
  role: z.enum([SESSION_ROLE.admin, SESSION_ROLE.user]),
  expiresInSeconds: z.number(),
  accessToken: z.string().optional(),
});

/**
 * 認可コードが束ねているもの。
 *
 * @remarks
 * **指定だけでなく、それを発行した要求の `state` も持ちます。** 指定だけを封緘すると、コードは
 * どの要求に対しても使えてしまいます —— 交換の相手はコードを持っている側が用意できるため
 * （自分で `/login` を踏めば新しい一時状態が手に入る）、`state` の突合が「自分の要求と自分の応答」
 * を確かめるだけになり、**コードがどの要求のために出されたかは誰も確かめません**。
 *
 * 実在の IdP では PKCE の検証子がこの役目を負います（コードは要求時の `code_verifier` を知る者に
 * しか交換できない）。ここで `state` を束ねるのは、その性質を開発用の経路でも保つためです。
 */
export type DevelopmentAuthorization = {
  /** このコードを発行した認可要求の `state`。 */
  readonly state: string;
  /** 発行する session の指定。 */
  readonly spec: TestSessionSpec;
};

/**
 * 開発用の認可コードを発行する。
 *
 * @remarks
 * IdP が持つ「認可した内容を、交換されるまで預かる」役目を、開発用の面が肩代わりします。**指定を
 * URL に平文で載せません** —— `code` は利用者が編集できる位置に現れるため、そこに役割を書けば
 * 誰でも管理者として戻ってこられます。封緘してあれば、書き換えた時点で交換が失敗します。
 *
 * **どの要求のために出したかを一緒に封緘します。** 一時状態の消費（`takeTransaction`）だけでは、
 * コードを手に入れた別の主体が新しい往復を始めて交換するのを止められません
 * （{@link DevelopmentAuthorization}）。
 *
 * 寿命は一時状態と揃えます。一時状態が切れたコードは交換できないので、それより長く生かしても
 * 使える時間は伸びません。
 *
 * 秘密値を引数に取らず設定から読むのは、**呼ぶのが app 層だから**です
 * （`app/dev/session/authorize-development-session.ts`）。渡す形にすると、封緘の鍵が
 * `adapters/server/auth` の外を通ります。
 */
export async function issueDevelopmentAuthorizationCode(
  authorization: DevelopmentAuthorization,
): Promise<string> {
  const { state, spec } = authorization;
  const issuedAt = Math.floor(Date.now() / 1000);

  return new EncryptJWT({
    state,
    sub: spec.subject,
    role: spec.role,
    expiresInSeconds: spec.expiresInSeconds,
    ...(spec.accessToken === undefined ? {} : { accessToken: spec.accessToken }),
  })
    .setProtectedHeader(SEAL_HEADER)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + TRANSACTION_MAX_AGE_SECONDS)
    .encrypt(await deriveSealKey(getAuthConfig().sessionSecret));
}

/**
 * 開発用の認可コードを、発行時の要求と指定へ戻す。
 *
 * @remarks
 * 秘密値を引数で受け取るのは、**呼ぶのが Resolver だから**です。Resolver は依存を注入されて
 * 組み立てられるので、ここで設定を直に読むと、Resolver の検証が環境変数の用意を要求します。
 *
 * @throws 復号できないとき、失効しているとき、中身が宣言した形でないとき
 */
export async function openDevelopmentAuthorizationCode(
  code: string,
  secret: string,
): Promise<DevelopmentAuthorization> {
  try {
    const { payload } = await jwtDecrypt(code, await deriveSealKey(secret));
    const parsed = SealedCode.parse(payload);

    return {
      state: parsed.state,
      spec: {
        subject: parsed.sub,
        role: parsed.role,
        expiresInSeconds: parsed.expiresInSeconds,
        ...(parsed.accessToken === undefined ? {} : { accessToken: parsed.accessToken }),
      },
    };
  } catch (cause) {
    // 復号の失敗・失効・形の違いを区別しない。どれも「このコードでは session を作れない」で
    // 同じであり、区別できると、書き換えたコードを試す側への手掛かりになる。
    throw createAppError(ErrorKind.UNAUTHENTICATED, { cause });
  }
}
