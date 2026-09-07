import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "storybook/test";

import { failedActionState, idleActionState, succeededActionState } from "@/model/action-state";
import { DELIVERY_CONFLICT_MESSAGE, type DeliveryAction } from "../../form-state";
import { SHIPPED_PURCHASES } from "../../shipments.fixture";
import { DeliveryListCard } from "./delivery-list";

/** canvas では送らない。押した先で何も起きないことを、待ち続けない形で示す。 */
const idle: DeliveryAction = () => Promise.resolve(idleActionState());

/** 配達の確認が通った状態を作る。 */
const succeeding: DeliveryAction = () =>
  Promise.resolve(succeededActionState({ purchaseCode: SHIPPED_PURCHASES[0].code }));

/** 読み込んでからの間に別の担当者が同じ注文を確認していた状態を作る。 */
const rejecting: DeliveryAction = () =>
  Promise.resolve(failedActionState({ formError: DELIVERY_CONFLICT_MESSAGE }));

/** 先頭の注文を配達済みにする。 */
async function confirmFirst(canvasElement: HTMLElement) {
  const [first] = within(canvasElement).getAllByRole("button", { name: "配達済みにする" });
  if (first === undefined) throw new Error("配達済みにする操作が無い");

  await userEvent.click(first);
}

const meta = {
  title: "Features/Admin/Shipments/DeliveryListCard",
  component: DeliveryListCard,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: [
          "発送済みの注文を並べ、配達を確認します。**まとめる操作を持ちません** —— 届いたかどうかは注文ごとに分かれるためです。",
          "**結果はカードに 1 つだけ**出ます —— 行ごとに状態を持たせると、どれが最後の結果なのかが読み取れなくなります。",
        ].join(""),
      },
    },
  },
  args: { purchases: SHIPPED_PURCHASES, deliverAction: idle },
  decorators: [(Story) => <div className="max-w-2xl">{Story()}</div>],
} satisfies Meta<typeof DeliveryListCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 確認を待っている注文が並んだ状態。操作は注文ごとに付く。 */
export const Default: Story = {};

/** 確認を待っている注文が無い状態。カードの枠は残したまま、無いことだけを伝える。 */
export const Empty: Story = {
  args: { purchases: [] },
};

/** 配達を確認した状態。結果はカードの下に 1 つだけ出る。 */
export const Confirmed: Story = {
  args: { deliverAction: succeeding },
  play: async ({ canvasElement }) => {
    await confirmFirst(canvasElement);
  },
};

/** 別の担当者が先に確認していた状態。理由をそのまま出す。 */
export const Conflicted: Story = {
  args: { deliverAction: rejecting },
  play: async ({ canvasElement }) => {
    await confirmFirst(canvasElement);
  },
};
