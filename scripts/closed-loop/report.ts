// 集計の結果を人が読む形にする。判定は [phases.ts](phases.ts) が持ち、ここは並べ方だけを持つ。

import { countOf, NO_WINDOWS_MESSAGE, toAnomalies, toPhases, type WindowMarks } from "./phases.js";

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
