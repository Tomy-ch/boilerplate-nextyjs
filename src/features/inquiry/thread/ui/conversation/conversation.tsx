"use client";

import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useOptimistic, useRef, useState } from "react";

import {
  INQUIRY_STREAM_TICKET_PATH,
  inquiryConversationEventSchema,
  toInquiryMessage,
} from "@/adapters/client/api/inquiries";
import { toStreamCursor } from "@/adapters/client/stream/cursor";
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
import { mergeMessages, pruneApplied, toConversationDays } from "@/model/inquiry/conversation";
import type { InquiryHistory, InquiryMessage } from "@/model/inquiry/inquiry";

import { sendInquiryMessageAction } from "../../../actions";
import { toConnectionStatus } from "../../../connection-status";
import { INQUIRY_BODY_FIELD } from "../../../form-names";
import { InquiryComposer } from "../composer/composer";
import { type InquiryDraft, InquiryMessageList } from "../message-list/message-list";

/** 受け取ったものがまだ 1 件も無い状態。描画のたびに新しい配列を作らない。 */
const NO_MESSAGES: readonly InquiryMessage[] = [];

/** 送信中のものがまだ 1 件も無い状態。 */
const NO_PENDING: readonly InquiryDraft[] = [];

const VIEWPORT_LABEL = "サポートとのやり取り";

const EMPTY_MESSAGE = "まだやり取りはありません。ご用件をお送りください。";

const FAILURE_TITLE = "送信できませんでした";

/** `InquiryConversation` の props。 */
export type InquiryConversationProps = {
  /** 取得した正本と、購読の開始位置。 */
  history: InquiryHistory;
};

/**
 * やり取りの表示と送信。
 *
 * @remarks
 * **正本は props で届き、その続きだけをここが持ちます。** 購読が運ぶのは「まだ取り直していない
 * 追記分」であって、取得した一覧の写しではありません。画面を離れれば次の取得が最新を返すため、
 * ここが持つものが消えても正しさは壊れません。
 *
 * **取り直しの合図は購読から来ます。** 窓を越えて遅れた event を見つけた購読は、届いた位置へ
 * 挿し込む代わりに正本の取り直しを求めます。取り直した応答が持つ新しい開始位置で購読を再開
 * するまで、購読は張り直しません。
 *
 * まだ 1 通も無い利用者では購読を始めません。問い合わせが作られるのは最初の送信のときで、
 * それまで購読する対象が存在しないためです。
 */
export function InquiryConversation({ history }: InquiryConversationProps) {
  const router = useRouter();
  const online = useOnlineStatus();

  const [appended, setAppended] = useState<readonly InquiryMessage[]>(NO_MESSAGES);
  const [state, formAction, pending] = useActionState(sendInquiryMessageAction, idleActionState());
  const [sending, addSending] = useOptimistic<readonly InquiryDraft[], InquiryDraft>(
    NO_PENDING,
    (current, draft) => [...current, draft],
  );
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [seenState, setSeenState] = useState(state);

  // 成立した送信は、次の 1 通と同じ鍵で飛ばない。通らなかった送信を送り直す間は同じ鍵のままに
  // して、応答が届かなかっただけの送信が 2 通にならないようにする。
  if (seenState !== state) {
    setSeenState(state);

    if (state.status === "success") {
      setIdempotencyKey(newIdempotencyKey());
    }
  }

  const { state: streamState, resume } = useStream({
    ticketPath: INQUIRY_STREAM_TICKET_PATH,
    initialCursor: toStreamCursor(history.streamCursor),
    schema: inquiryConversationEventSchema,
    enabled: history.inquiryId !== null,
    onEvents: (events) => {
      setAppended((current) => [...current, ...events.map(toInquiryMessage)]);
    },
    onResync: () => {
      router.refresh();
    },
  });

  const applied = useRef(history.streamCursor);

  useEffect(() => {
    if (applied.current === history.streamCursor) {
      return;
    }

    applied.current = history.streamCursor;
    setAppended((current) => pruneApplied(current, history.streamCursor));
    resume(toStreamCursor(history.streamCursor));
  }, [history.streamCursor, resume]);

  const send = useCallback(
    (formData: FormData) => {
      addSending({ id: idempotencyKey, body: String(formData.get(INQUIRY_BODY_FIELD) ?? "") });
      formAction(formData);
    },
    [addSending, formAction, idempotencyKey],
  );

  const messages = mergeMessages(history.messages, appended);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex justify-center">
        <ConnectionStatus
          status={toConnectionStatus(streamState, {
            online,
            subscribing: history.inquiryId !== null,
          })}
        />
      </div>

      <MessageScroller className="min-h-0 flex-1">
        <MessageScrollerViewport aria-label={VIEWPORT_LABEL} className="px-1">
          <MessageScrollerContent>
            {messages.length === 0 && sending.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">{EMPTY_MESSAGE}</p>
            ) : (
              <InquiryMessageList days={toConversationDays(messages)} pending={sending} />
            )}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>

      {state.status === "error" && state.formError !== null ? (
        <FormFeedback description={state.formError} title={FAILURE_TITLE} variant="destructive" />
      ) : null}

      <InquiryComposer
        action={send}
        idempotencyKey={idempotencyKey}
        pending={pending}
        state={state}
      />
    </div>
  );
}
