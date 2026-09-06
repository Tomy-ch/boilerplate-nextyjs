import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import { CartDockHandle } from "./dock-handle";

const meta = {
  title: "Features/Cart/DockHandle",
  component: CartDockHandle,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: [
          "画面の下から出す器を開け閉めするつまみです。**器が隠れているあいだも出ています** —— 下端に残るのはこれだけで、唯一の開く手段になります。",
          "**掴んで引く形にはしていません** —— 押すだけなら、支援技術からの操作も同じ 1 つの経路で済みます。",
        ].join(""),
      },
    },
  },
  args: { shown: false, onToggle: fn() },
} satisfies Meta<typeof CartDockHandle>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 器が隠れている状態。矢印は上を向き、読み上げは「小計を表示する」。 */
export const Closed: Story = {};

/** 器が出ている状態。矢印が反転し、読み上げは「小計を隠す」。 */
export const Open: Story = {
  args: { shown: true },
};
