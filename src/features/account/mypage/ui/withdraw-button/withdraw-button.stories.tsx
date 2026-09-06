import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mocked, userEvent, within } from "storybook/test";

import { failedActionState } from "@/model/action-state";
import { withdrawAction } from "../../../actions";
import { WithdrawButton } from "./withdraw-button";

/** 確認を開く。dialog は portal で `body` の側へ出るため、canvas の内側からは辿れない。 */
async function openConfirm(canvasElement: HTMLElement) {
  await userEvent.click(within(canvasElement).getByRole("button", { name: "退会する" }));
  await within(document.body).findByRole("alertdialog");
}

const meta = {
  title: "Features/Account/WithdrawButton",
  component: WithdrawButton,
  parameters: {
    layout: "centered",
    docs: {
      story: { inline: false, iframeHeight: 480 },
      description: {
        component: [
          "退会の操作です。押すと確認が開き、**確定するまで dialog は閉じません** —— 送信中の表示も失敗の文言もこの中に出ます。",
          "閉じるのは成立して画面が変わるときだけです。カタログでは送信先を差し替えてあります。",
        ].join(""),
      },
    },
  },
} satisfies Meta<typeof WithdrawButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 押す前。 */
export const Default: Story = {};

/** 確認を開いた状態。何が戻せないのかを先に書く。 */
export const Confirming: Story = {
  play: async ({ canvasElement }) => {
    await openConfirm(canvasElement);
  },
};

/**
 * 進行中の購入が残って退会できなかった状態。
 *
 * @remarks
 * 送信先は Server Action で、カタログでは差し替えてあります。失敗は props では作れないため、
 * 戻り値の側から作ります。
 */
export const Failed: Story = {
  beforeEach: () => {
    mocked(withdrawAction).mockResolvedValue(
      failedActionState({
        formError: "進行中の購入が残っているため退会できません。",
      }),
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await openConfirm(canvasElement);
    await userEvent.click(
      within(await within(document.body).findByRole("alertdialog")).getByRole("button", {
        name: "退会する",
      }),
    );
    await canvas.findByText("退会できませんでした");
  },
};
