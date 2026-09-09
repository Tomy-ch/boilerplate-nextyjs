import { getProductListPage, parseProductQuery } from "@/adapters/server/api/products";
import { toCaughtErrorResponse, toErrorResponse } from "@/adapters/server/http/error-response";
import { toRawQuery } from "@/adapters/server/http/search-params";
import { ErrorKind } from "@/errors/error-kind";

/**
 * 一覧の増分取得。
 *
 * @remarks
 * 無限スクロールが 2 ページ目以降を取りに来る口です。初回ページは Server Component が
 * 直接取得するため、ここは通りません。
 *
 * 取得も検証も画像 URL の解決も `adapters/server` が済ませています。このハンドラが持つのは、
 * 済んだ分類を HTTP へ写すところだけです。
 *
 * 失敗を捕まえるのは、握り潰すためではなく**正規化した形で返す**ためです。投げたままにすると応答の
 * 中身が framework の既定になり、内側の事情がそのまま外へ出ます。分類とログは `adapters` の境界が
 * 済ませているので、ここでは記録し直しません。
 */
export async function GET(request: Request): Promise<Response> {
  const parsed = parseProductQuery(toRawQuery(new URL(request.url).searchParams));

  if (!parsed.ok) {
    return toErrorResponse(ErrorKind.INVALID_ARGUMENT);
  }

  try {
    return Response.json(await getProductListPage(parsed.query));
  } catch (error) {
    return toCaughtErrorResponse(error);
  }
}
