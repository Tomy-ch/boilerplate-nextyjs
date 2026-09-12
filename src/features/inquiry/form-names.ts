/**
 * 送信が持つ項目の名前。
 *
 * @remarks
 * 送る側（入力欄）と受け取る側（Server Action）が同じ綴りを使うための宣言です。文字列を両側に
 * 書くと、片方だけを直したときに型では止まらず、実行して初めて「値が届いていない」形で現れます。
 *
 * **検証を持たない module に置きます。** 入力欄が要るのは綴りだけで、受け取る側の検証
 * （[`parse-message-form.ts`](parse-message-form.ts)）は要りません。
 */
export const INQUIRY_BODY_FIELD = "body";
