import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/components/cn";
import { withPartSpan } from "@/observability/render-span";
import { DASHBOARD_PERIOD, type DashboardPeriod, toPeriodHref } from "../../period";
import {
  PERIOD_CHOICE_CLASS,
  PERIOD_CHOICE_IDLE_CLASS,
  PERIOD_CHOICE_SELECTED_CLASS,
} from "./period-switch.definition";

/** `PeriodSwitch` の props。 */
export type PeriodSwitchProps = {
  /** いま選ばれている期間。 */
  current: DashboardPeriod;
  /** 日付を選ぶ選択肢。overlay を開くため、ここだけ client island を受け取る。 */
  rangeChoice: ReactNode;
};

/** 遷移するだけで済む選択肢。日付の要らないものだけが並ぶ。 */
const LINK_CHOICES: readonly { readonly period: DashboardPeriod; readonly label: string }[] = [
  { period: DASHBOARD_PERIOD.TODAY, label: "今日" },
  { period: DASHBOARD_PERIOD.MONTH, label: "今月" },
];

/**
 * 集計対象期間を選び直す導線。
 *
 * @remarks
 * **選んだ期間は URL に載ります。** 選択は「この画面の状態」ではなく「どの画面を見ているか」なので、
 * 日付の要らない 2 つは link です。tab や toggle にすると、同じ状態へ戻る手段が履歴と共有 URL の
 * 両方から失われます。
 *
 * **日付を選ぶ選択肢だけを外から受け取ります。** 両端を決めてからでないと行き先が決まらず、
 * 押した瞬間に遷移する link にできません。overlay を開く分だけ hydration が要るので、島を
 * この 1 つに閉じ込めています（[0040](../../../../../../docs/adr/0040-routing-rendering-strategy.md)）。
 *
 * `aria-current` でいま見ている項目を示します。色の違いだけで現在地を表すと、色を区別できない
 * 利用者に伝わりません（[0100](../../../../../../docs/adr/0100-accessibility-target.md)）。
 *
 * @see Storybook `Features/Admin/Analytics/PeriodSwitch`
 */
export const PeriodSwitch = withPartSpan(
  "features/admin/analytics/ui/period-switch/period-switch",
  ({ current, rangeChoice }: PeriodSwitchProps) => {
    return (
      <nav aria-label="集計対象期間">
        <ul className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted/40 p-1">
          {LINK_CHOICES.map((choice) => {
            const selected = choice.period === current;

            return (
              <li key={choice.period}>
                <Link
                  aria-current={selected ? "page" : undefined}
                  className={cn(
                    PERIOD_CHOICE_CLASS,
                    selected ? PERIOD_CHOICE_SELECTED_CLASS : PERIOD_CHOICE_IDLE_CLASS,
                  )}
                  href={toPeriodHref(choice.period)}
                >
                  {choice.label}
                </Link>
              </li>
            );
          })}
          <li>{rangeChoice}</li>
        </ul>
      </nav>
    );
  },
);
