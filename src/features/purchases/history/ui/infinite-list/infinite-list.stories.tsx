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
          "読み進められる購入履歴です。**取得と見た目をつなぐだけ**で、見た目は `PurchaseLoadMoreList` が、",
          "取得と末尾到達の検知は `useInfinitePurchases` が持ちます。詳細への行き先をここで組むのは、",
          "ルートを知っているのがこの feature だからで、行の側は渡された行き先を描くだけです。",
        ].join(""),
      },
    },
  },
  args: { initial: FIRST_PAGE, window: WHOLE_TIME, pageSize: 20 },
} satisfies Meta<typeof PurchaseInfiniteList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 続きがある状態。末尾へ届くと自分で取りに行く。 */
export const Default: Story = {};

/** 最後まで読み終えた状態。続きが無いので取りに行かない。 */
export const ReachedEnd: Story = {
  args: { initial: { items: HISTORY_ENTRIES, nextCursor: null } },
};
