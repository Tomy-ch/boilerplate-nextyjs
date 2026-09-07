import type { Metadata } from "next";
import { Suspense } from "react";

import { ContentContainer } from "@/components/shell/content-container/content-container";
import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
} from "@/components/shell/page-header/page-header";
import { MypagePageContent } from "@/features/account/mypage/page-content";
import { MypageSkeleton } from "@/features/account/mypage/ui/skeleton/skeleton";
import { MYPAGE_PATH } from "@/features/account/paths";
import { requireRegisteredUser } from "@/features/account/registration-gate";

export const metadata: Metadata = {
  title: "マイページ",
  description: "登録情報と購入の集計を確認できます。",
  robots: { index: false, follow: false },
};

/**
 * マイページの中身。
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
async function MypageContent() {
  await requireRegisteredUser(MYPAGE_PATH);

  return <MypagePageContent />;
}

/**
 * マイページ。
 *
 * @remarks
 * 確定認可をここで通します。`proxy.ts` の判定は前捌きです。
 *
 * パンくずは置きません。global nav がこの画面を直接指しており、階層が 1 段だからです。
 */
export default function MypagePage() {
  return (
    <ContentContainer className="py-8">
      <PageHeader>
        <div>
          <PageHeaderTitle>マイページ</PageHeaderTitle>
          <PageHeaderDescription>登録情報と購入の集計を確認できます。</PageHeaderDescription>
        </div>
      </PageHeader>
      <Suspense fallback={<MypageSkeleton />}>
        <MypageContent />
      </Suspense>
    </ContentContainer>
  );
}
