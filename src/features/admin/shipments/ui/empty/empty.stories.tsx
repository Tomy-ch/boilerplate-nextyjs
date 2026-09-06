import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ShipmentQueueEmpty } from "./empty";

const meta = {
  title: "Features/Admin/Shipments/QueueEmpty",
  component: ShipmentQueueEmpty,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: [
          "発送を待っている注文が無いときの表示です。**失敗ではありません** —— 契約は発送待ちが無いことを空の並びで返すので、未発送の注文が現れれば読み込み直したときに並びます。",
        ].join(""),
      },
    },
  },
} satisfies Meta<typeof ShipmentQueueEmpty>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 発送待ちが無い状態。 */
export const Default: Story = {};
