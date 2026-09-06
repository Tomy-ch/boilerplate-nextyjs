import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { PurchaseDetailSkeleton } from "./skeleton";

const meta = {
  title: "Features/Purchases/Detail/Skeleton",
  component: PurchaseDetailSkeleton,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: "購入詳細の待機表示です。明細と送り先の 2 枚が並ぶ形をそのまま枠で出します。",
      },
    },
  },
} satisfies Meta<typeof PurchaseDetailSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 既定。 */
export const Default: Story = {};
