import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { CheckoutCompleteSkeleton } from "./skeleton";

const meta = {
  title: "Features/Checkout/Complete/Skeleton",
  component: CheckoutCompleteSkeleton,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: "購入完了の待機表示です。控えと送り先の 2 枚が並ぶ形をそのまま枠で出します。",
      },
    },
  },
} satisfies Meta<typeof CheckoutCompleteSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 既定。 */
export const Default: Story = {};
