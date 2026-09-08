import { describe, expect, it } from "vitest";

import { NO_WINDOWS_MESSAGE, type WindowMarks } from "./phases";
import { reportAll, reportWindow } from "./report";

function windowOf(id: string, marks: Record<string, readonly number[]>): WindowMarks {
  return { id, marks };
}

describe("reportWindow", () => {
  // ----- 正常系 -----
  it("回数・区間・所見なしを並べる", () => {
    const lines = reportWindow(
      windowOf("w1", { openedAt: [0], commitAt: [30, 40], closedAt: [90] }),
    );

    expect(lines[0]).toBe("[w1] commitAt 2 回 / reviewStartedAt 0 回");
    expect(lines).toContain("  openedAt → commitAt: 30 秒");
    expect(lines).toContain("  所見なし");
  });

  it("分と時間へ落として読ませる", () => {
    const lines = reportWindow(windowOf("w1", { openedAt: [0], closedAt: [7200] }));

    expect(lines).toContain("  openedAt → closedAt: 2.0 時間");
  });

  // ----- 異常系 -----
  it("区間を作れない窓はそう述べる", () => {
    expect(reportWindow(windowOf("w1", { openedAt: [0] }))).toContain("  区間なし（打刻が 1 つ以下）");
  });

  it("所見が在るときは所見なしと書かない", () => {
    const lines = reportWindow(windowOf("w1", { openedAt: [0], commitAt: [10] }));

    expect(lines).not.toContain("  所見なし");
    expect(lines.some((line) => line.includes("窓が開いたまま"))).toBe(true);
  });
});

describe("reportAll", () => {
  // ----- 正常系 -----
  it("閉じた窓と開いたままの窓を数える", () => {
    const lines = reportAll([
      windowOf("w1", { openedAt: [0], closedAt: [10] }),
      windowOf("w2", { openedAt: [0] }),
    ]);

    expect(lines[0]).toBe("窓: 2 件（閉じた窓 1 件 / 開いたまま 1 件）");
  });

  // ----- 異常系 -----
  it("0 件を「異常なし」へ倒さない", () => {
    expect(reportAll([])).toEqual([`⚠ ${NO_WINDOWS_MESSAGE}`]);
  });
});
