// 閉じた窓を issue の題と本文にする判定。投稿は入口([send/index.ts](send/index.ts))が持つ。
//
// **所見の正はリポジトリの中に置かない**（[0160](../../docs/adr/0160-agent-environment-loop.md)
// 決定 4）。ここが作るのは、その置き場へ渡す文面である。
//
// 本文は 3 層で、順に**機械が読み戻す区画**・**数えた事実**・**読解**である。読解が無い窓でも
// 前 2 つは出る —— 決定的な集計が先に立ち、モデルはその後に来る（同 決定 2）。

import { humanize } from "./format.js";
import { renderObservation, type Observation } from "./observation.js";
import {
  COUNTED_MARKS,
  countOf,
  markAt,
  toAnomalies,
  toPhases,
  type WindowMarks,
} from "./phases.js";
import { BODY_SECTIONS, type ReadingGap, type Summary } from "./summarize.js";

/** epoch を `YYYY-MM-DD` にする。時刻までは題に要らない。 */
function toDate(epoch: number): string {
  return new Date(epoch * 1000).toISOString().slice(0, 10);
}

/**
 * issue の題。
 *
 * @remarks
 * 窓の id を必ず含めます。**題は同じ窓を二度立てていないかを人が見る唯一の手掛かり**であり、
 * 送出の索引が失われても id で照合できます。所見の中身を題に入れないのは、同じ窓の所見が
 * 訂正されても題が動かないようにするためです。
 */
export function issueTitle(window: WindowMarks): string {
  const at = markAt(window, "closedAt");

  return at === null
    ? `[feedback] 開発の窓 ${window.id}`
    : `[feedback] 開発の窓 ${window.id}（${toDate(at)}）`;
}

/** 読解が無かった理由を、そのまま本文に書く。 */
function gapNote(gap: ReadingGap): readonly string[] {
  if (gap === "読解を省いた") {
    return [
      "**読解なし — 読解を省いて送出した。**材料は手元にある。",
      "所見が無かったのではない。",
    ];
  }

  if (gap === "モデルを呼べなかった") {
    return [
      "**読解なし — モデルを呼べなかった。**材料は手元にあるので、次に呼べたときに読める。",
      "所見が無かったのではない。",
    ];
  }

  return [
    "**読解なし — 材料が無かった。**この窓の時間帯のセッションの記録を読めなかったので、",
    "読解の見込みが無い。所見が無かったのではない。",
  ];
}

/** 段の区間の節。打刻が 1 つ以下なら表を出さない —— 空の表は「測ったが 0 件」に読める。 */
function phaseLines(phases: readonly { from: string; to: string; seconds: number }[]): string[] {
  if (phases.length === 0) {
    return ["区間なし（打刻が 1 つ以下）"];
  }

  return [
    "| 区間 | 実測 |",
    "| --- | --- |",
    ...phases.map((phase) => `| ${phase.from} → ${phase.to} | ${humanize(phase.seconds)} |`),
  ];
}

/** 打刻から出た所見の節。 */
function anomalyLines(anomalies: readonly { kind: string; detail: string }[]): string[] {
  if (anomalies.length === 0) {
    return ["打刻の所見なし"];
  }

  return anomalies.map((anomaly) => `- **${anomaly.kind}** — ${anomaly.detail}`);
}

/**
 * 読んだ結果の節。
 *
 * @remarks
 * 落とした節は**落としたと書きます**。黙って省くと、書かれなかったことと落としたことが
 * 同じ見た目になり、関門が働いた形跡が残りません。
 */
function readingLines(summary: Summary | undefined, gap: ReadingGap): readonly string[] {
  if (summary === undefined) {
    return gapNote(gap);
  }

  return BODY_SECTIONS.flatMap((section) => {
    const text = summary.dropped.includes(section)
      ? "**この節は出口の関門で落とした**（秘密らしき形、または記録の逐語を含んでいた）。書かれなかったのではない。"
      : (summary.sections[section] ?? "該当なし");

    return [`## ${section}`, "", text, ""];
  });
}

/**
 * issue の本文。
 *
 * @param summary - モデルが読んだ結果。読解が無ければ `undefined`
 * @param gap - 読解が無いときの理由
 *
 * @remarks
 * **読めなかったことを「所見なし」に倒しません**
 * （[0157](../../docs/adr/0157-inspection-declaration-discipline.md)）。読解の節が空なのか、
 * そもそも読んでいないのかは本文から分かる必要があります。
 *
 * **記録の抜粋は載せません**（[0160](../../docs/adr/0160-agent-environment-loop.md) 決定 5）。
 * 外へ出るのは読んだ結果だけで、逐語は手元のモデルへ渡って終わります。
 */
export function renderIssueBody(
  window: WindowMarks,
  observation: Observation,
  summary: Summary | undefined,
  gap: ReadingGap,
): string {
  const phases = toPhases(window);
  const anomalies = toAnomalies(window);

  const lines = [
    `打刻された開発の窓 \`${window.id}\` が閉じた。`,
    "",
    renderObservation(observation),
    "",
    "## 段の区間",
    "",
  ];

  lines.push(...phaseLines(phases));

  lines.push("", "## 回数", "");

  for (const name of COUNTED_MARKS) {
    lines.push(`- ${name}: ${countOf(window, name)} 回`);
  }

  if (observation.toolCalls !== undefined) {
    lines.push(
      `- 道具の呼び出し: ${observation.toolCalls} 回（うち失敗 ${observation.toolFailures ?? 0}）`,
      `- 中断: ${observation.interrupts ?? 0} 回`,
    );
  }

  lines.push("", "## 所見", "");

  lines.push(...anomalyLines(anomalies));

  lines.push("", "---", "");

  lines.push(...readingLines(summary, gap));

  lines.push(
    "---",
    "",
    "上半分は打刻と記録から機械が数えた事実、下半分は手元のモデルが読んだ結果である（ADR 0160 決定 2）。",
    "所見の正はこの issue が持ち、リポジトリの中には置かない（同 決定 4）。",
    "改善が着地したらこの issue を閉じる —— 着地の記録を別に持たない（同 決定 1）。",
  );

  return `${lines.join("\n")}\n`;
}
