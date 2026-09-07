/**
 * 利用者側の商品一覧が 1 度に読み込む件数。
 *
 * @remarks
 * **条件の解釈（[`query.ts`](query.ts)）から切り離して持ちます。** あちらは URL の値を zod で
 * 解釈するため、この数値を 1 つ取るだけの client 側の読み込み（[`use-infinite-products.ts`](use-infinite-products.ts)）が
 * zod 一式を bundle へ引き込みます。
 */
export const PRODUCT_PAGE_SIZE = 24;
