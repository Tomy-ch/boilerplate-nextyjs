import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import Link from "next/link";
import type { ReactElement } from "react";
import { userEvent, within } from "storybook/test";

import { Button } from "@/components/design-system/action/button/button";
import { AdminShell } from "@/components/shell/admin-shell/admin-shell";
import type { AdminShellNavGroup } from "@/components/shell/admin-shell/admin-shell.definition";
import { ContentContainer } from "@/components/shell/content-container/content-container";
import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
} from "@/components/shell/page-header/page-header";
import type { DashboardSummary, PurchaseStatusCount } from "@/model/dashboard/dashboard";

import { ADMIN_ANALYTICS_PATH, ADMIN_DASHBOARD_PATH, ADMIN_PRODUCT_LIST_PATH } from "../paths";
import { toSummaryCards } from "../summary-cards";
import { AdminSummarySkeleton } from "../ui/skeleton/skeleton";
import { StatCards } from "../ui/stat-cards/stat-cards";
import { StatusBreakdown } from "../ui/status-breakdown/status-breakdown";
import { RANKING_ROWS } from "./analytics.fixture";
import { DASHBOARD_PERIOD } from "./period";
import { RankingTable } from "./ui/ranking-table/ranking-table";
import { AnalyticsView } from "./view";

const NAV_GROUPS: readonly AdminShellNavGroup[] = [
  {
    label: "集計",
    items: [
      { href: ADMIN_DASHBOARD_PATH, label: "ダッシュボード" },
      { href: ADMIN_ANALYTICS_PATH, label: "期間別の集計" },
    ],
  },
  { label: "商品", items: [{ href: ADMIN_PRODUCT_LIST_PATH, label: "商品一覧管理" }] },
];

/** route と同じ器で包む。`admin/layout.tsx` の shell と `page.tsx` の見出しを再現する。 */
function withPageFrame(Story: () => ReactElement) {
  return (
    <AdminShell
      consoleName="管理"
      headerActions={
        <Button asChild size="sm" variant="outline">
          <Link href="/products">ユーザー画面へ</Link>
        </Button>
      }
      homeHref={ADMIN_DASHBOARD_PATH}
      navGroups={NAV_GROUPS}
      siteHref="/"
      siteName="nextjs-boilerplate"
    >
      <ContentContainer className="py-8">
        <PageHeader>
          <div>
            <PageHeaderTitle>集計</PageHeaderTitle>
            <PageHeaderDescription>
              期間を選んで売上と注文の状況を読み、売れ筋の商品を確認します。
            </PageHeaderDescription>
          </div>
        </PageHeader>
        <Story />
      </ContentContainer>
    </AdminShell>
  );
}

let statusSeq = 0;

function count(statusName: string, value: number): PurchaseStatusCount {
  statusSeq += 1;

  return {
    statusId: `0195f0c2-2000-7000-8000-${String(statusSeq).padStart(12, "0")}`,
    statusName,
    count: value,
  };
}

const SUMMARY: DashboardSummary = {
  salesAmount: 824_695,
  salesCount: 24,
  purchaseStatusCounts: [
    count("未処理", 7),
    count("受付中", 4),
    count("確認中", 3),
    count("処理中", 4),
    count("完了", 1),
    count("キャンセル", 1),
    count("支払い済み", 4),
    count("発送済み", 1),
  ],
  totalProductCount: 500,
  publishedProductCount: 476,
};

/** 集計が届いている区画。route では `Suspense` の中で取得したものが入る。 */
const SUMMARY_SLOT = (
  <>
    <StatCards cards={toSummaryCards(SUMMARY)} label="選んだ期間の集計" />
    <StatusBreakdown counts={SUMMARY.purchaseStatusCounts} />
  </>
);

const RANKING_SLOT = <RankingTable rows={RANKING_ROWS} />;

