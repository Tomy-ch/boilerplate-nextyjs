import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { SAMPLE_PRODUCT, STATUS_OPTIONS } from "../../products.fixture";
import type { ProductFormValues, ProductValues } from "../../use-product-values";
import { emptyProductValues, productValuesOf, useProductValues } from "../../use-product-values";
import type { ProductPublishSectionProps } from "./publish-section";
import { ProductPublishSection } from "./publish-section";

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

/** 本物の hook を通した状態で包む。「非公開にする」は値を書き換える操作なので、静的では確かめられない。 */
function LivePublishSection({ form, ...props }: ProductPublishSectionProps) {
  const live = useProductValues(form.values, { withQuantity: false });

  return <ProductPublishSection {...props} form={live} />;
}

const meta = {
  title: "Features/Admin/Products/PublishSection",
  component: ProductPublishSection,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: [
          "公開の扱いの段です。状態と公開日時を同じ段に置くのは、どちらも「この商品を今どう扱うか」を",
          "決めるもので、片方だけを見て決められないからです。**状態は在庫・販売の軸で、公開の可否とは",
          "別**です —— 公開されるかどうかは公開日時が決めます。未公開へ戻す操作を別に置くのは、",
          "`datetime-local` を空へ戻すには区画の数だけ消す操作が要り、1 つの意図に操作が複数回要るためです。",
        ].join(""),
      },
    },
  },
  args: {
    form: seed(emptyProductValues()),
    idPrefix: "create",
    statusOptions: STATUS_OPTIONS,
  },
  render: (args) => <LivePublishSection {...args} />,
  decorators: [(Story) => <div className="max-w-2xl">{Story()}</div>],
} satisfies Meta<typeof ProductPublishSection>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 未公開のまま。戻す先が無いので「非公開にする」は押せない。 */
export const Unpublished: Story = {};

/** 公開日時が入っている状態。ここで初めて「非公開にする」が押せる。 */
export const Published: Story = {
  args: { form: seed(productValuesOf(SAMPLE_PRODUCT)), idPrefix: "edit" },
};
