import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ReactElement } from "react";
import { userEvent, within } from "storybook/test";

import { neverSettlingAction } from "~catalog/lib/pending-action";
import { ProfileSubmitButton } from "./submit-button";

/**
 * 送信先を持つ `form` で包む。`useFormStatus` は親の `form` の状態を読むため、包まないと
 * 送信中を観測する相手が居ない。
 */
function withForm(Story: () => ReactElement) {
  return <form action={neverSettlingAction}>{Story()}</form>;
}

const meta = {
  title: "Features/Account/ProfileSubmitButton",
  component: ProfileSubmitButton,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: [
          "登録情報を送る操作です。`form` の子として切り出してあるのは、`useFormStatus` が**親の**",
          "`form` の送信状態を読むためです。送信中の見せ方は `Button` が持ち、ここは待っているあいだの",
          "名前を渡すだけです。**カタログでは送信が終わりません**（押した直後の姿を留めるためです）。",
        ].join(""),
      },
    },
  },
  args: { label: "保存する", pendingLabel: "保存しています…" },
  decorators: [withForm],
} satisfies Meta<typeof ProfileSubmitButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 押す前。 */
export const Default: Story = {};

/** 送信中。文言が入れ替わり、二度押しを受け付けない。 */
export const Pending: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "保存する" }));
  },
};

/** 登録の画面での文言。押せるときと待つあいだの名前だけが違う。 */
export const Register: Story = {
  args: { label: "登録する", pendingLabel: "登録しています…" },
};
