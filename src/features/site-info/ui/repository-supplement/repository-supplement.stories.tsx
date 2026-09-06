import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "storybook/test";

import { REPOSITORIES } from "../../repositories";
import { RepositorySupplement } from "./repository-supplement";

const meta = {
  title: "Features/SiteInfo/RepositorySupplement",
  component: RepositorySupplement,
  parameters: {
    layout: "centered",
    docs: {
      story: { inline: false, iframeHeight: 480 },
      description: {
        component: [
          "リポジトリの目的とできることを補足する面です。カードには「何であるか」だけを置き、目的と",
          "機能の一覧はここへ畳みます —— 並べて出すと、このサイトが何かを知りたいだけの利用者にも、",
          "開発の関心事を最初から読ませることになります。**dialog ではなく popover**を使うのは、読んだ",
          "あとカードへ戻る前提の補足で、画面を覆って背後の操作を止めるほどの内容ではないからです。",
          "**面の中に導線を置きません** —— 同じ行き先を 2 か所に置くと、どちらが正しい入口かが読み取れません。",
        ].join(""),
      },
    },
  },
  args: { repository: REPOSITORIES[0] },
} satisfies Meta<typeof RepositorySupplement>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 閉じている状態。カードの足元に並ぶ操作。 */
export const Closed: Story = {};

/** 開いた状態。目的の 1 文と、できることの一覧が出る。 */
export const Open: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "リポジトリの補足" }));
    await within(document.body).findByText(REPOSITORIES[0].purpose);
  },
};

/** もう一方のリポジトリ。文量が違っても面の幅は変わらない。 */
export const Counterpart: Story = {
  args: { repository: REPOSITORIES[1] },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "リポジトリの補足" }));
    await within(document.body).findByText(REPOSITORIES[1].purpose);
  },
};
