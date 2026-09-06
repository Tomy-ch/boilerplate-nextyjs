import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { DEFAULT_RECENT_DAYS } from "../../period-draft";
import { PurchasePeriodFields } from "./period-fields";

const meta = {
  title: "Features/Purchases/History/PeriodFields",
  component: PurchasePeriodFields,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: [
          "期間の入力欄です。**区分を選ぶと、その区分が使う入力欄だけが現れます。**",
          "確定は持ちません。同じ入力欄を帯の中と overlay の両方から使うためで、",
          "どこで確定するかは置く側が決めます。",
        ].join(""),
      },
    },
  },
} satisfies Meta<typeof PurchasePeriodFields>;

export default meta;
type Story = StoryObj<typeof meta>;

const EMPTY = { kind: "all", month: "", from: "", to: "", days: DEFAULT_RECENT_DAYS } as const;

/** 全期間。追加の入力欄を持たない。 */
export const AllPeriod: Story = {
  args: { draft: EMPTY, onChange: () => {} },
};

/** 直近 N 日。日数の選択肢だけが現れる。 */
export const Recent: Story = {
  args: { draft: { ...EMPTY, kind: "recent" }, onChange: () => {} },
};

/** 暦月。月の入力欄が現れる。 */
export const Month: Story = {
  args: { draft: { ...EMPTY, kind: "month", month: "2026-07" }, onChange: () => {} },
};

/** 開始日と終了日。終了日は開始日より前を選べない。 */
export const Range: Story = {
  args: {
    draft: { ...EMPTY, kind: "range", from: "2026-06-01", to: "2026-08-17" },
    onChange: () => {},
  },
};

/** 期間を選び始めたところ。終了日がまだ無く、条件として成り立っていない。 */
export const PartialRange: Story = {
  args: { draft: { ...EMPTY, kind: "range", from: "2026-06-01" }, onChange: () => {} },
};
