import type { Metadata } from "next";
import { Suspense } from "react";

import { ContentContainer } from "@/components/shell/content-container/content-container";
import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
} from "@/components/shell/page-header/page-header";
import { AdminInquiryListPageContent } from "@/features/admin/inquiries/list/page-content";
import { AdminInquiryListSkeleton } from "@/features/admin/inquiries/list/ui/skeleton/skeleton";
import type { RawSearchParams } from "@/model/search-params";

export const metadata: Metadata = {
  title: "問い合わせ一覧",
  robots: { index: false, follow: false },
};

/**
 * 一覧の中身。
 *
 * @remarks
 * **`searchParams` を解くのはここです。** 器の側で待つと、待っている間は殻すら配れません。
 */
async function AdminInquiryListContent({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return <AdminInquiryListPageContent searchParams={await searchParams} />;
}

/**
 * 問い合わせを一覧で見る画面。
 *
 * @remarks
 * 索引に載せない理由は `docs/spec/route/admin/layout.function.md`「索引に載せない」。
 */
export default function AdminInquiryListPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return (
    <ContentContainer className="py-8">
      <PageHeader>
        <div>
          <PageHeaderTitle>問い合わせ一覧</PageHeaderTitle>
          <PageHeaderDescription>
            利用者から届いた問い合わせを確認し、回答します。
          </PageHeaderDescription>
        </div>
      </PageHeader>
      <Suspense fallback={<AdminInquiryListSkeleton />}>
        <AdminInquiryListContent searchParams={searchParams} />
      </Suspense>
    </ContentContainer>
  );
}
