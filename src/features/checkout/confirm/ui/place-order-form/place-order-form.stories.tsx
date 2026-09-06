import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { PlaceOrderStateProvider } from "../place-order-state/place-order-state";
import { PlaceOrderForm } from "./place-order-form";

/** 画面が組み立てた鍵の代わり。カタログでは送信しないため、値そのものに意味はない。 */
const IDEMPOTENCY_KEY = "0195f0c2-0000-7000-a000-000000000001";

const meta = {
  title: "Features/Checkout/Confirm/PlaceOrderForm",
  component: PlaceOrderForm,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: [
          "購入をそのまま確定する操作です。**鍵は画面が組んだ時点の値を送ります** —— 押すたびに",
          "作り直すと、二重に押したぶんだけ購入が増えます。金額が変わっているときは別の姿",
          "（`PriceChangeConfirm`）を使います。**カタログでは購入は実行されません。**",
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
} satisfies Meta<typeof PlaceOrderForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 確定できる状態。押すとそのまま送る。 */
export const Default: Story = {
  args: { orderable: true },
};

/** 確定できる明細が無い状態。押せない。 */
export const Disabled: Story = {
  args: { orderable: false },
};