const meta = {
  title: "Page/Admin/Analytics",
  component: AnalyticsView,
  parameters: {
    docs: {
      story: { inline: false, iframeHeight: 900 },
      description: {
        component: [
          "期間を選んで集計を読む画面です。**canvas では遷移も取得も起きません** —— 期間を押しても",
          "数値が変わらないのはそのためで、実際は押した時点でその URL の集計へ移ります。",
          "**取り直すのは選択肢の下だけ**で、選択肢と対象期間の表示は出たまま残ります。",
          "「期間を指定」だけは押しても遷移せず、両端を決めてから遷移する overlay を開きます。",
          "売れ筋は期間の選択に従いません。ここが見せるのは「いま何が動いているか」で、過去の月を",
          "選んだときに当時の順位が出ても品揃えの判断には使えないためです。見出しに期間を書いて",
          "いるのがその断りです。",
        ].join(""),
      },
    },
    layout: "fullscreen",
    nextjs: { navigation: { pathname: ADMIN_ANALYTICS_PATH } },
  },
  decorators: [withPageFrame],
  args: {
    query: { period: DASHBOARD_PERIOD.TODAY },
    window: { from: "2026-08-19", to: "2026-08-19" },
    summary: SUMMARY_SLOT,
    ranking: RANKING_SLOT,
  },
} satisfies Meta<typeof AnalyticsView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 今日。対象の暦日が選択肢の下に出る。 */
export const Default: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
};

/** タブレット。期間の選択は 1 行に収まり、棒と表は縦に積まれる。 */
export const DefaultTablet: Story = {
  globals: { viewport: { value: "tablet", isRotated: false } },
};

/** スマホ。期間の選択は折り返し、売れ筋の表は横送りで読む。 */
export const DefaultMobile: Story = {
  globals: { viewport: { value: "mobile2", isRotated: false } },
};

/** 今月。選ばれている項目が入れ替わり、下の暦日が月の両端になる。 */
export const Month: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
  args: {
    query: { period: DASHBOARD_PERIOD.MONTH },
    window: { from: "2026-08-01", to: "2026-08-31" },
  },
};

/** 期間を指定して集計が出ている状態。指定した両端がそのまま下に出る。 */
export const RangeSelected: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
  args: {
    query: { period: DASHBOARD_PERIOD.RANGE, from: "2026-07-01", to: "2026-07-31" },
    window: { from: "2026-07-01", to: "2026-07-31" },
  },
};

/** 日付を選ぶ overlay を開いた状態。選んでいた両端が初期値として残る。 */
export const RangeDialogOpen: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
  args: {
    query: { period: DASHBOARD_PERIOD.RANGE, from: "2026-07-01", to: "2026-07-31" },
    window: { from: "2026-07-01", to: "2026-07-31" },
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "期間を指定" }));
  },
};

/** スマホで overlay を開いた状態。日付の入力欄は縦に積まれる。 */
export const RangeDialogOpenMobile: Story = {
  globals: { viewport: { value: "mobile2", isRotated: false } },
  args: { query: { period: DASHBOARD_PERIOD.RANGE }, window: undefined },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "期間を指定" }));
  },
};

/** 集計を取り直している間。選択肢と対象期間は残り、下だけが待機表示になる。 */
export const SummaryPending: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
  args: {
    query: { period: DASHBOARD_PERIOD.MONTH },
    window: { from: "2026-08-01", to: "2026-08-31" },
    summary: <AdminSummarySkeleton />,
  },
};

/** URL の日付が入れ替わっている状態。集計の代わりに直す理由が出る。 */
export const RangeReversed: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
  args: {
    query: { period: DASHBOARD_PERIOD.RANGE, from: "2026-07-31", to: "2026-07-01" },
    window: undefined,
    summary: (
      <p className="text-sm text-destructive" role="alert">
        終了日は開始日と同じ日か、それより後を選んでください。
      </p>
    ),
  },
};

/** 直近 30 日に売れた商品が無い状態。表の枠は残し、空であることを本文で伝える。 */
export const NoRanking: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
  args: { ranking: <RankingTable rows={[]} /> },
};
