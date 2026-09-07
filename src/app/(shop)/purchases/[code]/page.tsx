import type { Metadata } from "next";
import { Suspense } from "react";
import { ContentContainer } from "@/components/shell/content-container/content-container";
import { requireRegisteredUser } from "@/features/account/registration-gate";
import { PurchaseDetailPageContent } from "@/features/purchases/detail/page-content";
import { PurchaseDetailSkeleton } from "@/features/purchases/detail/ui/skeleton/skeleton";
import { purchaseDetailPath } from "@/features/purchases/facade/paths/paths";

export const metadata: Metadata = {
  title: "購入詳細",
  description: "購入 1 件の控えと明細を確認できます。",
  robots: { index: false, follow: false },
};

/**
 * 控えの中身。
 *
 * @remarks
 * **取得と判定を解くのはここです。** 器の側で待つと、待っている間は殻すら配れません。
 * 器は promise のまま渡し、穴の内側で解きます。
 *
 * 確定認可もここで通します。`proxy.ts` の判定は前捌きです。
 *
 * **存在しない購入でも 200 が返ります。** 殻を先に流すため、`notFound()` に達した時点で応答の
 * ヘッダは出ています。書き方では解けないので、見つからないことは画面と `noindex` が伝えます。
 */
async function PurchaseDetailContent({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  await requireRegisteredUser(purchaseDetailPath(code));

  return <PurchaseDetailPageContent purchaseCode={code} />;
}

/**
 * 購入詳細。
 *
 * @remarks
 * 見出しを置きません。この画面の見出しはパンくずの現在地（注文番号）が担っており、
 * `PageHeader` を重ねると同じ識別子が 2 度並びます。
 */
export default function PurchaseDetailPage({ params }: { params: Promise<{ code: string }> }) {
  return (
    <ContentContainer className="py-8">
      <Suspense fallback={<PurchaseDetailSkeleton />}>
        <PurchaseDetailContent params={params} />
      </Suspense>
    </ContentContainer>
  );
}
