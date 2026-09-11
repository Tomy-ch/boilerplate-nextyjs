import * as z from "zod/mini";

import type { CursorPage } from "@/model/pagination";
import type { ProductListItem } from "@/model/product/product";
import { productIdSchema } from "@/model/product/product";

import { getProductsQueryFirstMax } from "../../gen/api/limits";
import { request } from "../http/request";

/**
 * 1 度の取得で読める件数の上限。
 *
 * @remarks
 * 契約が定めた値をそのまま出します。読み進めた件数を URL へ書き戻す側が、書ける上限として
 * 参照します。数を書き写すと、契約が広がっても古い上限で頭打ちになります。
 */
export const PRODUCT_LIST_MAX_ITEMS = getProductsQueryFirstMax;

/**
 * BFF が返す一覧 1 ページの形。
 *
 * @remarks
 * 契約から生成したスキーマではありません。この経路が受け取るのはバックエンドの応答ではなく、
 * `/api/products` が組み立てた表示用の形だからです。生成物を当てても、形が違うので通りません。
 *
 * それでも検証するのは、応答を検証せずに UI へ流さない原則が client 側の経路にも等しく
 * 効くためです。
 */
const ProductListPagePayload = z.object({
  items: z.array(
    z.object({
      id: productIdSchema,
      name: z.string(),
      price: z.string(),
      quantity: z.int(),
      categoryName: z.string(),
      statusName: z.string(),
      imageUrl: z.nullable(z.string()),
    }),
  ),
  nextCursor: z.nullable(z.string()),
});

/**
 * BFF が返す件数の形。
 *
 * @remarks
 * 検証する理由は {@link ProductListPagePayload} と同じです。
 */
const ProductCountPayload = z.object({ count: z.int() });

/**
 * 一覧の続きを取得する。
 *
 * @remarks
 * 同一オリジンの `/api/products` を {@link request} で叩くだけです。失敗の扱いと分類は
 * {@link request} の契約に従います。
 *
 * @param query - URL へ載せる検索条件。カーソルを含める
 * @param signal - 条件が変わった、または画面を離れたときに取得を打ち切る
 */
export async function fetchProductListPage(
  query: URLSearchParams,
  signal?: AbortSignal,
): Promise<CursorPage<ProductListItem>> {
  return request(`/api/products?${query.toString()}`, ProductListPagePayload, { signal });
}

/**
 * 条件に一致する件数だけを取得する。
 *
 * @remarks
 * 絞り込みを確定する前に、その条件で何件になるかを見せるための口です。一覧そのものは取りません。
 * 確定していない条件で一覧まで取ると、捨てるための取得が操作のたびに走ります。
 *
 * @param query - URL へ載せる検索条件。読み進めた位置は含めない
 * @param signal - 条件が変わった、または画面を離れたときに取得を打ち切る
 */
export async function fetchProductCount(
  query: URLSearchParams,
  signal?: AbortSignal,
): Promise<number> {
  const { count } = await request(
    `/api/products/count?${query.toString()}`,
    ProductCountPayload,
    { signal },
  );

  return count;
}
