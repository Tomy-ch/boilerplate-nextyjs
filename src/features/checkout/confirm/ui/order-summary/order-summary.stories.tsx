import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  BLOCKED_CART,
  ORDERABLE_CART,
  PARTIALLY_ORDERABLE_CART,
  SUBTOTAL_REFERENCE,
} from "../../../checkout.fixture";
import { PlaceOrderStateProvider } from "../place-order-state/place-order-state";
import { OrderSummary } from "./order-summary";

/** 画面が組み立てた鍵の代わり。カタログでは確定を実行しないため、値そのものに意味はない。 */
const IDEMPOTENCY_KEY = "0195f0c2-0000-7000-a000-000000000001";

const meta = {
  title: "Features/Checkout/Confirm/OrderSummary",
  component: OrderSummary,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: [
          "小計と確定の操作です。器を持たず、広い幅では本文の脇に貼り付き、狭い幅では画面の下端に固定されます。",
          "**出せるのは小計まで**で、税と送料は確定した時点で決まります。",
          "**カタログでは確定は実行されません。**",
        ].join(""),
      },
    },
  },
  decorators: [
    // 送信の状態は画面が 1 つだけ持つ。実画面と同じ位置に置かないと、確定の姿が器を持たない。
    (Story) => (
      <PlaceOrderStateProvider idempotencyKey={IDEMPOTENCY_KEY}>
        <div className="w-80 rounded-lg border p-4">
          <Story />
        </div>
      </PlaceOrderStateProvider>
    ),
  ],
} satisfies Meta<typeof OrderSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 既定。すべての明細が載る。 */
export const Default: Story = {
  args: {
    cart: ORDERABLE_CART,
    reference: SUBTOTAL_REFERENCE,
    size: "compact",
  },
};

/** 一部の明細が外れる状態。外れることを注記に足す。 */
export const WithExcluded: Story = {
  args: {
    cart: PARTIALLY_ORDERABLE_CART,
    reference: SUBTOTAL_REFERENCE,
    size: "compact",
  },
};

/** 確定できる明細が 1 つも無い状態。操作を押せなくする。 */
export const Blocked: Story = {
  args: {
    cart: BLOCKED_CART,
    reference: null,
    size: "compact",
  },
};
