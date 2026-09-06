import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { cn } from "@/components/cn";

import {
  EARPHONE_LINE,
  INSUFFICIENT_LINE,
  NOT_FOUND_LINE,
  PRICE_INCREASED_LINE,
  WATCH_LINE,
} from "../../cart.fixture";
import { CartLineRow } from "./line-row";

const meta = {
  title: "Features/Cart/LineRow",
  component: CartLineRow,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: [
          "カートの明細 1 行です。脇の領域と全画面の両方が使い、幅の違いは折り返しで吸収します。",
          "**商品状態は出しません。** 契約が返す明細に無く、出すには明細の数だけ商品を引くことになります。",
          "サムネイルは装飾として出し、代替テキストは空です。同じ商品名を隣の文字が持っています。",
          "金額は単価だけです。行ごとの小計は単価と数量の掛け算になり、金額の計算をフロントに戻すことになります。",
        ].join(""),
      },
    },
  },
  decorators: [
    // 脇に出す姿は `parameters.narrow` で指定する。器の幅で折り返しが変わる部品なので、
    // 実物と同じ幅の器に入れないと確かめたい姿にならない。
    (Story, context) => (
      <ul className={cn("flex flex-col divide-y", context.parameters["narrow"] === true && "w-70")}>
        <Story />
      </ul>
    ),
  ],
} satisfies Meta<typeof CartLineRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 事情の無い明細。 */
export const Default: Story = {
  args: { line: EARPHONE_LINE },
};

/** 名前が長い明細。2 行で打ち切り、操作は折り返して下へ回る。 */
export const LongName: Story = {
  args: { line: WATCH_LINE },
};

/** 数量が 1 の明細。減らす操作は押せず、取り除く操作が残る。 */
export const AtMinimumQuantity: Story = {
  args: { line: { ...EARPHONE_LINE, quantity: 1 } },
};

/** 在庫が足りない明細。今買える上限で増やす操作が止まる。 */
export const InsufficientStock: Story = {
  args: { line: INSUFFICIENT_LINE },
};

/** 値が上がった明細。買えるため弱めず、合算から外れることだけを伝える。 */
export const PriceIncreased: Story = {
  args: { line: PRICE_INCREASED_LINE },
};

/** 商品を引けない明細。名前も単価も出せないが、取り除く操作は残す。 */
export const NotFound: Story = {
  args: { line: NOT_FOUND_LINE },
};

/** 画像を持たない明細。代替画像へ倒す。 */
export const WithoutImage: Story = {
  args: { line: { ...EARPHONE_LINE, imageUrl: null } },
};

/** 脇に出す幅（280px 前後）に置いた明細。名前は 2 行で打ち切り、操作は画像の下へ回る。 */
export const InNarrowContainer: Story = {
  args: { line: WATCH_LINE },
  parameters: { narrow: true },
};
