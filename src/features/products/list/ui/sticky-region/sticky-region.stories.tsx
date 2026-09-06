import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ProductStickyAside, ProductStickyBar, ProductStickyRegion } from "./sticky-region";

/** 貼り付きが効く高さを与える。器の外に本文が無いと、そもそも送れない。 */
function TallBody() {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 20 }, (_, index) => (
        <div className="rounded-md border p-6" key={index}>{`商品 ${index + 1}`}</div>
      ))}
    </div>
  );
}

const meta = {
  title: "Features/Products/List/StickyRegion",
  component: ProductStickyRegion,
  parameters: {
    layout: "fullscreen",
    docs: {
      story: { inline: false, iframeHeight: 640 },
      description: {
        component: [
          "貼り付く領域をひとまとめにする器です。検索の帯と脇の絞り込みは別の列にありながら**上端を取り合います** —— 帯が出ているあいだ絞り込みはその下で止まり、",
          "帯が退けば header の直下まで上がります。",
          "**帯が退くのは下へ読み進めているあいだ**で、canvas を送ると確かめられます。",
        ].join(""),
      },
    },
  },
  args: { children: null },
  render: () => (
    <ProductStickyRegion>
      <div className="flex gap-6 p-6">
        <ProductStickyAside>
          <div className="rounded-md border p-4">
            <p className="font-emphasis text-sm">絞り込み</p>
            <p className="mt-2 text-muted-foreground text-sm">読み進めても手元に残ります。</p>
          </div>
        </ProductStickyAside>
        <div className="min-w-0 flex-1">
          <ProductStickyBar>
            <div className="border-b py-3">
              <p className="font-emphasis text-sm">検索と並び替え</p>
            </div>
          </ProductStickyBar>
          <div className="pt-4">
            <TallBody />
          </div>
        </div>
      </div>
    </ProductStickyRegion>
  ),
} satisfies Meta<typeof ProductStickyRegion>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 先頭に居る状態。帯は貼り付き、脇の絞り込みはその下で止まる。 */
export const AtTop: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
};

/** 脇に常設できない幅。絞り込みの列は出ず、帯だけが残る。 */
export const Mobile: Story = {
  globals: { viewport: { value: "mobile2", isRotated: false } },
};
