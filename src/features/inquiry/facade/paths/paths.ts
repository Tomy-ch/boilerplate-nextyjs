/**
 * この feature が持つルート。
 *
 * @remarks
 * `facade` へ置くのは、在庫の無い商品から問い合わせへ送る入口（`products`）がここを指すためです。
 * feature どうしは直接 import できず、公開する口だけをここへ出します。指す側が宛先を書き写すと、
 * ルートを変えたときに古い宛先が残ります。
 */

/** 自分の問い合わせ。マイページの下に置く。 */
export const INQUIRY_PATH = "/mypage/inquiry";
