import type { Quantity, Verdict } from "./budget";

/**
 * 判定を PR コメントの本文へ畳む。
 *
 * @remarks
 * 落ちた人が最初に知りたいのは「どの route が、何に対して、どれだけ超えたか」です。上限と増分は
 * 別の理由で鳴るため、列を分けて両方を出します。
 *
 * **量を 4 つへ割って出します** —— 初期 JS / 遅延 JS / 合計 JS / CSS。どれが動いたかで見るべき先
 * が変わるためです。
 *
 * **共有 chunk の増分は 1 度だけ出します。** 全 route が読む chunk が 8 KB 増えれば、route ごとの
 * 行はすべて +8 KB として並びます。表がそれを「29 件の増加」としか言えないと、読む人は 1 つの
 * 原因を 29 回追うことになります。
 */

const BYTES_PER_KB = 1024;

/** byte を KB の文字列へ。 */
function kb(bytes: number): string {
  return `${(bytes / BYTES_PER_KB).toFixed(1)} KB`;
}

/**
 * 増分を符号つきで。
 *
 * @remarks
 * base を持たない量には「新規」と書きます。空にすると**動いていない route と見分けが付かず**、
 * この PR で増えた route が「変化なし」として読まれます。判定の側も増分を見ないので、表の上でも
 * 比べる先が無いことを言う必要があります。
 */
function delta(quantity: Quantity): string {
  if (quantity.base === undefined) {
    return " (新規)";
  }

  // 丸めてから符号を決める。先に符号を見ると、1 byte 減っただけの route が `-0.0 KB` になる。
  const rounded = Number(((quantity.current - quantity.base) / BYTES_PER_KB).toFixed(1)) || 0;

  if (rounded === 0) {
    return "";
  }

  return ` (${rounded > 0 ? "+" : ""}${rounded.toFixed(1)})`;
}

/** 量 1 つを「値 (増分)」の形へ。 */
function cell(quantity: Quantity): string {
  return `${kb(quantity.current)}${delta(quantity)}`;
}

/** 1 行ぶんの判定を語にする。 */
function statusOf(verdict: Verdict): string {
  const over = [
    verdict.overLimit === undefined ? null : `上限 +${kb(verdict.overLimit)}`,
    verdict.initialJs.overGrowth === undefined
      ? null
      : `初期の増分 +${kb(verdict.initialJs.overGrowth)}`,
    verdict.totalJs.overGrowth === undefined
      ? null
      : `合計の増分 +${kb(verdict.totalJs.overGrowth)}`,
    verdict.css.overGrowth === undefined ? null : `CSS の増分 +${kb(verdict.css.overGrowth)}`,
  ].filter((reason) => reason !== null);

  if (over.length > 0) {
    return `❌ ${over.join(" / ")}`;
  }

  return verdict.limit === undefined ? "—" : "✅";
}

/** 落ちた route 1 件ぶんの、初期 JS の内訳。 */
function breakdownOf(verdict: Verdict): string {
  const own: Quantity = {
    current: verdict.initialJs.current - verdict.sharedJs.current,
    base:
      verdict.initialJs.base === undefined || verdict.sharedJs.base === undefined
        ? undefined
        : verdict.initialJs.base - verdict.sharedJs.base,
    overGrowth: undefined,
  };

  return `- \`${verdict.route}\` の初期 JS の内訳: この route だけが読む ${cell(own)} / 共有 ${cell(
    verdict.sharedJs,
  )}`;
}

/**
 * 表を組み立てる。
 *
 * @param verdicts - 判定。初期 JS の大きい route から並べ替えて出す。
 * @param survey - 表に添える計測全体の性質。
 * @param survey.sharedJs - 2 つ以上の route が読む chunk の総量。route ごとに繰り返さず 1 度だけ
 *   出す。
 * @param survey.deferredChunkCount - 遅延として引けた chunk の総数。0 は「遅延が無い」とも
 *   「成果物から引けなくなった」とも読めるため、抽出が生きていることを表に添える
 *   （`manifest.ts` の `CHUNK_REFERENCE`）。
 */
export function renderReport(
  verdicts: readonly Verdict[],
  survey: { readonly sharedJs: Quantity; readonly deferredChunkCount: number },
): string {
  const rows = [...verdicts].sort((a, b) => b.initialJs.current - a.initialJs.current);
  const moved = delta(survey.sharedJs);
  const failed = rows.filter(
    (v) => v.overLimit !== undefined || v.initialJs.overGrowth !== undefined,
  );

  return [
    `2 つ以上の route が読む共有 chunk: ${kb(survey.sharedJs.current)}${moved}${
      moved === "" ? "" : "。同じ増分が下の表の各 route へ乗っています"
    }`,
    `遅延として引けた chunk: ${survey.deferredChunkCount} 件`,
    "",
    "| route | 初期 JS | 遅延 JS | 合計 JS | CSS | 上限 | 判定 |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map(
      (v) =>
        `| \`${v.route}\` | ${cell(v.initialJs)} | ${cell(v.deferredJs)} | ${cell(v.totalJs)} | ${cell(
          v.css,
        )} | ${v.limit === undefined ? "—" : kb(v.limit)} | ${statusOf(v)} |`,
    ),
    ...(failed.length === 0 ? [] : ["", ...failed.map(breakdownOf)]),
  ].join("\n");
}
