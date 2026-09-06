import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ReactElement } from "react";
import { userEvent, within } from "storybook/test";

import { neverSettlingAction } from "~catalog/lib/pending-action";
import { ProductSubmitButton } from "./submit-button";

/**
 * 送信先を持つ `form` で包む。`useFormStatus` は親の `form` の状態を読むため、包まないと
 * 送信中を観測する相手が居ない。
 */
function withForm(Story: () => ReactElement) {
  return <form action={neverSettlingAction}>{Story()}</form>;
}

const meta = {
  title: "Features/Admin/Products/SubmitButton",
  component: ProductSubmitButton,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: [
          "商品を送る操作です。`form` の子として切り出してあるのは、`useFormStatus` が**親の** `form` の",
          "送信状態を読むためです。送信中の見せ方は `Button` が持ちます —— 文言を差し替えると幅が動くので、",
          "ここは文言を渡すだけで差し替えません。**カタログでは送信が終わりません**（押した直後の姿を",
          "留めるためです）。",
        ].join(""),
      },
    },
  },
  args: { label: "登録する", pendingLabel: "登録しています…", blocked: false },
  decorators: [withForm],
} satisfies Meta<typeof ProductSubmitButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 押せる状態。 */
export const Default: Story = {};

/** 止める理由がある状態。画像を送り終えていないときなどに押せなくなる。 */
export const Blocked: Story = {
  args: { blocked: true },
};

/** 送信中。文言が入れ替わり、二度押しを受け付けない。 */
export const Pending: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "登録する" }));
  },
};
