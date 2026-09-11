import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import Link from "next/link";
import type { ReactElement } from "react";

import { CursorPagination } from "@/components/app-starter/cursor-pagination/cursor-pagination";
import { Button } from "@/components/design-system/action/button/button";
import { AdminShell } from "@/components/shell/admin-shell/admin-shell";
import type { AdminShellNavGroup } from "@/components/shell/admin-shell/admin-shell.definition";
import { ContentContainer } from "@/components/shell/content-container/content-container";
import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
} from "@/components/shell/page-header/page-header";

import {
  ADMIN_DASHBOARD_PATH,
  ADMIN_INQUIRY_LIST_PATH,
  ADMIN_PRODUCT_LIST_PATH,
} from "../../paths";
import { ADMIN_INQUIRY_ROWS } from "../inquiries.fixture";
import { toNextPageHref } from "../query";
import { AdminInquiryTable } from "./ui/table/table";
import { AdminInquiryListView } from "./view";

const NAV_GROUPS: readonly AdminShellNavGroup[] = [
  { label: "集計", items: [{ href: ADMIN_DASHBOARD_PATH, label: "ダッシュボード" }] },
  { label: "商品", items: [{ href: ADMIN_PRODUCT_LIST_PATH, label: "商品一覧管理" }] },
  { label: "利用者", items: [{ href: ADMIN_INQUIRY_LIST_PATH, label: "問い合わせ一覧" }] },
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
            <PageHeaderTitle>問い合わせ一覧</PageHeaderTitle>
            <PageHeaderDescription>
              利用者から届いた問い合わせを確認し、回答します。
            </PageHeaderDescription>
          </div>
        </PageHeader>
        <Story />
      </ContentContainer>
    </AdminShell>
  );
}

const meta = {
  title: "Page/Admin/Inquiries/List",
  component: AdminInquiryListView,
  parameters: {
    layout: "fullscreen",
    docs: {
      story: { inline: false, iframeHeight: 720 },
      description: {
        component: [
          "運営が問い合わせを見比べる一覧です。更新の新しい順に並び、**本文は出しません** ——",
          "契約が一覧に本文を載せておらず、何が書かれているかは 1 件を開いて読みます。",
          "更新は購読が知らせ、届いた時点で一覧を取り直します（届いた内容では書き換えません）。",
          "**カタログは購読先を持ちません**（[msw のハンドラ](../../../../.storybook/msw/handlers.ts)）。",
        ].join(""),
      },
    },
  },
  decorators: [withPageFrame],
  args: {
    children: (
      <AdminInquiryTable
        items={ADMIN_INQUIRY_ROWS}
        pagination={
          <CursorPagination
            aria-label="問い合わせ一覧のページ送り"
            nextHref={toNextPageHref({ cursor: null, trail: [] }, "next-cursor")}
          />
        }
      />
    ),
  },
} satisfies Meta<typeof AdminInquiryListView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 3 件が並び、続きがある状態。 */
export const Default: Story = {};

/** まだ 1 件も届いていない状態。 */
export const Empty: Story = {
  args: { children: <AdminInquiryTable items={[]} /> },
};
