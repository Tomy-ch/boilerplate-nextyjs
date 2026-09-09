// 原典との突合の目録の、行の形を見るゲート。
//
// 見るのは形だけである —— 判定が正しいかは原典を読まないと決まらず、それは
// `interpretation-audit` の仕事で、ここではない。ここが守るのは「反証できる形をしているか」で、
// 指し先が消えた行と、前提を持たない行を落とす。

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, "..");
const LEDGER_PATH = "docs/reference/upstream-interpretations.md";

/** 判定として認める 3 値。4 つめを作らせない。 */
const VERDICTS = ["差異なし", "差異あり", "逸脱宣言あり"] as const;

type Row = {
  readonly line: number;
  readonly source: string;
  readonly ours: string;
  readonly verdict: string;
  readonly premise: string;
  readonly checkedAt: string;
};

/** 目録の表から行を読む。見出し行と区切り行は落とす。 */
function parseRows(): readonly Row[] {
  const lines = readFileSync(path.join(REPOSITORY_ROOT, LEDGER_PATH), "utf8").split("\n");

  return lines.flatMap((raw, index) => {
    const line = raw.trim();

    if (!line.startsWith("|") || !line.endsWith("|")) {
      return [];
    }

    const cells = line
      .slice(1, -1)
      .split(" | ")
      .map((cell) => cell.trim());

    // 判定の列に 3 値のどれかが在る行だけを目録の行とみなす。判定の 3 値を説明する表や、
    // この文書の他の表を巻き込まないため。
    if (cells.length !== 5 || !VERDICTS.some((verdict) => cells[2]?.includes(verdict))) {
      return [];
    }

    return [
      {
        line: index + 1,
        source: cells[0] ?? "",
        ours: cells[1] ?? "",
        verdict: cells[2] ?? "",
        premise: cells[3] ?? "",
        checkedAt: cells[4] ?? "",
      },
    ];
  });
}

/** セル内の Markdown リンクが指すリポジトリ相対パス。 */
function linkedPaths(cell: string): readonly string[] {
  return [...cell.matchAll(/\]\(([^)]+)\)/g)].flatMap((match) => {
    const target = (match[1] ?? "").split("#")[0] ?? "";

    if (target === "" || target.startsWith("http")) {
      return [];
    }

    return [path.normalize(path.join("docs/reference", target))];
  });
}

describe("原典との突合の目録", () => {
  const rows = parseRows();

  // ----- 正常系 -----
  it("行を 1 件以上持つ", () => {
    expect(rows.length).toBeGreaterThan(0);
  });

  it("判定が 3 値のどれかである", () => {
    const unknown = rows.filter(
      (row) => !VERDICTS.some((verdict) => row.verdict.includes(verdict)),
    );

    expect(unknown.map((row) => `${LEDGER_PATH}:${row.line}`)).toEqual([]);
  });

  it("こちら側の指し先がすべて実在する", () => {
    const missing = rows.flatMap((row) =>
      linkedPaths(row.ours)
        .filter((target) => !existsSync(path.join(REPOSITORY_ROOT, target)))
        .map((target) => `${LEDGER_PATH}:${row.line} → ${target}`),
    );

    expect(missing).toEqual([]);
  });

  it("行ごとに、確かめた日を持つ", () => {
    const undated = rows.filter((row) => !/^\d{4}-\d{2}-\d{2}$/.test(row.checkedAt));

    expect(undated.map((row) => `${LEDGER_PATH}:${row.line}`)).toEqual([]);
  });

  // ----- 異常系 -----
  it("前提を持たない行を置かない", () => {
    // 前提は、読み手がこの判定に反対するための唯一の手掛かりである。空欄の行は、
    // 判定だけが在って反証の手立てが無い状態になる。
    const bare = rows.filter((row) => row.premise.length < 20);

    expect(bare.map((row) => `${LEDGER_PATH}:${row.line} → ${row.source}`)).toEqual([]);
  });

  it("同じ対を 2 度並べない", () => {
    const seen = new Map<string, number>();
    const duplicated: string[] = [];

    for (const row of rows) {
      const key = `${row.source}||${row.ours}`;

      if (seen.has(key)) {
        duplicated.push(`${LEDGER_PATH}:${row.line} と :${seen.get(key)}`);
      }

      seen.set(key, row.line);
    }

    expect(duplicated).toEqual([]);
  });
});
