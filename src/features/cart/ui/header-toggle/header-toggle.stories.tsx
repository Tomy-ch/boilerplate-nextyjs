import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { useCartStore } from "@/stores/cart-store";
import { CartHeaderToggle } from "./header-toggle";

/** 脇の領域が出ているかを、story の初期状態として指定する。 */
function seedOpen(isOpen: boolean) {
  useCartStore.setState({ isOpen });
}

const meta = {
  title: "Features/Cart/HeaderToggle",
  component: CartHeaderToggle,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: [
          "脇に常設できる幅での、カートの入口です。**中身を持ちません** —— 押すと脇の領域が出るか",
          "消えるかで、開閉の要求そのものは `stores` が持ちます（商品をカートへ入れたときにも開くため、",
          "要求は別の feature からも来ます）。`aria-expanded` を持たせるのは、この操作が別の領域の開閉を",
          "担っているからです。",
        ].join(""),
      },
    },
  },
  args: { count: 3 },
  decorators: [
    (Story) => {
      seedOpen(false);

      return <Story />;
    },
  ],
} satisfies Meta<typeof CartHeaderToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 脇の領域が閉じている状態。読み上げは「カートを開く」。 */
export const Closed: Story = {};

/** 脇の領域が出ている状態。読み上げは「カートを閉じる」。 */
export const Open: Story = {
  decorators: [
    (Story) => {
      seedOpen(true);

      return <Story />;
    },
  ],
};

/** 何も入っていない状態。点数は出さない。 */
export const Empty: Story = {
  args: { count: 0 },
};
