import { describe, expect, it } from "vitest";

import { ceTaskUrl, issuesSearchUrl, qualityGateUrl } from "./endpoints";

const SERVER = "https://sonarcloud.io";

describe("ceTaskUrl", () => {
  // ----- 正常系 -----
  it("entry を id で名指す", () => {
    expect(ceTaskUrl(SERVER, "AY-task")).toBe("https://sonarcloud.io/api/ce/task?id=AY-task");
  });

  it("待ち受け先が下位パスに在ってもその下へ継ぐ", () => {
    expect(ceTaskUrl("https://sonar.example.com/sonar", "AY-task")).toBe(
      "https://sonar.example.com/sonar/api/ce/task?id=AY-task",
    );
  });

  it("待ち受け先の末尾の / を重ねない", () => {
    expect(ceTaskUrl("https://sonarcloud.io/", "AY-task")).toBe(
      "https://sonarcloud.io/api/ce/task?id=AY-task",
    );
  });

  // ----- 異常系 -----
  it("id に含まれる記号を符号化し、別の引数として読まれないようにする", () => {
    expect(ceTaskUrl(SERVER, "AY&ps=1")).toBe("https://sonarcloud.io/api/ce/task?id=AY%26ps%3D1");
  });
});

describe("qualityGateUrl", () => {
  // ----- 正常系 -----
  it("project ではなく解析を名指す", () => {
    expect(qualityGateUrl(SERVER, "AY-analysis")).toBe(
      "https://sonarcloud.io/api/qualitygates/project_status?analysisId=AY-analysis",
    );
  });

  // ----- 異常系 -----
  it("解析の id に含まれる記号を符号化する", () => {
    expect(qualityGateUrl(SERVER, "AY#1")).toBe(
      "https://sonarcloud.io/api/qualitygates/project_status?analysisId=AY%231",
    );
  });
});

describe("issuesSearchUrl", () => {
  // ----- 正常系 -----
  it("PR 番号があれば PR の解析へ絞る", () => {
    expect(issuesSearchUrl(SERVER, "example_project", "42")).toBe(
      "https://sonarcloud.io/api/issues/search?componentKeys=example_project&resolved=false&ps=500&pullRequest=42",
    );
  });

  it("PR 番号が無ければ branch の解析を問う", () => {
    expect(issuesSearchUrl(SERVER, "example_project", undefined)).toBe(
      "https://sonarcloud.io/api/issues/search?componentKeys=example_project&resolved=false&ps=500",
    );
  });

  it("PR 番号が空文字列でも branch の解析を問う", () => {
    expect(issuesSearchUrl(SERVER, "example_project", "")).toBe(
      "https://sonarcloud.io/api/issues/search?componentKeys=example_project&resolved=false&ps=500",
    );
  });

  // ----- 異常系 -----
  it("project key に含まれる記号を符号化する", () => {
    expect(issuesSearchUrl(SERVER, "example&ps=1", undefined)).toBe(
      "https://sonarcloud.io/api/issues/search?componentKeys=example%26ps%3D1&resolved=false&ps=500",
    );
  });
});
