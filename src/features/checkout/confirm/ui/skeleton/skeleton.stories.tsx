import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { CheckoutConfirmSkeleton } from "./skeleton";

const meta = {
  title: "Features/Checkout/Confirm/Skeleton",
  component: CheckoutConfirmSkeleton,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "購入確認の待機表示です。出来上がりと同じ段組みで枠だけを出し、読み始めた位置が動かないようにします。",
      },
    },
  },
} satisfies Meta<typeof CheckoutConfirmSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 広い段。内容と集計を左右に置く。 */
export const PC: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
};

/** 狭い段。縦に積む。 */
export const Mobile: Story = {
  globals: { viewport: { value: "mobile2", isRotated: false } },
};
