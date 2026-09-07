import { type ProductId, toProductId } from "@/model/product/product";

/** フォームが対象の商品を指すときの項目名。 */
const PRODUCT_ID_FIELD = "productId";

/** フォームが数量を指すときの項目名。 */
const QUANTITY_FIELD = "quantity";

/**
 * 送信された内容から商品を指す値を取り出す。
 *
 * @remarks
 * フォームは外から来る入力なので、ここが識別子を確定させる境界です。実在するかどうかはバックエンドが
 * 判断します。
 *
 * @returns 値が無い、または文字列でなければ null
 */
export function readProductId(formData: FormData): ProductId | null {
  const value = formData.get(PRODUCT_ID_FIELD);

  return typeof value === "string" && value !== "" ? toProductId(value) : null;
}

/**
 * 送信された内容から数量を取り出す。
 *
 * @remarks
 * 取り出せる形かどうかだけを見ます。受け付ける範囲を決めているのは契約であり、範囲外の数量は
 * バックエンドが拒みます。
 *
 * 空の値を数へ変換しません。`Number` は項目の欠落も空文字も `0` と読むため、変換に任せると
 * 「送られてこなかった」が「0 が送られてきた」になります。
 *
 * @returns 整数として読めなければ null
 */
export function readQuantity(formData: FormData): number | null {
  const raw = formData.get(QUANTITY_FIELD);

  if (typeof raw !== "string" || raw.trim() === "") {
    return null;
  }

  const value = Number(raw);

  return Number.isInteger(value) ? value : null;
}
