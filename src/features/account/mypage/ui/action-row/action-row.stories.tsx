import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { MypageActionRow } from "./action-row";

const meta = {
  title: "Features/Account/Mypage/ActionRow",
  component: MypageActionRow,
  parameters: {
    docs: {
      description: {
        component: [
          "マイページ下端の操作の並びです。横に並べられる幅では 1 行に収め、収まらない幅では",
          "縦に積んで区切り線で分けます。**退会はカタログでは実行されません** —— 確認 dialog までが",
          "確かめられる範囲です。",
        ].join(""),
      },
    },
  },
} satisfies Meta<typeof MypageActionRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 既定。横に並ぶ。 */
export const Default: Story = {};

/** タブレット幅。まだ 1 行に収まる。 */
export const Tablet: Story = {
  globals: { viewport: { value: "tablet", isRotated: false } },
};

/** スマホ幅。縦に積み、区切り線で 1 つずつ分ける。 */
export const Mobile: Story = {
  globals: { viewport: { value: "mobile2", isRotated: false } },
};
