import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { CART } from "../../cart.fixture";
import { CartSubtotal } from "./subtotal";

const meta = {
  title: "Features/Cart/Subtotal",
  component: CartSubtotal,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: [
          "カートの小計です。**バックエンドが返した値をそのまま出します** —— 買える明細だけを合算した参考値で、ここでは足し直しません。",
          "大きさは器に合わせ、脇の領域では控えめに、全画面と引き出しでは大きく出します。",
        ].join(""),
      },
    },
  },
  args: { amount: CART.subtotalAmount },
  decorators: [(Story) => <div className="w-72">{Story()}</div>],
} satisfies Meta<typeof CartSubtotal>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 全画面と引き出しでの姿。金額が主役になる。 */
export const Prominent: Story = {};

/** 脇の領域での姿。中身と同じ送りの中に並ぶ。 */
export const Compact: Story = {
  args: { size: "compact" },
};

/** 桁が伸びた小計。金額が器の幅を押し広げない。 */
export const LargeAmount: Story = {
  args: { amount: 1_234_567_890 },
};

/** 買える明細が 1 つも無い状態。0 も同じ位置に出す。 */
export const Zero: Story = {
  args: { amount: 0 },
};
