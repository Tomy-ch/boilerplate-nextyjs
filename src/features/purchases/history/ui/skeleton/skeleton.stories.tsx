import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { PurchaseHistorySkeleton } from "./skeleton";

const meta = {
  title: "Features/Purchases/History/Skeleton",
  component: PurchaseHistorySkeleton,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "購入履歴の待機表示です。実際に並ぶ行と同じ高さ・同じ区切りで枠だけを出し、描画された瞬間に位置が動かないようにします。",
      },
    },
  },
} satisfies Meta<typeof PurchaseHistorySkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 既定。 */
export const Default: Story = {};
