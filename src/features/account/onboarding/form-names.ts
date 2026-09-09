/**
 * 入力欄の `name`。
 *
 * @remarks
 * **送る側と読む側が同じ綴りを見るための 1 か所です。**戻り先を隠し項目で運ぶ登録画面と、送られて
 * きた内容を読む [`parse-registration-form.ts`](parse-registration-form.ts) の両方が引きます。
 *
 * **綴りだけを持ち、検証を持ちません。** 読む側は zod を使いますが、書く側（`view.tsx`）が要るのは
 * この文字列だけです。同じ module に置くと、隠し項目を 1 つ描くために検証の一式が
 * client bundle へ載ります。
 */
export const RETURN_URL_FIELD = "returnUrl";
