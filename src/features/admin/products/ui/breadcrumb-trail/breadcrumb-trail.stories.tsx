import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ADMIN_PRODUCT_LIST_PATH } from "../../../paths";
import { ProductBreadcrumbTrail } from "./breadcrumb-trail";

const meta = {
  title: "Features/Admin/Products/BreadcrumbTrail",
  component: ProductBreadcrumbTrail,
  parameters: {
    layout: "padded",
    nextjs: { navigation: { pathname: ADMIN_PRODUCT_LIST_PATH } },
    docs: {
      description: {
        component: [
          "商品まわりの画面の、現在地までの階層です。受け取るのは一覧より下だけで、**戻れるのは一覧まで**です —— 途中の段は商品名で、それ自体を開く面が管理側に無いので押せません。",
        ].join(""),
      },
    },
  },
  args: { trail: ["新規作成"] },
} satisfies Meta<typeof ProductBreadcrumbTrail>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 一覧のすぐ下。押せるのは先頭の 1 段だけ。 */
export const OneLevel: Story = {};

/** 2 段下。途中の段は商品名で、それ自体を開く面が管理側に無いので押せない。 */
export const TwoLevels: Story = {
  args: { trail: ["ワイヤレスイヤホン", "在庫の補充"] },
};

/** 商品名が長い場合。器の幅で折り返す。 */
export const LongName: Story = {
  args: {
    trail: [
      "ノイズキャンセリング ヘッドホン（over-ear・第 3 世代・ケース同梱・保証 2 年付き）",
      "在庫の補充",
    ],
  },
};
