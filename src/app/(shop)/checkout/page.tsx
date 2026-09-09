import type { Metadata } from "next";
import { Suspense } from "react";

import { ContentContainer } from "@/components/shell/content-container/content-container";
import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
} from "@/components/shell/page-header/page-header";
import { requireRegisteredUser } from "@/features/account/registration-gate";
import { CheckoutConfirmPageContent } from "@/features/checkout/confirm/page-content";
import { CheckoutConfirmSkeleton } from "@/features/checkout/confirm/ui/skeleton/skeleton";
import { CHECKOUT_PATH } from "@/features/checkout/paths";

export const metadata: Metadata = {
  title: "購入確認",
  description: "お届け先と注文内容を確かめて、注文を確定できます。",
  robots: { index: false, follow: false },
};

/**
 * 購入確認の中身。
 *
 * @remarks
 * **登録済みかの判定を穴の内側で行います。** 器の側で待つと、待っている間は殻すら配れません。
 * 殻に主体の情報は載りません。
 *
 * **送り返しは殻を配り終えた後になります。** 応答は既に 200 で出ているため、転送は `Location`
 * ヘッダではなく meta タグで伝わります。未認証の来訪は `proxy.ts` が入口で本物の転送として
 * 捌くので、ここまで届くのは「認証済みだが登録が済んでいない」場合だけです。登録の有無は
 * バックエンドに問わないと分からず、入口では判定できません。
 */
async function CheckoutConfirmContent() {
  await requireRegisteredUser(CHECKOUT_PATH);

  return <CheckoutConfirmPageContent />;
}

/**
 * 購入確認。
 *
 * @remarks
 * 認証の内側にあります。確定認可をここで通します。`proxy.ts` の判定は前捌きです。
 * 登録がまだの主体も止めます。購入を結び付ける先の利用者がまだ無いためです。
 */
export default function CheckoutPage() {
  return (
    <ContentContainer className="py-8">
      <PageHeader>
        <div>
          <PageHeaderTitle>購入確認</PageHeaderTitle>
          <PageHeaderDescription>
            内容を確かめて注文を確定します。確定するまで購入は成立しません。
          </PageHeaderDescription>
        </div>
      </PageHeader>
      <Suspense fallback={<CheckoutConfirmSkeleton />}>
        <CheckoutConfirmContent />
      </Suspense>
    </ContentContainer>
  );
}
