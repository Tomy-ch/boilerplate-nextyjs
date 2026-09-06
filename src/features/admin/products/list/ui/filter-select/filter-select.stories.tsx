import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ADMIN_PRODUCT_LIST_PATH } from "../../../../paths";
import { CATEGORY_OPTIONS, NO_CONDITIONS, STATUS_OPTIONS } from "../../list.fixture";
import { AdminProductFilterSelect } from "./filter-select";

const meta = {
  title: "Features/Admin/Products/List/FilterSelect",
  component: AdminProductFilterSelect,
  parameters: {
    layout: "padded",
    nextjs: { navigation: { pathname: ADMIN_PRODUCT_LIST_PATH } },
    docs: {
      story: { inline: false, iframeHeight: 320 },
      description: {
        component: [
          "選んだ時点で反映する絞り込みです。**脇に畳まず常に見えている幅で使います** —— overlay の中でまとめて確定する `Features/Admin/Products/List/FilterSheet` が対になります。",
          "**canvas では遷移が起きません。**",
        ].join(""),
      },
    },
  },
  args: {
    field: "categoryCodes",
    label: "分類",
    options: CATEGORY_OPTIONS,
    conditions: NO_CONDITIONS,
  },
} satisfies Meta<typeof AdminProductFilterSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 分類で絞る欄。何も選ばれていない状態が「すべて」。 */
export const Category: Story = {};

/** 分類が効いている状態。 */
export const CategorySelected: Story = {
  args: { conditions: { ...NO_CONDITIONS, categoryCodes: ["1", "2"] } },
};

/** 状態で絞る欄。差し替える条件が違うだけで、欄そのものは同じ部品。 */
export const Status: Story = {
  args: {
    field: "statusCodes",
    label: "状態",
    options: STATUS_OPTIONS,
    conditions: { ...NO_CONDITIONS, statusCodes: ["2"] },
  },
};
