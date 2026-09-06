import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { useCartStore } from "@/stores/cart-store";
import { CART, CART_WITH_ISSUES, EMPTY_CART } from "../../cart.fixture";
import { CartHeaderDrawer } from "./header-drawer";

/** 中身を見たいという要求を、story の初期状態として指定する。 */
function seedOpen(isOpen: boolean) {
  useCartStore.setState({ isOpen });
}

const meta = {
  title: "Features/Cart/HeaderDrawer",
  component: CartHeaderDrawer,
  parameters: {
    layout: "fullscreen",
    docs: {
      story: { inline: false, iframeHeight: 640 },
      description: {
        component: [
          "脇に常設できない幅での、カートの入口と中身です。**引き出す操作は押下だけ**で、画面端からの",
          "swipe は持ちません —— 端からの swipe は browser の戻る操作と競合し、どちらが起きるかが端末ごとに",
          "変わります。開閉は `stores` の要求に従います —— 商品をカートへ入れたときにも開く必要があり、",
          "その操作は別の feature にあるためです。",
        ].join(""),
      },
    },
  },
  args: { cart: CART },
  globals: { viewport: { value: "mobile2", isRotated: false } },
  decorators: [
    (Story) => {
      seedOpen(false);

      return <Story />;
    },
  ],
} satisfies Meta<typeof CartHeaderDrawer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 閉じている状態。header に出ているのは点数付きの入口だけ。 */
export const Closed: Story = {};

/** 開いた状態。背面は半透明で覆われ、背面の押下と「閉じる」のどちらでも閉じる。 */
export const Open: Story = {
  decorators: [
    (Story) => {
      seedOpen(true);

      return <Story />;
    },
  ],
};

/** 買えない明細が混ざった状態で開いたところ。事情は行の中に出る。 */
export const OpenWithIssues: Story = {
  args: { cart: CART_WITH_ISSUES },
  decorators: [
    (Story) => {
      seedOpen(true);

      return <Story />;
    },
  ],
};

/** 空のカートで開いた状態。点数の代わりに、入っていないことを書く。 */
export const OpenEmpty: Story = {
  args: { cart: EMPTY_CART },
  decorators: [
    (Story) => {
      seedOpen(true);

      return <Story />;
    },
  ],
};
