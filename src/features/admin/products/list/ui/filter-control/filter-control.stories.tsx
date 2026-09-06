import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, userEvent, within } from "storybook/test";

import { CATEGORY_OPTIONS } from "../../list.fixture";
import { AdminProductFilterControl } from "./filter-control";

const meta = {
  title: "Features/Admin/Products/List/FilterControl",
  component: AdminProductFilterControl,
  parameters: {
    layout: "padded",
    docs: {
      story: { inline: false, iframeHeight: 320 },
      description: {
        component: [
          "絞り込みの選択欄です。**選ばれた値をどう扱うかは持たず**、選んだ時点で反映する場所と、まとめて確定する overlay の中の両方から使われます。",
          "**「すべて」という候補はありません** —— 何も選ばれていない状態がそれにあたります。",
        ].join(""),
      },
    },
  },
  args: {
    label: "分類",
    options: CATEGORY_OPTIONS,
    value: [],
    onSelect: fn(),
  },
} satisfies Meta<typeof AdminProductFilterControl>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 何も選ばれていない状態。これが「すべて」を意味する。 */
export const Unselected: Story = {};

/** 1 つ選ばれている状態。選んだ値が欄に出る。 */
export const Selected: Story = {
  args: { value: ["1"] },
};

/** 複数選ばれている状態。同時に効かせられる。 */
export const MultipleSelected: Story = {
  args: { value: ["1", "2", "4"] },
};

/** 候補を開いた状態。入り切りを候補ごとに見せる。 */
export const Open: Story = {
  args: { value: ["1"] },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: /分類/ }));
    await within(document.body).findByText("書籍");
  },
};
