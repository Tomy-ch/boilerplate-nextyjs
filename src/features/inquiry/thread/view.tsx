import { APP_SHELL_HEADER_HEIGHT } from "@/components/shell/app-shell/app-shell.definition";
import type { InquiryHistory } from "@/model/inquiry/inquiry";
import { withScreenSpan } from "@/observability/render-span";

import { InquiryConversation } from "./ui/conversation/conversation";

/** 画面の上下に空ける余白（`py-4` の合計）。器の高さから引く。 */
const VERTICAL_PADDING = "2rem";

/** `InquiryThreadView` の props。 */
export type InquiryThreadViewProps = {
  /** 取得した正本と、購読の開始位置。 */
  history: InquiryHistory;
};

/**
 * 問い合わせの全画面表示。
 *
 * @remarks
 * **画面そのものは縦にスクロールしません。** やり取りだけが枠の中で流れ、送信欄は常に下端に
 * 残ります。打ちながら直前のやり取りが見える状態を保つためで、画面ごと流れる形にすると、
 * 送るたびに下端まで辿り直すことになります。
 *
 * 高さは器の側で確定させます。中の枠は与えられた高さを分け合うだけなので、やり取りが何通あっても
 * 送信欄の位置は動きません。
 */
export const InquiryThreadView = withScreenSpan(
  "features/inquiry/thread/view",
  ({ history }: InquiryThreadViewProps) => {
    return (
      <div
        className="flex min-h-0 flex-col gap-4"
        style={{ height: `calc(100dvh - ${APP_SHELL_HEADER_HEIGHT}px - ${VERTICAL_PADDING})` }}
      >
        <InquiryConversation history={history} />
      </div>
    );
  },
);
