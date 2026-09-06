import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { PROFILE } from "../../../account.fixture";
import { ProfileCard } from "./profile-card";

const meta = {
  title: "Features/Account/Mypage/ProfileCard",
  component: ProfileCard,
  parameters: {
    docs: {
      description: {
        component:
          "自分の登録情報と、編集への導線です。住所は郵便番号を先頭に置いて 1 つの文字列へ組みます。",
      },
    },
  },
} satisfies Meta<typeof ProfileCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 既定。全項目が埋まっている。 */
export const Default: Story = {
  args: { profile: PROFILE },
};

/** 建物名が無い場合。任意入力なので、区切りごと落として詰める。 */
export const WithoutBuilding: Story = {
  args: { profile: { ...PROFILE, building: null } },
};

/**
 * 契約が上限を宣言していないメールアドレス。折り返せないと器を横へ押し広げるため、
 * 語の途中でも折り返す。
 */
export const LongEmail: Story = {
  args: {
    profile: {
      ...PROFILE,
      email: "taro.yamada.with.a.very.long.local.part.for.layout@subdomain.example.co.jp",
    },
  },
};
