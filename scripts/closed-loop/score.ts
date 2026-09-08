// 集まった所見を束ね、順位を付け、着地した改善を測り直す判定。issue の取得は
// 入口([weekly/index.ts](weekly/index.ts))が持ち、ここは受け取った issue だけから答えを出す。
//
// **ここは何も決めない。**順位は検討の入口であって結論ではなく、測り直しは再発の件数と
// 判定の時期が来たかを並べるだけである。保持・簡素化・撤回を決めるのは人である
// （[0160](../../docs/adr/0160-agent-environment-loop.md) 決定 1）。

import type { Observation } from "./observation.js";
import { FINDING_KINDS, type FindingKind, KIND_LABEL_PREFIX } from "./summarize.js";

/** 分類が付いていない issue をまとめる鍵。 */
export const UNCLASSIFIED = "unclassified";

/** 週次が読む issue 1 件。 */
export type FeedbackIssue = {
  readonly number: number;
  readonly kinds: readonly FindingKind[];
  readonly observation: Observation;
  readonly sections: Readonly<Record<string, string>>;
  /** 立った時刻（epoch 秒）。読めなければ undefined */
  readonly createdAt?: number;
  /** 閉じられた時刻（epoch 秒）。開いていれば undefined */
  readonly resolvedAt?: number;
  /** 「完了」として閉じられたか。畳み込みで閉じたものと区別する */
  readonly completed?: boolean;
};

/**
 * ラベル名から分類を取り出す。
 *
 * @remarks
 * 知らない分類は捨てます。ラベルは人も付けるので、綴り違いや将来増えた名前が混ざりえます。
 * ただし**捨てた結果が空になっても消えはしません** —— `UNCLASSIFIED` として数えられます。
 */
export function labelsToKinds(labels: readonly string[]): readonly FindingKind[] {
  const known = new Set<string>(FINDING_KINDS);

  return labels
    .filter((name) => name.startsWith(KIND_LABEL_PREFIX))
    .map((name) => name.slice(KIND_LABEL_PREFIX.length))
    .filter((name): name is FindingKind => known.has(name));
}

/** 順位付けの重み。 */
export type Weights = {
  readonly frequency: number;
  readonly impact: number;
  readonly humanIntervention: number;
  readonly recurrence: number;
};

/**
 * 重みの既定値。
 *
 * @remarks
 * **人の介入と再発を高く置きます。**件数は「何回起きたか」しか語りませんが、人が割り込んだ
 * ことと同じものが戻ってきたことは、**環境が直っていない**ことを直接に語るからです。
 * 運用のデータで動かす前提で定数に置いてあります。
 */
export const DEFAULT_WEIGHTS: Weights = {
  frequency: 1,
  impact: 2,
  humanIntervention: 3,
  recurrence: 4,
};

/** 同じ種類の所見をまとめた 1 件。 */
export type Cluster = {
  readonly key: string;
  readonly issues: readonly number[];
  /** 件数 */
  readonly frequency: number;
  /** 影響。道具の失敗の合計を代理指標とする */
  readonly impact: number;
  /** 人の介入。中断の合計 */
  readonly humanIntervention: number;
  /** 再発。2 件以上に跨って現れたかの 0/1 */
  readonly recurrence: number;
  readonly score: number;
  readonly isRecurring: boolean;
};

/**
 * 道具の失敗率。呼び出しが観測できていなければ `undefined`。
 *
 * @remarks
 * 率を出すのは、**規模の違う窓を並べても比較できる**ようにするためです。失敗 100 件でも
 * 呼び出し 10,000 件なら 1% であり、失敗 20 件で呼び出し 200 件の窓のほうが苦しんでいます。
 */
export function failureRate(observation: Observation): number | undefined {
  const calls = observation.toolCalls;
  const failures = observation.toolFailures;

  if (calls === undefined || failures === undefined || calls === 0) {
    return undefined;
  }

  return failures / calls;
}

/**
 * PR が開いてからマージされるまでの秒。観測できなければ `undefined`。
 *
 * @remarks
 * **実装が速くてもマージが遅ければリードタイムは縮みません。**実装の時間と並べて出すために、
 * 段から待ちだけを取り出します。
 */
export function mergeWaitSec(observation: Observation): number | undefined {
  return observation.phases.find((phase) => phase.from === "prOpenedAt" && phase.to === "mergedAt")
    ?.sec;
}

/**
 * 束ねる鍵。
 *
 * @remarks
 * 分類のラベルが付いていればそれを鍵にし、無ければ `UNCLASSIFIED` にまとめます。
 * **意味による分類はここでは行いません** —— 決定的な集計が先に立ち、モデルはその後です
 * （[0160](../../docs/adr/0160-agent-environment-loop.md) 決定 2）。
 */
export function clusterKey(issue: FeedbackIssue): string {
  return issue.kinds.length === 0
    ? UNCLASSIFIED
    : [...issue.kinds].sort((a, b) => a.localeCompare(b)).join("+");
}

