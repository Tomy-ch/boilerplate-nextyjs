/**
 * 商品名に許される長さ。
 *
 * @remarks
 * 契約が課す上限です。ここで止めるのは、超えた入力が往復してから 422 で返るのを待たせないため
 * だけで、**判定の正は backend にあります**。
 */
export const PRODUCT_NAME_MAX_LENGTH = 255;

/**
 * 価格として受け付ける形。
 *
 * @remarks
 * 小数を含む十進の文字列です。数値へ変換しないのは、丸めるとサブセントの精度が落ちるためで、
 * 送るときも文字列のまま運びます。
 */
export const PRODUCT_PRICE_PATTERN = /^\d+(\.\d+)?$/;

/**
 * 画像として選べる形式と、利用者へ見せるその呼び名。
 *
 * @remarks
 * **受け付ける形式の宣言はここだけです。**入力欄へ渡す `accept` も、画面の説明文も、弾いた
 * ときの文言もここから導きます。散文で書き並べると、形式を足したときに直し漏れた場所だけが
 * 嘘をつきます。
 *
 * 呼び名を機械的な大文字化で作らないのは、形式の綴りが決まっているためです（`WebP` は
 * `WEBP` ではない）。
 */
const IMAGE_TYPE_LABELS = {
  "image/png": "PNG",
  "image/jpeg": "JPEG",
  "image/webp": "WebP",
} as const;

/** 入力欄の `accept` に渡す並び。 */
export const PRODUCT_IMAGE_ACCEPT = Object.keys(IMAGE_TYPE_LABELS).join(",");

/** 選べる形式を、利用者へ見せる並びにしたもの。 */
export const PRODUCT_IMAGE_ACCEPT_LABEL = Object.values(IMAGE_TYPE_LABELS).join(" / ");
