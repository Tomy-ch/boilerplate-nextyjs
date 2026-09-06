import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { PROFILE } from "../../../checkout.fixture";
import { ShippingCard } from "./shipping-card";

const meta = {
  title: "Features/Checkout/Confirm/ShippingCard",
  component: ShippingCard,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: [
          "届け先の確認です。**この画面では編集しません** —— 購入の作成が受け取るのは商品と数量だけで、",
          "届け先は登録情報から決まります。変更の導線だけを持ちます。",
        ].join(""),
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[32rem] max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ShippingCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 既定。建物名まで登録されている。 */
export const Default: Story = {
  args: { profile: PROFILE },
};

/** 建物名の無い住所。区切りごと落ちる。 */
export const WithoutBuilding: Story = {
  args: { profile: { ...PROFILE, building: null } },
};
