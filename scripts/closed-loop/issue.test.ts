import { describe, expect, it } from "vitest";

import { issueTitle, renderIssueBody } from "./issue";
import type { WindowMarks } from "./phases";

function windowOf(marks: Record<string, readonly number[]>): WindowMarks {
  return { id: "w1788885163-abc", marks };
}

describe("issueTitle", () => {
  // ----- 正常系 -----
  it("窓 id と閉じた日を題にする", () => {
    expect(issueTitle(windowOf({ openedAt: [0], closedAt: [1788885163] }))).toBe(
      "[feedback] 開発の窓 w1788885163-abc（2026-09-09）",
    );
  });

  // ----- 異常系 -----
  it("閉じていない窓でも窓 id は落とさない", () => {
    expect(issueTitle(windowOf({ openedAt: [0] }))).toBe("[feedback] 開発の窓 w1788885163-abc");
  });
});

describe("renderIssueBody", () => {
  // ----- 正常系 -----
  it("区間・回数・所見を並べる", () => {
    const body = renderIssueBody(
      windowOf({ openedAt: [0], implStartedAt: [60], commitAt: [120, 180], closedAt: [240] }),
    );

    expect(body).toContain("| openedAt → implStartedAt | 60 秒 |");
    expect(body).toContain("- commitAt: 2 回");
    expect(body).toContain("- reviewStartedAt: 0 回");
    expect(body).toContain("**段が飛んでいる**");
  });

  it("所見が無ければ、そう書く", () => {
    const body = renderIssueBody(
      windowOf({
        openedAt: [0],
        planApprovedAt: [1],
        implStartedAt: [2],
        commitAt: [3],
        reviewStartedAt: [4],
        prOpenedAt: [5],
        mergedAt: [6],
        closedAt: [7],
      }),
    );

    expect(body).toContain("所見なし");
  });

  it("読解を含まないことを本文に書く", () => {
    expect(renderIssueBody(windowOf({ openedAt: [0], closedAt: [1] }))).toContain(
      "記録の読解は含まない",
    );
  });

  // ----- 異常系 -----
  it("区間を作れない窓はそう書く", () => {
    expect(renderIssueBody(windowOf({ openedAt: [0] }))).toContain("区間なし（打刻が 1 つ以下）");
  });
});
