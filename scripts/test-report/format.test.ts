import { describe, expect, it } from "vitest";

import {
  codeBlock,
  collectPlaywrightFailures,
  collectVitestFailures,
  formatReport,
  type PlaywrightReport,
  type Summary,
  summarise,
  type VitestReport,
} from "./format";

/** 見分けられなかったら本文を組む前に落とす。テスト側で `!` を書かないため。 */
function summaryOf(report: unknown): Summary {
  const summary = summarise(report);
  if (!summary) throw new Error("レポートの形を見分けられませんでした");
  return summary;
}

/** 上限の検査で使う、同じ大きさの失敗を任意件数持つ要約。 */
function manyFailures(count: number): Summary {
  return {
    total: count,
    failures: Array.from({ length: count }, (_, index) => ({
      file: `/repo/${index}.test.ts`,
      name: `ケース ${index}`,
      message: "y".repeat(500),
    })),
    failedWithoutTestFailure: false,
  };
}

const PASSING: VitestReport = {
  numTotalTests: 3,
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

describe("collectVitestFailures", () => {
  // ----- 正常系 -----
  it("失敗したケースだけを取り出す", () => {
    expect(collectVitestFailures(FAILING)).toEqual([
      { file: "/repo/a.test.ts", name: "a > ng", message: "expected 1 to be 2" },
    ]);
  });

  it("通ったケースしかなければ空にする", () => {
    expect(collectVitestFailures(PASSING)).toEqual([]);
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

    expect(collectVitestFailures(report)).toEqual([
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

    expect(collectVitestFailures(report)[0]?.message).toBe("(理由の記録なし)");
  });

  it("空のレポートで落ちない", () => {
    expect(collectVitestFailures({})).toEqual([]);
  });
});

describe("formatReport", () => {
  // ----- 正常系 -----
  it("全件通ったことを件数つきで述べる", () => {
    expect(formatReport(summaryOf(PASSING), "tail")).toBe("全 3 件のテストが通りました。");
  });

  it("失敗の全件と、母数に対する件数を述べる", () => {
    const body = formatReport(summaryOf(FAILING), "tail");

    expect(body).toContain("全 3 件中 **1 件が失敗**");
    expect(body).toContain("以下がその全件です");
    expect(body).toContain("a > ng");
    expect(body).toContain("expected 1 to be 2");
  });

  it("通ったケースを本文へ出さない", () => {
    expect(formatReport(summaryOf(FAILING), "tail")).not.toContain("a > ok");
  });

  // ----- 異常系 -----
  it("テストが落ちていないのに実行が失敗したら、判定を持つログを添える", () => {
    const report: VitestReport = { numTotalTests: 3, success: false, testResults: [] };
    const body = formatReport(
      summaryOf(report),
      "ERROR: Coverage for lines (99%) does not meet threshold",
    );

    expect(body).toContain("実行はテスト以外の理由で失敗しています");
    expect(body).toContain("does not meet threshold");
  });

  it("上限に収まるなら全件を出し、全件だと述べる", () => {
    const body = formatReport(manyFailures(3), "tail");

    expect(body).toContain("以下がその全件です");
    expect(body).toContain("ケース 2");
  });

  it("上限を超えたら、載せた件数と落とした件数と在処を述べる", () => {
    const body = formatReport(manyFailures(100), "tail", 2_000);

    expect(body).toContain("全 100 件中 **100 件が失敗**");
    expect(body).toContain("本文の長さの上限に達したため");
    expect(body).toContain("JSON レポート");
    expect(body).not.toContain("以下がその全件です");
    expect(body.length).toBeLessThan(6_000);
  });

  it("1 件も載らない本文にはしない", () => {
    expect(formatReport(manyFailures(100), "tail", 1)).toContain("ケース 0");
  });
});

const PW_FAILING: PlaywrightReport = {
  stats: { expected: 2, unexpected: 1, flaky: 0, skipped: 0 },
  suites: [
    {
      title: "a.spec.ts",
      file: "e2e/journeys/a.spec.ts",
      specs: [{ title: "通る経路", ok: true, tests: [] }],
      suites: [
        {
          title: "入れ子の suite",
          specs: [
            {
              title: "落ちる経路",
              file: "e2e/journeys/a.spec.ts",
              ok: false,
              tests: [
                {
                  results: [
                    { status: "failed", error: { message: "Timed out waiting for locator" } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe("collectPlaywrightFailures", () => {
  // ----- 正常系 -----
  it("入れ子の suite を降りて、ok が偽の spec だけを拾う", () => {
    expect(collectPlaywrightFailures(PW_FAILING)).toEqual([
      {
        file: "e2e/journeys/a.spec.ts",
        name: "落ちる経路",
        message: "Timed out waiting for locator",
      },
    ]);
  });

  it("spec の外で落ちたものを errors から拾う", () => {
    const report: PlaywrightReport = { errors: [{ message: "config を読めませんでした" }] };

    expect(collectPlaywrightFailures(report)).toEqual([
      { file: "(spec の外)", name: "(実行系の失敗)", message: "config を読めませんでした" },
    ]);
  });

  // ----- 異常系 -----
  it("通った spec しかなければ空にする", () => {
    const report: PlaywrightReport = { suites: [{ specs: [{ title: "ok", ok: true }] }] };

    expect(collectPlaywrightFailures(report)).toEqual([]);
  });

  it("空のレポートで落ちない", () => {
    expect(collectPlaywrightFailures({})).toEqual([]);
  });

  it("results[].errors から複数の文言を拾い、重複を畳む", () => {
    const report: PlaywrightReport = {
      suites: [
        {
          specs: [
            {
              title: "落ちる",
              ok: false,
              tests: [
                {
                  results: [
                    {
                      status: "failed",
                      error: { message: "同じ文言" },
                      errors: [{ message: "同じ文言" }, { message: "別の文言" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(collectPlaywrightFailures(report)[0]?.message).toBe("同じ文言\n別の文言");
  });

  it("欠けだらけの spec でも落とさず、欠けた場所を名指しする", () => {
    const report: PlaywrightReport = {
      suites: [{ specs: [{ ok: false }] }],
      errors: [{}],
    };

    expect(collectPlaywrightFailures(report)).toEqual([
      { file: "(不明なファイル)", name: "(不明なケース)", message: "(理由の記録なし)" },
      { file: "(spec の外)", name: "(実行系の失敗)", message: "(理由の記録なし)" },
    ]);
  });

  it("文言を持たない result を理由なしとして残す", () => {
    const report: PlaywrightReport = {
      suites: [{ file: "a.spec.ts", specs: [{ title: "落ちる", ok: false, tests: [{}] }] }],
    };

    expect(collectPlaywrightFailures(report)[0]?.message).toBe("(理由の記録なし)");
  });
});

describe("summarise", () => {
  // ----- 正常系 -----
  it("Vitest のレポートを見分ける", () => {
    expect(summarise(PASSING)?.total).toBe(3);
  });

  it("Playwright のレポートを見分け、母数を stats から足す", () => {
    expect(summarise(PW_FAILING)?.total).toBe(3);
    expect(summarise(PW_FAILING)?.failures).toHaveLength(1);
  });

  // ----- 異常系 -----
  it("どちらでもない形は判定できないとして undefined を返す", () => {
    expect(summarise({ hello: "world" })).toBeUndefined();
  });

  it("オブジェクトでないものを渡されても落ちない", () => {
    expect(summarise("not json")).toBeUndefined();
    expect(summarise(null)).toBeUndefined();
  });

  it("stats を持たない Playwright のレポートを母数 0 で通す", () => {
    const summary = summarise({ suites: [] });

    expect(summary?.total).toBe(0);
    expect(summary?.failedWithoutTestFailure).toBe(false);
  });

  it("spec が 1 件も落ちていないのに unexpected があるものを、テスト以外の失敗とする", () => {
    const summary = summarise({ stats: { unexpected: 1 }, suites: [] });

    expect(summary?.failedWithoutTestFailure).toBe(true);
  });

  it("success を持たない Vitest のレポートをテスト以外の失敗にしない", () => {
    expect(summarise({ testResults: [] })?.failedWithoutTestFailure).toBe(false);
  });
});

describe("codeBlock", () => {
  // ----- 正常系 -----
  it("バッククォートを含まない文字列を 3 つのフェンスで囲む", () => {
    expect(codeBlock("expected 1 to be 2")).toEqual(["```text", "expected 1 to be 2", "```"]);
  });

  // ----- 異常系 -----
  it("中身のフェンスより長いフェンスで囲む", () => {
    const [open, , close] = codeBlock("見出し\n```\nrm -rf /\n```");

    expect(open).toBe("````text");
    expect(close).toBe("````");
  });

  it("最長の連なりだけを見る", () => {
    expect(codeBlock("`a` ````` b")[0]).toBe("``````text");
  });

  it("端末の色付けを外し、文言は残す", () => {
    expect(codeBlock("\u001B[31mexpected 1 to be 2\u001B[39m")[1]).toBe("expected 1 to be 2");
  });

  it("上限を超える塊を、落とした量を書いた上で切る", () => {
    const body = codeBlock("x".repeat(50), 10)[1] ?? "";

    expect(body).toContain("50 文字あり、先頭 10 文字");
    expect(body.startsWith("x".repeat(10))).toBe(true);
  });
});
