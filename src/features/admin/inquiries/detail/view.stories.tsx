import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import Link from "next/link";
import type { ReactElement } from "react";

import { Button } from "@/components/design-system/action/button/button";
import { AdminShell } from "@/components/shell/admin-shell/admin-shell";
import type { AdminShellNavGroup } from "@/components/shell/admin-shell/admin-shell.definition";
import { ContentContainer } from "@/components/shell/content-container/content-container";
import { idleActionState } from "@/model/action-state";

import {
  ADMIN_DASHBOARD_PATH,
  ADMIN_INQUIRY_LIST_PATH,
  ADMIN_PRODUCT_LIST_PATH,
} from "../../paths";
import { ADMIN_INQUIRY_HISTORY, ADMIN_INQUIRY_ID } from "../inquiries.fixture";
import { InquiryBreadcrumbTrail } from "../ui/breadcrumb-trail/breadcrumb-trail";
import { AdminInquiryDetailView } from "./view";

const NAV_GROUPS: readonly AdminShellNavGroup[] = [
  { label: "集計", items: [{ href: ADMIN_DASHBOARD_PATH, label: "ダッシュボード" }] },
  { label: "商品", items: [{ href: ADMIN_PRODUCT_LIST_PATH, label: "商品一覧管理" }] },
  { label: "利用者", items: [{ href: ADMIN_INQUIRY_LIST_PATH, label: "問い合わせ一覧" }] },
];

/** route と同じ器で包む。階層は `@breadcrumb` の slot が出すものを再現する。 */
function withPageFrame(Story: () => ReactElement) {
  return (
    <AdminShell
      breadcrumb={<InquiryBreadcrumbTrail trail={["対応"]} />}
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
        <Story />
      </ContentContainer>
    </AdminShell>
  );
}

const meta = {
  title: "Page/Admin/Inquiries/Detail",
  component: AdminInquiryDetailView,
  parameters: {
    layout: "fullscreen",
    docs: {
      story: { inline: false, iframeHeight: 900 },
      description: {
        component: [
          "運営が 1 件に回答する画面です。**右へ寄るのは運営の発言**で、利用者側の画面とは",
          "「自分」が入れ替わります。",
          "**この画面は会話そのものを購読しません** —— 契約が持つ購読の口は「自分の問い合わせ」と",
          "「更新フィード」の 2 つで、運営が任意の 1 件を直接購読する口がないためです。",
          "フィードが開いている 1 件の更新を伝えたときに、正本を取り直します。",
        ].join(""),
      },
    },
  },
  decorators: [withPageFrame],
  args: {
    history: ADMIN_INQUIRY_HISTORY,
    inquiryId: ADMIN_INQUIRY_ID,
    replyAction: async () => idleActionState<void, "body">(),
  },
} satisfies Meta<typeof AdminInquiryDetailView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 利用者と運営のやり取りが並ぶ。 */
export const Default: Story = {};
