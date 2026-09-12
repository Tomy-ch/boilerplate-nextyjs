/**
 * 先送りにした検査を回すよう促すコメント。
 *
 * @remarks
 * 出るのは 1 PR に 1 件です。同じ趣旨のコメントを 2 つ置くと、片方だけが更新される形が生まれます。
 */

import type { Change } from "../lib/numstat";
import { type CheckSummary, pending, type Recommendation, recommend } from "./recommend";
import { countChangedLines } from "./volume";

export type Nudge =
  | {
      /** 構造で名指しできた。 */
      readonly kind: "recommend";
      readonly checks: readonly Recommendation[];
    }
  | {
      /** 名指しはできないが、行数が線を越えた。 */
      readonly kind: "volume";
      readonly changedLines: number;
      readonly checks: readonly CheckSummary[];
    }
  | {
      readonly kind: "quiet";
    };

/** 組み上がったコメント。 */
export type Comment = {
  readonly title: string;
  readonly body: string;
};

/**
 * 差分から、何を言うかを決める。
 *
 * @param changes - 変更されたファイルと、その変更行数。
 * @param labels - その PR が既に持つラベル。
 * @param alertAt - 行数だけを根拠に知らせる線。
 *
 * @remarks
 * **構造が先。**名指しできたなら、そのラベルだけを勧めます。行数は名指しできなかったときの
 * 予備で、根拠のある数を置けない以上そちらを主にはできません（[`volume.ts`](volume.ts)）。
 */
export function decideNudge(
  changes: readonly Change[],
  labels: readonly string[],
  alertAt: number,
): Nudge {
  const checks = recommend(changes, labels);

  if (checks.length > 0) return { kind: "recommend", checks };

  const changedLines = countChangedLines(changes);
  const remaining = pending(labels);

  if (changedLines < alertAt || remaining.length === 0) return { kind: "quiet" };

  return { kind: "volume", changedLines, checks: remaining };
}

/** 言うことがなければ何も組まない。 */
export function renderNudge(nudge: Nudge): Comment | undefined {
  if (nudge.kind === "quiet") return undefined;

  return nudge.kind === "recommend" ? renderRecommend(nudge.checks) : renderVolume(nudge);
}

/** 何が回るかの説明。どちらのコメントも最後にこれを置く。 */
const NOT_A_GATE = [
  "**これはゲートではありません。** どれも付けずに merge できます。全数は保護ブランチへの",
  "merge と日次で回り（ADR 0091 §3）、`develop` / `staging` / `production` を base とする PR",
  "では 3 つとも必ず回ります。",
].join("\n");

/** 名指しできたとき。 */
function renderRecommend(checks: readonly Recommendation[]): Comment {
  return {
    title: "## 🔎 この PR で回しておくことを勧める検査",
    body: [
      "差分が、先送りにしている検査の見るものを動かしています。merge 後の全数を待たず、この PR で",
      "回しておくことを勧めます。**ラベルを付けると回ります。**",
      "",
      "| ラベル | 回るもの | 目安 | なぜ |",
      "| --- | --- | --- | --- |",
      ...checks.map(
        ({ label, runs, duration, reasons }) =>
          `| \`${label}\` | ${runs} | ${duration} | ${reasons.join(" / ")} |`,
      ),
      "",
      NOT_A_GATE,
      "",
    ].join("\n"),
  };
}

/** 名指しできず、行数だけが越えたとき。 */
function renderVolume({
  changedLines,
  checks,
}: {
  readonly changedLines: number;
  readonly checks: readonly CheckSummary[];
}): Comment {
  return {
    title: "## 🔎 先送りにしている検査を回しておくことを勧めます",
    body: [
      `この PR は、先送りにしている検査が見る範囲を **${changedLines} 行**動かしています。`,
      "どの検査が要るかを構造からは名指しできませんでしたが、差分を読んで影響を追いきれる規模を",
      "超えています。回したい検査のラベルを付けてください。",
      "",
      "| ラベル | 回るもの | 目安 |",
      "| --- | --- | --- |",
      ...checks.map(({ label, runs, duration }) => `| \`${label}\` | ${runs} | ${duration} |`),
      "",
      NOT_A_GATE,
      "",
    ].join("\n"),
  };
}
