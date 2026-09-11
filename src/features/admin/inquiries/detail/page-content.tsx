import { getInquiryHistory } from "@/adapters/server/api/inquiries";
import type { InquiryId } from "@/model/inquiry/inquiry";
import { withScreenSpan } from "@/observability/render-span";

import { AdminInquiryDetailView } from "./view";

/** `AdminInquiryDetailPageContent` の props。 */
export type AdminInquiryDetailPageContentProps = {
  /** route の動的セグメントが指す問い合わせ。 */
  inquiryId: InquiryId;
};

/**
 * 問い合わせ 1 件の取得と組み立て。
 *
 * @remarks
 * 1 ページだけ取ります。古いやり取りを遡る導線はまだ置いていません。
 */
export const AdminInquiryDetailPageContent = withScreenSpan(
  "features/admin/inquiries/detail/page-content",
  async ({ inquiryId }: AdminInquiryDetailPageContentProps) => {
    const history = await getInquiryHistory(inquiryId);

    return <AdminInquiryDetailView history={history} inquiryId={inquiryId} />;
  },
);
