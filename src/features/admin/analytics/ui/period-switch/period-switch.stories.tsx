import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ADMIN_ANALYTICS_PATH } from "../../../paths";
import { DASHBOARD_PERIOD } from "../../period";
import { RangeDialog } from "../range-dialog/range-dialog";
import { PeriodSwitch } from "./period-switch";

const meta = {
  title: "Features/Admin/Analytics/PeriodSwitch",
  component: PeriodSwitch,
  parameters: {
    layout: "padded",
    nextjs: { navigation: { pathname: ADMIN_ANALYTICS_PATH } },
    docs: {
      description: {
        component: [
          "集計対象期間を選び直す導線です。**選んだ期間は URL に載ります** —— 選択は「この画面の状態」",
          "ではなく「どの画面を見ているか」なので、日付の要らない 2 つは link です。tab や toggle に",
          "すると、同じ状態へ戻る手段が履歴からも共有 URL からも失われます。日付を選ぶ選択肢だけを",
          "外から受け取るのは、両端が決まるまで行き先が決まらないためで、hydration をその 1 つに閉じ込めます。",
        ].join(""),
      },
    },
  },
  args: {
    current: DASHBOARD_PERIOD.TODAY,
    rangeChoice: <RangeDialog selected={false} />,
  },
} satisfies Meta<typeof PeriodSwitch>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 何も選ばずに開いた状態。既定は今日。 */
export const Today: Story = {};

/** 今月を選んだ状態。現在地は色だけでなく `aria-current` でも示す。 */
export const Month: Story = {
  args: { current: DASHBOARD_PERIOD.MONTH },
};

/** 日付を指定して見ている状態。選ばれている印は外から受け取った選択肢の側に付く。 */
export const Range: Story = {
  args: {
    current: DASHBOARD_PERIOD.RANGE,
    rangeChoice: <RangeDialog from="2026-09-01" selected to="2026-09-06" />,
  },
};
