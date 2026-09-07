import { Suspense } from "react";

import { InvalidQueryFeedback } from "@/components/app-starter/invalid-query-feedback/invalid-query-feedback";
import { getDefaultErrorMeta } from "@/errors/error-catalog";
import { ErrorKind } from "@/errors/error-kind";
import type { RawSearchParams } from "@/model/search-params";
import { withScreenSpan } from "@/observability/render-span";
import { ADMIN_ANALYTICS_PATH } from "../paths";
import { AdminSummarySkeleton } from "../ui/skeleton/skeleton";
import { PERIOD_KEY_LABEL, toPeriodRequest } from "./period";
import { toPeriodWindow } from "./period-window";
import { AnalyticsRankingSection } from "./ranking-section";
import { parsePeriodSelection } from "./read-period";
import { AnalyticsSummarySection } from "./summary-section";
import { AnalyticsView } from "./view";

/** `AdminAnalyticsPageContent` の props。 */
export type AdminAnalyticsPageContentProps = {
  /** 暦日を区切る基準の瞬間。実時計を読む場所は `app` が持つ。 */
  now: Date;
  /** URL の検索条件。 */
  searchParams: RawSearchParams;
};

/**
 * 集計の画面の中身。URL の解釈と、取り直す範囲の区切りを行う。
 *
 * @remarks
 * **この関数は取得を待ちません。** 待つと、選択肢まで含めた画面全体が待機表示に置き換わります。
 * 取得は 2 つの区画がそれぞれ持ち（`summary-section.tsx` / `ranking-section.tsx`）、`Suspense` の
 * 外側には選択肢と期間の表示だけが残ります。
 *
 * 集計の待機に鍵を与えるのは、期間が変われば数値が総入れ替えになるためです。鍵を与えないと、
 * 次の集計が届くまで前の期間の数が残ります。**鍵は値を一意に表す形で作ります。** 区切り文字で
 * 連結すると、値に区切り文字が現れた時点で別の期間が同じ鍵になります。
 *
 * URL の条件は `parsePeriodSelection` へ通し、独自の変換を持ちません。読めない期間は集計の代わりに
 * {@link InvalidQueryFeedback} が引き受けます。
 *
 * **いまの時刻は受け取ります。** どの暦日を見ているかの表示にも、区分を区間へ解くのにも要り、
 * 1 つの値を両方へ配ります。別々に読むと、境目の時刻に添え書きと集計の対象がずれます。実時計を
 * 読む場所を `app` に置くのは、既定の「今日」が要求のクエリへ入るためです。ここで読むと、
 * その画面の基準画像は撮った暦日のあいだしか一致しません（`config/clock`）。
 */
export const AdminAnalyticsPageContent = withScreenSpan(
  "features/admin/analytics/page-content",
  ({ now, searchParams }: AdminAnalyticsPageContentProps) => {
    const parsed = parsePeriodSelection(searchParams);

    if (!parsed.ok) {
      return (
        <InvalidQueryFeedback
          invalidKeys={parsed.invalidKeys}
          keyLabels={PERIOD_KEY_LABEL}
          message={getDefaultErrorMeta(ErrorKind.INVALID_ARGUMENT).message}
          resetHref={ADMIN_ANALYTICS_PATH}
          resetLabel="期間を外して見る"
          title="この期間では集計を表示できません"
        />
      );
    }

    const request = toPeriodRequest(parsed.selection, now);

    return (
      <AnalyticsView
        query={parsed.selection}
        ranking={
          <Suspense fallback={null}>
            <AnalyticsRankingSection now={now} />
          </Suspense>
        }
        summary={
          <Suspense fallback={<AdminSummarySkeleton />} key={JSON.stringify(request)}>
            <AnalyticsSummarySection request={request} />
          </Suspense>
        }
        window={toPeriodWindow(parsed.selection, now)}
      />
    );
  },
);
