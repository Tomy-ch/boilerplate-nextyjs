import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { CART, CART_WITH_ISSUES, CART_WITHOUT_PURCHASABLE, EMPTY_CART } from "../../cart.fixture";
import { CartContents } from "./contents";

const meta = {
  title: "Features/Cart/Contents",
  component: CartContents,
  parameters: {
    layout: "padded",
    docs: {
      story: { inline: false, iframeHeight: 600 },
      description: {
        component: [
          "カートの中身です。**器を持ちません** —— 脇の領域として常設する場合と、狭い幅で本文へ被せる",
          "場合の両方から使うため、位置と大きさは呼び出し元が決めます。小計と先へ進む導線は送りの外に置き、",
          "明細だけを局所スクロールさせます —— 高さを超えた明細を外側のスクロールに委ねると、器が固定",
          "されている場合に届かない行が出ます。導線は 2 本あり、主が購入手続き、副がカートページです。",
        ].join(""),
      },
    },
  },
  args: { cart: CART },
  decorators: [(Story) => <div className="flex h-[32rem] w-72 flex-col">{Story()}</div>],
} satisfies Meta<typeof CartContents>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 明細が複数ある状態。明細だけが送られ、小計と導線は残る。 */
export const WithLines: Story = {};

/** 買えない明細と値の変わった明細が混ざった状態。事情は行の中に出る。 */
export const WithIssues: Story = {
  args: { cart: CART_WITH_ISSUES },
};

/** 買える明細が 1 つも無い状態。購入手続きへは進ませない。 */
export const WithoutPurchasable: Story = {
  args: { cart: CART_WITHOUT_PURCHASABLE },
};

/** 空の状態。小計も導線も出さず、入っていないことだけを書く。 */
export const Empty: Story = {
  args: { cart: EMPTY_CART },
};
