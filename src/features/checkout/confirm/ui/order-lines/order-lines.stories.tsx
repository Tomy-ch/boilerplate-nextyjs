import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { LONG_CART, ORDERABLE_CART, PARTIALLY_ORDERABLE_CART } from "../../../checkout.fixture";
import { OrderLines } from "./order-lines";

const meta = {
  title: "Features/Checkout/Confirm/OrderLines",
  component: OrderLines,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: [
          "確定する内容の再掲です。直す手段はカートへ戻す導線 1 本だけで、",
          "**今回の購入に載らない明細も落とさずに出します** —— 落とすと、カートで見た明細が黙って消えます。",
        ].join(""),
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[40rem] max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof OrderLines>;

export default meta;
type Story = StoryObj<typeof meta>;

/** すべての明細が載る状態。 */
export const Default: Story = {
  args: { lines: ORDERABLE_CART.lines },
};

/** 一部が載らない状態。載らない行に理由が付く。 */
export const WithExcluded: Story = {
  args: { lines: PARTIALLY_ORDERABLE_CART.lines },
};

/** 畳む数を超える明細。10 件までを出し、残りはその場で開く。 */
export const Folded: Story = {
  args: { lines: LONG_CART.lines },
};
