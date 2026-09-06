import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { SampleNotice } from "./sample-notice";

const meta = {
  title: "Features/Home/SampleNotice",
  component: SampleNotice,
  parameters: {
    layout: "padded",
    nextjs: { navigation: { pathname: "/" } },
    docs: {
      description: {
        component: [
          "このサイトがサンプルであることの断り書きです。実在しそうな商品名と企業名を並べている以上、",
          "書かないと実在の取引と取り違えられます。伝えるのは**サンプルであること・掲載物が実在しない",
          "こと・購入と決済が機能しないこと**の 3 つです。利用規約への導線を先頭に置くのは、閲覧した",
          "時点で同意とみなす以上、同意の対象へ最初に届く必要があるからです。**閉じる操作を置きません**",
          "—— 閉じられる断り書きは、閉じた利用者に対しては無いのと同じです。",
        ].join(""),
      },
    },
  },
} satisfies Meta<typeof SampleNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 広い段。 */
export const Default: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
};

/** 狭い段。文が折り返しても、導線は本文の下に残る。 */
export const Mobile: Story = {
  globals: { viewport: { value: "mobile2", isRotated: false } },
};
