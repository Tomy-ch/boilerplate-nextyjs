import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ContentContainer } from "@/components/shell/content-container/content-container";
import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
} from "@/components/shell/page-header/page-header";
import { getClockConfig } from "@/config/clock/clock.server";
import { AdminDashboardPageContent } from "@/features/admin/dashboard/page-content";
import { AdminSummarySkeleton } from "@/features/admin/ui/skeleton/skeleton";

export const metadata: Metadata = {
  title: "ダッシュボード",
  robots: { index: false, follow: false },
};

/**
 * ダッシュボードの中身。
 *
 * @remarks
 * **「いま」を読むのは穴の内側です。** 実時計はプリレンダーの最中には値が定まらないため、
 * `connection()` を待って「要求のときに描く」ことを確定させてから読みます。
 */
async function AdminDashboardContent() {
  await connection();

  return <AdminDashboardPageContent now={getClockConfig().now()} />;
}

/**
 * 管理の入口。
 *
 * @remarks
 * 索引に載せない理由は `docs/spec/route/admin/layout.function.md`「索引に載せない」。器の下の
 * すべての画面に効きます。
 *
 * 集計はバックエンドが合成したものをそのまま出します。画面が計算を持たない理由は
 * `docs/spec/route/admin/page.function.md`「集計はフロントで作らない」、値の母集団は
 * `model/dashboard` の `DashboardSummary`。
 *
 * **「いま」をここで読んで渡します。** 暦日の区切りは要求のクエリに載るため、実時計を読む場所が
 * `features` の中にあると検証で固定できません（`config/clock`）。`config` を参照できるのは
 * `app` までで、合成の入口が外から来る値を解決するのは層の役目どおりです。
 */
export default function AdminDashboardPage() {
  return (
    <ContentContainer className="py-8">
      <PageHeader>
        <div>
          <PageHeaderTitle>ダッシュボード</PageHeaderTitle>
          <PageHeaderDescription>今日の売上と、注文の状況を確認します。</PageHeaderDescription>
        </div>
      </PageHeader>
      <Suspense fallback={<AdminSummarySkeleton />}>
        <AdminDashboardContent />
      </Suspense>
    </ContentContainer>
  );
}
