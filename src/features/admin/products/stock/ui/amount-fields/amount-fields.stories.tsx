import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "storybook/test";

import { StockAmountFields } from "./amount-fields";

/** 量を打ち、必要なら向きも選ぶ。見込みは向きと量の両方が揃って初めて出る。 */
function enterAmount(quantity: string, direction?: string) {
  return async ({ canvasElement }: { canvasElement: HTMLElement }): Promise<void> => {
    const canvas = within(canvasElement);

    if (direction !== undefined) {
      await userEvent.click(canvas.getByLabelText(direction));
    }

    await userEvent.type(canvas.getByLabelText("数量"), quantity);
  };
}

const meta = {
  title: "Features/Admin/Products/Stock/AmountFields",
  component: StockAmountFields,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: [
          "在庫をどちらへいくつ動かすかを決める欄です。向きと量が 1 つの部品なのは、見込みがその両方から決まるためです。",
          "**符号は人に書かせず、向きで受けます。** 量が読めた時点で、送信後の見込みが下に出ます。",
        ].join(""),
      },
    },
  },
  args: { current: 120 },
} satisfies Meta<typeof StockAmountFields>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 開いた直後。既定は補充で、量がまだ読めないので見込みは出ない。 */
export const Default: Story = {};

/** 補充する量を打った状態。見込みが増えた側に出る。 */
export const Replenishing: Story = {
  play: enterAmount("30"),
};

/** 差し引く向きを選んで量を打った状態。見込みが減った側に出る。 */
export const Deducting: Story = {
  play: enterAmount("30", "差し引く"),
};

/** 在庫より多く差し引こうとしている状態。入力は止めず、受け付けられないことだけを添える。 */
export const Negative: Story = {
  play: enterAmount("500", "差し引く"),
};

/** 量が読めずに拒まれた状態。誤りの文言は量の欄に付く。 */
export const Rejected: Story = {
  args: { message: "数量は 1 以上の整数で入力してください。" },
};
