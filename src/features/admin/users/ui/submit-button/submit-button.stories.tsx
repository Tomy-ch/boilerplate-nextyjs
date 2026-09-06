import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ReactElement } from "react";
import { userEvent, within } from "storybook/test";

import { neverSettlingAction } from "~catalog/lib/pending-action";
import { WithdrawSubmitButton } from "./submit-button";

/**
 * 送信先を持つ `form` で包む。`useFormStatus` は親の `form` の状態を読むため、包まないと
 * 送信中を観測する相手が居ない。
 */
function withForm(Story: () => ReactElement) {
  return <form action={neverSettlingAction}>{Story()}</form>;
}

const meta = {
  title: "Features/Admin/Users/WithdrawSubmitButton",
  component: WithdrawSubmitButton,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: [
          "退会を送る操作です。`form` の子として切り出してあり、親の `form` の送信状態を読みます。",
          "**カタログでは送信が終わりません** —— 押した直後の姿を留めるためで、実際は結果が返ると確認ごと閉じます。",
        ].join(""),
      },
    },
  },
  decorators: [withForm],
} satisfies Meta<typeof WithdrawSubmitButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 押す前。取り返せない操作なので、色でも destructive を示す。 */
export const Default: Story = {};

/** 送信中。文言が入れ替わり、二度押しを受け付けない。 */
export const Pending: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "退会させる" }));
  },
};
