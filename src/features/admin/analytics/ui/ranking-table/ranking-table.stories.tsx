import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { toProductId } from "@/model/product/product";
import { ADMIN_ANALYTICS_PATH } from "../../../paths";
import { RANKING_ROWS } from "../../analytics.fixture";
import { RankingTable } from "./ranking-table";

const meta = {
  title: "Features/Admin/Analytics/RankingTable",
  component: RankingTable,
  parameters: {
    layout: "padded",
    nextjs: { navigation: { pathname: ADMIN_ANALYTICS_PATH } },
    docs: {
      description: {
        component: [
          "売れ筋の商品を順位の順に並べます。**上の集計とは期間が別**で、見出しの「直近 30 日」がその断りです。",
          "**押せるのは商品名だけ**で、行全体は押せません（行き先は利用者向けの商品の面）。狭い段では価格の列を伏せます。",
        ].join(""),
      },
    },
  },
  args: { rows: RANKING_ROWS },
} satisfies Meta<typeof RankingTable>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 5 件が並んだ状態。押せるのは商品名だけ。 */
export const Default: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
};

/** 狭い段。価格の列を伏せ、順位・商品名・販売数を残す。 */
export const Mobile: Story = {
  globals: { viewport: { value: "mobile2", isRotated: false } },
};

/** 直近 30 日に売れたものが無い状態。表の形は保ったまま、無いことだけを伝える。 */
export const Empty: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
  args: { rows: [] },
};

/** 商品名が長い行。名前だけが折り返し、数の列は右端で揃ったまま。 */
export const LongName: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
  args: {
    rows: [
      {
        id: toProductId("0195f0c2-3000-7000-8000-000000000009"),
        rank: 1,
        name: "ノイズキャンセリング ヘッドホン（over-ear・第 3 世代・ケース同梱・保証 2 年付き）",
        price: "349.00",
        soldQuantity: 128,
      },
      ...RANKING_ROWS.slice(1, 3),
    ],
  },
};
