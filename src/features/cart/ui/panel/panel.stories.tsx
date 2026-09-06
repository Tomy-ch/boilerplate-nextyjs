import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { useCartStore } from "@/stores/cart-store";

import { CART, CART_WITH_ISSUES, CART_WITHOUT_PURCHASABLE, EMPTY_CART } from "../../cart.fixture";
import { CartPanel } from "./panel";

/** 中身を見たいという要求を、story の初期状態として指定する。 */
function seedOpen(isOpen: boolean) {
  useCartStore.setState({ isOpen });
}

const meta = {
  title: "Features/Cart/Panel",
  component: CartPanel,
  parameters: {
    layout: "padded",
    docs: {
      // story ごとに iframe を分ける。開いた状態と閉じた状態を同じ docs ページへ載せるが、
      // 開閉を持つ store は 1 つしかないので、同じ木で描くと後の story の値が先へも及ぶ。
      story: { inline: false, iframeHeight: 640 },
      description: {
        component: [
          "本文の脇に出すカートです。狭い幅では出しません（`CartHeaderAction` が被せる形で受け持つ）。",
          "**閉じると領域ごと消えます。** 本文から 280px 前後を持っていくため、閉じられないと",
          "一度カートへ入れた利用者は本文を狭いまま読み続けることになります。開き直す入口は header です。",
          "小計と先へ進む導線は送りの外に置くため、明細が画面の高さを超えても見失いません。",
        ].join(""),
      },
    },
  },
  args: { cart: CART },
  decorators: [
    (Story) => {
      seedOpen(true);

      return <Story />;
    },
  ],
} satisfies Meta<typeof CartPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 明細が複数ある状態。 */
export const WithLines: Story = {};

/** 買えない明細と値の変わった明細が混ざった状態。事情は行の中に出る。 */
export const WithIssues: Story = {
  args: { cart: CART_WITH_ISSUES },
};

/** 買える明細が 1 つも無い状態。購入手続きへは進ませない。 */
export const WithoutPurchasable: Story = {
  args: { cart: CART_WITHOUT_PURCHASABLE },
};

/** 空の状態。枠ごと描画しない。 */
export const Empty: Story = {
  args: { cart: EMPTY_CART },
};

/** 閉じた状態。中身はあるが領域ごと出さない。 */
export const Closed: Story = {
  decorators: [
    (Story) => {
      seedOpen(false);

      return <Story />;
    },
  ],
};
