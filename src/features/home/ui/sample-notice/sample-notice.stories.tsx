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
          "このサイトがサンプルであることの断り書きです。伝えるのは**サンプルであること・掲載物が実在しないこと・購入と決済が機能しないこと**の 3 つです。",
          "利用規約への導線が先頭にあるのは、閲覧した時点で同意とみなすためです。**閉じる操作はありません。",
          "**",
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
