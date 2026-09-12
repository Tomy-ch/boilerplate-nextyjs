import { describe, expect, it } from "vitest";

import { componentPath, severityLevel, toSarif } from "./sarif";

const SERVER = "https://sonarcloud.io";

const ISSUE = {
  rule: "typescript:S1234",
  severity: "CRITICAL",
  message: "この関数は長すぎます",
  component: "example_project:src/app/page.tsx",
  line: 12,
};

describe("severityLevel", () => {
  // ----- 正常系 -----
  it("止めるべき深刻度を error にする", () => {
    expect(severityLevel("BLOCKER")).toBe("error");
    expect(severityLevel("CRITICAL")).toBe("error");
  });

  it("読ませたい深刻度を warning にする", () => {
    expect(severityLevel("MAJOR")).toBe("warning");
  });

  it("参考の深刻度を note にする", () => {
    expect(severityLevel("MINOR")).toBe("note");
    expect(severityLevel("INFO")).toBe("note");
  });

  // ----- 異常系 -----
  it("表に無い深刻度は warning へ寄せ、所見を落とさない", () => {
    expect(severityLevel("UNKNOWN")).toBe("warning");
  });
});

describe("componentPath", () => {
  // ----- 正常系 -----
  it("先頭の project key を落としてリポジトリ相対のパスにする", () => {
    expect(componentPath("example_project:src/app/page.tsx")).toBe("src/app/page.tsx");
  });

  it("key に : が含まれていても、落とすのは先頭の 1 つだけ", () => {
    expect(componentPath("org:project:src/app/page.tsx")).toBe("project:src/app/page.tsx");
  });

  it("key が正規表現の特殊文字を含んでいても同じ結果になる", () => {
    expect(componentPath("a.*+?()[]{}|^$:src/app/page.tsx")).toBe("src/app/page.tsx");
  });

  // ----- 異常系 -----
  it("key の付いていない綴りはそのまま返す", () => {
    expect(componentPath("src/app/page.tsx")).toBe("src/app/page.tsx");
    expect(componentPath("")).toBe("");
  });
});

describe("toSarif", () => {
  // ----- 正常系 -----
  it("所見を、ファイルと行に結び付いた結果へ直す", () => {
    const sarif = toSarif({ issues: [ISSUE] }, SERVER);

    expect(sarif.runs[0]?.results).toEqual([
      {
        ruleId: "typescript:S1234",
        level: "error",
        message: { text: "この関数は長すぎます" },
        locations: [
          {
            physicalLocation: {
              artifactLocation: { uri: "src/app/page.tsx" },
              region: { startLine: 12 },
            },
          },
        ],
      },
    ]);
  });

  it("名乗られた規則を重複なく並べ、説明の在り処を添える", () => {
    const other = { ...ISSUE, rule: "typescript:S0001" };
    const sarif = toSarif({ issues: [ISSUE, ISSUE, other] }, SERVER);

    expect(sarif.runs[0]?.tool.driver.rules).toEqual([
      {
        id: "typescript:S0001",
        helpUri: "https://sonarcloud.io/coding_rules?open=typescript:S0001",
      },
      {
        id: "typescript:S1234",
        helpUri: "https://sonarcloud.io/coding_rules?open=typescript:S1234",
      },
    ]);
  });

  it("行を持たない所見は、範囲の先頭行へ置く", () => {
    const issue = { ...ISSUE, line: undefined, textRange: { startLine: 7 } };
    const sarif = toSarif({ issues: [issue] }, SERVER);

    expect(sarif.runs[0]?.results[0]?.locations[0]?.physicalLocation.region).toEqual({
      startLine: 7,
    });
  });

  it("取り込む側が読む器の綴りを添える", () => {
    const sarif = toSarif({ issues: [] }, SERVER);

    expect(sarif.$schema).toBe("https://json.schemastore.org/sarif-2.1.0.json");
    expect(sarif.version).toBe("2.1.0");
    expect(sarif.runs[0]?.tool.driver.name).toBe("SonarQube Cloud");
    expect(sarif.runs[0]?.tool.driver.informationUri).toBe(SERVER);
  });

  it("所見が 1 件も無ければ、空の走査として書き出す", () => {
    const sarif = toSarif({ issues: [] }, SERVER);

    expect(sarif.runs[0]?.results).toEqual([]);
    expect(sarif.runs[0]?.tool.driver.rules).toEqual([]);
  });

  // ----- 異常系 -----
  it("応答として読めない形も、空の走査として書き出す", () => {
    expect(toSarif("応答ではない", SERVER).runs[0]?.results).toEqual([]);
  });

  it("項目の欠けた所見も、位置と規則を埋めて落とさない", () => {
    const sarif = toSarif({ issues: [{}] }, SERVER);

    expect(sarif.runs[0]?.results).toEqual([
      {
        ruleId: "unknown",
        level: "warning",
        message: { text: "" },
        locations: [
          {
            physicalLocation: {
              artifactLocation: { uri: "" },
              region: { startLine: 1 },
            },
          },
        ],
      },
    ]);
  });
});
