// 集計の結果を人が読む形にする。判定は [phases.ts](phases.ts) が持ち、ここは並べ方だけを持つ。

import { countOf, NO_WINDOWS_MESSAGE, toAnomalies, toPhases, type WindowMarks } from "./phases.js";
import type { TranscriptCounts } from "./transcript.js";

/**
 * 記録が 1 行も読めなかったときに出す行。
 *
 * @remarks
 * 置き場が無いことと、読めなかったことは見分けが付きません。0 を「起動なし」として出すと、
 * **読めていない機械の上で全スキルが「一度も呼ばれていない」と報告されます**。
 */
export const NO_TRANSCRIPT_MESSAGE =
  "セッションの記録を 1 行も読めませんでした。置き場が無いか、この機械の記録ではありません";

/** 回数として意味を持つ打刻。イベントの列であることをそのまま所見にする。 */
const COUNTED_MARKS: readonly string[] = ["commitAt", "reviewStartedAt"];

/** 秒を、桁を見て読みやすい単位へ落とす。 */
function humanize(seconds: number): string {
  if (seconds < 0) {
    return `${seconds} 秒`;
  }
  if (seconds < 90) {
    return `${seconds} 秒`;
  }
  if (seconds < 5400) {
    return `${Math.round(seconds / 60)} 分`;
  }

  return `${(seconds / 3600).toFixed(1)} 時間`;
}

/**
 * 1 つの窓の報告。
 *
 * @remarks
 * **所見が無い窓も「所見なし」と書きます。**黙って落とすと、見て何も無かった窓と、そもそも
 * 見ていない窓が区別できなくなります（[0157](../../docs/adr/0157-inspection-declaration-discipline.md)）。
 */
export function reportWindow(window: WindowMarks): readonly string[] {
  const phases = toPhases(window);
  const anomalies = toAnomalies(window);
  const counts = COUNTED_MARKS.map((name) => `${name} ${countOf(window, name)} 回`).join(" / ");
  const lines = [`[${window.id}] ${counts}`];

  for (const phase of phases) {
    lines.push(`  ${phase.name}: ${humanize(phase.seconds)}`);
  }

  if (phases.length === 0) {
    lines.push("  区間なし（打刻が 1 つ以下）");
  }

  if (anomalies.length === 0) {
    lines.push("  所見なし");
  }

  for (const anomaly of anomalies) {
    lines.push(`  ⚠ ${anomaly.kind}: ${anomaly.detail}`);
  }

  return lines;
}

/**
 * 全窓の報告。
 *
 * @remarks
 * 窓が 0 件のときは「異常なし」ではなく、**0 件であること自体**を出します。
 */
export function reportAll(windows: readonly WindowMarks[]): readonly string[] {
  if (windows.length === 0) {
    return [`⚠ ${NO_WINDOWS_MESSAGE}`];
  }

  const closed = windows.filter((window) => (window.marks.closedAt?.length ?? 0) > 0);
  const header = [
    `窓: ${windows.length} 件（閉じた窓 ${closed.length} 件 / 開いたまま ${windows.length - closed.length} 件）`,
    "",
  ];

  return [...header, ...windows.flatMap((window) => [...reportWindow(window), ""])];
}

/** 記録の報告に添える、数えられなかった量と宣言の突合。 */
export type TranscriptContext = {
  /** 読んだ行数 */
  readonly files: number;
  /** 解釈できなかった行数 */
  readonly unparsable: number;
  /** 宣言されているが記録に現れなかったスキル */
  readonly never: readonly string[];
};

/** 上位いくつかを `名前 回数` の行にする。 */
function topLines(counter: Readonly<Record<string, number>>, limit: number): readonly string[] {
  return Object.entries(counter)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([name, count]) => `  ${name}: ${count}`);
}

/**
 * 記録から数えた事実の報告。
 *
 * @remarks
 * **一度も起動されなかったスキルは、退役の候補としてではなく事実として並べます**
 * （[0160](../../docs/adr/0160-agent-environment-loop.md) 決定 3）。機会を待つスキルは、機会が
 * 来なかった期間について何も語りません。
 *
 * **数えられなかった行は必ず出します。**記録の形はツールが決めており版が上がれば変わるので、
 * 黙って飛ばすと「読めた範囲だけの数」が全量として読まれます
 * （[0157](../../docs/adr/0157-inspection-declaration-discipline.md)）。
 */
export function reportTranscript(
  counts: TranscriptCounts,
  context: TranscriptContext,
): readonly string[] {
  if (context.files === 0) {
    return ["", `⚠ ${NO_TRANSCRIPT_MESSAGE}`];
  }

  const skills = topLines(counts.skills, 12);
  const lines = [
    "",
    `記録: ${context.files} 行（解釈できなかった行 ${context.unparsable}）`,
    `やり取り ${counts.turns} / 道具の失敗 ${counts.toolErrors} / 中断 ${counts.interruptions}`,
    "",
    "スキルの起動:",
    ...(skills.length > 0 ? skills : ["  なし"]),
    "",
    `一度も起動されなかったスキル: ${context.never.length} 本`,
    "  ※ 利用の型を見ずに退役の根拠にしない（ADR 0160 決定 3）",
  ];

  if (context.never.length > 0) {
    lines.push(`  ${context.never.join(" / ")}`);
  }

  return lines;
}
