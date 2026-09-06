import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { SiteFooter } from "./site-footer";

const meta = {
  title: "Features/SiteInfo/SiteFooter",
  component: SiteFooter,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: [
          "利用者向け画面のフッターの中身です。器が 2 つ（`(shop)` と `(site-info)`）あるので、**中身はここが 1 つだけ持ちます。",
          "** admin の器には出しません。",
        ].join(""),
      },
    },
  },
} satisfies Meta<typeof SiteFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 広い段。 */
export const Default: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
};

/** 狭い段。導線が折り返す。 */
export const Mobile: Story = {
  globals: { viewport: { value: "mobile2", isRotated: false } },
};
