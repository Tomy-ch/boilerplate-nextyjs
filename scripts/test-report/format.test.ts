import { describe, expect, it } from "vitest";

import { parseSpecs } from "../lib/playwright-report";

import {
  codeBlock,
  codeSpan,
  collectPlaywrightFailures,
  collectVitestFailures,
  formatReport,
  type Summary,
  summarise,
  type VitestReport,
} from "./format";

/** 見分けられなかったら本文を組む前に落とす。テスト側で `!` を書かないため。 */
function summariseOf(report: unknown): Summary {
  const summary = summarise(JSON.stringify(report));
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

  it("testResults が配列でなければ 0 件として読む", () => {
    expect(collectVitestFailures({ testResults: {} as never })).toEqual([]);
  });

  it("failureMessages が配列でなければ理由なしとして残す", () => {
    const report: VitestReport = {
      testResults: [
        {
          name: "/repo/d.test.ts",
          status: "failed",
          assertionResults: [
            { fullName: "d", status: "failed", failureMessages: "壊れた" as never },
          ],
        },
      ],
    };

    expect(collectVitestFailures(report)[0]?.message).toBe("(理由の記録なし)");
  });
});

describe("formatReport", () => {
  // ----- 正常系 -----
  it("全件通ったことを件数つきで述べる", () => {
    expect(formatReport(summariseOf(PASSING), "tail")).toBe("全 3 件のテストが通りました。");
  });

  it("失敗の全件と、母数に対する件数を述べる", () => {
    const body = formatReport(summariseOf(FAILING), "tail");

    expect(body).toContain("全 3 件中 **1 件が失敗**");
    expect(body).toContain("以下がその全件です");
    expect(body).toContain("a > ng");
    expect(body).toContain("expected 1 to be 2");
  });

  it("通ったケースを本文へ出さない", () => {
    expect(formatReport(summariseOf(FAILING), "tail")).not.toContain("a > ok");
  });

  // ----- 異常系 -----
  it("テストが落ちていないのに実行が失敗したら、判定を持つログを添える", () => {
    const report: VitestReport = { numTotalTests: 3, success: false, testResults: [] };
    const body = formatReport(
      summariseOf(report),
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
    // 上限そのものに紐づける。固定値と比べると、budget を無視した実装でも通り続ける。
    expect(body.length).toBeLessThan(2_000 * 1.5);
  });

  it("1 件も載らない本文にはしない", () => {
    expect(formatReport(manyFailures(100), "tail", 1)).toContain("ケース 0");
  });
});

const PW_FAILING = {
  stats: { expected: 2, unexpected: 1, flaky: 0, skipped: 0 },
  suites: [
    {
      title: "a.spec.ts",
      file: "e2e/journeys/a.spec.ts",
      specs: [{ title: "通る経路", ok: true, tests: [{ status: "expected", results: [] }] }],
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
                  status: "unexpected",
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

/** レポートの実物と同じく、文字列から spec を取り出して渡す。 */
function specsOf(report: unknown) {
  return parseSpecs(JSON.stringify(report));
}

describe("collectPlaywrightFailures", () => {
  // ----- 正常系 -----
  it("入れ子の suite を降りて、落ちた test だけを拾う", () => {
    expect(collectPlaywrightFailures(specsOf(PW_FAILING), PW_FAILING)).toEqual([
      {
        file: "e2e/journeys/a.spec.ts",
        name: "落ちる経路",
        message: "Timed out waiting for locator",
      },
    ]);
  });

  it("再試行で通った flaky も落ちたものとして拾う", () => {
    const report = {
      suites: [
        {
          file: "a.spec.ts",
          specs: [
            {
              title: "揺れる経路",
              file: "a.spec.ts",
              // Playwright は flaky な spec を ok: true にする。ここで足切りすると取りこぼす。
              ok: true,
              tests: [
                {
                  status: "flaky",
                  results: [{ status: "failed", error: { message: "1 度目に落ちた" } }],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(collectPlaywrightFailures(specsOf(report), report)).toEqual([
      { file: "a.spec.ts", name: "揺れる経路", message: "1 度目に落ちた" },
    ]);
  });

  it("results[].errors から複数の文言を拾い、重複を畳む", () => {
    const report = {
      suites: [
        {
          file: "a.spec.ts",
          specs: [
            {
              title: "落ちる",
              file: "a.spec.ts",
              tests: [
                {
                  status: "unexpected",
                  results: [
                    {
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

    expect(collectPlaywrightFailures(specsOf(report), report)[0]?.message).toBe(
      "同じ文言\n別の文言",
    );
  });

  it("spec の外で落ちたものを errors から拾う", () => {
    const report = { suites: [], errors: [{ message: "config を読めませんでした" }] };

    expect(collectPlaywrightFailures(specsOf(report), report)).toEqual([
      { file: "(spec の外)", name: "(実行系の失敗)", message: "config を読めませんでした" },
    ]);
  });

  // ----- 異常系 -----
  it("通った spec しかなければ空にする", () => {
    const report = {
      suites: [{ specs: [{ title: "ok", tests: [{ status: "expected", results: [] }] }] }],
    };

    expect(collectPlaywrightFailures(specsOf(report), report)).toEqual([]);
  });

  it("欠けだらけの spec でも落とさず、欠けた場所を名指しする", () => {
    const report = {
      suites: [{ specs: [{ tests: [{ status: "unexpected" }] }] }],
      errors: [{}],
    };

    expect(collectPlaywrightFailures(specsOf(report), report)).toEqual([
      { file: "(不明なファイル)", name: "(不明なケース)", message: "(理由の記録なし)" },
      { file: "(spec の外)", name: "(実行系の失敗)", message: "(理由の記録なし)" },
    ]);
  });

  it("spec が 1 件も無くても落ちない", () => {
    expect(collectPlaywrightFailures([], {})).toEqual([]);
  });

  it("errors が配列でなければ 0 件として読み、偽の失敗を組まない", () => {
    // 文字列を反復させると 1 文字につき 1 件の失敗を捏造する。
    expect(collectPlaywrightFailures([], { errors: "oops" as never })).toEqual([]);
  });
});

describe("summarise", () => {
  // ----- 正常系 -----
  it("Vitest のレポートを見分ける", () => {
    expect(summarise(JSON.stringify(PASSING))?.total).toBe(3);
  });

  it("Playwright のレポートを見分け、母数を stats から足す", () => {
    expect(summarise(JSON.stringify(PW_FAILING))?.total).toBe(3);
    expect(summarise(JSON.stringify(PW_FAILING))?.failures).toHaveLength(1);
  });

  // ----- 異常系 -----
  it("どちらでもない形は判定できないとして undefined を返す", () => {
    expect(summarise(JSON.stringify({ hello: "world" }))).toBeUndefined();
  });

  it("オブジェクトでないものを渡されても落ちない", () => {
    expect(summarise("not json")).toBeUndefined();
    expect(summarise("null")).toBeUndefined();
  });

  it("stats を持たない Playwright のレポートを母数 0 で通す", () => {
    const summary = summarise(JSON.stringify({ suites: [] }));

    expect(summary?.total).toBe(0);
    expect(summary?.failedWithoutTestFailure).toBe(false);
  });

  it("spec が 1 件も落ちていないのに unexpected があるものを、テスト以外の失敗とする", () => {
    const summary = summarise(JSON.stringify({ stats: { unexpected: 1 }, suites: [] }));

    expect(summary?.failedWithoutTestFailure).toBe(true);
  });

  it("到達しなかったファイル分の失敗で、母数が失敗件数を下回らない", () => {
    // この下限が無いと「全 0 件中 2 件が失敗」という自分に矛盾した見出しになる。
    const report: VitestReport = {
      numTotalTests: 0,
      testResults: [
        { name: "/repo/a.test.ts", status: "failed", message: "boom", assertionResults: [] },
        { name: "/repo/b.test.ts", status: "failed", message: "boom", assertionResults: [] },
      ],
    };

    expect(summariseOf(report).total).toBe(2);
  });

  it("Playwright 側でも母数が失敗件数を下回らない", () => {
    const report = {
      stats: { expected: 0, unexpected: 0, flaky: 0, skipped: 0 },
      suites: [
        {
          file: "a.spec.ts",
          specs: [
            { title: "落ちる", file: "a.spec.ts", tests: [{ status: "unexpected", results: [] }] },
          ],
        },
      ],
    };

    expect(summariseOf(report).total).toBe(1);
  });

  it("トップレベルがオブジェクトでない JSON を判定できないとする", () => {
    expect(summarise("42")).toBeUndefined();
  });

  it("success を持たない Vitest のレポートをテスト以外の失敗にしない", () => {
    expect(summarise(JSON.stringify({ testResults: [] }))?.failedWithoutTestFailure).toBe(false);
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

describe("codeSpan", () => {
  // 失敗も拒否も持たない変換なので、正常系だけで軸を取る（ADR 0090「契約の内側で成功なら正常系」）。
  it("1 行のコードスパンにする", () => {
    expect(codeSpan("a > b")).toBe("`a > b`");
  });

  it("改行を潰して見出しから溢れさせない", () => {
    expect(codeSpan("先頭\n\n## 偽の見出し")).toBe("`先頭 ## 偽の見出し`");
  });

  it("中身より長いバッククォートで囲む", () => {
    expect(codeSpan("``` 閉じる ```")).toBe("```` ``` 閉じる ``` ````");
  });

  it("空の値でも空のスパンにしない", () => {
    expect(codeSpan("   ")).toBe("`(空)`");
  });

  it("mention と他スレッドへの生リンクをコードスパンの中へ閉じる", () => {
    // コードスパンの中は記法として読まれないので、通知も逆参照も起きない。
    expect(codeSpan("@someone https://github.com/o/r/issues/1")).toBe(
      "`@someone https://github.com/o/r/issues/1`",
    );
  });
});
