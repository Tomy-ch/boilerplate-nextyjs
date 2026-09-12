import { describe, expect, it } from "vitest";

import { findMentions, isPinReferenced, repoOf } from "./scanner-removal";

describe("repoOf", () => {
  // ----- 正常系 -----
  it("版を外して owner/repo を返す", () => {
    expect(repoOf("github/codeql-action@v4.37.6")).toBe("github/codeql-action");
  });

  it("版を持たないキーはそのまま返す", () => {
    expect(repoOf("github/codeql-action")).toBe("github/codeql-action");
  });
});

describe("isPinReferenced", () => {
  // ----- 正常系 -----
  it("残る workflow がサブパス付きで使っていれば参照とみなす", () => {
    const surviving = ["    - uses: github/codeql-action/upload-sarif@v4.37.6"];

    expect(isPinReferenced("github/codeql-action@v4.37.6", surviving)).toBe(true);
  });

  // ----- 異常系 -----
  it("どの workflow も使っていなければ孤児とみなす", () => {
    const surviving = ["    - uses: actions/checkout@v7.0.0"];

    expect(isPinReferenced("SonarSource/sonarqube-scan-action@v8.2.1", surviving)).toBe(false);
  });

  it("名前が前方一致するだけの action を参照とみなさない", () => {
    expect(isPinReferenced("actions/cache", ["    - uses: actions/checkout@v7.0.0"])).toBe(false);
  });
});

describe("findMentions", () => {
  // ----- 正常系 -----
  it("綴りを含む行を、行番号つきで挙げる", () => {
    const content = ["# 見出し", "CodeQL の層", "無関係な行"].join("\n");

    expect(findMentions("docs/x.md", content, ["CodeQL"])).toEqual([
      { file: "docs/x.md", line: 2, text: "CodeQL の層" },
    ]);
  });

  it("同じ行が複数の綴りに当たっても 1 件で返す", () => {
    const found = findMentions("docs/x.md", "CodeQL と codeql", ["CodeQL", "codeql"]);

    expect(found).toHaveLength(1);
  });

  // ----- 異常系 -----
  it("綴りが無ければ 0 件を返す", () => {
    expect(findMentions("docs/x.md", "何も無い", ["CodeQL"])).toEqual([]);
  });
});
