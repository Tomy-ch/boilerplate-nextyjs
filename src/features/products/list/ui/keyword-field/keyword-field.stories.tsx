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
          "キーワードの入力欄です。**打鍵では検索しません** —— 検索語だけが先に効くと、絞り込みを組んで",
          "いる途中で一覧が入れ替わり、中途半端な条件の結果を見ることになります。**入力の保持を画面の",
          "下書きに預けます** —— 検索語は絞り込みと同じ 1 つの条件の一部で、入力欄が自分で保持すると、",
          "絞り込み側から確定したときに打ち込んだ検索語が置き去りになります。**空のまま押せるのは、いま",
          "検索語が効いているときだけ**です。",
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
