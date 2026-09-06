import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "storybook/test";

import { PlaceOrderStateProvider } from "../place-order-state/place-order-state";
import { PriceChangeConfirm } from "./price-change-confirm";

/** 画面が組み立てた鍵の代わり。カタログでは送信しないため、値そのものに意味はない。 */
const IDEMPOTENCY_KEY = "0195f0c2-0000-7000-a000-000000000001";

const meta = {
  title: "Features/Checkout/Confirm/PriceChangeConfirm",
  component: PriceChangeConfirm,
  parameters: {
    layout: "centered",
    docs: {
      story: { inline: false, iframeHeight: 420 },
      description: {
        component: [
          "金額が変わっていることを確かめてから確定する操作です。**カートへ入れたときと違う金額で",
          "請求されることを、確定してから知らせるわけにいきません。** 出口は 3 つ —— 進む・見直す・",
          "直す —— で、閉じるだけの操作が無いと元の画面へ戻れません。**カタログでは購入は実行されません。**",
        ].join(""),
      },
    },
  },
  decorators: [
    // 送信の状態は画面が 1 つだけ持つ。実画面と同じ位置に置かないと、この姿が器を持たない。
    (Story) => (
      <PlaceOrderStateProvider idempotencyKey={IDEMPOTENCY_KEY}>
        <div className="w-72">
          <Story />
        </div>
      </PlaceOrderStateProvider>
    ),
  ],
  args: {
    changedNames: ["ノイズキャンセリングヘッドホン"],
    orderable: true,
  },
} satisfies Meta<typeof PriceChangeConfirm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 確かめる前。押すと確かめが開く。 */
export const Default: Story = {};

/** 確かめを開いた状態。 */
export const Confirming: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "注文を確定する" }));
  },
};

/** 複数の商品で金額が変わった状態。 */
export const MultipleItems: Story = {
  args: { changedNames: ["ノイズキャンセリングヘッドホン", "スマートウォッチ（第 2 世代）"] },
  play: Confirming.play,
};
