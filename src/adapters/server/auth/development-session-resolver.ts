import "server-only";

import { createAppError } from "@/errors/app-error";
import { ErrorKind } from "@/errors/error-kind";

import {
  createDefaultSessionResolver,
  type DefaultSessionResolverDeps,
} from "./default-session-resolver";
import { openDevelopmentAuthorizationCode } from "./development-authorization-code";
import { createRandomToken } from "./random-token";
import type { AuthorizationRequest, SessionRecord, SessionResolver } from "./session-resolver";
import { toTestSessionRecord } from "./test-session-record";

/**
 * 認可を始める代わりに開く面。
 *
 * @remarks
 * `features/dev-session` が同じ値を持ちますが、この層は `features` を参照できません。
 * 前捌きの `proxy.ts` がログイン画面の場所を自前で持つのと同じ、層の境界による重複です。
 */
const DEV_SESSION_PATH = "/dev/session";

/** 戻り先を持ち回るための検索条件の名前。 */
const RETURN_URL_PARAM = "returnUrl";

/** 要求と応答を対応づける値を持ち回るための検索条件の名前。 */
const STATE_PARAM = "state";

/**
 * IdP を立てずに認可の往復を成立させる Resolver を作る。
 *
 * @remarks
 * **`AUTH_MODE=dev` のときだけ選ばれます。** 選ぶ判定は環境と併せて `resolver.ts` の
 * `usesDevelopmentAuthorization()` が持ち、そう組む理由もそちらが持ちます。
 *
 * **往復そのものは省きません。** 送り出す先が `/dev/session` に変わるだけで、一時状態の cookie も
 * `/api/auth/callback` も本番と同じ経路を通ります。ここで直接 session を置く形にすると、callback が
 * 一度も踏まれない状態で画面を触り続けることになり、認可の往復が壊れていても気づけません。
 *
 * 封緘と復元は既定 Resolver をそのまま借ります。cookie の形が方式で変わると、`dev` で作った
 * session を `idp` で読めなくなり、環境変数を切り替えただけで入り直しが要ります。
 */
export function createDevelopmentSessionResolver(
  deps: DefaultSessionResolverDeps,
): SessionResolver {
  const sealing = createDefaultSessionResolver(deps);

  return {
    async startAuthorization(returnUrl: string): Promise<AuthorizationRequest> {
      // 一時状態の形は方式で変えない。PKCE の検証子と nonce をこちらは使わないが、空にすると
      // cookie を扱う側が「方式によっては入っていない」を知ることになる。
      const transaction = {
        state: createRandomToken(),
        codeVerifier: createRandomToken(),
        nonce: createRandomToken(),
        returnUrl,
      };

      // origin は callback と同じもの（`redirectUri`）から導く。どちらも同じアプリの口であり、
      // 別々に持つと片方だけ書き換えた設定が起動時には正しく見える。
      const url = new URL(DEV_SESSION_PATH, deps.redirectUri);
      url.searchParams.set(RETURN_URL_PARAM, returnUrl);
      url.searchParams.set(STATE_PARAM, transaction.state);

      return { authorizationUrl: url.toString(), transaction };
    },

    async completeAuthorization({ code, state, transaction }): Promise<SessionRecord> {
      if (state !== transaction.state) {
        throw createAppError(ErrorKind.UNAUTHENTICATED, {
          cause: new Error("認可応答の state が要求時のものと一致しません"),
        });
      }

      const authorization = await openDevelopmentAuthorizationCode(code, deps.sessionSecret);

      // 応答の state と別に、コード自身が名乗る state も確かめる。前者はコードを持つ側が用意できる
      // （自分で認可を始めれば新しい一時状態が手に入る）ので、それだけでは「このコードがこの要求の
      // ために出された」ことを確かめたことにならない。
      if (authorization.state !== transaction.state) {
        throw createAppError(ErrorKind.UNAUTHENTICATED, {
          cause: new Error("認可コードが別の要求のために発行されています"),
        });
      }

      return toTestSessionRecord(authorization.spec);
    },

    seal: sealing.seal,
    sealTransaction: sealing.sealTransaction,
    restore: sealing.restore,
    restoreTransaction: sealing.restoreTransaction,

    /**
     * 終わらせる相手が居ないので、送り出す先を持たない。
     *
     * @remarks
     * この session は IdP を通さずに作ったものです。既定 Resolver へ委ねると Discovery を引きに
     * 行き、IdP が立っていない環境ではログアウトが失敗します。
     */
    async endSession(): Promise<string | null> {
      return null;
    },
  };
}
