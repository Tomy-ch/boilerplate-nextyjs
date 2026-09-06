import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { CursorPage } from "@/model/pagination";
import type { ProductListItem } from "@/model/product/product";
import { toProductId } from "@/model/product/product";
import { SAMPLE_ITEM_URLS } from "~catalog/lib/sample-asset";
import { ProductInfiniteList } from "./infinite-list";

let itemSeq = 0;

function item(overrides: Partial<ProductListItem> = {}): ProductListItem {
  itemSeq += 1;

  return {
    id: toProductId(`0195f0c2-0000-7000-8000-${String(itemSeq).padStart(12, "0")}`),
    name: "ワイヤレスイヤホン",
    price: "19.99",
    quantity: 12,
    categoryName: "オーディオ",
    statusName: "公開",
    imageUrl: SAMPLE_ITEM_URLS[0],
    ...overrides,
  };
}

const ITEMS: readonly ProductListItem[] = [
  item(),
  item({ name: "スマートウォッチ", price: "129.00", imageUrl: null }),
  item({ name: "USB-C ハブ", price: "45.50" }),
  item({ name: "編組ケーブル 2m", price: "0.99", imageUrl: null }),
];

const FIRST_PAGE: CursorPage<ProductListItem> = { items: ITEMS, nextCursor: "next" };

const meta = {
  title: "Features/Products/List/InfiniteList",
  component: ProductInfiniteList,
  parameters: {
    layout: "padded",
    docs: {
      story: { inline: false, iframeHeight: 720 },
      description: {
        component: [
          "読み進められる商品の一覧です。**取得と見た目をつなぐだけ**で、見た目は `LoadMoreList` が、",
          "取得と末尾到達の検知は `useInfiniteProducts` が持ちます。分けてあるのは、見え方の確認に取得を",
          "必要としないようにするためです（見た目そのものは `Features/Products/List/LoadMoreList` で",
          "全状態を見られます）。**canvas では一覧が短く末尾の目印が最初から見えている**ため、開いた時点で",
          "続きを取りに行きます。返すのはカタログ自身で、届く続きは 1 度きりです。",
        ].join(""),
      },
    },
  },
  args: { initial: FIRST_PAGE, query: {}, total: 24 },
} satisfies Meta<typeof ProductInfiniteList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 開いた直後。末尾の目印が見えているので、その場で続きを取りに行き、届いた分まで並ぶ。 */
export const Default: Story = {};

/** 最初から続きが無い状態。取りに行かないので、渡された分だけが並ぶ。 */
export const ReachedEnd: Story = {
  args: { initial: { items: ITEMS, nextCursor: null } },
};
