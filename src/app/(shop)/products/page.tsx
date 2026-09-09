import type { Metadata } from "next";
import { Suspense } from "react";

import { ContentContainer } from "@/components/shell/content-container/content-container";
import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
} from "@/components/shell/page-header/page-header";
import { ProductListPageContent } from "@/features/products/list/page-content";
import { ProductListSkeleton } from "@/features/products/list/ui/skeleton/skeleton";
import type { RawSearchParams } from "@/model/search-params";

export const metadata: Metadata = {
  title: "商品一覧",
  description: "取り扱っている商品を検索して一覧で確認できます。",
  alternates: { canonical: "/products" },
};

/**
 * 一覧の中身。
 *
 * @remarks
 * **`searchParams` を解くのはここです。** 器の側で待つと、待っている間は殻すら配れません。
 * 器は promise のまま渡し、穴の内側で解きます。
 */
async function ProductListContent({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  return <ProductListPageContent searchParams={await searchParams} />;
}

/**
 * 商品一覧。
 *
 * @remarks
 * `Suspense` に鍵を与えません。条件が変わったときに取り直す範囲は
 * [`page-content.tsx`](../../../features/products/list/page-content.tsx) の内側で区切られており、
 * ここで鍵を与えると絞り込みの入力欄まで待機表示へ落ちます。この境界が受け持つのは初回の
 * 組み立てだけです。
 */
export default function ProductsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  return (
    <ContentContainer className="py-8">
      <PageHeader>
        <div>
          <PageHeaderTitle>商品一覧</PageHeaderTitle>
          <PageHeaderDescription>取り扱っている商品を検索できます。</PageHeaderDescription>
        </div>
      </PageHeader>
      <Suspense fallback={<ProductListSkeleton />}>
        <ProductListContent searchParams={searchParams} />
      </Suspense>
    </ContentContainer>
  );
}
