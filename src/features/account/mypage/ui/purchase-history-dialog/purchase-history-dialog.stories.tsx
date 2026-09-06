import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  EMPTY_PURCHASE_HISTORY,
  PURCHASE_HISTORY,
  TRUNCATED_PURCHASE_HISTORY,
} from "../../../account.fixture";
import { PurchaseHistoryDialog } from "./purchase-history-dialog";

const meta = {
  title: "Features/Account/Mypage/PurchaseHistoryDialog",
  component: PurchaseHistoryDialog,
  parameters: {
    docs: {
      description: {
        component: [
          "購入履歴を dialog で一覧します。集計のカードに全件を並べるとカードが縦に伸び、その下の",
          "操作が押し下げられるため、局所スクロールを持つ dialog へ移しています。",
        ].join(""),
      },
    },
  },
} satisfies Meta<typeof PurchaseHistoryDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 既定。全部が 1 ページに収まっている。 */
export const Default: Story = {
  args: { purchases: PURCHASE_HISTORY },
};

/** 続きがある場合。並んでいるのが全部ではないことを説明で伝える。 */
export const Truncated: Story = {
  args: { purchases: TRUNCATED_PURCHASE_HISTORY },
};

/** 購入が 1 件も無い場合。開いても並ぶものが無いので押せなくする。 */
export const Empty: Story = {
  args: { purchases: EMPTY_PURCHASE_HISTORY },
};

/** スマホ幅。表が dialog の中で横スクロールへ移る。 */
export const Mobile: Story = {
  args: { purchases: PURCHASE_HISTORY },
  globals: { viewport: { value: "mobile2", isRotated: false } },
};
