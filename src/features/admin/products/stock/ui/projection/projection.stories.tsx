import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { STOCK_DIRECTION } from "../../stock-direction";
import { StockProjection } from "./projection";

const meta = {
  title: "Features/Admin/Products/Stock/Projection",
  component: StockProjection,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: [
          "送信したらいくつになるかの見込みです。**参考値であって、入力を止める根拠ではありません**",
          "—— 止める根拠が読み込んだ時点の在庫しか無いためで、増減後が範囲を外れた要求は契約が拒みます。",
          "量が読めないうちは何も描きません。",
        ].join(""),
      },
    },
  },
  args: { current: 120, direction: STOCK_DIRECTION.REPLENISH, quantity: 30 },
} satisfies Meta<typeof StockProjection>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 補充した後の見込み。 */
export const Replenish: Story = {};

/** 差し引いた後の見込み。 */
export const Deduct: Story = {
  args: { direction: STOCK_DIRECTION.DEDUCT },
};

/** 在庫より多く差し引く見込み。止めはせず、受け付けられないことだけを添える。 */
export const Negative: Story = {
  args: { direction: STOCK_DIRECTION.DEDUCT, quantity: 500 },
};
