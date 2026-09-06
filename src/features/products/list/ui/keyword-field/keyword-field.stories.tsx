import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ReactElement } from "react";
import { userEvent, within } from "storybook/test";

import { FILTER_KEY, type ProductListSelection } from "../../../facade/list-url/list-url";
import { ProductFilterDraftProvider } from "../../filter-draft";
import { ProductKeywordField } from "./keyword-field";

/** 下書きの供給で包む。入力の保持は画面の下書きが持つため、包まないと打った内容が残らない。 */
function withDraft(
  Story: () => ReactElement,
  context: { args: { selection: ProductListSelection } },
) {
  return (
    <ProductFilterDraftProvider selection={context.args.selection}>
      <div className="max-w-md">{Story()}</div>
    </ProductFilterDraftProvider>
  );
}

const meta = {
  title: "Features/Products/List/KeywordField",
  component: ProductKeywordField,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: [
          "キーワードの入力欄です。**打鍵では検索せず**、送信で確定します。**入力の保持は画面の下書きが持ちます** —— 検索語は絞り込みと同じ 1 つの条件の一部で、",
          "どちらの確定操作からも同じものが飛ぶためです。",
          "**空のまま押せるのは、いま検索語が効いているときだけ**です。",
        ].join(""),
      },
    },
  },
  args: { selection: {} },
  decorators: [withDraft],
} satisfies Meta<typeof ProductKeywordField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 何も効いていない状態。送信しても結果が変わらないので、押せない。 */
export const Empty: Story = {};

/** 打ちかけの状態。押せるようになるが、押すまで一覧は変わらない。 */
export const Typing: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.type(within(canvasElement).getByRole("searchbox"), "イヤホン");
  },
};

/** 検索語が効いている状態。空にして押せば外せる。 */
export const Applied: Story = {
  args: { selection: { [FILTER_KEY.KEYWORD]: "イヤホン" } },
};
