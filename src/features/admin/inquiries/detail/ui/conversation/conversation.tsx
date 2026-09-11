"use client";

import { useRouter } from "next/navigation";
import { useActionState, useCallback, useOptimistic, useState } from "react";

import {
  INQUIRY_FEED_STREAM_TICKET_PATH,
  inquiryFeedEventSchema,
  toUpdatedInquiryId,
} from "@/adapters/client/api/inquiries";
import { useStream } from "@/adapters/client/stream/use-stream";
import { useOnlineStatus } from "@/capabilities/use-online-status";
import { ConnectionStatus } from "@/components/app-starter/connection-status/connection-status";
import { FormFeedback } from "@/components/app-starter/form-feedback/form-feedback";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerViewport,
} from "@/components/design-system/container/message-scroller/message-scroller";
import { idleActionState } from "@/model/action-state";
import { newIdempotencyKey } from "@/model/idempotency-key";
import { toConversationDays } from "@/model/inquiry/conversation";
import type { InquiryHistory, InquiryId } from "@/model/inquiry/inquiry";

import { replyInquiryAction } from "../../../actions";
import { toFeedConnectionStatus } from "../../../connection-status";
import { REPLY_BODY_FIELD } from "../../../form-names";
import { type AdminInquiryDraft, AdminInquiryMessageList } from "../message-list/message-list";
import { AdminInquiryReplyForm } from "../reply-form/reply-form";

/** 送信中のものがまだ 1 件も無い状態。描画のたびに新しい配列を作らない。 */
const NO_PENDING: readonly AdminInquiryDraft[] = [];

const VIEWPORT_LABEL = "利用者とのやり取り";

const FAILURE_TITLE = "回答を送信できませんでした";

/** `AdminInquiryConversation` の props。 */
export type AdminInquiryConversationProps = {
  /** 回答先。 */
  inquiryId: InquiryId;
  /** 取得した正本。 */
  history: InquiryHistory;
};

/**
 * 運営から見たやり取りと、回答の送信。
 *
 * @remarks
 * **この画面は会話そのものを購読しません。** 契約が持つ購読の口は「自分の問い合わせ」と
 * 「更新フィード」の 2 つで、運営が任意の 1 件を直接購読する口はありません。代わりに
 * フィードを購読し、開いている問い合わせが動いたときだけ正本を取り直します。
 *
 * したがって新しい 1 通は、届いた本文ではなく取り直した正本として現れます。フィードが運ぶのは
 * 本文を含まない更新の事実だけなので、これは遠回りではなく唯一の経路です。
 */
export function AdminInquiryConversation({ history, inquiryId }: AdminInquiryConversationProps) {
  const router = useRouter();
  const online = useOnlineStatus();

  const [state, formAction, pending] = useActionState(replyInquiryAction, idleActionState());
  const [sending, addSending] = useOptimistic<readonly AdminInquiryDraft[], AdminInquiryDraft>(
    NO_PENDING,
    (current, draft) => [...current, draft],
  );
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [seenState, setSeenState] = useState(state);

  // 成立した回答は、次の 1 通と同じ鍵で飛ばない。通らなかった送信を送り直す間は同じ鍵のままにする。
  if (seenState !== state) {
    setSeenState(state);

    if (state.status === "success") {
      setIdempotencyKey(newIdempotencyKey());
    }
  }

  const reply = useCallback(
    (formData: FormData) => {
      addSending({ id: idempotencyKey, body: String(formData.get(REPLY_BODY_FIELD) ?? "") });
      formAction(formData);
    },
    [addSending, formAction, idempotencyKey],
  );

  const { state: streamState } = useStream({
    ticketPath: INQUIRY_FEED_STREAM_TICKET_PATH,
    initialCursor: null,
    schema: inquiryFeedEventSchema,
    onEvents: (events) => {
      if (events.some((event) => toUpdatedInquiryId(event) === inquiryId)) {
        router.refresh();
      }
    },
    onResync: () => {
      router.refresh();
    },
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex justify-center">
        <ConnectionStatus status={toFeedConnectionStatus(streamState, online)} />
      </div>

      <MessageScroller className="min-h-0 flex-1">
        <MessageScrollerViewport aria-label={VIEWPORT_LABEL} className="px-1">
          <MessageScrollerContent>
            <AdminInquiryMessageList
              days={toConversationDays(history.messages)}
              pending={sending}
            />
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>

      {state.status === "error" && state.formError !== null ? (
        <FormFeedback description={state.formError} title={FAILURE_TITLE} variant="destructive" />
      ) : null}

      <AdminInquiryReplyForm
        action={reply}
        idempotencyKey={idempotencyKey}
        inquiryId={inquiryId}
        pending={pending}
        state={state}
      />
    </div>
  );
}
