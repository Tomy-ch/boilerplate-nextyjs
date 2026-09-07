import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import Link from "next/link";
import type { ReactElement } from "react";

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
import { DashboardView } from "./view";

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

/**
 * route と同じ器で包む。`admin/layout.tsx` が置く shell と `page.tsx` が置く見出しを story 側で
 * 再現し、画面がどう収まるかを取得なしで確かめられるようにする。
 */
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
            <PageHeaderTitle>ダッシュボード</PageHeaderTitle>
            <PageHeaderDescription>今日の売上と、注文の状況を確認します。</PageHeaderDescription>
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
    statusId: `0195f0c2-1000-7000-8000-${String(statusSeq).padStart(12, "0")}`,
    statusName,
    count: value,
  };
}

/** 実測した契約の応答と同じ顔ぶれ。マスタの表示順で並ぶ。 */
const STATUS_COUNTS = [
  count("未処理", 7),
  count("受付中", 4),
  count("確認中", 3),
  count("処理中", 4),
  count("完了", 1),
  count("キャンセル", 1),
  count("支払い済み", 4),
  count("発送済み", 1),
] satisfies readonly [PurchaseStatusCount, ...PurchaseStatusCount[]];

const SUMMARY: DashboardSummary = {
  salesAmount: 824_695,
  salesCount: 24,
  purchaseStatusCounts: STATUS_COUNTS,
  totalProductCount: 500,
  publishedProductCount: 476,
};

const meta = {
  title: "Page/Admin/Dashboard",
  component: DashboardView,
  parameters: {
    docs: {
      story: { inline: false, iframeHeight: 760 },
      description: {
        component: [
          "管理の入口です。**期間を選ばせません** —— 開いた直後に読む面なので、今日の集計だけを出し、",
          "期間を跨いで見比べる用は「期間を指定して見る」の先へ委ねます。数値カードの注記が省けないのは、",
          "売上（キャンセル除外）・ステータス別件数（キャンセル込み）・商品数（期間非依存）で母集団が",
          "違うためで、注記が無いと同じ母集団の数として読まれます。棒グラフは補助で、数そのものは隣の表が持ちます。",
        ].join(""),
      },
    },
    layout: "fullscreen",
    nextjs: { navigation: { pathname: ADMIN_DASHBOARD_PATH } },
  },
  decorators: [withPageFrame],
  args: { summary: SUMMARY },
} satisfies Meta<typeof DashboardView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 購入のある日。8 つのステータスがそろい、棒と表が同じ内容を指す。 */
export const Default: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
};

/** タブレット。脇の一覧は常設され、棒と表は縦に積まれる。 */
export const DefaultTablet: Story = {
  globals: { viewport: { value: "tablet", isRotated: false } },
};

/** スマホ。数値カードは 2 列を保ち、内訳は棒・表の順に続く。 */
export const DefaultMobile: Story = {
  globals: { viewport: { value: "mobile2", isRotated: false } },
};

/** 購入がまだ無い日。契約は空配列を返すので、棒も表も出さず一文で伝える。 */
export const NoPurchases: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
  args: {
    summary: {
      ...SUMMARY,
      salesAmount: 0,
      salesCount: 0,
      purchaseStatusCounts: [],
    },
  },
};

/** 売上が伸びた日。桁が増えてもカードの列が崩れないかを見る。 */
export const LargeAmount: Story = {
  globals: { viewport: { value: "mobile2", isRotated: false } },
  args: {
    summary: {
      ...SUMMARY,
      salesAmount: 9_876_543_210,
      salesCount: 12_480,
      totalProductCount: 128_400,
      publishedProductCount: 119_872,
    },
  },
};

/** ステータスが 1 つだけの日。棒が 1 本でも軸と余白が保たれるかを見る。 */
export const SingleStatus: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
  args: {
    summary: { ...SUMMARY, purchaseStatusCounts: [STATUS_COUNTS[0]] },
  },
};
