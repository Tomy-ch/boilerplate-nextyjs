import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "storybook/test";

import { ADMIN_ANALYTICS_PATH } from "../../../paths";
import { RangeDialog } from "./range-dialog";

/** trigger を押して面を開く。dialog は portal で `body` の側へ出る。 */
async function openDialog(canvasElement: HTMLElement) {
  await userEvent.click(within(canvasElement).getByRole("button", { name: "期間を指定" }));
  await within(document.body).findByRole("dialog");
}

const meta = {
  title: "Features/Admin/Analytics/RangeDialog",
  component: RangeDialog,
  parameters: {
    layout: "centered",
    nextjs: { navigation: { pathname: ADMIN_ANALYTICS_PATH } },
    docs: {
      story: { inline: false, iframeHeight: 460 },
      description: {
        component: [
          "集計する期間の両端を、面を覆って選びます。**overlay なのは、両端が決まるまで行き先が",
          "決まらないから**です。隣の 2 つは押した瞬間に遷移でき、日付を持たない分だけ幅も要りません。",
          "**中身は native の GET フォーム**で、送信すると入力した値がそのまま URL のクエリになります",
          "—— 送信を横取りする handler も、入力を持つ state もありません。日付の前後は `min` / `max` でも",
          "示しますが、見ているのは URL に載っていた値なので、入れ替わった組は送った先で誤りとして返ります。",
        ].join(""),
      },
    },
  },
  args: { selected: false },
} satisfies Meta<typeof RangeDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 閉じている状態。並びの中では他の選択肢と同じ見た目に揃う。 */
export const Closed: Story = {};

/** この期間で見ている状態。閉じていても選ばれている印が付く。 */
export const Selected: Story = {
  args: { selected: true, from: "2026-09-01", to: "2026-09-06" },
};

/** 開いた状態。初めて開くので入力欄は空で、両端とも必須。 */
export const Open: Story = {
  play: async ({ canvasElement }) => {
    await openDialog(canvasElement);
  },
};

/** 選んでいた日付を持って開き直した状態。入れ直しをさせず、値の出所は URL。 */
export const Prefilled: Story = {
  args: { selected: true, from: "2026-09-01", to: "2026-09-06" },
  play: async ({ canvasElement }) => {
    await openDialog(canvasElement);
  },
};
