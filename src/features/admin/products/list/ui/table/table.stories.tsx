import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "storybook/test";

import { CursorPagination } from "@/components/app-starter/cursor-pagination/cursor-pagination";
import { ADMIN_PRODUCT_LIST_PATH } from "../../../../paths";
import { LONG_NAME_PRODUCT_ROW, PRODUCT_ROWS } from "../../list.fixture";
import { AdminProductTable } from "./table";

const meta = {
  title: "Features/Admin/Products/List/Table",
  component: AdminProductTable,
  parameters: {
    layout: "padded",
    nextjs: { navigation: { pathname: ADMIN_PRODUCT_LIST_PATH } },
    docs: {
      story: { inline: false, iframeHeight: 640 },
      description: {
        component: [
          "管理側の商品一覧です。**利用者側の一覧と同じ商品を表で出します** —— 買う側はカード、管理側は件どうしを見比べるためです。",
          "行全体が編集への導線ですが、支援技術には商品名だけが遷移先として見えます。**在庫の数は補充への導線**で、どちらへも行の操作 menu から明示的に選べます。",
          "狭い段では分類と状態の列を伏せます。",
        ].join(""),
      },
    },
  },
  args: {
    items: PRODUCT_ROWS,
    pagination: <CursorPagination aria-label="商品一覧のページ送り" nextHref="?after=next" />,
  },
} satisfies Meta<typeof AdminProductTable>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 状態の 4 つの区分と、マスタに無い状態が並んだ状態。 */
export const Default: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
};

/** 狭い段。列は商品名・価格・在庫・操作だけに絞る。 */
export const Mobile: Story = {
  globals: { viewport: { value: "mobile2", isRotated: false } },
};

/** 条件に合う商品が無い状態。表の形は保ったまま、無いことだけを伝える。 */
export const Empty: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
  args: { items: [] },
};

/** 契約上の最大長を持つ商品名。列幅を押し広げず、折り返して収まる。 */
export const LongName: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
  args: { items: [LONG_NAME_PRODUCT_ROW, ...PRODUCT_ROWS.slice(0, 2)] },
};

/** 行の操作を開いた状態。編集と在庫の補充へ進める。 */
export const RowActionsOpen: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "ワイヤレスイヤホン の操作" }),
    );
  },
};