/** issue 群を鍵ごとに束ね、点を付けて降順に並べる。 */
export function clusterIssues(
  issues: readonly FeedbackIssue[],
  weights: Weights = DEFAULT_WEIGHTS,
): readonly Cluster[] {
  const groups = new Map<string, FeedbackIssue[]>();

  for (const issue of issues) {
    const key = clusterKey(issue);

    groups.set(key, [...(groups.get(key) ?? []), issue]);
  }

  const clusters: Cluster[] = [];

  for (const [key, members] of groups) {
    const frequency = members.length;
    const impact = members.reduce((sum, m) => sum + (m.observation.toolFailures ?? 0), 0);
    const humanIntervention = members.reduce((sum, m) => sum + (m.observation.interrupts ?? 0), 0);
    const isRecurring = frequency > 1;
    const recurrence = isRecurring ? 1 : 0;

    clusters.push({
      key,
      issues: members.map((m) => m.number).sort((a, b) => a - b),
      frequency,
      impact,
      humanIntervention,
      recurrence,
      isRecurring,
      score:
        frequency * weights.frequency +
        impact * weights.impact +
        humanIntervention * weights.humanIntervention +
        recurrence * weights.recurrence,
    });
  }

  return clusters.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
}

/**
 * 待ちが実装の時間を上回っている窓。
 *
 * @remarks
 * 「PR が早く上がってもマージが遅ければ意味がない」を機械的に言い直したものです。ここに載る
 * 窓は**実装を速くしても縮まない**ので、改善の向きが他と違います。
 */
export function waitDominated(issues: readonly FeedbackIssue[]): readonly number[] {
  return issues
    .filter((issue) => {
      const wait = mergeWaitSec(issue.observation);

      if (wait === undefined) {
        return false;
      }

      const work = issue.observation.phases
        .filter((phase) => phase.to !== "mergedAt")
        .reduce((sum, phase) => sum + Math.max(phase.sec, 0), 0);

      return wait > work;
    })
    .map((issue) => issue.number)
    .sort((a, b) => a - b);
}

/**
 * 着地から測り直しまでの日数。
 *
 * @remarks
 * [0160](../../docs/adr/0160-agent-environment-loop.md) 決定 1 が「一定期間後に再計測する」と
 * 置いた待ち時間です。**短すぎれば母数が足りず、長すぎれば次の改善と混ざります。**14 日は
 * 最初の設定値で、運用のデータで動かす前提です。
 */
export const REEVALUATION_DAYS = 14;

/** 着地した改善 1 件と、その後の再発。 */
export type Reevaluation = {
  readonly key: string;
  /** 着地の合図になった issue。同じ鍵のうち最後に閉じられたもの */
  readonly landedIssue: number;
  /** その issue が閉じられた epoch 秒 */
  readonly landedAt: number;
  /** 着地の後に同じ鍵で新しく立った issue */
  readonly recurred: readonly number[];
  /** 測り直しの時期が来ているか */
  readonly due: boolean;
};

/**
 * 着地した改善を、その後の再発と並べる。
 *
 * @remarks
 * **「着地」の合図は issue が閉じられたことです**（[0160](../../docs/adr/0160-agent-environment-loop.md)
 * 決定 1 の「着地の記録を二重に持たない」）。畳み込みで閉じたものは着地ではないので、
 * `completed` を見ます。
 *
 * `UNCLASSIFIED` は除きます。**何についての所見か分かっていない以上、「同じものが再発したか」に
 * 答えられません。**
 *
 * **判定はしません。**再発の件数と、測り直しの時期が来たかを並べるだけです。
 */
export function reevaluations(
  issues: readonly FeedbackIssue[],
  now: number,
): readonly Reevaluation[] {
  const byKey = new Map<string, FeedbackIssue[]>();

  for (const issue of issues) {
    const key = clusterKey(issue);

    if (key === UNCLASSIFIED) {
      continue;
    }

    byKey.set(key, [...(byKey.get(key) ?? []), issue]);
  }

  const found: Reevaluation[] = [];

  for (const [key, group] of byKey) {
    const landed = group
      .filter(
        (issue): issue is FeedbackIssue & { resolvedAt: number } =>
          issue.resolvedAt !== undefined && issue.completed === true,
      )
      .sort((a, b) => b.resolvedAt - a.resolvedAt)[0];

    if (landed === undefined) {
      continue;
    }

    found.push({
      key,
      landedIssue: landed.number,
      landedAt: landed.resolvedAt,
      recurred: group
        .filter((issue) => issue.createdAt !== undefined && issue.createdAt > landed.resolvedAt)
        .map((issue) => issue.number)
        .sort((a, b) => a - b),
      due: now >= landed.resolvedAt + REEVALUATION_DAYS * 86_400,
    });
  }

  return found.sort((a, b) => b.recurred.length - a.recurred.length || a.key.localeCompare(b.key));
}
