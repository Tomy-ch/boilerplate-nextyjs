import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { PurchaseHistoryEntry } from "@/model/purchase/purchase";

import { purchaseDetailPath } from "../../../facade/paths/paths";
import { HISTORY_ENTRIES } from "../../../purchases.fixture";
import { type PurchaseListEntry, PurchaseLoadMoreList } from "./purchase-list";

function toEntries(purchases: readonly PurchaseHistoryEntry[]): readonly PurchaseListEntry[] {
  return purchases.map((purchase) => ({ purchase, href: purchaseDetailPath(purchase.code) }));
}

const ENTRIES = toEntries(HISTORY_ENTRIES);

const meta = {
  title: "Features/Purchases/History/PurchaseList",
  component: PurchaseLoadMoreList,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: [
          "読み進めた購入履歴の 4 つの見え方です。**取得は持たないので canvas では増えません。**",
          "件数に総数を添えないのは、契約が総件数を返さないためです。",
        ].join(""),
      },
    },
  },
} satisfies Meta<typeof PurchaseLoadMoreList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 続きがある状態。末尾に近づけば自動で読むため、操作は出さない。 */
export const HasNext: Story = {
  args: { entries: ENTRIES, loadMore: { status: "idle" } },
};

/** 続きを取得している最中。読み終えた分は残したまま、末尾で進行を示す。 */
export const Loading: Story = {
  args: { entries: ENTRIES, loadMore: { status: "loading" } },
};

/** 続きの取得に失敗した状態。ここでだけ読み直す操作を出す。末尾に留まったままでは自動で直らない。 */
export const Failed: Story = {
  args: { entries: ENTRIES, loadMore: { status: "failed", onRetry: () => {} } },
};

/** 最後まで読み終えた状態。続きが無いので操作も進行も出さない。 */
export const ReachedEnd: Story = {
  args: { entries: ENTRIES, loadMore: { status: "exhausted" } },
};
