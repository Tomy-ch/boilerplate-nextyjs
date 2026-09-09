/**
 * この feature が持つルート。
 *
 * @remarks
 * `facade` へ置くのは、マイページ（`account`）がここを指すためです。feature どうしは直接 import
 * できず、公開する口だけをここへ出します。指す側が宛先を書き写すと、ルートを変えたときに古い
 * 宛先が残ります。
 */

/** 購入履歴。global nav が直接指す。 */
export const PURCHASE_HISTORY_PATH = "/purchases";

/**
 * 購入 1 件の詳細を指す。
 *
 * @param purchaseCode - 購入コード。利用者へ注文番号として見せている値
 */
export function purchaseDetailPath(purchaseCode: string): string {
  return `${PURCHASE_HISTORY_PATH}/${encodeURIComponent(purchaseCode)}`;
}
