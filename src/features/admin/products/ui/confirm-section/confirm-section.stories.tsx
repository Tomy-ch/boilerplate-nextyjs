import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { CATEGORY_OPTIONS, SAMPLE_PRODUCT, STATUS_OPTIONS } from "../../products.fixture";
import { emptyProductValues, productValuesOf } from "../../use-product-values";
import { ProductConfirmSection } from "./confirm-section";

const meta = {
  title: "Features/Admin/Products/ConfirmSection",
  component: ProductConfirmSection,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: [
          "送る前に内容を確かめる段です。**入力欄を持たず**、直すのは前の段へ戻って行います。空欄は「未入力」として出ます。",
          "説明は表示側と同じ経路（sanitize してから描く）を通るので、**ここで見えないものは保存しても表示されません。",
          "**",
        ].join(""),
      },
    },
  },
  args: {
    values: productValuesOf(SAMPLE_PRODUCT),
    categoryOptions: CATEGORY_OPTIONS,
    statusOptions: STATUS_OPTIONS,
    imageCount: 2,
  },
  decorators: [(Story) => <div className="max-w-2xl">{Story()}</div>],
} satisfies Meta<typeof ProductConfirmSection>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 一通り埋まっている状態。説明は書いた形のまま出る。 */
export const Filled: Story = {};

/** 任意の項目を空のまま送ろうとしている状態。空欄は「未入力」として見せる。 */
export const Empty: Story = {
  args: { values: emptyProductValues(), imageCount: 0 },
};

/** 公開日時を入れずに登録する状態。空欄が何を意味するかを、そのまま文言で出す。 */
export const Unpublished: Story = {
  args: {
    values: { ...productValuesOf(SAMPLE_PRODUCT), publishedAt: "" },
    imageCount: 0,
  },
};
