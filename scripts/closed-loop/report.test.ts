import { describe, expect, it } from "vitest";

import { NO_WINDOWS_MESSAGE, type WindowMarks } from "./phases";
import { NO_TRANSCRIPT_MESSAGE, reportAll, reportTranscript, reportWindow } from "./report";
import { countTranscript, type TranscriptCounts } from "./transcript";

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

describe("reportTranscript", () => {
  const counts: TranscriptCounts = countTranscript([
    JSON.stringify({ type: "user", message: { content: [{ type: "tool_use", name: "Skill", input: { skill: "commit" } }] } }),
  ]);

  // ----- 正常系 -----
  it("読んだ量・数えられなかった量・起動を並べる", () => {
    const lines = reportTranscript(counts, { files: 10, unparsable: 2, never: [] });

    expect(lines).toContain("記録: 10 行（解釈できなかった行 2）");
    expect(lines).toContain("  commit: 1");
    expect(lines).toContain("一度も起動されなかったスキル: 0 本");
  });

  it("一度も起動されなかったスキルを名前で挙げる", () => {
    const lines = reportTranscript(counts, { files: 1, unparsable: 0, never: ["glossary", "how-to"] });

    expect(lines).toContain("  glossary / how-to");
  });

  it("起動が 1 件も無ければ、そう述べる", () => {
    const lines = reportTranscript(countTranscript([]), { files: 1, unparsable: 0, never: [] });

    expect(lines).toContain("  なし");
  });

  // ----- 異常系 -----
  it("1 行も読めなかったことを「起動なし」へ倒さない", () => {
    expect(reportTranscript(counts, { files: 0, unparsable: 0, never: [] })).toEqual([
      "",
      `⚠ ${NO_TRANSCRIPT_MESSAGE}`,
    ]);
  });
});
