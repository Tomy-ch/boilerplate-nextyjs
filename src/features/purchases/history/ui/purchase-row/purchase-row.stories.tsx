import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { purchaseDetailPath } from "../../../facade/paths/paths";
import { HISTORY_ENTRIES, LARGE_AMOUNT_ENTRY } from "../../../purchases.fixture";
import { PurchaseRow } from "./purchase-row";

const [FIRST, , DELIVERED, CANCELED] = HISTORY_ENTRIES;

const meta = {
  title: "Features/Purchases/History/PurchaseRow",
  component: PurchaseRow,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: [
          "購入履歴の 1 行です。**行そのものが詳細への行き先**で、狙う的を文字の幅まで縮めません。",
          "状況の色は届いたか止まったかで変わります。文字を読まずに目的の購入へ寄せるためで、",
          "色は文言の補強でしかありません。",
        ].join(""),
      },
    },
  },
  decorators: [
    (Story) => (
      <ul className="divide-y rounded-lg border">
        <Story />
      </ul>
    ),
  ],
} satisfies Meta<typeof PurchaseRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 既定。注文日時・購入コード・状況・合計を 1 行に収める。 */
export const Default: Story = {
  args: {
    purchase: FIRST ?? LARGE_AMOUNT_ENTRY,
    href: purchaseDetailPath((FIRST ?? LARGE_AMOUNT_ENTRY).code),
  },
};

/** 配達まで終わった購入。望ましい終端なので緑で示す。 */
export const Delivered: Story = {
  args: {
    purchase: DELIVERED ?? LARGE_AMOUNT_ENTRY,
    href: purchaseDetailPath((DELIVERED ?? LARGE_AMOUNT_ENTRY).code),
  },
};

/** キャンセル済みの購入。届かなかった終端なので赤で示す。状況の名称はバックエンドが解決した値をそのまま出す。 */
export const Canceled: Story = {
  args: {
    purchase: CANCELED ?? LARGE_AMOUNT_ENTRY,
    href: purchaseDetailPath((CANCELED ?? LARGE_AMOUNT_ENTRY).code),
  },
};

/** 桁の大きい合計。まだ動いている状態なので色は付かない。金額が伸びても行の高さは変わらない。 */
export const LargeAmount: Story = {
  args: {
    purchase: LARGE_AMOUNT_ENTRY,
    href: purchaseDetailPath(LARGE_AMOUNT_ENTRY.code),
  },
};
