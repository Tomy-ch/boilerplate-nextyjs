import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ADMIN_PRODUCT_LIST_PATH } from "../../../../paths";
import { StockCurrentAmount } from "./current-stock";

const meta = {
  title: "Features/Admin/Products/Stock/CurrentStock",
  component: StockCurrentAmount,
  parameters: {
    layout: "padded",
    nextjs: { navigation: { pathname: ADMIN_PRODUCT_LIST_PATH } },
    docs: {
      description: {
        component: [
          "いま判っている在庫と、その鮮度です。**この数が古くても更新の結果は壊れません**（増減は相対値で送るため）。",
          "ずれるのは見込みだけなので、鮮度の注記と取り直す導線を添えています。商品名は 2 行で打ち切ります。",
        ].join(""),
      },
    },
  },
  args: {
    productName: "ワイヤレスイヤホン",
    quantity: 120,
    reloadHref: `${ADMIN_PRODUCT_LIST_PATH}/0195f0c2-0000-7000-8000-000000000001/stock`,
  },
} satisfies Meta<typeof StockCurrentAmount>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 在庫がある状態。 */
export const Default: Story = {};

/** 在庫が尽きている状態。0 も数として同じ位置に出す。 */
export const OutOfStock: Story = {
  args: { quantity: 0 },
};

/** 商品名が長い状態。2 行で打ち切り、取り直す操作の位置を動かさない。 */
export const LongName: Story = {
  args: {
    productName:
      "ノイズキャンセリング ヘッドホン（over-ear・第 3 世代・ケース同梱・保証 2 年付き・限定カラー）",
  },
};
