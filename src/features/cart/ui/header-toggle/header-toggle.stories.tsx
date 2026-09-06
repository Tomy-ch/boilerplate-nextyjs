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
      // story ごとに iframe を分ける。開いた状態と閉じた状態を同じ docs ページへ載せるが、
      // 開閉を持つ store は 1 つしかないので、同じ木で描くと後の story の値が先へも及ぶ。
      story: { inline: false, iframeHeight: 240 },
      description: {
        component: [
          "脇に常設できる幅での、カートの入口です（常設できない幅は `Features/Cart/HeaderDrawer` が受け持ちます）。",
          "**中身を持たず**、押すと脇の領域が出るか消えるかだけです。別の領域の開閉を担うので `aria-expanded` を持ちます。",
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
