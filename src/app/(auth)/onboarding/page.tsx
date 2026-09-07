import type { Metadata } from "next";
import { Suspense } from "react";

import { ContentContainer } from "@/components/shell/content-container/content-container";
import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
} from "@/components/shell/page-header/page-header";
import { OnboardingPageContent } from "@/features/account/onboarding/page-content";
import { OnboardingSkeleton } from "@/features/account/onboarding/ui/skeleton/skeleton";
import { MYPAGE_PATH } from "@/features/account/paths";
import { requireUnregisteredUser } from "@/features/account/registration-gate";
import { toSafeReturnUrl } from "@/model/return-url";

export const metadata: Metadata = {
  title: "登録",
  description: "はじめて利用するときに、お届け先などの情報を登録します。",
  robots: { index: false, follow: false },
};

/**
 * 登録の中身。
 *
 * @remarks
 * **`searchParams` と登録済みかの判定を解くのはここです。** どちらも器の側で待つと、
 * 待っている間は殻すら配れません。
 *
 * 判定を穴の内側へ置いても、登録済みの主体を送り返す働きは変わりません。転送は描画の途中でも
 * 効き、殻を先に配ったぶんだけ早く判定へ入ります。
 */
async function OnboardingContent({
  searchParams,
}: {
  searchParams: Promise<{ returnUrl?: string }>;
}) {
  const { returnUrl } = await searchParams;
  const destination = toSafeReturnUrl(returnUrl ?? MYPAGE_PATH);

  await requireUnregisteredUser(destination);

  return <OnboardingPageContent returnUrl={destination} />;
}

/**
 * 登録（オンボーディング）。
 *
 * @remarks
 * 認証は済んでいるが利用者の記録がまだ無い主体だけが入れます。登録済みで踏んだ場合は戻り先へ
 * 送り返します。2 人目の利用者を作る操作を見せないためです。
 *
 * 利用者向けの shell ではなく認証の器に載せます。ここを通る主体は保護された画面のどれも開けず、
 * nav を出しても行ける先がありません。
 */
export default function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ returnUrl?: string }>;
}) {
  return (
    <ContentContainer className="py-8">
      <PageHeader>
        <div>
          <PageHeaderTitle>登録</PageHeaderTitle>
          <PageHeaderDescription>
            はじめての利用に必要な情報を登録します。登録が終わると、購入や購入履歴の確認ができます。
          </PageHeaderDescription>
        </div>
      </PageHeader>
      <Suspense fallback={<OnboardingSkeleton />}>
        <OnboardingContent searchParams={searchParams} />
      </Suspense>
    </ContentContainer>
  );
}
