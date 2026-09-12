import type { Metadata } from "next";
import { Suspense } from "react";

import { ContentContainer } from "@/components/shell/content-container/content-container";
import { MYPAGE_PATH } from "@/features/account/paths";
import { requireRegisteredUser } from "@/features/account/registration-gate";
import { InquiryThreadPageContent } from "@/features/inquiry/thread/page-content";
import { InquiryThreadSkeleton } from "@/features/inquiry/thread/ui/skeleton/skeleton";

export const metadata: Metadata = {
  title: "お問い合わせ",
  description: "サポートとやり取りできます。",
  robots: { index: false, follow: false },
};

/**
 * 問い合わせの中身。
 *
 * @remarks
 * 登録済みかの判定を穴の内側で行う理由は、マイページ（`../page.tsx`）と同じです。
 */
async function InquiryContent() {
  await requireRegisteredUser(MYPAGE_PATH);

  return <InquiryThreadPageContent />;
}

/**
 * お問い合わせ。
 *
 * @remarks
 * **見出しを置きません。** 画面の高さいっぱいをやり取りと送信欄で使うためで、この画面が何かは
 * global nav とタブのタイトルが示します。見出しを置くと、その高さぶんだけやり取りが縮みます。
 *
 * 確定認可をここで通します。`proxy.ts` の判定は前捌きです。
 */
export default function InquiryPage() {
  return (
    <ContentContainer className="py-4">
      <Suspense fallback={<InquiryThreadSkeleton />}>
        <InquiryContent />
      </Suspense>
    </ContentContainer>
  );
}
