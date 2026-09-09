import { getProductCount, parseProductQuery } from "@/adapters/server/api/products";
import { toCaughtErrorResponse, toErrorResponse } from "@/adapters/server/http/error-response";
import { toRawQuery } from "@/adapters/server/http/search-params";
import { ErrorKind } from "@/errors/error-kind";

/**
 * 絞り込みを確定する前の件数。
 *
 * @remarks
 * 脇の絞り込みが、まだ URL に載っていない条件で何件になるかを問い合わせる口です。確定した条件
 * ぶんは Server Component が取得するため、ここは通りません。
 *
 * 一覧の増分取得と同じ組み立てです。持つのは、済んだ分類を HTTP へ写すところだけで、
 * 取得も検証も `adapters/server` が済ませています。
 */
export async function GET(request: Request): Promise<Response> {
  const parsed = parseProductQuery(toRawQuery(new URL(request.url).searchParams));

  if (!parsed.ok) {
    return toErrorResponse(ErrorKind.INVALID_ARGUMENT);
  }

  try {
    return Response.json({ count: await getProductCount(parsed.query) });
  } catch (error) {
    return toCaughtErrorResponse(error);
  }
}
