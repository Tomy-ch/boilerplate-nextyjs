import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { EARPHONE_LINE, INSUFFICIENT_LINE } from "../../../checkout.fixture";
import { OrderLineRow } from "./order-line-row";

const meta = {
  title: "Features/Checkout/Confirm/OrderLineRow",
  component: OrderLineRow,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: [
          "確定する内容の 1 行です。**操作を持ちません** —— 数量を変えるのも取り除くのもカートの領分で、",
          "この行は確かめるためだけに並びます。今回の購入に載らない明細は、理由を添えて弱めて出します。",
        ].join(""),
      },
    },
  },
  decorators: [
    (Story) => (
      <ul className="w-[32rem] max-w-full">
        <Story />
      </ul>
    ),
  ],
} satisfies Meta<typeof OrderLineRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 今回の購入に載る明細。 */
export const Included: Story = {
  args: { line: EARPHONE_LINE },
};

/** 事情が立って載らない明細。理由と、載らないことを添える。 */
export const Excluded: Story = {
  args: { line: INSUFFICIENT_LINE },
};

/** 商品を引けなかった明細。名前も単価も欠ける。 */
export const Unknown: Story = {
  args: {
    line: {
      ...INSUFFICIENT_LINE,
      availableQuantity: null,
      issues: ["notFound"],
      name: null,
      unitPrice: null,
    },
  },
};
