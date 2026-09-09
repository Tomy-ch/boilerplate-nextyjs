import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { diffBaseline, EXCLUDED_DIRECTORIES } from "./rules";
import { REPO_ROOT, readBaseline, scanRowsOutsideTable, scanTree } from "./scan";

// リポジトリ全体を歩くため、既定の 5 秒では足りない（`docs/testing-conventions.md`）。
const TIMEOUT_MS = 300_000;

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "marker-baseline-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

/** `root` からの相対パスへ本文を置く。中間ディレクトリは作る。 */
function place(relativePath: string, ...lines: string[]): void {
  const absolute = join(root, relativePath);

  mkdirSync(join(absolute, ".."), { recursive: true });
  writeFileSync(absolute, `${lines.join("\n")}\n`);
}

describe("scanTree", () => {
  // ----- 正常系 -----
  it("マーカーを持つファイルだけを行数付きで返す", () => {
    place("src/a.ts", "// sample:begin", "const x = 1;", "// sample:end");
    place("src/b.ts", "const y = 2;");
    place("docs/c.md", "<!-- boilerplate-only:line -->");

    expect(scanTree(root)).toEqual({ "docs/c.md": 1, "src/a.ts": 2 });
  });

  it("キーを相対パスの昇順で返す", () => {
    place("b.md", "<!-- sample:line -->");
    place("a/z.md", "<!-- sample:line -->");
    place("a.md", "<!-- sample:line -->");

    expect(Object.keys(scanTree(root))).toEqual(["a.md", "a/z.md", "b.md"]);
  });

  // 隣は**ディレクトリ**で置く。除外はディレクトリを降りる前にしか当たらず、ファイルで置くと
  // 判定を一度も通らない。
  it("接頭辞が途中まで一致するだけのディレクトリへは降りる", () => {
    place("src/model/generated-extra/api.ts", "// sample:line");

    expect(scanTree(root)).toEqual({ "src/model/generated-extra/api.ts": 1 });
  });

  it(
    "実ツリーがベースラインと一致する",
    () => {
      expect(diffBaseline(scanTree(REPO_ROOT), readBaseline()).join("\n")).toBe("");
    },
    TIMEOUT_MS,
  );

  // ----- 異常系 -----
  it("除外ディレクトリ名の配下へ降りない", () => {
    for (const name of EXCLUDED_DIRECTORIES) {
      place(`${name}/dropped.md`, "<!-- sample:line -->");
    }

    expect(scanTree(root)).toEqual({});
  });

  it("除外接頭辞の配下へ降りない", () => {
    place("src/model/generated/api.ts", "// sample:line");
    place(".claude/worktrees/other/src/a.ts", "// sample:line");

    expect(scanTree(root)).toEqual({});
  });

  it("シンボリックリンクを辿らない", () => {
    place("outside.md", "<!-- sample:line -->");
    symlinkSync(join(root, "outside.md"), join(root, "linked.md"));

    expect(Object.keys(scanTree(root))).toEqual(["outside.md"]);
  });

  it("読めないファイルを飛ばさずに投げる", () => {
    place("locked.md", "<!-- sample:line -->");
    chmodSync(join(root, "locked.md"), 0o000);

    expect(() => scanTree(root)).toThrow();
  });
});

describe("scanRowsOutsideTable", () => {
  // ----- 正常系 -----
  it(
    "実ツリーの Markdown に、表として成立していない行が無い",
    () => {
      expect(scanRowsOutsideTable(REPO_ROOT)).toEqual({});
    },
    TIMEOUT_MS,
  );

  it("Markdown 以外は見ない", () => {
    place("src/a.ts", "| a | b |", "| 1 | 2 |");

    expect(scanRowsOutsideTable(root)).toEqual({});
  });

  // ----- 異常系 -----
  it("区切り行を持たない `|` 始まりの行を挙げる", () => {
    place("docs/a.md", "| a | b |", "| 1 | 2 |");

    expect(scanRowsOutsideTable(root)).toEqual({ "docs/a.md": [1, 2] });
  });
});

describe("readBaseline", () => {
  // ----- 正常系 -----
  it("0 件の項目を持たない", () => {
    const zeros = Object.entries(readBaseline())
      .filter(([, count]) => count <= 0)
      .map(([file]) => file);

    expect(zeros).toEqual([]);
  });
});
