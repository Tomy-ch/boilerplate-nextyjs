import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ErrorKind } from "@/errors/error-kind";
import { failedActionState, succeededActionState } from "@/model/action-state";
import {
  WITHDRAW_CONFLICT_MESSAGE,
  WITHDRAW_TARGET_LOST_MESSAGE,
  type WithdrawUserState,
} from "../../form-state";
import { WithdrawFeedback } from "./withdraw-feedback";

const SUCCEEDED: WithdrawUserState = succeededActionState({ name: "山田 太郎" });

const CONFLICTED: WithdrawUserState = failedActionState({
  formError: `山田 太郎 は${WITHDRAW_CONFLICT_MESSAGE}`,
  kind: ErrorKind.CONFLICT,
});

const TARGET_LOST: WithdrawUserState = failedActionState({
  formError: WITHDRAW_TARGET_LOST_MESSAGE,
});

const meta = {
  title: "Features/Admin/Users/WithdrawFeedback",
  component: WithdrawFeedback,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: [
          "退会させた結果の報せです。**一覧の上に置きます** —— 確認の面は結果が返ると閉じるので、",
          "その中に出した文言は一緒に消え、成立した行は絞り込み次第で一覧からも消えます。",
          "成立の報せに但し書きが付くのは、退会そのものが終わっていても購入の取消と在庫の戻しは",
          "後から順に進むためです。まだ何も送っていない状態では何も描きません。",
        ].join(""),
      },
    },
  },
  args: { state: SUCCEEDED },
} satisfies Meta<typeof WithdrawFeedback>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 成立した状態。誰を退会させたかと、後始末がまだ続くことを添える。 */
export const Succeeded: Story = {};

/** 進行中の購入が残って拒まれた状態。拒んだ理由をそのまま出す。 */
export const Conflicted: Story = {
  args: { state: CONFLICTED },
};

/** 対象が送られてこなかった状態。開き直す先を文言が示す。 */
export const TargetLost: Story = {
  args: { state: TARGET_LOST },
};
