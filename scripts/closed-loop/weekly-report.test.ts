import { describe, expect, it } from "vitest";

import type { Observation } from "./observation";
import { resolvePeriod } from "./period";
import { clusterIssues, type FeedbackIssue } from "./score";
import { NO_ISSUES_MESSAGE, REEVALUATION_NOTE, reportWeekly } from "./weekly-report";

const PERIOD = resolvePeriod("2026-09-01", "2026-09-07", 0);

function observationOf(over: Partial<Observation> = {}): Observation {
  return { windowId: "w1-x", openedAt: 0, closedAt: 100, phases: [], ...over };
}

function issueOf(number: number, over: Partial<FeedbackIssue> = {}): FeedbackIssue {
  return { number, kinds: [], observation: observationOf(), sections: {}, ...over };
}

function reportOf(issues: readonly FeedbackIssue[], over: Record<string, unknown> = {}) {
  return reportWeekly({
    period: PERIOD,
    issues,
    clusters: clusterIssues(issues),
    reevaluated: [],
    waiting: [],
    unparsed: 0,
    ...over,
  });
}

describe("NO_ISSUES_MESSAGE", () => {
  // ----- 正常系 -----
  it("0 件が「問題なし」ではないことを述べる", () => {
    expect(NO_ISSUES_MESSAGE).toContain("ここでは分かりません");
  });
});

describe("REEVALUATION_NOTE", () => {
  // ----- 正常系 -----
  it("決めるのが人であることを述べる", () => {
    expect(REEVALUATION_NOTE).toContain("人が決める");
  });
});

describe("reportWeekly", () => {
  // ----- 正常系 -----
  it("期間と件数を先頭に出す", () => {
    const lines = reportOf([issueOf(1)]);

    expect(lines[0]).toBe("期間 2026-09-01 〜 2026-09-07");
    expect(lines[1]).toBe("所見 1 件");
  });

  it("検討課題に、順位と改善案そのものを並べる", () => {
    const lines = reportOf([
      issueOf(1, { kinds: ["skill"], sections: { 改善案: "commit スキルへ寄せる" } }),
    ]);

    expect(lines.some((line) => line.includes("skill  件数1"))).toBe(true);
    expect(lines.some((line) => line.includes("#1 commit スキルへ寄せる"))).toBe(true);
  });

  it("測り直しに、決めるのが人であることを添える", () => {
    const lines = reportOf([issueOf(1)], {
      reevaluated: [{ key: "skill", landedIssue: 5, landedAt: 0, recurred: [6], due: true }],
    });

    expect(lines.some((line) => line.includes("#5 を 1970-01-01 にクローズ → 再発 #6"))).toBe(true);
    expect(lines).toContain(`  ${REEVALUATION_NOTE}`);
  });

  it("判定の時期が来ていない測り直しに、その旨を添える", () => {
    const lines = reportOf([issueOf(1)], {
      reevaluated: [{ key: "skill", landedIssue: 5, landedAt: 0, recurred: [], due: false }],
    });

    expect(lines.some((line) => line.includes("再発なし（判定はまだ早い）"))).toBe(true);
  });

  it("待ちが上回る窓を挙げる", () => {
    const lines = reportOf([issueOf(1)], { waiting: [1, 2] });

    expect(lines.some((line) => line.includes("待ちが実装の時間を上回る窓: #1 #2"))).toBe(true);
  });

  it("窓ごとの実測を並べる", () => {
    const lines = reportOf([
      issueOf(1, {
        observation: observationOf({
          toolCalls: 200,
          toolFailures: 20,
          interrupts: 3,
          phases: [{ from: "prOpenedAt", to: "mergedAt", sec: 600 }],
        }),
      }),
    ]);

    expect(lines.some((line) => line.includes("失敗10.0% 中断3 待ち10 分"))).toBe(true);
  });

  // ----- 異常系 -----
  it("0 件を「問題なし」へ倒さない", () => {
    expect(reportOf([])).toEqual([
      "期間 2026-09-01 〜 2026-09-07",
      "所見 0 件",
      `⚠ ${NO_ISSUES_MESSAGE}`,
    ]);
  });

  it("読めなかった issue の数を出す", () => {
    expect(reportOf([issueOf(1)], { unparsed: 2 })[1]).toBe("所見 1 件（観測を読めず 2 件）");
  });

  it("観測できていない値を「—」で出す", () => {
    const lines = reportOf([issueOf(1)]);

    expect(lines.some((line) => line.includes("失敗— 中断— 待ち—"))).toBe(true);
  });
});
