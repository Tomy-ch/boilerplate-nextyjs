// 閉じた窓を issue の題と本文にする判定。投稿は入口([send/index.ts](send/index.ts))が持つ。
//
// **所見の正はリポジトリの中に置かない**（[0160](../../docs/adr/0160-agent-environment-loop.md)
// 決定 4）。ここが作るのは、その置き場へ渡す文面である。

import { humanize } from "./format.js";
import {
  COUNTED_MARKS,
  countOf,
  markAt,
  toAnomalies,
  toPhases,
  type WindowMarks,
} from "./phases.js";

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

/**
 * issue の本文。
 *
 * @remarks
 * **数えたものしか書きません。**「何が難しかったか」はモデルの仕事で、この機構はまだ
 * それを持ちません（[0160](../../docs/adr/0160-agent-environment-loop.md) 決定 2）。
 * 持たないことを本文に書くのは、空欄を「所見なし」と読ませないためです
 * （[0157](../../docs/adr/0157-inspection-declaration-discipline.md)）。
 *
 * **記録の抜粋は載せません**（同 決定 5）。ここへ出るのは打刻から数えた事実だけです。
 */
export function renderIssueBody(window: WindowMarks): string {
  const phases = toPhases(window);
  const anomalies = toAnomalies(window);

  const lines = [
    `打刻された開発の窓 \`${window.id}\` が閉じた。以下は打刻から数えた事実だけで、解釈を含まない。`,
    "",
    "## 段の区間",
    "",
  ];

  if (phases.length === 0) {
    lines.push("区間なし（打刻が 1 つ以下）");
  } else {
    lines.push("| 区間 | 実測 |", "| --- | --- |");

    for (const phase of phases) {
      lines.push(`| ${phase.from} → ${phase.to} | ${humanize(phase.seconds)} |`);
    }
  }

  lines.push("", "## 回数", "");

  for (const name of COUNTED_MARKS) {
    lines.push(`- ${name}: ${countOf(window, name)} 回`);
  }

  lines.push("", "## 所見", "");

  if (anomalies.length === 0) {
    lines.push("所見なし");
  } else {
    for (const anomaly of anomalies) {
      lines.push(`- **${anomaly.kind}** — ${anomaly.detail}`);
    }
  }

  lines.push(
    "",
    "---",
    "",
    "打刻から機械が数えた事実であり、記録の読解は含まない（ADR 0160 決定 2）。",
    "所見の正はこの issue が持ち、リポジトリの中には置かない（同 決定 4）。",
    "改善が着地したらこの issue を閉じる —— 着地の記録を別に持たない（同 決定 1）。",
  );

  return `${lines.join("\n")}\n`;
}
