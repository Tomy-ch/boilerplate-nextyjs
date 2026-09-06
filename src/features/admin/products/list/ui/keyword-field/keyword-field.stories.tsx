import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "storybook/test";

import { ADMIN_PRODUCT_LIST_PATH } from "../../../../paths";
import { NO_CONDITIONS } from "../../list.fixture";
import { AdminProductKeywordField } from "./keyword-field";

const meta = {
  title: "Features/Admin/Products/List/KeywordField",
  component: AdminProductKeywordField,
  parameters: {
    layout: "padded",
    nextjs: { navigation: { pathname: ADMIN_PRODUCT_LIST_PATH } },
    docs: {
      description: {
        component: [
          "管理側の商品一覧の検索欄です。**打鍵では検索しません** —— 一覧はページ送りで見る前提なので、",
          "打鍵のたびに取り直すと読んでいる途中で行が入れ替わります。候補から選ぶ分類・状態と違って、",
          "打ち終わりが判らないのも理由です。**空のまま押せるのは、いま検索語が効いているときだけ**です",
          "—— 効いている語を消すには空の送信が要る一方、何も効いていない状態での送信は結果が変わりません。",
        ].join(""),
      },
    },
  },
  args: { conditions: NO_CONDITIONS },
} satisfies Meta<typeof AdminProductKeywordField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 何も効いていない状態。送信しても結果が変わらないので、押せない。 */
export const Empty: Story = {};

/** 打ちかけの状態。まだ送っていないので一覧は変わっていない。 */
export const Typing: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.type(within(canvasElement).getByRole("searchbox"), "イヤホン");
  },
};

/** 検索語が効いている状態。確定した語は URL が持ち、入力欄はそれを写している。 */
export const Searched: Story = {
  args: { conditions: { ...NO_CONDITIONS, keyword: "イヤホン" } },
};
