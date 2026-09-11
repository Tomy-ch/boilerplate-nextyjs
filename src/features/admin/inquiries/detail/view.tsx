import {
  KeyValueItem,
  KeyValueLabel,
  KeyValueList,
  KeyValueValue,
} from "@/components/design-system/display/key-value-list/key-value-list";
import { formatDateTime } from "@/model/datetime";
import type { InquiryHistory, InquiryId } from "@/model/inquiry/inquiry";
import { withScreenSpan } from "@/observability/render-span";

import { AdminInquiryConversation } from "./ui/conversation/conversation";

/** `AdminInquiryDetailView` の props。 */
export type AdminInquiryDetailViewProps = {
  /** 開いている問い合わせ。 */
  inquiryId: InquiryId;
  /** 取得した正本。 */
  history: InquiryHistory;
};

/**
 * 問い合わせ 1 件の全画面表示。
 *
 * @remarks
 * **やり取りだけが枠の中で流れ、回答欄は下端に残ります。** 理由は利用者側の画面と同じで、
 * 打ちながら直前のやり取りが見える状態を保つためです。
 *
 * **誰の問い合わせかを出せません。** 契約が返すメッセージは送り手の種別しか持たず、利用者の
 * 識別子は一覧の行だけが持ちます。代わりに問い合わせの識別子を出し、一覧の行と突き合わせられる
 * ようにしています。
 */
export const AdminInquiryDetailView = withScreenSpan(
  "features/admin/inquiries/detail/view",
  ({ history, inquiryId }: AdminInquiryDetailViewProps) => {
    const first = history.messages.at(0);

    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <KeyValueList>
          <KeyValueItem>
            <KeyValueLabel>問い合わせ</KeyValueLabel>
            <KeyValueValue className="break-all">{inquiryId}</KeyValueValue>
          </KeyValueItem>
          <KeyValueItem>
            <KeyValueLabel>開始</KeyValueLabel>
            <KeyValueValue>
              {first === undefined ? "まだやり取りがありません" : formatDateTime(first.createdAt)}
            </KeyValueValue>
          </KeyValueItem>
        </KeyValueList>

        <AdminInquiryConversation history={history} inquiryId={inquiryId} />
      </div>
    );
  },
);
