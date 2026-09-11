import type { Metadata } from "next";
import { Suspense } from "react";
import { ContentContainer } from "@/components/shell/content-container/content-container";
import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
} from "@/components/shell/page-header/page-header";
import { CheckoutCompletePageContent } from "@/features/checkout/complete/page-content";
import { CheckoutCompleteSkeleton } from "@/features/checkout/complete/ui/skeleton/skeleton";
import type { RawSearchParams } from "@/model/search-params";

export const metadata: Metadata = {
  title: "購入完了",
  description: "確定した注文の控えと内訳を確認できます。",
  robots: { index: false, follow: false },
};

/**
 * 控えの中身。
 *
 * @remarks
 * **取得と判定を解くのはここです。** 器の側で待つと、待っている間は殻すら配れません。
 * 器は promise のまま渡し、穴の内側で解きます。
 *
 * **指し先の無い URL でも 200 が返ります。** 殻を先に流すため、`notFound()` に達した時点で応答の
 * ヘッダは出ています。書き方では解けないので、見つからないことは画面と `noindex` が伝えます。
 */
async function CheckoutCompleteContent({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return <CheckoutCompletePageContent searchParams={await searchParams} />;
}

/**
 * 購入完了。取得を待たず、殻と待機表示だけを先に配る route segment。
 */
export default function CheckoutCompletePage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return (
    <ContentContainer className="py-8">
      <PageHeader>
        <div>
          <PageHeaderTitle>購入完了</PageHeaderTitle>
          <PageHeaderDescription>
            ご注文を承りました。控えは後からも確認できます。
          </PageHeaderDescription>
        </div>
      </PageHeader>
      <Suspense fallback={<CheckoutCompleteSkeleton />}>
        <CheckoutCompleteContent searchParams={searchParams} />
      </Suspense>
    </ContentContainer>
  );
}
