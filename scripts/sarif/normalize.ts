// code scanning へ取り込む SARIF を整える。

/** SARIF の 1 実行分。整えるのは `results` だけなので、他は形を問わずそのまま運ぶ。 */
type SarifRun = { results?: unknown };

/** 抑止されたかどうかを判定するのに要る形だけを持つ結果。 */
type SarifResult = { suppressions?: unknown };

/** 読み込んだ SARIF。 */
type SarifLog = { runs?: unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** ソースで抑止された所見かどうか。SARIF はそれを `suppressions` の空でない配列で表す。 */
function isSuppressed(result: unknown): boolean {
  if (!isRecord(result)) {
    return false;
  }

  const { suppressions } = result as SarifResult;

  return Array.isArray(suppressions) && suppressions.length > 0;
}

/**
 * 取り込める形へ整えた SARIF を返す。
 *
 * @remarks
 * 抑止済みの所見を落とし、`results` を必ず配列にします（`null` は SARIF 2.1.0 に無い値で、
 * 取り込みがそこで弾かれます）。**読めない形はそのまま返します** —— ここが落とすと、SARIF を
 * 元の問題がこの工程の失敗として現れ、原因の在り処がずれます。
 *
 * @param sarif - スキャナが書き出した SARIF
 * @returns 抑止済みの所見を除き、`results` を配列に揃えた SARIF
 */
export function normalizeSarif(sarif: unknown): unknown {
  if (!isRecord(sarif)) {
    return sarif;
  }

  const { runs } = sarif as SarifLog;

  if (!Array.isArray(runs)) {
    return sarif;
  }

  return {
    ...sarif,
    runs: runs.map((run) => {
      if (!isRecord(run)) {
        return run;
      }

      const { results } = run as SarifRun;

      if (results === null || results === undefined) {
        return { ...run, results: [] };
      }

      if (!Array.isArray(results)) {
        return run;
      }

      return { ...run, results: results.filter((result) => !isSuppressed(result)) };
    }),
  };
}
