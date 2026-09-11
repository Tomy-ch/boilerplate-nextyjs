import type { InquiryId } from "@/model/inquiry/inquiry";
import type { ProductId } from "@/model/product/product";

/**
 * 商品を管理する画面のパス。
 *
 * @remarks
 * 画面を挟まず feature 直下に置きます。管理の画面どうしが互いへの導線を持ち、利用者向けの器も
 * 管理への入口をここから引くため、どれか 1 つの画面の持ち物にできません。
 *
 * 一覧が扱う検索条件やページ送りはここに入れません。パスは admin の route 構成が変われば変わり、
 * 条件は一覧の作りが変われば変わる、別々に動くものです。
 */
export const ADMIN_PRODUCT_LIST_PATH = "/admin/products";

/** 管理の入口。今日の集計を出す。 */
export const ADMIN_DASHBOARD_PATH = "/admin";

/** 期間を選んで集計を読む画面のパス。 */
export const ADMIN_ANALYTICS_PATH = "/admin/analytics";

/** 発送を待っている注文を便ごとに見る画面のパス。 */
export const ADMIN_SHIPMENT_QUEUE_PATH = "/admin/shipments";

/** 利用者を一覧で見る画面のパス。 */
export const ADMIN_USER_LIST_PATH = "/admin/users";

/** 問い合わせを一覧で見る画面のパス。 */
export const ADMIN_INQUIRY_LIST_PATH = "/admin/inquiries";

/** 商品を作る画面のパス。 */
export const ADMIN_PRODUCT_NEW_PATH = `${ADMIN_PRODUCT_LIST_PATH}/new`;

/** 商品を編集する画面のパス。 */
export function adminProductEditPath(id: ProductId): string {
  return `${ADMIN_PRODUCT_LIST_PATH}/${encodeURIComponent(id)}/edit`;
}

/** 在庫を補充する画面のパス。 */
export function adminProductStockPath(id: ProductId): string {
  return `${ADMIN_PRODUCT_LIST_PATH}/${encodeURIComponent(id)}/stock`;
}

/**
 * 商品 1 件を眺める画面のパス。
 *
 * @remarks
 * **利用者向けの画面を指します。** 管理側は商品を一覧で見比べるための面しか持たず、1 件を
 * 眺める面がありません。編集の面（{@link adminProductEditPath}）は目的が違い、名前を押した
 * 人が求めているのは「どんな商品か」であって編集ではありません。
 *
 * 管理側に 1 件を眺める面ができたら、行き先をそちらへ替えるのはこの関数だけです。
 */
export function productDetailPath(id: ProductId): string {
  return `/products/${encodeURIComponent(id)}`;
}

/** 問い合わせ 1 件のやり取りを見る画面のパス。 */
export function adminInquiryDetailPath(id: InquiryId): string {
  return `${ADMIN_INQUIRY_LIST_PATH}/${encodeURIComponent(id)}`;
}
