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
          "表を畳めない幅での絞り込みです。**条件を組んでいる間、表は overlay の裏に隠れます** ——",
          "選んだ結果が見えないので、選んだ時点では反映せず、確定の操作を下端へ置きます。",
          "**開くたびに、いま効いている条件から組み直します** —— 閉じている間は条件が画面のどこにも",
          "見えないため、前に開いたときの選びかけを覚えていると、次に開いた人にはそれが効いている",
          "条件に見えます。検索語をここへ入れないのは、入力欄が幅によらず画面の上に出ているからです。",
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
