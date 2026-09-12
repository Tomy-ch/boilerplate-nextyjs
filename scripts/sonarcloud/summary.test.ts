import { describe, expect, it } from "vitest";

import { countResults, renderSummary } from "./summary";

/** 位置の付いた所見 1 件を組む。 */
function resultAt(level: string, uri: string, startLine: number): Record<string, unknown> {
  return {
    ruleId: "typescript:S1234",
    level,
    message: { text: "この関数は長すぎます" },
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri },
          region: { startLine },
        },
      },
    ],
  };
}

/** 走査 1 回ぶんの SARIF を組む。 */
function sarifOf(results: readonly unknown[]): unknown {
  return { runs: [{ results }] };
}

const ERROR_RESULT = resultAt("error", "src/app/page.tsx", 12);
const NOTE_RESULT = resultAt("note", "src/app/layout.tsx", 3);

const FAILING_CONDITIONS = "- `new_duplicated_lines_density` gt 3 — actual 7.4\n";

describe("countResults", () => {
  // ----- 正常系 -----
  it("走査をまたいで所見を数える", () => {
    const sarif = { runs: [{ results: [ERROR_RESULT] }, { results: [NOTE_RESULT] }] };

    expect(countResults(sarif)).toBe(2);
  });

  it("所見が 1 件も無ければ 0 件", () => {
    expect(countResults(sarifOf([]))).toBe(0);
  });

  // ----- 異常系 -----
  it("SARIF として読めない形も 0 件として数える", () => {
    expect(countResults("SARIF ではない")).toBe(0);
  });
});

describe("renderSummary", () => {
  // ----- 正常系 -----
  it("ゲートの判定を先頭に置く", () => {
    expect(renderSummary(sarifOf([]), "OK", "")).toBe("Quality gate: OK\n\nNo issues.\n");
  });

  it("落ちた条件を所見より先に置く", () => {
    const body = renderSummary(sarifOf([]), "ERROR", FAILING_CONDITIONS);

    expect(body).toBe(`Quality gate: ERROR\n\n${FAILING_CONDITIONS}\nNo issues.\n`);
  });

  it("所見 1 件を、位置と規則の行と説明の行にする", () => {
    const body = renderSummary(sarifOf([ERROR_RESULT]), "ERROR", "");

    expect(body).toBe(
      "Quality gate: ERROR\n\n- [error] src/app/page.tsx:12 typescript:S1234\n  - この関数は長すぎます\n",
    );
  });

  it("重い段から順に並べる", () => {
    const body = renderSummary(sarifOf([NOTE_RESULT, ERROR_RESULT]), "ERROR", "");

    expect(body.indexOf("[error]")).toBeLessThan(body.indexOf("[note]"));
  });

  it("読ませたい段は、止めるべき段と参考の段のあいだへ置く", () => {
    const warning = resultAt("warning", "src/app/error.tsx", 7);
    const body = renderSummary(sarifOf([NOTE_RESULT, warning, ERROR_RESULT]), "ERROR", "");

    expect(body.indexOf("[error]")).toBeLessThan(body.indexOf("[warning]"));
    expect(body.indexOf("[warning]")).toBeLessThan(body.indexOf("[note]"));
  });

  it("説明の改行を空白へ潰し、箇条書きを崩さない", () => {
    const result = { ...ERROR_RESULT, message: { text: "1 行目\n2 行目" } };
    const body = renderSummary(sarifOf([result]), "ERROR", "");

    expect(body).toContain("  - 1 行目 2 行目\n");
  });

  // ----- 異常系 -----
  it("段の無い所見は warning として扱う", () => {
    const result = { ...ERROR_RESULT, level: undefined };
    const body = renderSummary(sarifOf([result]), "ERROR", "");

    expect(body).toContain("- [warning] src/app/page.tsx:12");
  });

  it("知らない段の所見を最後へ回す", () => {
    const result = resultAt("unknown", "src/app/route.ts", 1);
    const body = renderSummary(sarifOf([result, NOTE_RESULT]), "ERROR", "");

    expect(body.indexOf("[note]")).toBeLessThan(body.indexOf("[unknown]"));
  });

  it("位置の読めない所見も、行として残す", () => {
    const body = renderSummary(sarifOf([{}]), "ERROR", "");

    expect(body).toBe("Quality gate: ERROR\n\n- [warning] ?:0 ?\n  - \n");
  });
});
