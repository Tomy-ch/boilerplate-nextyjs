import * as z from "zod/mini";

import {
  INQUIRY_AUTHOR_KIND,
  type InquiryId,
  type InquiryMessage,
  inquiryIdSchema,
} from "@/model/inquiry/inquiry";

/** 自分の問い合わせを購読する口を発券する中継。 */
export const INQUIRY_STREAM_TICKET_PATH = "/api/inquiries/me/stream-ticket";

/** 問い合わせの更新フィードを購読する口を発券する中継（運営）。 */
export const INQUIRY_FEED_STREAM_TICKET_PATH = "/api/inquiries/feed/stream-ticket";

/** 会話に 1 通追加されたことを表す event の種別。末尾の版は契約の世代を表す。 */
const MESSAGE_CREATED_TYPE = "inquiry.message.created.v1";

/** 問い合わせが更新されたことを表す event の種別（フィード）。 */
const THREAD_UPDATED_TYPE = "inquiry.thread.updated.v1";

/**
 * 送信側がオフセット付きで書く日時。
 *
 * @remarks
 * **`Z` に固定されていません。** 送信側は現地のオフセットのまま書き出すため、`Z` しか通さない
 * 既定の検証を当てると、届いた event がすべて落ちます。読み取った後は `Date` にした時点で
 * 同じ瞬間を指すので、オフセットの違いは表示へ影響しません。
 */
const offsetDateTime = z.iso.datetime({ offset: true });

/**
 * 会話 stream が運ぶ event。
 *
 * @remarks
 * **判別は封筒の `type` で行います。** 契約に無い種別はここで落ち、上へ流れません。
 *
 * `payload` の位置は数値、封筒の位置は 10 進文字列です。**同じ値の別の綴り**で、封筒側は
 * 桁あふれを避けるために文字列になっています。畳み込みが使うのは会話の中での位置なので、
 * ここが読むのは `payload` の側です。
 */
export const inquiryConversationEventSchema = z.object({
  type: z.literal(MESSAGE_CREATED_TYPE),
  payload: z.object({
    messageId: z.string(),
    inquiryId: inquiryIdSchema,
    author: z.object({
      kind: z.enum([INQUIRY_AUTHOR_KIND.user, INQUIRY_AUTHOR_KIND.operator]),
    }),
    body: z.string(),
    sequence: z.int().check(z.minimum(1)),
    createdAt: offsetDateTime,
  }),
});

/** 会話 stream が運ぶ event 1 件。 */
export type InquiryConversationEvent = z.infer<typeof inquiryConversationEventSchema>;

/**
 * フィードが運ぶ event。
 *
 * @remarks
 * **本文を持ちません。** 運ぶのは「どの問い合わせがどこまで進んだか」だけで、中身が要る画面は
 * 履歴を取り直します。
 *
 * `payload` の位置は**会話の中での位置**であり、フィードの位置ではありません。フィードの位置は
 * 封筒が持ちます。取り違えると、問い合わせが 2 件以上ある環境で再開位置がずれます。
 */
export const inquiryFeedEventSchema = z.object({
  type: z.literal(THREAD_UPDATED_TYPE),
  payload: z.object({
    inquiryId: inquiryIdSchema,
    userId: z.string(),
    sequence: z.int().check(z.minimum(1)),
    updatedAt: offsetDateTime,
  }),
});

/** フィードが運ぶ event 1 件。 */
export type InquiryFeedEvent = z.infer<typeof inquiryFeedEventSchema>;

/** 届いた event を、取得した履歴と同じ表示用の型へ写す。 */
export function toInquiryMessage(event: InquiryConversationEvent): InquiryMessage {
  return {
    id: event.payload.messageId,
    authorKind: event.payload.author.kind,
    body: event.payload.body,
    sequence: event.payload.sequence,
    createdAt: new Date(event.payload.createdAt),
  };
}

/** 更新のあった問い合わせ。一覧はこの識別子を見て、その行を取り直す。 */
export function toUpdatedInquiryId(event: InquiryFeedEvent): InquiryId {
  return event.payload.inquiryId;
}
