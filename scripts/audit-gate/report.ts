import { type Advisory, isBlocking } from "./advisories";

/**
 * 検出を PR コメントの本文へ畳む。
 *
 * @remarks
 * 落ちた人が最初に知りたいのは「どれが止めているか」なので、blocking を先に並べます。止めない
 * ものを同じ表に残すのは、「抑止ファイルが空 = 何も除外されていない、ではない」と同じ理由です
 * —— 落とさないことと見せないことを分けます。
 */

/** 依存経路は先頭のいくつかだけを出す。全部並べても読む人が得るものが無い。 */
const MAX_PATHS = 3;

/** 経路を 1 セルへ畳む。 */
function pathCell(paths: readonly string[]): string {
  if (paths.length === 0) {
    return "—";
  }

  const shown = paths.slice(0, MAX_PATHS).map((path) => `\`${path}\``);
  const rest = paths.length - shown.length;

  return rest > 0 ? `${shown.join(", ")} ほか ${rest} 件` : shown.join(", ");
}

/** 1 件を行にする。 */
function row(advisory: Advisory): string {
  const fix = advisory.patched === undefined ? "**修正版なし**" : `\`${advisory.patched}\``;

  return `| ${advisory.severity} | \`${advisory.module}\` | ${fix} | [${advisory.title}](${advisory.url}) | ${pathCell(advisory.paths)} |`;
}

/** 表の骨。 */
function table(advisories: readonly Advisory[]): string[] {
  return [
    "| severity | パッケージ | 修正版 | 内容 | 経路 |",
    "| --- | --- | --- | --- | --- |",
    ...advisories.map(row),
  ];
}

/**
 * 表を組み立てる。
 *
 * @param advisories - 検出。
 * @returns Markdown の本文。
 */
export function renderReport(advisories: readonly Advisory[]): string {
  if (advisories.length === 0) {
    return "検出はありません。";
  }

  const blocking = advisories.filter(isBlocking);
  const rest = advisories.filter((advisory) => !isBlocking(advisory));
  const lines: string[] = [];

  if (blocking.length > 0) {
    lines.push(`### 止めているもの（${blocking.length} 件）`, "", ...table(blocking), "");
  }

  if (rest.length > 0) {
    lines.push(
      `### 止めないもの（${rest.length} 件）`,
      "",
      "severity が high 未満か、修正版がまだ無いもの。",
      "",
      ...table(rest),
      "",
    );
  }

  return lines.join("\n").trimEnd();
}
