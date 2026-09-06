import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import { CATEGORY_ID, CATEGORY_OPTIONS } from "../../products.fixture";
import { ProductSelectField } from "./select-field";

const meta = {
  title: "Features/Admin/Products/SelectField",
  component: ProductSelectField,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: [
          "候補から 1 つ選ぶ項目です。候補はマスタから来る静的で少数の一覧なので **native の `select`** で足ります。",
          "**空の候補を先頭へ置きます** —— 既定で先頭が選ばれたことにすると、確かめずに送った値と意図して選んだ値を区別できません。",
        ].join(""),
      },
    },
  },
  args: {
    controlId: "product-category",
    label: "分類",
    name: "categoryId",
    options: CATEGORY_OPTIONS,
    value: "",
    onValueChange: fn(),
  },
  decorators: [(Story) => <div className="max-w-md">{Story()}</div>],
} satisfies Meta<typeof ProductSelectField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** まだ選ばれていない状態。先頭は候補ではなく、選ばれていないことを表す。 */
export const Unselected: Story = {};

/** 選ばれている状態。 */
export const Selected: Story = {
  args: { value: CATEGORY_ID },
};

/** 選ばずに送ろうとした状態。選ぶことが即ち触れることなので、focus が外れるのを待たない。 */
export const Invalid: Story = {
  args: { message: "分類を選んでください。" },
};
