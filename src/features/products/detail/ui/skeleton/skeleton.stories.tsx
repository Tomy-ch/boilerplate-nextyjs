import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ProductDetailSkeleton } from "./skeleton";

const meta = {
  title: "Features/Products/Detail/Skeleton",
  component: ProductDetailSkeleton,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "商品詳細の待機表示です。実物と同じ 2 段組みの枠を出し、届いた瞬間に段組みが立ち上がって読み始めた位置が動かないようにします。",
      },
    },
  },
} satisfies Meta<typeof ProductDetailSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 既定。 */
export const Default: Story = {};
