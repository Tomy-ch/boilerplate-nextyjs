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

/**
 * 送り手ごとの呼び名。
 *
 * @remarks
 * **利用者側の画面と逆です。** この画面で右へ寄るのは運営の発言で、問い合わせた本人は相手側に
 * 立ちます。同じやり取りでも、誰が読んでいるかで「自分」が入れ替わります。
 */
const AUTHOR_LABEL: Readonly<Record<string, string>> = {
  [INQUIRY_AUTHOR_KIND.user]: "利用者",
  [INQUIRY_AUTHOR_KIND.operator]: "運営",
};

const SENDING_LABEL = "送信中";

/** `AdminInquiryMessageList` の props。 */
export type AdminInquiryMessageListProps = {
  /** 日付で区切った、確定しているやり取り。 */
  days: readonly ConversationDay[];
  /** まだ応答が返っていない回答。識別子を伴う理由は利用者側と同じ。 */
  pending: readonly AdminInquiryDraft[];
};

/** まだ応答が返っていない回答 1 件。 */
export type AdminInquiryDraft = {
  readonly id: string;
  readonly body: string;
};

function AdminInquiryMessageRow({ message }: { message: InquiryMessage }) {
  const mine = message.authorKind === INQUIRY_AUTHOR_KIND.operator;

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
 * 運営から見たやり取りの並び。
 *
 * @remarks
 * 取得も並べ替えも持たず、確定した並びを描くだけです。日付の区切りを挟む理由は利用者側と
 * 同じで、時刻だけを見せているためです。
 */
export const AdminInquiryMessageList = withPartSpan(
  "features/admin/inquiries/detail/ui/message-list/message-list",
  ({ days, pending }: AdminInquiryMessageListProps) => {
    return (
      <div className="flex flex-col gap-4">
        {days.map((day) => (
          <Fragment key={day.day}>
            <Marker variant={MARKER_VARIANT.SEPARATOR}>
              <MarkerContent>{day.day}</MarkerContent>
            </Marker>
            <MessageGroup>
              {day.messages.map((message) => (
                <AdminInquiryMessageRow key={message.id} message={message} />
              ))}
            </MessageGroup>
          </Fragment>
        ))}

        {pending.length === 0 ? null : (
          <MessageGroup>
            {pending.map((draft) => (
              <Message align={MESSAGE_ALIGN.END} key={draft.id}>
                <MessageContent>
                  <MessageHeader>{AUTHOR_LABEL[INQUIRY_AUTHOR_KIND.operator]}</MessageHeader>
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
