import { withPartSpan } from "@/observability/render-span";
import type { PeriodWindow } from "../../period-window";

/** `PeriodCaption` の props。 */
export type PeriodCaptionProps = {
  /** 集計が対象にしている暦日。決まっていなければ渡さない。 */
  window?: PeriodWindow;
};

/**
 * いま出ている数が、どの日付の話かを添える。
 *
 * @remarks
 * **選択肢の名前だけでは、どの日を見ているのか判りません。**「今月」が何月なのか、「今日」が
 * いつなのかは、画面を見た時刻によって変わります。共有した画面や撮った画像を後から読む人には、
 * その手がかりが名前の側に残っていません。
 *
 * **出す from / to は、集計と同じ規則（日本時間の暦日）を辿って導いた写しです**（`../../period-window.ts`）。だから根拠を文言に添えます。
 *
 * 1 日だけを指すときは範囲の形にしません。同じ日付を 2 度並べても、読み手が得るものがありません。
 *
 * @see Storybook `Features/Admin/Analytics/PeriodCaption`
 */
export const PeriodCaption = withPartSpan(
  "features/admin/analytics/ui/period-caption/period-caption",
  ({ window }: PeriodCaptionProps) => {
    if (window === undefined) {
      return <p className="text-sm text-muted-foreground">集計する期間が決まっていません。</p>;
    }

    const span = window.from === window.to ? window.from : `${window.from} 〜 ${window.to}`;

    return (
      <p className="text-sm text-muted-foreground" data-slot="period-caption">
        <span className="font-emphasis text-foreground tabular-nums">{span}</span>
        {" に注文された購入を集計しています（日本時間の暦日）。"}
      </p>
    );
  },
);
