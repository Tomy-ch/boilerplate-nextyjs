import { describe, expect, it } from "vitest";

import {
  countMarkerLines,
  diffBaseline,
  EXCLUDED_PATH_PREFIXES,
  findRowsOutsideTable,
  isBaselineTarget,
} from "./rules";

describe("countMarkerLines", () => {
  // ----- 正常系 -----
  it("両方の族の全接尾辞を数える", () => {
    const content = [
      "<!-- boilerplate-only:begin -->",
      "<!-- boilerplate-only:end -->",
      "x // sample:line",
      "# sample:replace-begin",
      "# sample:replace-with",
      "# sample:replace-end",
    ].join("\n");

    expect(countMarkerLines(content)).toBe(6);
  });

  it("コードフェンスの中でも数える", () => {
    const content = ["```ts", 'const to = "/account"; // sample:line', "```"].join("\n");

    expect(countMarkerLines(content)).toBe(1);
  });

  it("マーカーが無ければ 0", () => {
    expect(countMarkerLines("# 見出し\n\nただの散文。")).toBe(0);
  });

  // ----- 異常系 -----
  it("コメント記号の無い同名トークンを数えない", () => {
    expect(countMarkerLines('grep -rn "sample:begin" docs/')).toBe(0);
    expect(countMarkerLines("| `boilerplate-only:line` | 行末コメント |")).toBe(0);
  });

  it("接尾辞の無いマーカー名を数えない", () => {
    expect(countMarkerLines("<!-- sample -->")).toBe(0);
  });

  it("接尾辞が途中まで一致するだけのものを数えない", () => {
    expect(countMarkerLines("// sample:beginning")).toBe(0);
  });

  it("別名のマーカーを数えない", () => {
    expect(countMarkerLines("# setup-localize:begin")).toBe(0);
  });
});

describe("EXCLUDED_PATH_PREFIXES", () => {
  // ----- 正常系 -----
  it("すべて区切りで終わる", () => {
    expect(EXCLUDED_PATH_PREFIXES.filter((prefix) => !prefix.endsWith("/"))).toEqual([]);
  });
});

describe("isBaselineTarget", () => {
  // ----- 正常系 -----
  it("通常の本文を対象にする", () => {
    expect(isBaselineTarget("docs/adr/README.md")).toBe(true);
    expect(isBaselineTarget("src/model/authz.ts")).toBe(true);
  });

  it("接頭辞が途中まで一致するだけのパスは対象にする", () => {
    expect(isBaselineTarget("out-of-scope/notes.md")).toBe(true);
    expect(isBaselineTarget("src/model/generated-by-hand.ts")).toBe(true);
  });

  // ----- 異常系 -----
  it("宣言した接頭辞を対象から外す", () => {
    for (const prefix of EXCLUDED_PATH_PREFIXES) {
      expect(isBaselineTarget(`${prefix}anything.md`), prefix).toBe(false);
    }
  });

  it("自分自身のディレクトリを対象から外す", () => {
    expect(isBaselineTarget("scripts/marker-baseline/rules.test.ts")).toBe(false);
  });

  it("区切りを Windows の綴りで渡された宣言済みの接頭辞も外す", () => {
    expect(isBaselineTarget("src\\app\\generated\\api.ts")).toBe(false);
  });
});

describe("diffBaseline", () => {
  // ----- 正常系 -----
  it("一致していれば空を返す", () => {
    expect(diffBaseline({ "a.md": 2 }, { "a.md": 2 })).toEqual([]);
  });

  // ----- 異常系 -----
  it("マーカーを持つファイルが増えたら落とす", () => {
    const failures = diffBaseline({ "a.md": 2, "new.md": 2 }, { "a.md": 2 });

    expect(failures).toEqual([
      "マーカー行が現れました: new.md（2 行） — 本物のマーカーならベースラインへ、規約の例示なら除去側のリテラル宣言へ",
    ]);
  });

  it("既にマーカーを持つファイルで行数が変わったら落とす", () => {
    const failures = diffBaseline({ "a.md": 4 }, { "a.md": 2 });

    expect(failures).toEqual(["マーカー行数が変わりました: a.md（2 → 4 行）"]);
  });

  it("マーカーが無くなったら落とす", () => {
    const failures = diffBaseline({}, { "a.md": 2 });

    expect(failures).toEqual(["マーカー行が無くなりました: a.md — ベースラインのほうが古い"]);
  });
});

describe("findRowsOutsideTable", () => {
  const table = ["| a | b |", "| --- | --- |", "| 1 | 2 |"];

  // ----- 正常系 -----
  it("区切り行から始まる表は落とさない", () => {
    expect(findRowsOutsideTable(table.join("\n"))).toEqual([]);
  });

  it("行内の `:line` は表を割らない", () => {
    const content = [...table, "| 3 | 4 <!-- boilerplate-only:line --> |"].join("\n");

    expect(findRowsOutsideTable(content)).toEqual([]);
  });

  it("表の直後に置いたブロックマーカーは表を割らない", () => {
    const content = [...table, "", "<!-- sample:begin -->", "散文", "<!-- sample:end -->"].join(
      "\n",
    );

    expect(findRowsOutsideTable(content)).toEqual([]);
  });

  it("囲みコードの中の `|` を表と見なさない", () => {
    const content = ["```text", "| a | b |", "```"].join("\n");

    expect(findRowsOutsideTable(content)).toEqual([]);
  });

  // ----- 異常系 -----
  it("表の途中のブロックマーカーより後ろの行を落とす", () => {
    const content = [
      ...table,
      "<!-- boilerplate-only:replace-begin -->",
      "| 3 | 4 |",
      "<!-- boilerplate-only:replace-with -->",
      "<!-- = | 3 | 5 | -->",
      "<!-- boilerplate-only:replace-end -->",
      "| 6 | 7 |",
    ].join("\n");

    expect(findRowsOutsideTable(content)).toEqual([5, 9]);
  });

  it("表の途中の空行より後ろの行を落とす", () => {
    expect(findRowsOutsideTable([...table, "", "| 3 | 4 |"].join("\n"))).toEqual([5]);
  });

  it("区切り行を持たない行の並びを落とす", () => {
    expect(findRowsOutsideTable("| a | b |\n| 1 | 2 |")).toEqual([1, 2]);
  });
});
