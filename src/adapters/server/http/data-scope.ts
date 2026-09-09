import "server-only";

import { createAppError } from "@/errors/app-error";
import { ErrorKind } from "@/errors/error-kind";

/**
 * 取得の口が扱う値の分類。
 *
 * @remarks
 * 分類を値ではなく**口**に持たせる理由は [adapters の README](../../README.md) が持ちます。
 *
 * 呼び出し側に値を綴りのまま書かせるのは、この宣言を検査が読むためです
 * （`project-rules/no-user-scoped-in-cached-module`）。綴りを定数へ寄せると検査が黙って外れるので、
 * `scripts/scope-spelling.gate.test.ts` が綴りのままであることを見張ります。
 */
export type DataScope = "public" | "user-scoped";

/**
 * 資格情報を運ぶヘッダ。
 *
 * @remarks
 * HTTP が資格情報の運び手として定めているものです（RFC 9110 §11.6.2 / RFC 6265）。アプリ固有の
 * 名前を足しません —— 契約が独自に持つ識別子は、それを載せる口の分類が `user-scoped` になる
 * ことで覆います（[adapters](../../README.md)）。
 */
const CREDENTIAL_HEADERS: ReadonlySet<string> = new Set(["authorization", "cookie"]);

/**
 * 呼び出しごとの指定が、口の分類に許された範囲に収まっていることを確かめる。
 *
 * @remarks
 * 同じことを型が既に禁じています（`request.ts` の `UserScopedRequestSpec`）。ここに置くのは **型を
 * 迂回した書き方**への後詰めで、別の口の使い回しや組み立てた spec から入ってくる経路を止めます。
 *
 * @throws 分類に許されない指定を含むとき
 */
export function assertSpecWithinScope(
  scope: DataScope,
  spec: { path: string; cache?: RequestCache; tags?: readonly string[] },
): void {
  if (scope === "user-scoped" && (spec.cache !== undefined || spec.tags !== undefined)) {
    throw createAppError(ErrorKind.INVALID_ARGUMENT, {
      cause: new Error(`主体に紐づく取得はキャッシュへ入れられません: ${spec.path}`),
    });
  }
}

/**
 * 資格情報のヘッダが呼び出しごとの指定に混ざっていないことを確かめる。
 *
 * @remarks
 * 資格情報を組むのは要求境界だけです。呼び出しごとに組める余地が残っていると、
 * **口の分類が「その client が資格情報を載せるか」を言い当てられなくなります** —— 分類の
 * 前提そのものが崩れるため、綴りの段階で塞ぎます。
 *
 * @throws 資格情報のヘッダを含むとき
 */
export function assertNoCredentialHeader(headers?: Readonly<Record<string, string>>): void {
  const credential = Object.keys(headers ?? {}).find((name) =>
    CREDENTIAL_HEADERS.has(name.toLowerCase()),
  );

  if (credential !== undefined) {
    throw createAppError(ErrorKind.INVALID_ARGUMENT, {
      cause: new Error(`資格情報のヘッダは呼び出しごとに組めません: ${credential}`),
    });
  }
}
