import { describe, expect, it } from "vitest";

import {
  eachLineOutsideFence,
  extractHeadings,
  parseFrontmatterKeys,
  splitFrontmatter,
} from "./document-structure";

describe("eachLineOutsideFence", () => {
  // ----- 正常系 -----
  it("フェンスの外の行だけを行番号つきで返す", () => {
    const content = ["外側", "```", "内側", "```", "また外側"].join("\n");

    expect([...eachLineOutsideFence(content)]).toEqual([
      { line: "外側", lineNo: 1 },
      { line: "また外側", lineNo: 5 },
    ]);
  });

  it("開きと同じ記号・同じ長さ以上の行だけを閉じとして扱う", () => {
    const content = ["````", "``` 内側", "````", "外側"].join("\n");

    expect([...eachLineOutsideFence(content)].map((entry) => entry.line)).toEqual(["外側"]);
  });

  // ----- 異常系 -----
  it("閉じないフェンスの中身は最後まで外へ出さない", () => {
    const content = ["外側", "```", "内側"].join("\n");

    expect([...eachLineOutsideFence(content)].map((entry) => entry.line)).toEqual(["外側"]);
  });
});

describe("splitFrontmatter", () => {
  // ----- 正常系 -----
  it("frontmatter の中身と閉じの行番号を返す", () => {
    const content = ["---", "name: sample", "---", "# 本文"].join("\n");

    expect(splitFrontmatter(content)).toEqual({ lines: ["name: sample"], endLine: 3 });
  });

  // ----- 異常系 -----
  it("先頭が区切りでなければ frontmatter として扱わない", () => {
    expect(splitFrontmatter("# 本文\n")).toBeNull();
  });

  it("閉じの区切りが無ければ frontmatter として扱わない", () => {
    expect(splitFrontmatter("---\nname: sample\n")).toBeNull();
  });
});

describe("parseFrontmatterKeys", () => {
  // ----- 正常系 -----
  it("トップレベルのキーと値を取り出す", () => {
    expect(parseFrontmatterKeys(["name: sample", "description: 説明"])).toEqual(
      new Map([
        ["name", "sample"],
        ["description", "説明"],
      ]),
    );
  });

  it("折り畳みスカラの後続行を連結して値にする", () => {
    const keys = parseFrontmatterKeys(["description: >-", "  一行目", "  二行目", "name: sample"]);

    expect(keys.get("description")).toBe("一行目 二行目");
  });

  // ----- 異常系 -----
  it("キーの形を成さない行を読み飛ばす", () => {
    expect(parseFrontmatterKeys(["- 配列要素", "  ただの続き"])).toEqual(new Map());
  });
});

describe("extractHeadings", () => {
  // ----- 正常系 -----
  it("見出しの階層・文言・行番号を返す", () => {
    const content = ["# 題名", "本文", "## 節"].join("\n");

    expect(extractHeadings(content)).toEqual([
      { level: 1, text: "題名", lineNo: 1 },
      { level: 2, text: "節", lineNo: 3 },
    ]);
  });

  it("文言が空の見出しも列から落とさない", () => {
    // 落とすと、片側にだけ在るときに対訳の列がずれた分だけ詰まって揃い、構造ずれが
    // 無報告になる。全角空白のように markdownlint が素通しする綴りで実際に起こる。
    const content = ["# 題名", "## ", "## 　"].join("\n");

    expect(extractHeadings(content)).toEqual([
      { level: 1, text: "題名", lineNo: 1 },
      { level: 2, text: "", lineNo: 2 },
      { level: 2, text: "", lineNo: 3 },
    ]);
  });

  // ----- 異常系 -----
  it("フェンスの中の見出し記法を見出しとして扱わない", () => {
    const content = ["```md", "# 例示", "```"].join("\n");

    expect(extractHeadings(content)).toEqual([]);
  });

  it("見出しを持たない文書では空を返す", () => {
    expect(extractHeadings("本文だけ\n")).toEqual([]);
  });
});
