import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, userEvent, within } from "storybook/test";

import { ADMIN_USER_LIST_PATH } from "../../../paths";
import { USER_SCOPE } from "../../query";
import { ADMIN_USER_ROWS, LONG_NAME_USER_ROW, WITHDRAWN_USER_ROWS } from "../../users.fixture";
import { AdminUserPagination } from "../pagination/pagination";
import { AdminUserTable } from "./table";

const meta = {
  title: "Features/Admin/Users/Table",
  component: AdminUserTable,
  parameters: {
    layout: "padded",
    nextjs: { navigation: { pathname: ADMIN_USER_LIST_PATH } },
    docs: {
      description: {
        component: [
          "管理側の利用者一覧です。取得もページ送りの組み立ても持たず、並べる利用者と下へ置くものを",
          "受け取るだけです。**確認を出すのはここではありません** —— 行が知っているのは「この人に対して",
          "退会が選ばれた」ことだけで、確認の面と結果は一覧の外側に居ます。退会済みかは色ではなく",
          "文字のバッジで示し、行そのものは淡くしません。",
        ].join(""),
      },
    },
  },
  args: {
    items: ADMIN_USER_ROWS,
    onWithdraw: fn(),
    pagination: <AdminUserPagination location={{ scope: USER_SCOPE.ALL, page: 1 }} pageCount={4} />,
  },
} satisfies Meta<typeof AdminUserTable>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 有効と退会済みが混ざった並び。状態の列で見分けられる。 */
export const Default: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
};

/** 狭い段。電話番号の列を伏せ、名前・メール・状態・操作だけを残す。 */
export const Mobile: Story = {
  globals: { viewport: { value: "mobile2", isRotated: false } },
};

/** 条件に合う利用者が無い状態。表の形は保ったまま、無いことだけを伝える。 */
export const Empty: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
  args: { items: [] },
};

/** 退会済みだけの並び。もう一度退会させる意味が無いので、操作の trigger ごと出さない。 */
export const WithdrawnOnly: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
  args: { items: WITHDRAWN_USER_ROWS },
};

/** 契約上の最大長を持つ姓名。表は自分の領域の中で横へ伸び、画面そのものは横へあふれない。 */
export const LongName: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
  args: { items: [LONG_NAME_USER_ROW, ...ADMIN_USER_ROWS.slice(0, 2)] },
};

/** 行の操作を開いた状態。有効な利用者には退会だけが並ぶ。 */
export const RowActionsOpen: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "山田 太郎 の操作" }));
  },
};
