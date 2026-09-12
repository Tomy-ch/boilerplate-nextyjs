"use client";

import { useRouter } from "next/navigation";

import {
  INQUIRY_FEED_STREAM_TICKET_PATH,
  inquiryFeedEventSchema,
} from "@/adapters/client/api/inquiries";
import { useStream } from "@/adapters/client/stream/use-stream";
import { useOnlineStatus } from "@/capabilities/use-online-status";
import { ConnectionStatus } from "@/components/app-starter/connection-status/connection-status";
import { withPartSpan } from "@/observability/render-span";

import { toFeedConnectionStatus } from "../../../connection-status";

/**
 * 更新のあった問い合わせを拾い、一覧を取り直す。
 *
 * @remarks
 * **届いた内容で一覧を書き換えません。** フィードが運ぶのは「どの問い合わせがどこまで進んだか」
 * だけで、並び順を決める更新日時も、表に出している他の列も入っていません。手元で行を差し替えると、
 * 取り直した一覧と食い違います。
 *
 * **開始位置を渡しません。** 一覧の取得はフィードの位置を返さないため、購読は発券が束ねた位置
 * から始まります。繋ぎ直しの前後で取りこぼした更新は次の更新で取り返され、取り返される前に
 * 見えているのは 1 回ぶん古い一覧です。取り直しを求められたときに再開の位置を返さないのも
 * 同じ理由で、購読はそれを見込んで自分で張り直します。
 */
export const AdminInquiryFeedWatch = withPartSpan(
  "features/admin/inquiries/list/ui/feed-watch/feed-watch",
  () => {
    const router = useRouter();
    const online = useOnlineStatus();

    const { state } = useStream({
      ticketPath: INQUIRY_FEED_STREAM_TICKET_PATH,
      initialCursor: null,
      schema: inquiryFeedEventSchema,
      onEvents: () => {
        router.refresh();
      },
      onResync: () => {
        router.refresh();
      },
    });

    return <ConnectionStatus status={toFeedConnectionStatus(state, online)} />;
  },
);
