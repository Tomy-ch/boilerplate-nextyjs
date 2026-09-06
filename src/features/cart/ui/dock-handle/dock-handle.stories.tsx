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
          "画面の下から出す器を開け閉めするつまみです。**器が隠れているあいだも出ています** ——",
          "隠れた状態で画面の下端に残るのはこれだけで、唯一の開く手段になります。**掴んで引く形には",
          "していません** —— 引く操作は指の移動量と速度で判定が要り、`prefers-reduced-motion` や支援技術",
          "からの操作に別の経路を用意することになります。押すだけなら 1 つの経路で済みます。",
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
