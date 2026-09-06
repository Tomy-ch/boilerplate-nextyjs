import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { DashboardSummary } from "@/model/dashboard/dashboard";
import { toSummaryCards } from "../../summary-cards";
import { StatCards } from "./stat-cards";

const SUMMARY: DashboardSummary = {
  salesAmount: 824_695,
  salesCount: 24,
  purchaseStatusCounts: [],
  totalProductCount: 500,
  publishedProductCount: 476,
};

const meta = {
  title: "Features/Admin/StatCards",
  component: StatCards,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: [
          "集計を数値で並べる枠です。**押せるのは中身を並べた面があるカードだけ**で、見出しに矢印が",
          "付いているものがそれにあたります。押せる印を hover の前に出すのは、指で触るまで判らないと",
          "押せる面を探すことになるためです。注記はカードごとに母集団が違うことを示すもので、省けません。",
        ].join(""),
      },
    },
  },
  args: { cards: toSummaryCards(SUMMARY), label: "今日の集計" },
} satisfies Meta<typeof StatCards>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 既定の 4 枚。3 枚目だけが一覧へ送れるので、そこにだけ矢印が付く。 */
export const Default: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
};

/** 狭い段。4 枚を縦に積まず 2 列を保つので、下に続くものが最初の画面から押し出されない。 */
export const Mobile: Story = {
  globals: { viewport: { value: "mobile2", isRotated: false } },
};

/** 桁が伸びた値。列に収まらない分は末尾を落とし、上位の桁で大きさが読めるようにする。 */
export const LargeAmount: Story = {
  globals: { viewport: { value: "mobile2", isRotated: false } },
  args: {
    cards: toSummaryCards({
      ...SUMMARY,
      salesAmount: 9_876_543_210,
      salesCount: 12_480,
      totalProductCount: 128_400,
      publishedProductCount: 119_872,
    }),
  },
};

/** 値がまだ無い日。0 でも枠と注記は同じ位置に残り、高さが動かない。 */
export const Zero: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
  args: {
    cards: toSummaryCards({
      ...SUMMARY,
      salesAmount: 0,
      salesCount: 0,
      totalProductCount: 0,
      publishedProductCount: 0,
    }),
  },
};
