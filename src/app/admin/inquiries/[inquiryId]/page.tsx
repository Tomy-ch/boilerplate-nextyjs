import type { Metadata } from "next";
import { Suspense } from "react";

import { ContentContainer } from "@/components/shell/content-container/content-container";
import { AdminInquiryDetailPageContent } from "@/features/admin/inquiries/detail/page-content";
import { AdminInquiryDetailSkeleton } from "@/features/admin/inquiries/detail/ui/skeleton/skeleton";
import { toInquiryId } from "@/model/inquiry/inquiry";

export const metadata: Metadata = {
  title: "問い合わせの対応",
  robots: { index: false, follow: false },
};

/**
 * やり取りの中身。
 *
 * @remarks
 * **動的セグメントを確定させるのはここです。** 器の側で待つと、待っている間は殻すら配れません。
 * 識別子の形が契約に合わない要求は、取得が `not-found` として返します。
 */
async function AdminInquiryDetailContent({ params }: { params: Promise<{ inquiryId: string }> }) {
  const { inquiryId } = await params;

  return <AdminInquiryDetailPageContent inquiryId={toInquiryId(inquiryId)} />;
}

/**
 * 問い合わせ 1 件に回答する画面。
 *
 * @remarks
 * 一覧と別のルートにします。1 つの画面に一覧と対応を同居させると、どの問い合わせを開いているかが
 * URL から失われ、戻る操作も共有もできなくなります。
 */
export default function AdminInquiryDetailPage({
  params,
}: {
  params: Promise<{ inquiryId: string }>;
}) {
  return (
    <ContentContainer className="py-8">
      <Suspense fallback={<AdminInquiryDetailSkeleton />}>
        <AdminInquiryDetailContent params={params} />
      </Suspense>
    </ContentContainer>
  );
}
