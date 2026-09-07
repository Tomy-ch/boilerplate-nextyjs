import { getDashboardSummary } from "@/adapters/server/api/dashboard";
import { cn } from "@/components/cn";
import { toSummaryCards } from "../summary-cards";
import { StatCards } from "../ui/stat-cards/stat-cards";
import { StatusBreakdown } from "../ui/status-breakdown/status-breakdown";
import type { PeriodRequest } from "./period";

/** `AnalyticsSummarySection` の props。 */
export type AnalyticsSummarySectionProps = {
  /** 期間の指定が集計を求められる形になっているか。 */
  request: PeriodRequest;
};

const LABEL = "選んだ期間の集計";

/** 期間が決まっていないときに、何を直せばよいかを述べる文言。 */
const PENDING_MESSAGE: Readonly<Record<"incomplete" | "reversed", string>> = {
  incomplete: "開始日と終了日の両方を選んでください。",
  reversed: "終了日は開始日と同じ日か、それより後を選んでください。",
};

/** これから選ぶ案内と、入力の拒否を、色で区別する。 */
const PENDING_TONE: Readonly<Record<"incomplete" | "reversed", string>> = {
  incomplete: "text-muted-foreground",
  reversed: "text-destructive",
};

/**
 * 期間が変わったときに取り直す区画。
 *
 * @remarks
 * **期間を選び直したときに待つのはここだけです。** 選択肢とその下の期間の表示は外側にあり、
 * この区画が取り直している間も出たまま残ります。
 *
 * **期間が決まっていない（`incomplete`）ことは失敗ではありません。** 日付をこれから選ぶところ
 * なので、取得を試みず、何を直せばよいかだけを述べます。誤りとして出すと、開いただけで叱られる
 * 画面になります。
 *
 * **前後が逆（`reversed`）なのは入力の拒否です。** 送った値がそのまま受け取れないことなので、
 * 誤りの色で出します。
 *
 * **どちらも読み上げの役は持ちません。** この 2 つは文書の初期表示にしか現れず、動的に差し込ま
 * れる場面がありません。live region は内容の変化を伝える機構なので、最初から画面にある文言に
 * 付けると前置きが増えるだけになります（`Alert` の契約も同じ理由で常設の文言を除いています）。
 */
export async function AnalyticsSummarySection({ request }: AnalyticsSummarySectionProps) {
  if (request.status !== "ready") {
    return (
      <p className={cn("text-sm", PENDING_TONE[request.status])}>
        {PENDING_MESSAGE[request.status]}
      </p>
    );
  }

  const summary = await getDashboardSummary(request.window);

  return (
    <>
      <StatCards cards={toSummaryCards(summary)} label={LABEL} />
      <StatusBreakdown counts={summary.purchaseStatusCounts} />
    </>
  );
}
