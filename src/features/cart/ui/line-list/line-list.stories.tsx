import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { Cart } from "@/model/cart/cart";
import { CART, CART_WITH_ISSUES } from "../../cart.fixture";
import { CartLineRow } from "../line-row/line-row";
import type { CartLineSlot } from "./line-list";
import { CartLineList } from "./line-list";

/** 行そのものは server が組み立てたものを受け取る。器が持つのは並べる順だけ。 */
function slotsOf(cart: Cart): readonly CartLineSlot[] {
  return cart.lines.map((line) => ({
    productId: line.productId,
    row: <CartLineRow key={line.productId} line={line} />,
  }));
}

const meta = {
  title: "Features/Cart/LineList",
  component: CartLineList,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: [
          "明細を並べ、取り除いた行があった場所に取り消しを差し込む器です。**消えた行と同じ場所に案内を置きます** —— 押した場所と案内の出る場所がずれると、",
          "どの行が消えたのかを目で辿り直すことになります。",
          "**canvas では取り除けません** —— 送信先が無いので、案内の出る姿までは進みません。",
        ].join(""),
      },
    },
  },
  args: { slots: slotsOf(CART) },
  decorators: [(Story) => <div className="w-80">{Story()}</div>],
} satisfies Meta<typeof CartLineList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 明細が複数ある状態。並びはサーバが返した順。 */
export const WithLines: Story = {};

/** 事情のある明細が混ざった状態。器は並べるだけで、事情は行が出す。 */
export const WithIssues: Story = {
  args: { slots: slotsOf(CART_WITH_ISSUES) },
};

/** 明細が 1 つだけの状態。区切り線は行の間にしか出ない。 */
export const SingleLine: Story = {
  args: { slots: slotsOf(CART).slice(0, 1) },
};
