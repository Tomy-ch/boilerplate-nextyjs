import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "storybook/test";

import { SAMPLE_ITEM_URLS } from "~catalog/lib/sample-asset";
import { ProductGallery } from "./gallery";

const meta = {
  title: "Features/Products/DetailGallery",
  component: ProductGallery,
  parameters: {
    layout: "padded",
    docs: {
      story: { inline: false, iframeHeight: 620 },
      description: {
        component: [
          "商品の画像を送りながら見る面です。**枚数によらず carousel に載せます** —— 枚数で構造を変えると",
          "境界で見た目が動き、1 枚の商品と複数枚の商品が別の画面に見えます。1 枚も無い場合は代替画像を",
          "1 枚として置きます。**実画像だけを押して拡大できます** —— 代替画像は「画像が無い」ことを伝える",
          "表示で、拡大しても得られるものがありません。紙には先頭の 1 枚だけを残し、幅も抑えます。",
        ].join(""),
      },
    },
  },
  args: { productName: "ワイヤレスイヤホン", imageUrls: SAMPLE_ITEM_URLS },
  decorators: [(Story) => <div className="max-w-lg">{Story()}</div>],
} satisfies Meta<typeof ProductGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 複数枚ある状態。送る操作と一覧の両方から位置を選べる。 */
export const MultipleImages: Story = {};

/** 1 枚だけの状態。構造は同じで、送る操作が出ないだけ。 */
export const SingleImage: Story = {
  args: { imageUrls: [SAMPLE_ITEM_URLS[0]] },
};

/** 1 枚も無い状態。代替画像を 1 枚として置き、押しても拡大しない。 */
export const NoImage: Story = {
  args: { imageUrls: [] },
};

/** 一覧から 2 枚目を選んだ状態。送った位置そのものが見せたい状態になる。 */
export const SecondSlide: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("link", { name: "2 枚目" }));
  },
};
