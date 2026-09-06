import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ADMIN_USER_LIST_PATH } from "../../../paths";
import { USER_SCOPE } from "../../query";
import { AdminUserPagination } from "./pagination";

const meta = {
  title: "Features/Admin/Users/Pagination",
  component: AdminUserPagination,
  parameters: {
    layout: "padded",
    nextjs: { navigation: { pathname: ADMIN_USER_LIST_PATH } },
    docs: {
      description: {
        component: [
          "利用者一覧のページ送りです。**任意のページへ跳べます** —— 契約が位置と全件数を返す",
          "offset 方式のため、次と前しか指せない商品・購入の一覧とは部品から違います。",
          "端でも前後を消さず、押せない control として残します。消すと残った側が左右へ動き、",
          "同じ場所を狙って押し続けられません。",
        ].join(""),
      },
    },
  },
  args: { location: { scope: USER_SCOPE.ALL, page: 1 }, pageCount: 4 },
} satisfies Meta<typeof AdminUserPagination>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 先頭ページ。戻る先が無いので「前へ」は押せない。 */
export const FirstPage: Story = {};

/** 途中のページ。前後のどちらへも進め、離れた範囲は省略記号で畳まれる。 */
export const MiddlePage: Story = {
  args: { location: { scope: USER_SCOPE.ALL, page: 5 }, pageCount: 12 },
};

/** 末尾のページ。次が無いので「次へ」は押せない。 */
export const LastPage: Story = {
  args: { location: { scope: USER_SCOPE.ALL, page: 4 }, pageCount: 4 },
};

/** ページが 1 枚しかない状態。前後のどちらも押せないまま、位置は保たれる。 */
export const SinglePage: Story = {
  args: { location: { scope: USER_SCOPE.ALL, page: 1 }, pageCount: 1 },
};

/** 絞り込みが効いている状態。行き先の link は絞り込みを保ったまま作られる。 */
export const Scoped: Story = {
  args: { location: { scope: USER_SCOPE.WITHDRAWN, page: 2 }, pageCount: 3 },
};
