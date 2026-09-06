import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useCallback, useState } from "react";
import { fn } from "storybook/test";

import { SAMPLE_PRODUCT } from "../../products.fixture";
import type { ProductDescriptionSectionProps } from "./description-section";
import { ProductDescriptionSection } from "./description-section";

/** 書いた内容を保つ形で包む。値の持ち主は器なので、包まないと打っても hidden の欄が動かない。 */
function LiveDescriptionSection({ value, onValueChange, ...props }: ProductDescriptionSectionProps) {
  const [current, setCurrent] = useState(value);
  const change = useCallback(
    (next: string) => {
      setCurrent(next);
      onValueChange(next);
    },
    [onValueChange],
  );

  return <ProductDescriptionSection {...props} onValueChange={change} value={current} />;
}

const meta = {
  title: "Features/Admin/Products/DescriptionSection",
  component: ProductDescriptionSection,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: [
          "商品の説明の段です。編集面そのものは form の値を持たないので、**書いた内容を hidden の欄へ",
          "写して送ります**。編集面は最初に読む一式から外してあり（editor 一式は gzip 約 190 KB）、",
          "**段が開かれるまで読み込みを始めません** —— 隠れたまま DOM に残る器へ置くと、開いた人が払う",
          "待ちは減らないまま初期の量だけが減る形になります。一度開いたら閉じないのは、閉じると戻った",
          "ときに書いた内容が初期値へ戻るためです。",
        ].join(""),
      },
    },
  },
  args: {
    active: true,
    idPrefix: "create",
    initialValue: "",
    value: "",
    onValueChange: fn(),
  },
  render: (args) => <LiveDescriptionSection {...args} />,
  decorators: [(Story) => <div className="max-w-2xl">{Story()}</div>],
} satisfies Meta<typeof ProductDescriptionSection>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 開かれた直後。編集面が届き、まだ何も書かれていない。 */
export const Active: Story = {};

/** まだ開かれていない段。出来上がりと同じ高さの枠だけを置き、届いた瞬間に下が動かないようにする。 */
export const Inactive: Story = {
  args: { active: false },
};

/** 書かれている状態。編集面は開いた時点の内容からしか組み立てられない。 */
export const WithContent: Story = {
  args: {
    idPrefix: "edit",
    initialValue: SAMPLE_PRODUCT.description ?? "",
    value: SAMPLE_PRODUCT.description ?? "",
  },
};
