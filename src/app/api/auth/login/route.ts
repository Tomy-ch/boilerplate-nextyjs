import { getSessionResolver } from "@/adapters/server/auth/resolver";
import { storeTransaction } from "@/adapters/server/auth/session";
import { unavailableLoginPath } from "@/features/auth/facade/login-notice";
import { toSafeReturnUrl } from "@/model/return-url";

/**
 * 認可要求を組み立て、IdP へ送り出す。
 *
 * @remarks
 * 認可要求の組み立てと一時状態の保管を画面側に置くと、client のコードが PKCE の検証子に
 * 触れることになります。だから画面が持つのは「ここへ送る」だけです。
 *
 * 送り先が借り物の画面になるのは、既定の Resolver が federation の経路を採っているためです。
 * 所有画面へ移す形では、資格情報を受け取るのが `/login` になり、ここは中継する側へ変わります。
 *
 * 復帰先は受け取った時点で検証し、以降は検証済みの値だけを持ち回ります。入口で 1 度だけ
 * 検証するのは、経路の途中で検証し忘れる箇所を作らないためです。
 */
export async function GET(request: Request): Promise<Response> {
  const returnUrl = toSafeReturnUrl(new URL(request.url).searchParams.get("returnUrl"));

  try {
    const { authorizationUrl, transaction } =
      await getSessionResolver().startAuthorization(returnUrl);

    await storeTransaction(transaction);

    return Response.redirect(authorizationUrl, 302);
  } catch {
    // 認可要求の組み立てと一時状態の保管のどちらが落ちても、認証は始まっていない。
    // ここで例外を外へ出すと利用者には本文の無い 500 だけが残り、戻る手段が無くなるので、
    // 始めた場所へ返して再試行させる。
    return Response.redirect(new URL(unavailableLoginPath(returnUrl), request.url), 302);
  }
}
