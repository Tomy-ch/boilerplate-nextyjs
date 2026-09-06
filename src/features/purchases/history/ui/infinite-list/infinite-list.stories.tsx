import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { CursorPage } from "@/model/pagination";
import type { PurchaseHistoryEntry } from "@/model/purchase/purchase";
import { WHOLE_TIME } from "@/model/time-window";
import { HISTORY_ENTRIES } from "../../../purchases.fixture";
import { PurchaseInfiniteList } from "./infinite-list";

const FIRST_PAGE: CursorPage<PurchaseHistoryEntry> = {
  items: HISTORY_ENTRIES,
  nextCursor: "next",
};

const meta = {
  title: "Features/Purchases/InfiniteList",
  component: PurchaseInfiniteList,
  parameters: {
    layout: "padded",
    docs: {
      story: { inline: false, iframeHeight: 620 },
      description: {
        component: [
          "読み進められる購入履歴です。**取得と見た目をつなぐだけ**で、見た目は `Features/Purchases/PurchaseLoadMoreList`、",
          "取得と末尾到達の検知は hook が持ちます。",
          "詳細への行き先はここで組みます。**canvas では末尾の目印が最初から見えている**ので、開いた時点で続きを取りに行き、届く続きは 1 度きりです。",
        ].join(""),
      },
    },
  },
  args: { initial: FIRST_PAGE, window: WHOLE_TIME, pageSize: 20 },
} satisfies Meta<typeof PurchaseInfiniteList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 開いた直後。末尾の目印が見えているので、その場で続きを取りに行き、届いた分まで並ぶ。 */
export const Default: Story = {};

/** 最初から続きが無い状態。取りに行かないので、渡された分だけが並ぶ。 */
export const ReachedEnd: Story = {
  args: { initial: { items: HISTORY_ENTRIES, nextCursor: null } },
};
