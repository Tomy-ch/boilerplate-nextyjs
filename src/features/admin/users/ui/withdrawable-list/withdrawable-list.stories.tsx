import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "storybook/test";

import { ErrorKind } from "@/errors/error-kind";
import { failedActionState, idleActionState, succeededActionState } from "@/model/action-state";
import { ADMIN_USER_LIST_PATH } from "../../../paths";
import { WITHDRAW_CONFLICT_MESSAGE, type WithdrawUserAction } from "../../form-state";
import { USER_SCOPE } from "../../query";
import { ADMIN_USER_ROWS } from "../../users.fixture";
import { AdminUserPagination } from "../pagination/pagination";
import { WithdrawableUserList } from "./withdrawable-list";

/** canvas では送らない。押した先で何も起きないことを、待ち続けない形で示す。 */
const idle: WithdrawUserAction = () => Promise.resolve(idleActionState());

/** 退会が成立した状態を作る。 */
const succeeding: WithdrawUserAction = () =>
  Promise.resolve(succeededActionState({ name: "山田 太郎" }));

/** 進行中の購入が残って拒まれた状態を作る。 */
const rejecting: WithdrawUserAction = () =>
  Promise.resolve(
    failedActionState({
      formError: `山田 太郎 は${WITHDRAW_CONFLICT_MESSAGE}`,
      kind: ErrorKind.CONFLICT,
    }),
  );

/**
 * 行の操作 menu を開いてから「退会させる」を選び、確認の中の送信まで押す。
 *
 * menu も dialog も portal で `body` の側へ出るため、canvas の内側からは辿れない。
 */
async function withdraw(canvasElement: HTMLElement) {
  const body = within(document.body);

  await userEvent.click(within(canvasElement).getByRole("button", { name: "山田 太郎 の操作" }));
  await userEvent.click(await body.findByRole("menuitem", { name: "退会させる" }));

  const dialog = await body.findByRole("alertdialog");

  await userEvent.click(within(dialog).getByRole("button", { name: "退会させる" }));
}

const meta = {
  title: "Features/Admin/Users/WithdrawableList",
  component: WithdrawableUserList,
  parameters: {
    layout: "fullscreen",
    nextjs: { navigation: { pathname: ADMIN_USER_LIST_PATH } },
    docs: {
      story: { inline: false, iframeHeight: 640 },
      description: {
        component: [
          "退会の始まりと終わりを繋ぐ層です。行・確認の面・結果の報せは別々の部品にあり、**どれとどれが同じ相手の話かを知っているのはここだけ**です。",
          "確認は成否によらず閉じ、結果は一覧の上に残ります。",
        ].join(""),
      },
    },
  },
  args: {
    items: ADMIN_USER_ROWS,
    withdrawAction: idle,
    pagination: <AdminUserPagination location={{ scope: USER_SCOPE.ALL, page: 1 }} pageCount={4} />,
  },
} satisfies Meta<typeof WithdrawableUserList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** まだ何も送っていない状態。報せの領域は場所を取らない。 */
export const Default: Story = {};

/** 退会が成立した状態。確認は閉じ、何が起きたかは一覧の上に残る。 */
export const Withdrawn: Story = {
  args: { withdrawAction: succeeding },
  play: async ({ canvasElement }) => {
    await withdraw(canvasElement);
  },
};

/** 拒まれた状態。確認は同じく閉じ、拒まれた理由が一覧の上に残る。 */
export const Conflicted: Story = {
  args: { withdrawAction: rejecting },
  play: async ({ canvasElement }) => {
    await withdraw(canvasElement);
  },
};
