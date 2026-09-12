import { postInquiriesMeMessagesBodyBodyMax } from "../../gen/api/limits";

/**
 * 問い合わせの本文が取れる文字数の上限。
 *
 * @remarks
 * **検証を持たない module に置きます。** 入力欄と story はこの数だけを要り、event の検証
 * スキーマ（[`inquiries.ts`](inquiries.ts)）は要りません。同じ module から取ると、`const` を 1 つ
 * 読む import が zod のスキーマ一式をブラウザの束へ載せます。
 *
 * 契約から生成した値をそのまま出します。数を書き写すと、契約が動いたときに画面だけが古い上限を
 * 見せます。
 */
export const INQUIRY_BODY_MAX_LENGTH = postInquiriesMeMessagesBodyBodyMax;
