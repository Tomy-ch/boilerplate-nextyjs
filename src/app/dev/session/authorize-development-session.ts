import { issueDevelopmentAuthorizationCode } from "@/adapters/server/auth/development-authorization-code";
import { AUTHORIZE_ERROR, authorizeFailurePath } from "@/features/dev-session/authorize-error";
import { parseDevSessionForm } from "@/features/dev-session/parse-session-form";
import { RETURN_URL_PARAM, STATE_PARAM } from "@/features/dev-session/paths";
import { toSafeReturnUrl } from "@/model/return-url";

import { toSessionInput } from "./to-session-input";

/** 認可の応答を受け取る口。app 層の中の別の口なので、相対のまま指す。 */
const AUTH_CALLBACK_PATH = "/api/auth/callback";

/**
 * 送信の本体に許すバイト数。
 *
 * @remarks
 * **受け口が自分で持ちます。** `next.config.ts` の `bodySizeLimit` は Server Action にしか及ばず、
 * Route Handler へ寄せた時点で外れます。ここが受けるのは短い指定だけで、貼られた Bearer を
 * 含めても収まります。
 */
const MAX_BODY_BYTES = 64 * 1024;

/**
 * 認可の結果。HTTP の形へ直すのは呼び出し側（Route Handler）。
 *
 * @remarks
 * 状態ごとに持つ値が違うため判別可能 union にしてあります。転送先まで組んで返すのは、戻す行き先が
 * `features` の語彙（失敗の分類）で決まるためです。**Route Handler は `features` を引けません。**
 */
export type AuthorizeOutcome =
  | { readonly kind: "redirect"; readonly destination: string }
  | { readonly kind: "not-an-authorization" }
  | { readonly kind: "too-large" };

/**
 * 開発用 IdP の認可要求を受け、応答へ送り出す先を決める。
 *
 * @remarks
 * **Route Handler の本体をここへ置きます。** `route.ts` に許される import 先は `adapters/server` /
 * `errors` / `logging` で、原則は thin proxy です。form の解析も失敗の分類も `features` の
 * 語彙なので、受け口の隣へ出して口そのものを薄く保ちます。
 *
 * 失敗は分類だけを URL へ載せて画面へ戻します。分類しか戻さない理由は
 * `features/dev-session/authorize-error.ts` の `AUTHORIZE_ERROR` が持ちます。項目ごとの理由は、
 * 自分の画面へ留まる送信（その場で発行する Server Action）の側です。
 *
 * **対応づける値が正しいかは判定しません。** 突き合わせるのは `/api/auth/callback` が復元する
 * 一時状態で、ここでも判定すると同じ判定が 2 か所に分かれます。ここが見るのは、載っているか
 * どうかだけです。
 */
export async function authorizeDevelopmentSession(request: Request): Promise<AuthorizeOutcome> {
  const declaredBytes = Number(request.headers.get("content-length") ?? 0);

  if (declaredBytes > MAX_BODY_BYTES) {
    return { kind: "too-large" };
  }

  const formData = await request.formData();
  // File が送られても文字列として扱わない。`[object File]` は state として成立しないため、
  // 対応づかない送信として落とす。
  const stateEntry = formData.get(STATE_PARAM);
  const state = typeof stateEntry === "string" ? stateEntry : "";
  const returnUrl = toSafeReturnUrl(formData.get(RETURN_URL_PARAM));

  if (state === "") {
    // 対応づける値が無い送信は認可の往復の外から来ている。戻す先も決められない。
    return { kind: "not-an-authorization" };
  }

  const parsed = parseDevSessionForm(formData);

  if (!parsed.ok) {
    return {
      kind: "redirect",
      destination: authorizeFailurePath(returnUrl, state, AUTHORIZE_ERROR.INVALID),
    };
  }

  let code: string;

  try {
    code = await issueDevelopmentAuthorizationCode({
      state,
      spec: await toSessionInput(parsed.input),
    });
  } catch {
    return {
      kind: "redirect",
      destination: authorizeFailurePath(returnUrl, state, AUTHORIZE_ERROR.UNAVAILABLE),
    };
  }

  const response = new URLSearchParams({ code, state });

  return { kind: "redirect", destination: `${AUTH_CALLBACK_PATH}?${response.toString()}` };
}
