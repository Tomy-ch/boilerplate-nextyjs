import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useCallback, useState } from "react";
import { fn } from "storybook/test";

import { PRODUCT_NAME_MAX_LENGTH } from "../../field-limits";
import type { ProductTextFieldProps } from "./text-field";
import { ProductTextField } from "./text-field";

/**
 * 打鍵を受けられる形で包む。値の持ち主は呼び出し元なので、包まないと打っても何も入らない。
 * args の `value` はその初期値として使う。
 */
function LiveTextField({ value, onValueChange, ...props }: ProductTextFieldProps) {
  const [current, setCurrent] = useState(value);
  const change = useCallback(
    (next: string) => {
      setCurrent(next);
      onValueChange(next);
    },
    [onValueChange],
  );

  return <ProductTextField {...props} onValueChange={change} value={current} />;
}

const meta = {
  title: "Features/Admin/Products/TextField",
  component: ProductTextField,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: [
          "商品フォームの 1 行入力です。**値は呼び出し元が持ちます** —— 入力欄に任せると、弾かれた送信のあとに書いた内容が消えます。",
          "a11y 属性は `FormField` が組むので、項目ごとに書き写しません。",
        ].join(""),
      },
    },
  },
  args: {
    controlId: "product-name",
    label: "商品名",
    name: "name",
    value: "ワイヤレスイヤホン",
    required: true,
    onValueChange: fn(),
    onLeave: fn(),
  },
  render: (args) => <LiveTextField {...args} />,
  decorators: [(Story) => <div className="max-w-md">{Story()}</div>],
} satisfies Meta<typeof ProductTextField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 必須の項目。印は名前の前に置く。 */
export const Default: Story = {};

/** 補足のある項目。上限や扱いを添える。 */
export const WithDescription: Story = {
  args: { description: `${PRODUCT_NAME_MAX_LENGTH} 文字までです。` },
};

/** 任意の項目。空欄のままでよいことを印が示す。 */
export const Optional: Story = {
  args: {
    controlId: "product-threshold",
    label: "在庫警告の閾値",
    name: "stockWarningThreshold",
    value: "",
    required: false,
    description: "この数を下回ったら在庫が少ないものとして扱います。空欄なら扱いません。",
    inputMode: "numeric",
    min: 0,
    type: "number",
  },
};

/** 誤りが返っている状態。文言は欄の下に付き、入力欄そのものにも印が付く。 */
export const Invalid: Story = {
  args: { value: "", message: "商品名を入力してください。" },
};

/** 十進を文字列のまま運ぶ項目。数値の入力欄にすると丸めが入り、送る前に精度が落ちる。 */
export const Decimal: Story = {
  args: {
    controlId: "product-price",
    label: "価格",
    name: "price",
    value: "19.99",
    description: "USD で入力します。小数はそのまま保たれます。",
    inputMode: "decimal",
    placeholder: "19.99",
  },
};
