import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  EMPTY_PURCHASE_HISTORY,
  EMPTY_PURCHASE_SUMMARY,
  PURCHASE_HISTORY,
  PURCHASE_SUMMARY,
} from "../../../account.fixture";
import { PurchaseSummaryCard } from "./purchase-summary-card";

const meta = {
  title: "Features/Account/Mypage/PurchaseSummaryCard",
  component: PurchaseSummaryCard,
  parameters: {
    docs: {
      description: {
        component: [
          "購入の集計です。総数と合計はキャンセル済みを除いた値で、内訳にもキャンセルの行は",
          "現れません。契約がそう定めています。",
        ].join(""),
      },
    },
  },
} satisfies Meta<typeof PurchaseSummaryCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 既定。2 つのステータスに分かれている。 */
export const Default: Story = {
  args: { purchases: PURCHASE_HISTORY, summary: PURCHASE_SUMMARY },
};

/** 購入が 1 件も無い場合。列だけの表を出さず、案内に置き換える。 */
export const Empty: Story = {
  args: { purchases: EMPTY_PURCHASE_HISTORY, summary: EMPTY_PURCHASE_SUMMARY },
};

/** ステータスが 1 つだけの場合。合計行と本文が同じ値になる。 */
export const SingleStatus: Story = {
  args: {
    purchases: PURCHASE_HISTORY,
    summary: {
      totalCount: 2,
      totalAmount: 4_980,
      breakdown: [
        {
          statusId: "0195f0c2-0000-7000-8000-0000000000b1",
          statusName: "支払い待ち",
          count: 2,
          totalAmount: 4_980,
        },
      ],
    },
  },
};

/**
 * ステータス名が長い場合。契約は名称の長さに上限を宣言していないため、1 行に収まる前提を置けない。
 */
export const LongStatusName: Story = {
  args: {
    purchases: PURCHASE_HISTORY,
    summary: {
      ...PURCHASE_SUMMARY,
      breakdown: [
        {
          statusId: "0195f0c2-0000-7000-8000-0000000000c1",
          statusName: "取り寄せのため出荷までに時間がかかっています",
          count: 12,
          totalAmount: 124_000,
        },
      ],
    },
  },
};
