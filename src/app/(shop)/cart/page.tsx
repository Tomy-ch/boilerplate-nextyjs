import type { Metadata } from "next";
import { Suspense } from "react";
import { ContentContainer } from "@/components/shell/content-container/content-container";
import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
} from "@/components/shell/page-header/page-header";
import { CartPageContent } from "@/features/cart/page-content";
import { CartSkeleton } from "@/features/cart/ui/skeleton/skeleton";

export const metadata: Metadata = {
  title: "カート",
  description: "カートに入れた商品の数量を変えたり、取り除いたりできます。",
  robots: { index: false, follow: false },
};

/**
 * カート。
 *
 * @remarks
 * 認証を要しません。未ログインの利用者が中身を全画面で確かめられる唯一の経路であり、ここに
 * 認証を挟むと、脇の領域が出せない幅では中身を確かめる手段が無くなります。
 *
 * **待機表示は 1 つだけ置きます。** 見出しは殻に残し、中身だけを穴へ落とします。カートは外枠
 * （`(shop)/layout.tsx`）も読みますが、取得は 1 リクエストの中で memo 化されるため往復は増えません
 * （`adapters/server/api/cart.ts`）。境界をさらに割ると画面が二度継ぎ足され、読み始めた位置が
 * 動きます。
 */
export default function CartPage() {
  return (
    <ContentContainer className="py-8">
      <PageHeader>
        <div>
          <PageHeaderTitle>カート</PageHeaderTitle>
          <PageHeaderDescription>
            買えない明細や値の変わった明細は、その行に理由を添えています。
          </PageHeaderDescription>
        </div>
      </PageHeader>
      <Suspense fallback={<CartSkeleton />}>
        <CartPageContent />
      </Suspense>
    </ContentContainer>
  );
}
