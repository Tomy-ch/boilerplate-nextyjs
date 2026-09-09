import type { Metadata } from "next";
import { Suspense } from "react";

import { ContentContainer } from "@/components/shell/content-container/content-container";
import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
} from "@/components/shell/page-header/page-header";
import { ProfileEditPageContent } from "@/features/account/edit/page-content";
import { ProfileEditSkeleton } from "@/features/account/edit/ui/skeleton/skeleton";
import { PROFILE_EDIT_PATH } from "@/features/account/paths";
import { requireRegisteredUser } from "@/features/account/registration-gate";

export const metadata: Metadata = {
  title: "プロフィール編集",
  description: "登録情報を変更できます。",
  robots: { index: false, follow: false },
};

/**
 * プロフィール編集の中身。
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
async function ProfileEditContent() {
  await requireRegisteredUser(PROFILE_EDIT_PATH);

  return <ProfileEditPageContent />;
}

/**
 * プロフィール編集。
 *
 * @remarks
 * マイページとは独立したルートです。1 つの画面に表示と編集を同居させると、どちらの状態で
 * 開いているかが URL から失われ、戻る操作も共有もできなくなります。
 */
export default function ProfileEditPage() {
  return (
    <ContentContainer className="py-8">
      <PageHeader>
        <div>
          <PageHeaderTitle>プロフィール編集</PageHeaderTitle>
          <PageHeaderDescription>登録情報を変更できます。</PageHeaderDescription>
        </div>
      </PageHeader>
      <Suspense fallback={<ProfileEditSkeleton />}>
        <ProfileEditContent />
      </Suspense>
    </ContentContainer>
  );
}
