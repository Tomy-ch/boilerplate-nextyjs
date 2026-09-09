import type { Metadata } from "next";
import { Suspense } from "react";
import { ContentContainer } from "@/components/shell/content-container/content-container";
import { resolveProductMetadata } from "@/features/products/detail/metadata";
import { ProductDetailPageContent } from "@/features/products/detail/page-content";
import { ProductDetailSkeleton } from "@/features/products/detail/ui/skeleton/skeleton";

/**
 * 商品ごとの metadata。題・要約・正規 URL を商品から採り、見つからなければ `noindex` を名乗る。
 *
 * @remarks
 * 判定は feature 側（`detail/metadata.ts`）が持ち、ここは `params` を解いて渡すだけです。
 * 中身は殻と一緒には決まらず、穴の中身と同じ取得を待って流れます。
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  return resolveProductMetadata(id);
}

/**
 * 商品の中身。
 *
 * @remarks
 * **取得と判定を解くのはここです。** 器の側で待つと、待っている間は殻すら配れません。
 * 器は promise のまま渡し、穴の内側で解きます。
 *
 * **存在しない ID でも 200 が返ります。** 見つからないことは画面と `noindex` が伝え、その理由は
 * {@link generateMetadata} が呼ぶ `detail/metadata.ts` が持ちます。
 */
async function ProductDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return <ProductDetailPageContent id={id} />;
}

/**
 * 商品詳細の route segment。
 *
 * @remarks
 * 殻（`ContentContainer`）と待ちの境界をここで確定させ、取得を待つ穴は `ProductDetailContent` の
 * 内側に閉じます。取得も組み立ても持ちません。
 */
export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <ContentContainer className="py-8">
      <Suspense fallback={<ProductDetailSkeleton />}>
        <ProductDetailContent params={params} />
      </Suspense>
    </ContentContainer>
  );
}
