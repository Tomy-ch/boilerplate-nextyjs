import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ReactElement } from "react";

import { AppShell } from "@/components/shell/app-shell/app-shell";
import { ContentContainer } from "@/components/shell/content-container/content-container";

import { EMPTY_HISTORY, HISTORY, LONG_BODY_HISTORY } from "../inquiry.fixture";
import { InquiryThreadView } from "./view";

const NAV_ITEMS = [
  { href: "/products", label: "商品" },
  { href: "/purchases", label: "購入履歴" },
  { href: "/mypage", label: "マイページ" },
];

/**
 * route と同じ器で包む。
 *
 * @remarks
 * `(shop)/layout.tsx` が置く shell と `page.tsx` が置く読み幅を再現します。**見出しは置きません**
 * —— 実物も置いておらず、画面の高さをやり取りと送信欄で使い切るためです。
 */
function withPageFrame(Story: () => ReactElement) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppShell
        footer={<p>Next.js / React のプレゼンテーション層 boilerplate です。</p>}
        navItems={NAV_ITEMS}
        siteName="nextjs-boilerplate"
      >
        <ContentContainer className="py-4">
          <Story />
        </ContentContainer>
      </AppShell>
    </div>
  );
}

const meta = {
  title: "Page/Mypage/Inquiry",
  component: InquiryThreadView,
  parameters: {
    layout: "fullscreen",
    docs: {
      story: { inline: false, iframeHeight: 900 },
      description: {
        component: [
          "サポートとのやり取りの全画面表示です。**画面そのものは縦にスクロールしません** ——",
          "やり取りだけが枠の中で流れ、送信欄は常に下端に残ります。",
          "受信の状態は常に出したままで、繋がっているかどうかを画面から読めるようにしています。",
          "**カタログは購読先を持ちません。** 発券の口が「対象なし」を返すため、状態は待機のまま",
          "止まります（[msw のハンドラ](../../../.storybook/msw/handlers.ts)）。",
        ].join(""),
      },
    },
  },
  decorators: [withPageFrame],
  args: { history: HISTORY },
} satisfies Meta<typeof InquiryThreadView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 日付をまたぐやり取り。自分の発言が右、サポートが左に並ぶ。 */
export const Default: Story = {};

/** まだ 1 通も無い状態。取得の失敗ではなく、最初の 1 通を待っている。 */
export const Empty: Story = { args: { history: EMPTY_HISTORY } };

/** 長い本文と、区切りの無い連続文字列。吹き出しの幅の上限と折り返しを確かめる。 */
export const LongBody: Story = { args: { history: LONG_BODY_HISTORY } };
