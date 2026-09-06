import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "storybook/test";

import { CATEGORY_OPTIONS, SAMPLE_PRODUCT } from "../../products.fixture";
import type { ProductFormValues, ProductValues } from "../../use-product-values";
import { emptyProductValues, productValuesOf, useProductValues } from "../../use-product-values";
import type { ProductBasicsSectionProps } from "./basics-section";
import { ProductBasicsSection } from "./basics-section";

/** args が運ぶのは初期値だけ。打鍵を受ける本物の状態は harness が作る。 */
function seed(values: ProductValues): ProductFormValues {
  return {
    values,
    errors: {},
    dirty: false,
    setValue: () => undefined,
    touch: () => undefined,
    isSectionBlocked: () => false,
  };
}

/** 本物の hook を通した状態で包む。段の部品は入力の状態を外から受けるため、包まないと打てない。 */
function LiveBasicsSection({ form, withQuantity, ...props }: ProductBasicsSectionProps) {
  const live = useProductValues(form.values, { withQuantity });

  return <ProductBasicsSection {...props} form={live} withQuantity={withQuantity} />;
}

const meta = {
  title: "Features/Admin/Products/BasicsSection",
  component: ProductBasicsSection,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: [
          "商品の基本情報の段です。**自分が段であることを知りません** —— 表示・非表示と focus の移動は、これを並べる器（wizard / tabs）が持ちます。",
          "価格は文字列のまま運ぶので数値の入力欄にしません。**誤りは触れた項目にだけ出ます。**",
        ].join(""),
      },
    },
  },
  args: {
    categoryOptions: CATEGORY_OPTIONS,
    form: seed(emptyProductValues()),
    idPrefix: "create",
    withQuantity: true,
  },
  render: (args) => <LiveBasicsSection {...args} />,
  decorators: [(Story) => <div className="max-w-2xl">{Story()}</div>],
} satisfies Meta<typeof ProductBasicsSection>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 作る画面。在庫数まで尋ねる。開いた直後なので、空欄でも誤りは出ない。 */
export const Create: Story = {};

/** 編集の画面。在庫数は別の口が持つので尋ねない。 */
export const Edit: Story = {
  args: {
    form: seed(productValuesOf(SAMPLE_PRODUCT)),
    idPrefix: "edit",
    withQuantity: false,
  },
};

/** 必須の欄に触れて空のまま離れた状態。触れた項目にだけ誤りが出る。 */
export const Touched: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByLabelText("商品名"));
    await userEvent.click(canvas.getByLabelText("価格"));
    await userEvent.click(canvas.getByLabelText("在庫数"));
    await userEvent.tab();
  },
};
