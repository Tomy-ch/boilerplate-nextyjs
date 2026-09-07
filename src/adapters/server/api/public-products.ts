import "server-only";

import type { CursorPage } from "@/model/pagination";
import { type ProductId, toProductId } from "@/model/product/product";

import { GetProductsResponse, getProductsQueryFirstMax } from "../../gen/api/endpoints.zod";
import { getPublicClient } from "./public-client";

/** 一覧の口が 1 度に返せる最大件数。全件を辿る側（`app/sitemap.ts`）が 1 歩の幅として使う。 */
export const PRODUCT_PAGE_LIMIT: number = getProductsQueryFirstMax;

/**
 * 公開中の商品の ID を 1 ページぶん、主体を名乗らずに取得する。
 *
 * @remarks
 * サイトマップが末尾まで辿るための口です。1 ページの幅は契約の上限（{@link PRODUCT_PAGE_LIMIT}）
 * で固定し、辿る側は cursor だけを持ち回ります。
 *
 * `products.ts` ではなくこちらが要るのは、あちらの client が要求のたびに cookie を読むため、
 * `use cache` の中から呼べず、その口を持つモジュールごと `use cache` の下から引けないためです
 * （ESLint の `no-user-scoped-in-cached-module`）。資格情報を持たないので、返るのは公開中の
 * ものだけです。
 *
 * @param after - 前のページが返した cursor。先頭なら省略
 */
export async function getPublicProductIds(after?: string): Promise<CursorPage<ProductId>> {
  const page = await getPublicClient().request({
    path: "/v1/products",
    searchParams: { first: String(PRODUCT_PAGE_LIMIT), after },
    schema: GetProductsResponse,
  });

  return {
    items: page.products.map((product) => toProductId(product.id)),
    nextCursor: page.nextCursor,
  };
}
