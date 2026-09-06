import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { PeriodCaption } from "./period-caption";

const meta = {
  title: "Features/Admin/Analytics/PeriodCaption",
  component: PeriodCaption,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: [
          "いま出ている数がどの日付の話かを添える一文です。**選択肢の名前だけでは判りません** ——",
          "「今月」が何月で「今日」がいつなのかは画面を見た時刻で変わり、共有した URL や撮った画像を",
          "後から読む人には手がかりが残りません。暦日の解釈（日本時間）も同じ理由で文言に書きます。",
        ].join(""),
      },
    },
  },
  args: { window: { from: "2026-09-01", to: "2026-09-06" } },
} satisfies Meta<typeof PeriodCaption>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 範囲を指している状態。両端を含めて集計する。 */
export const Range: Story = {};

/** 1 日だけを指している状態。同じ日付を 2 度並べても読み手が得るものが無いので、範囲の形にしない。 */
export const SingleDay: Story = {
  args: { window: { from: "2026-09-06", to: "2026-09-06" } },
};

/** 期間が決まっていない状態。日付を出す代わりに、決まっていないことを言う。 */
export const Undecided: Story = {
  args: { window: undefined },
};
