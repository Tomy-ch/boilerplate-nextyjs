import { getMyInquiryHistory } from "@/adapters/server/api/inquiries";
import { withScreenSpan } from "@/observability/render-span";

import { InquiryThreadView } from "./view";

/**
 * 取得と組み立て。
 *
 * @remarks
 * **1 ページだけ取ります。** 古いやり取りを遡る導線はまだ置いておらず、取れる範囲を超える
 * 問い合わせは上端で切れます。
 *
 * この取得が返す位置が、そのまま購読の開始位置になります。取り直しのたびに新しい位置が届くので、
 * 購読と正本のあいだに隙間ができません。
 */
export const InquiryThreadPageContent = withScreenSpan(
  "features/inquiry/thread/page-content",
  async () => {
    return <InquiryThreadView history={await getMyInquiryHistory()} />;
  },
);
