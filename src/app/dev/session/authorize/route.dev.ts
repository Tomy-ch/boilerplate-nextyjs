import { isDevelopmentAccessAllowed } from "@/adapters/server/auth/development-access";

import { authorizeDevelopmentSession } from "../authorize-development-session";

/**
 * 開発用 IdP の認可 endpoint。
 *
 * @remarks
 * **Server Action ではなく Route Handler です。** 理由は `features/dev-session/paths.ts` の
 * `DEV_AUTHORIZE_PATH` が持ちます。
 *
 * **開ける環境の判定をここでも行います。** 画面とは別の入口であり、画面を経由せずに呼べます。
 * 入口ごとに閉じていなければ、閉じたことになりません。
 *
 * **判定と組み立ては隣のモジュールが持ちます。** `route.ts` に許される import 先は
 * `adapters/server` / `errors` / `logging` で、原則は thin proxy です。ここが持つのは、
 * 口を閉じることと、返ってきた結果を HTTP の形へ直すことだけです。
 *
 * @returns 認可の応答・失敗の案内への 303。開けていない環境では 404、対応づける値が無ければ 400、
 *   本体が大きすぎれば 413
 */
export async function POST(request: Request): Promise<Response> {
  if (!(await isDevelopmentAccessAllowed())) {
    // 403 にしない。存在を知らせないほうが、設定を誤ったまま公開したときの被害が小さい。
    return new Response(null, { status: 404 });
  }

  const outcome = await authorizeDevelopmentSession(request);

  switch (outcome.kind) {
    case "redirect":
      // 303 にする。302 のままだと、戻した先をブラウザが POST で開き直しうる。
      return Response.redirect(new URL(outcome.destination, request.url), 303);
    case "too-large":
      return new Response(null, { status: 413 });
    default:
      return new Response(null, { status: 400 });
  }
}
