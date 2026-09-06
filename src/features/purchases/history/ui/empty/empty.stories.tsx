import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { toPurchaseHistoryHref } from "../../period";
import { PurchaseHistoryEmpty } from "./empty";

const meta = {
  title: "Features/Purchases/History/Empty",
  component: PurchaseHistoryEmpty,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: [
          "並べるものが無いときの表示です。**「まだ買っていない」と「絞り込んだ結果が無い」を分けます。**",
          "後者を同じ文言で出すと、条件を外せば出てくることが画面から読み取れません。",
        ].join(""),
      },
    },
  },
} satisfies Meta<typeof PurchaseHistoryEmpty>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 購入そのものが 1 件も無い状態。 */
export const NoPurchases: Story = {
  args: { reason: "none" },
};

/** 絞り込んだ結果が 0 件の状態。 */
export const NoResultInPeriod: Story = {
  args: { reason: "filtered", resetHref: toPurchaseHistoryHref({ kind: "all" }) },
};
