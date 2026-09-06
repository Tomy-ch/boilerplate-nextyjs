import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "storybook/test";

import { ADMIN_PRODUCT_LIST_PATH } from "../../../../paths";
import { CATEGORY_OPTIONS, NO_CONDITIONS, STATUS_OPTIONS } from "../../list.fixture";
import { AdminProductFilterSheet } from "./filter-sheet";

const meta = {
  title: "Features/Admin/Products/List/FilterSheet",
  component: AdminProductFilterSheet,
  parameters: {
    layout: "fullscreen",
    nextjs: { navigation: { pathname: ADMIN_PRODUCT_LIST_PATH } },
    docs: {
      story: { inline: false, iframeHeight: 560 },
      description: {
        component: [
          "表を畳めない幅での絞り込みです。**選んだ時点では反映せず**、下端の操作でまとめて確定します（表が overlay の裏に隠れるため）。",
          "**開くたびに、いま効いている条件から組み直します。** 検索語はここに入りません —— 入力欄は幅によらず画面の上に出ています。",
        ].join(""),
      },
    },
  },
  args: {
    conditions: NO_CONDITIONS,
    categoryOptions: CATEGORY_OPTIONS,
    statusOptions: STATUS_OPTIONS,
  },
  globals: { viewport: { value: "mobile2", isRotated: false } },
} satisfies Meta<typeof AdminProductFilterSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 閉じている状態。開く操作は画面の下端に固定される。 */
export const Closed: Story = {};

/** 条件が効いている状態。効いている数が開く操作に付く。 */
export const Filtered: Story = {
  args: { conditions: { ...NO_CONDITIONS, categoryCodes: ["1"], statusCodes: ["2"] } },
};

/** 開いた状態。効いている条件が下書きの初期値として入っている。 */
export const Open: Story = {
  args: { conditions: { ...NO_CONDITIONS, categoryCodes: ["1"], statusCodes: ["2"] } },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: /絞り込み/ }));
    await within(document.body).findByRole("dialog");
  },
};
