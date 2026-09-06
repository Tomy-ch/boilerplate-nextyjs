import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { MypageSkeleton } from "./skeleton";

const meta = {
  title: "Features/Account/Mypage/Skeleton",
  component: MypageSkeleton,
  parameters: {
    docs: {
      description: {
        component:
          "マイページの待機表示です。出来上がりと同じ段組みで枠だけを出し、読み始めた位置が動かないようにします。",
      },
    },
  },
} satisfies Meta<typeof MypageSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 既定。2 枚の枠が段に並ぶ。 */
export const Default: Story = {};

/** スマホ幅。段が畳まれて縦に積む。 */
export const Mobile: Story = {
  globals: { viewport: { value: "mobile2", isRotated: false } },
};
