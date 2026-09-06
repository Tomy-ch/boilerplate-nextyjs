import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, userEvent, within } from "storybook/test";

import { neverSettlingAction } from "~catalog/lib/pending-action";
import { ADMIN_USER_ROWS, LONG_NAME_USER_ROW } from "../../users.fixture";
import { UserWithdrawDialog } from "./withdraw-dialog";

/** 確認の中の送信を押す。同じ呼び名が外にも居るので、dialog の内側へ絞る。 */
async function submitWithdraw() {
  const dialog = await within(document.body).findByRole("alertdialog");

  await userEvent.click(within(dialog).getByRole("button", { name: "退会させる" }));
}

const meta = {
  title: "Features/Admin/Users/WithdrawDialog",
  component: UserWithdrawDialog,
  parameters: {
    layout: "fullscreen",
    docs: {
      story: { inline: false, iframeHeight: 420 },
      description: {
        component: [
          "退会させる前の確認です。**不可逆なので確認を挟みます** —— 押し間違いが取り返せない操作なので、",
          "背景を押しても閉じません。本文が後始末の但し書きを持つのは、退会そのものが終わっても購入の",
          "取消と在庫の戻しは後から順に進むためです。**この面は trigger を持ちません** —— 開くのは行の",
          "操作が選ばれたときだけで、送信の結果を受けるのも外側です。",
        ].join(""),
      },
    },
  },
  args: {
    target: ADMIN_USER_ROWS[0],
    onDismiss: fn(),
    formAction: neverSettlingAction,
  },
} satisfies Meta<typeof UserWithdrawDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 確認を開いた状態。やめる側が既定の位置に立つ。 */
export const Open: Story = {};

/** 送信中。確認は開いたまま留まり、結果が返ってから外側が閉じる。 */
export const Submitting: Story = {
  play: submitWithdraw,
};

/** 名前が長い相手。見出しが折り返しても本文と操作の位置は動かない。 */
export const LongName: Story = {
  args: { target: LONG_NAME_USER_ROW },
};
