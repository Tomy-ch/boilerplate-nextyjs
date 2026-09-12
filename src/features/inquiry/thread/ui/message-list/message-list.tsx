import { Fragment } from "react";

import { Bubble, BubbleContent } from "@/components/design-system/display/bubble/bubble";
import { BUBBLE_VARIANT } from "@/components/design-system/display/bubble/bubble.definition";
import { Marker, MarkerContent } from "@/components/design-system/display/marker/marker";
import { MARKER_VARIANT } from "@/components/design-system/display/marker/marker.definition";
import {
  Message,
  MessageContent,
  MessageFooter,
  MessageGroup,
  MessageHeader,
} from "@/components/design-system/display/message/message";
import { MESSAGE_ALIGN } from "@/components/design-system/display/message/message.definition";
import { formatTime } from "@/model/datetime";
import type { ConversationDay } from "@/model/inquiry/conversation";
import { INQUIRY_AUTHOR_KIND, type InquiryMessage } from "@/model/inquiry/inquiry";
import { withPartSpan } from "@/observability/render-span";

/** 送り手ごとの呼び名。向きは支援技術へ伝わらないため、名前は必ず本文の前に置く。 */
const AUTHOR_LABEL: Readonly<Record<string, string>> = {
  [INQUIRY_AUTHOR_KIND.user]: "あなた",
  [INQUIRY_AUTHOR_KIND.operator]: "サポート",
};

/** 届く前の 1 通に添える文言。 */
const SENDING_LABEL = "送信中";

/**
 * まだ応答が返っていない送信 1 件。
 *
 * @remarks
 * 識別子を伴うのは、同じ本文を続けて送っても別の行として扱うためです。位置で数えると、
 * 先に確定した 1 通が抜けたときに残りの行が作り直されます。
 */
export type InquiryDraft = {
  readonly id: string;
  readonly body: string;
};

/** `InquiryMessageList` の props。 */
export type InquiryMessageListProps = {
  /** 日付で区切った、確定しているやり取り。 */
  days: readonly ConversationDay[];
  /** まだ応答が返っていない送信。並びの末尾に置く。 */
  pending: readonly InquiryDraft[];
};

/** 1 通ぶんの吹き出し。誰の発言かで向きと面が変わる。 */
function InquiryMessageRow({ message }: { message: InquiryMessage }) {
  const mine = message.authorKind === INQUIRY_AUTHOR_KIND.user;

  return (
    <Message align={mine ? MESSAGE_ALIGN.END : MESSAGE_ALIGN.START}>
      <MessageContent>
        <MessageHeader>
          {AUTHOR_LABEL[message.authorKind]} {formatTime(message.createdAt)}
        </MessageHeader>
        <Bubble variant={mine ? BUBBLE_VARIANT.DEFAULT : BUBBLE_VARIANT.MUTED}>
          <BubbleContent className="whitespace-pre-wrap break-words">{message.body}</BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  );
}

/**
 * やり取りの並び。
 *
 * @remarks
 * 取得も購読も持ちません。**並べ替えも重複の除去もここでは行わず**、確定した並びを受け取って
 * 描くだけにします。送信中の 1 通は、確定したものと同じ向き・同じ面で末尾に置きます。
 *
 * 日付の区切りと向きが何を約束するかは、同 feature の [README](../../../README.md)。
 */
export const InquiryMessageList = withPartSpan(
  "features/inquiry/thread/ui/message-list/message-list",
  ({ days, pending }: InquiryMessageListProps) => {
    return (
      <div className="flex flex-col gap-4">
        {days.map((day) => (
          <Fragment key={day.day}>
            <Marker variant={MARKER_VARIANT.SEPARATOR}>
              <MarkerContent>{day.day}</MarkerContent>
            </Marker>
            <MessageGroup>
              {day.messages.map((message) => (
                <InquiryMessageRow key={message.id} message={message} />
              ))}
            </MessageGroup>
          </Fragment>
        ))}

        {pending.length === 0 ? null : (
          <MessageGroup>
            {pending.map((draft) => (
              <Message align={MESSAGE_ALIGN.END} key={draft.id}>
                <MessageContent>
                  <MessageHeader>{AUTHOR_LABEL[INQUIRY_AUTHOR_KIND.user]}</MessageHeader>
                  <Bubble variant={BUBBLE_VARIANT.DEFAULT}>
                    <BubbleContent className="whitespace-pre-wrap break-words opacity-70">
                      {draft.body}
                    </BubbleContent>
                  </Bubble>
                  <MessageFooter>{SENDING_LABEL}</MessageFooter>
                </MessageContent>
              </Message>
            ))}
          </MessageGroup>
        )}
      </div>
    );
  },
);
