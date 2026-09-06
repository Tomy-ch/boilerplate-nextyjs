import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "storybook/test";

import { REPOSITORIES } from "../../repositories";
import { RepositoryCards } from "./repository-cards";

const meta = {
  title: "Features/SiteInfo/RepositoryCards",
  component: RepositoryCards,
  parameters: {
    layout: "padded",
    docs: {
      story: { inline: false, iframeHeight: 560 },
      description: {
        component: [
          "このサイトを構成しているリポジトリの説明です。フッターの導線より詳しく書きます —— あちらは",
          "どの画面からでも辿れることを担い、ここは「何と何で出来ているのか」を読ませます。**カード全体が",
          "リポジトリへの導線ですが、link で包んではいません** —— 包むと補足を開く操作が link の内側に入り、",
          "操作の中に操作が居る形になります。支援技術にはリポジトリ名だけが遷移先として見えます。",
        ].join(""),
      },
    },
  },
} satisfies Meta<typeof RepositoryCards>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 広い段。2 列に並ぶ。 */
export const Default: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
};

/** 狭い段。1 列になり、カードの高さは中身で決まる。 */
export const Mobile: Story = {
  globals: { viewport: { value: "mobile2", isRotated: false } },
};

/** 補足を開いた状態。カードを押す導線とは別の操作として重なりの上に出る。 */
export const SupplementOpen: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
  play: async ({ canvasElement }) => {
    const [first] = within(canvasElement).getAllByRole("button", { name: "リポジトリの補足" });

    await userEvent.click(first);
    await within(document.body).findByText(REPOSITORIES[0].purpose);
  },
};
