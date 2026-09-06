import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ReactElement } from "react";

import {
  PlaceOrderStateProvider,
  usePlaceOrderState,
} from "../place-order-state/place-order-state";
import { PlaceOrderSubmit } from "./place-order-submit";

/** 送信先は器が配る。押した先が無い form に置くと、押した瞬間に画面ごと読み込み直される。 */
function OrderForm({ children }: { children: ReactElement }) {
  const { formAction } = usePlaceOrderState();

  return <form action={formAction}>{children}</form>;
}

/** 送信状態は画面が 1 つだけ持つ。器の外では読めないので、包まないと描けない。 */
function withPlaceOrderState(Story: () => ReactElement) {
  return (
    <PlaceOrderStateProvider idempotencyKey="0195f0c2-0000-7000-b000-000000000001">
      <OrderForm>{Story()}</OrderForm>
    </PlaceOrderStateProvider>
  );
}

const meta = {
  title: "Features/Checkout/PlaceOrderSubmit",
  component: PlaceOrderSubmit,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: [
          "購入を確定する送信部です。**待っているかは画面が 1 つだけ持つ送信の状態から採ります**（`Features/Checkout/PlaceOrderState`）。",
          "幅は器に合わせ、集計の中では主操作として広げ、確かめの footer では文言の幅に収めます。",
        ].join(""),
      },
    },
  },
  args: { label: "注文を確定する", orderable: true },
  decorators: [withPlaceOrderState],
} satisfies Meta<typeof PlaceOrderSubmit>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 確定できる明細がある状態。 */
export const Default: Story = {};

/** 器の幅いっぱいに広げた姿。集計の中では主操作になる。 */
export const FullWidth: Story = {
  args: { fullWidth: true },
};

/** 確定できる明細が 1 つも無い状態。押せない。 */
export const NotOrderable: Story = {
  args: { orderable: false },
};
