import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ProfileEditSkeleton } from "./skeleton";

const meta = {
  title: "Features/Account/Edit/Skeleton",
  component: ProfileEditSkeleton,
  parameters: {
    docs: {
      description: {
        component:
          "プロフィール編集の待機表示です。縦の長さを実物に合わせ、待っている間に置いた scroll 位置が意味を失わないようにします。",
      },
    },
  },
} satisfies Meta<typeof ProfileEditSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 既定。9 項目ぶんの枠が並ぶ。 */
export const Default: Story = {};
