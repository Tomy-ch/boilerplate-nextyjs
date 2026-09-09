import type { Metadata } from "next";
import { Suspense } from "react";

import { ContentContainer } from "@/components/shell/content-container/content-container";
import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
} from "@/components/shell/page-header/page-header";
import { AdminProductListPageContent } from "@/features/admin/products/list/page-content";
import { AdminProductListSkeleton } from "@/features/admin/products/list/ui/skeleton/skeleton";
import type { RawSearchParams } from "@/model/search-params";

export const metadata: Metadata = {
  title: "商品一覧管理",
  robots: { index: false, follow: false },
};

/**
 * 一覧の中身。
 *
 * @remarks
 * **`searchParams` を解くのはここです。** 器の側で待つと、待っている間は殻すら配れません。
 * 器は promise のまま渡し、穴の内側で解きます。
 */
async function AdminProductListContent({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return <AdminProductListPageContent searchParams={await searchParams} />;
}

/**
 * 管理側の商品一覧管理。
 *
 * @remarks
 * 索引に載せない理由は `docs/spec/route/admin/layout.function.md`「索引に載せない」。
 */
export default function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return (
    <ContentContainer className="py-8">
      <PageHeader>
        <div>
          <PageHeaderTitle>商品一覧管理</PageHeaderTitle>
          <PageHeaderDescription>
            未公開を含むすべての商品を確認し、作成・編集・在庫の補充へ進みます。
          </PageHeaderDescription>
        </div>
      </PageHeader>
      <Suspense fallback={<AdminProductListSkeleton />}>
        <AdminProductListContent searchParams={searchParams} />
      </Suspense>
    </ContentContainer>
  );
}
