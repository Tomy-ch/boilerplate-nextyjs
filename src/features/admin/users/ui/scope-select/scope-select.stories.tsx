import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ADMIN_USER_LIST_PATH } from "../../../paths";
import { USER_SCOPE } from "../../query";
import { UserScopeSelect } from "./scope-select";

const meta = {
  title: "Features/Admin/Users/ScopeSelect",
  component: UserScopeSelect,
  parameters: {
    layout: "padded",
    nextjs: { navigation: { pathname: ADMIN_USER_LIST_PATH } },
    docs: {
      description: {
        component: [
          "一覧が対象にする範囲を選ぶ欄です。**canvas では遷移が起きません** —— 選んでも表示が",
          "変わらないのはそのためで、実際は選んだ時点でその範囲の一覧へ移ります。確定を待たせないのは、",
          "排他の 3 つしかなく結果が同じ画面に出るためです。native の `select` で組むのは、候補が固定で",
          "複数選べないからです。",
        ].join(""),
      },
    },
  },
  args: { value: USER_SCOPE.ALL },
} satisfies Meta<typeof UserScopeSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 絞り込んでいない状態。 */
export const All: Story = {};

/** 有効な利用者だけに絞った状態。 */
export const Active: Story = {
  args: { value: USER_SCOPE.ACTIVE },
};

/** 退会済みだけに絞った状態。 */
export const Withdrawn: Story = {
  args: { value: USER_SCOPE.WITHDRAWN },
};
