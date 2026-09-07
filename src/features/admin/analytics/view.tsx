import type { ReactNode } from "react";
import { withScreenSpan } from "@/observability/render-span";
import { DASHBOARD_PERIOD, type DashboardPeriodSelection } from "./period";
import type { PeriodWindow } from "./period-window";
import { PeriodCaption } from "./ui/period-caption/period-caption";
import { PeriodSwitch } from "./ui/period-switch/period-switch";
import { RangeDialog } from "./ui/range-dialog/range-dialog";

/** `AnalyticsView` の props。 */
export type AnalyticsViewProps = {
  /** URL が表す条件。選択肢の現在地と、日付の初期値になる。 */
  query: DashboardPeriodSelection;
  /** 集計が対象にしている暦日。決まっていなければ渡さない。 */
  window?: PeriodWindow;
  /** 期間に従って取り直す区画。 */
  summary: ReactNode;
  /** 期間に従わない区画。 */
  ranking: ReactNode;
};

/**
 * 期間を選んで集計を読む画面。
 *
 * @remarks
 * 取得を持ちません。**取り直す区画を slot で受けます。** 期間を選び直したときに待つのは集計だけで、
 * 選択肢とその下の日付は出たままです。全体を 1 つの待機に包むと、押した選択肢そのものが消えてから
 * 戻ってくることになり、何を押したのかを見失います。
 *
 * **売れ筋を別の slot にしているのも同じ理由です。** 期間の選択に従わない区画なので、期間を
 * 変えても取り直す必要がありません。
 *
 * **数値カードと内訳は入口（`view.tsx`）と同じ部品です。** 同じ値を別の形で出すと、期間を変えた
 * だけのつもりで読み方まで変わります。
 *
 * @see Storybook `Page/Admin/Analytics`
 */
export const AnalyticsView = withScreenSpan(
  "features/admin/analytics/view",
  ({ query, window, summary, ranking }: AnalyticsViewProps) => {
    const period = query.period ?? DASHBOARD_PERIOD.TODAY;

    return (
      <div className="space-y-8">
        <div className="space-y-3">
          <PeriodSwitch
            current={period}
            rangeChoice={
              <RangeDialog
                from={query.from}
                selected={period === DASHBOARD_PERIOD.RANGE}
                to={query.to}
              />
            }
          />
          <PeriodCaption window={window} />
        </div>
        {summary}
        {ranking}
      </div>
    );
  },
);
