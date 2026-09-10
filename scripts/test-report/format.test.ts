import { describe, expect, it } from "vitest";

import { collectFailures, formatReport, type VitestReport } from "./format";

const PASSING: VitestReport = {
  numTotalTests: 3,
  numFailedTests: 0,
  success: true,
  testResults: [
    {
      name: "/repo/a.test.ts",
      status: "passed",
      assertionResults: [{ fullName: "a > ok", status: "passed" }],
    },
  ],
};

const FAILING: VitestReport = {
  numTotalTests: 3,
  numFailedTests: 1,
  success: false,
  testResults: [
    {
      name: "/repo/a.test.ts",
      status: "failed",
      assertionResults: [
        { fullName: "a > ok", status: "passed" },
        { fullName: "a > ng", status: "failed", failureMessages: ["expected 1 to be 2"] },
      ],
    },
  ],
};

describe("collectFailures", () => {
  // ----- 正常系 -----
  it("失敗したケースだけを取り出す", () => {
    expect(collectFailures(FAILING)).toEqual([
      { file: "/repo/a.test.ts", name: "a > ng", message: "expected 1 to be 2" },
    ]);
  });

  it("通ったケースしかなければ空にする", () => {
    expect(collectFailures(PASSING)).toEqual([]);
  });

  it("ケースへ到達せず落ちたファイルを拾う", () => {
    const report: VitestReport = {
      testResults: [
        {
          name: "/repo/b.test.ts",
          status: "failed",
          message: "Cannot find module",
          assertionResults: [],
        },
      ],
    };

    expect(collectFailures(report)).toEqual([
      { file: "/repo/b.test.ts", name: "(ケースへ到達せず)", message: "Cannot find module" },
    ]);
  });

  // ----- 異常系 -----
  it("理由が記録されていない失敗も落とさない", () => {
    const report: VitestReport = {
      testResults: [
        {
          name: "/repo/c.test.ts",
          status: "failed",
          assertionResults: [{ fullName: "c", status: "failed" }],
        },
      ],
    };

    expect(collectFailures(report)[0]?.message).toBe("(理由の記録なし)");
  });

  it("空のレポートで落ちない", () => {
    expect(collectFailures({})).toEqual([]);
  });
});

describe("formatReport", () => {
  // ----- 正常系 -----
  it("全件通ったことを件数つきで述べる", () => {
    expect(formatReport(PASSING, "tail")).toBe("全 3 件のテストが通りました。");
  });

  it("失敗の全件と、母数に対する件数を述べる", () => {
    const body = formatReport(FAILING, "tail");

    expect(body).toContain("全 3 件中 **1 件が失敗**");
    expect(body).toContain("以下がその全件です");
    expect(body).toContain("a > ng");
    expect(body).toContain("expected 1 to be 2");
  });

  it("通ったケースを本文へ出さない", () => {
    expect(formatReport(FAILING, "tail")).not.toContain("a > ok");
  });

  // ----- 異常系 -----
  it("テストが落ちていないのに実行が失敗したら、判定を持つログを添える", () => {
    const report: VitestReport = { numTotalTests: 3, numFailedTests: 0, success: false };
    const body = formatReport(report, "ERROR: Coverage for lines (99%) does not meet threshold");

    expect(body).toContain("実行はテスト以外の理由で失敗しています");
    expect(body).toContain("does not meet threshold");
  });
});
