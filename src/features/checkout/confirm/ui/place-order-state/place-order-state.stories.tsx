import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ReactNode } from "react";
import { mocked, userEvent, within } from "storybook/test";

import { failedActionState } from "@/model/action-state";
import { placeOrderAction } from "../../../actions";
import { PlaceOrderError, PlaceOrderSubmit } from "../place-order-submit/place-order-submit";
import { PlaceOrderStateProvider, usePlaceOrderState } from "./place-order-state";

/** 送信先は器が配る。実画面と同じく、姿ごとの form が同じ送信先を指す。 */
function OrderForm({ children, label }: { children?: ReactNode; label: string }) {
  const { formAction } = usePlaceOrderState();

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-md border p-4">
      <p className="text-muted-foreground text-sm">{label}</p>
      {children}
    </form>
  );
}

/** 画面に 1 つだけ置いた送信状態が、2 か所の姿へ同じように届くことを見るための並び。 */
function TwoPlaces() {
  return (
    <div className="flex flex-col gap-6">
      <OrderForm label="脇に貼り付く姿">
        <PlaceOrderSubmit fullWidth label="注文を確定する" orderable />
      </OrderForm>
      <OrderForm label="下端に固定する帯">
        <PlaceOrderSubmit label="注文を確定する" orderable />
      </OrderForm>
      <PlaceOrderError />
    </div>
  );
}

const meta = {
  title: "Features/Checkout/Confirm/PlaceOrderState",
  component: PlaceOrderStateProvider,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: [
          "確定の送信状態を、画面に 1 つだけ置く器です。**同じ集計を 2 か所に描く**（脇に貼り付く姿と下端の帯）",
          "ので、姿ごとに状態を持つと、幅の境界を跨いだ瞬間に送信中の表示も失敗の文言も消えます。",
          "待っているかを `useFormStatus` ではなく `useActionState` から採るのはこのためです。",
        ].join(""),
      },
    },
  },
  args: { idempotencyKey: "0195f0c2-0000-7000-b000-000000000001", children: <TwoPlaces /> },
  decorators: [(Story) => <div className="max-w-md">{Story()}</div>],
} satisfies Meta<typeof PlaceOrderStateProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

/** まだ送っていない状態。2 か所とも同じ姿で押せる。 */
export const Idle: Story = {};

/**
 * 確定が通らなかった状態。文言は 2 か所のどちらから送っても同じ場所に出る。
 *
 * @remarks
 * 送信先は Server Action で、カタログでは差し替えてあります。失敗は props では作れないため、
 * 戻り値の側から作ります。
 */
export const Failed: Story = {
  beforeEach: () => {
    mocked(placeOrderAction).mockResolvedValue(
      failedActionState({ formError: "在庫が変わったため確定できませんでした。" }),
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [first] = canvas.getAllByRole("button", { name: "注文を確定する" });

    await userEvent.click(first);
    await canvas.findByText("注文を確定できませんでした");
  },
};
