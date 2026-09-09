// 週次の集計を人が読む形にする判定。issue の取得は入口([weekly/index.ts](weekly/index.ts))が
// 持ち、ここは並べ方だけを持つ。
//
// **順位は検討の入口であって結論ではない。**保持・簡素化・撤回を決めるのは人である
// 。だから本文にその一行を残す。

import { humanize, issueRefs, percent } from "./format.js";
import { type Period, toDay } from "./period.js";
import {
  type Cluster,
  type FeedbackIssue,
  failureRate,
  mergeWaitSec,
  REEVALUATION_DAYS,
  type Reevaluation,
} from "./score.js";
import { IMPROVEMENT_SECTION } from "./summarize.js";

/**
 * 期間内に所見が 1 件も無いときに出す行。
 *
 * @remarks
 * 0 件は「問題が無かった週」ではありません。**窓が開かなかった週も、送出が届かなかった週も、
 * 同じ 0 件**です。
 */
export const NO_ISSUES_MESSAGE =
  "この期間の所見は 0 件です。窓が無かったのか、送出が届いていないのかは、ここでは分かりません";

/** 測り直しの結果に添える一行。誰が決めるのかを毎回書く。 */
export const REEVALUATION_NOTE =
  "効いたかを決めるのはここではない。保持 / 簡素化 / 撤回は人が決める";

function asDate(epoch: number): string {
  return toDay(epoch);
}

/** 束ねた結果を、点の高い順に並べる。 */
function clusterLines(
  clusters: readonly Cluster[],
  issues: readonly FeedbackIssue[],
): readonly string[] {
  const byNumber = new Map(issues.map((issue) => [issue.number, issue]));
  const lines: string[] = ["", "検討課題（点の高い順）"];

  for (const cluster of clusters) {
    lines.push(
      `  [${String(cluster.score).padStart(4)}] ${cluster.key}` +
        `  件数${cluster.frequency} 影響${cluster.impact} 介入${cluster.humanIntervention}` +
        ` ${cluster.isRecurring ? "反復" : "単発"}`,
      `         ${issueRefs(cluster.issues)}`,
    );

    // 順位だけでなく改善案そのものを並べる。GitHub を開かずに議題が読めるようにする。
    for (const number of cluster.issues) {
      const proposal = byNumber.get(number)?.sections[IMPROVEMENT_SECTION];

      if (proposal === undefined) {
        continue;
      }

      for (const line of proposal.split("\n")) {
        lines.push(`         #${number} ${line}`);
      }
    }
  }

  return lines;
}

/** 測り直しの結果を並べる。 */
function reevaluationLines(reevaluated: readonly Reevaluation[]): readonly string[] {
  const lines = ["", `測り直し（着地から ${REEVALUATION_DAYS} 日後に判定する）`];

  for (const item of reevaluated) {
    const since = item.recurred.length === 0 ? "再発なし" : `再発 ${issueRefs(item.recurred)}`;

    lines.push(
      `  ${item.key}  #${item.landedIssue} を ${asDate(item.landedAt)} にクローズ → ${since}` +
        `${item.due ? "" : "（判定はまだ早い）"}`,
    );
  }

  lines.push(`  ${REEVALUATION_NOTE}`);

  return lines;
}

/** 窓ごとの実測を並べる。 */
function perWindowLines(issues: readonly FeedbackIssue[]): readonly string[] {
  return [
    "",
    "窓ごとの実測",
    ...issues.map((issue) => {
      const rate = failureRate(issue.observation);
      const wait = mergeWaitSec(issue.observation);

      return (
        `  #${issue.number} ${issue.observation.windowId}` +
        `  失敗${percent(rate)}` +
        ` 中断${issue.observation.interrupts ?? "—"}` +
        ` 待ち${wait === undefined ? "—" : humanize(wait)}`
      );
    }),
  ];
}

/** 週次の報告に要る材料。 */
export type WeeklyInput = {
  readonly period: Period;
  readonly issues: readonly FeedbackIssue[];
  readonly clusters: readonly Cluster[];
  readonly reevaluated: readonly Reevaluation[];
  readonly waiting: readonly number[];
  /** 観測の区画を読めなかった issue の数 */
  readonly unparsed: number;
};

/**
 * 週次の報告。
 *
 * @remarks
 * **読めなかった issue の数を必ず出します。**人が本文を書き換えた 1 件で週次全体を落とさない
 * 代わりに、落とした量は見えている必要があります
 * 。
 */
export function reportWeekly(input: WeeklyInput): readonly string[] {
  const header = [
    `期間 ${asDate(input.period.from)} 〜 ${asDate(input.period.to)}`,
    `所見 ${input.issues.length} 件` +
      (input.unparsed > 0 ? `（観測を読めず ${input.unparsed} 件）` : ""),
  ];

  if (input.issues.length === 0) {
    return [...header, `⚠ ${NO_ISSUES_MESSAGE}`];
  }

  return [
    ...header,
    ...(input.clusters.length > 0 ? clusterLines(input.clusters, input.issues) : []),
    ...(input.reevaluated.length > 0 ? reevaluationLines(input.reevaluated) : []),
    ...(input.waiting.length > 0
      ? [
          "",
          `待ちが実装の時間を上回る窓: ${issueRefs(input.waiting)}`,
          "  実装を速くしても縮まない。レビューとマージの経路を見ること",
        ]
      : []),
    ...perWindowLines(input.issues),
  ];
}
