/**
 * 回答の送信が持つ項目の名前。
 *
 * @remarks
 * 綴りだけを持つ理由は利用者側（[`../../inquiry/form-names.ts`](../../inquiry/form-names.ts)）と
 * 同じです。入力欄は綴りだけを要り、受け取る側の検証は要りません。
 */
export const REPLY_BODY_FIELD = "body";

/** 回答先を載せる項目の名前。運営は複数の問い合わせを行き来するため、送信が対象を伴う。 */
export const REPLY_INQUIRY_ID_FIELD = "inquiryId";
