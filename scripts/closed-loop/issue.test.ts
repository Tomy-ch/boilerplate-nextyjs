import { describe, expect, it } from "vitest";

import { issueTitle, renderIssueBody } from "./issue";
import { toObservation } from "./observation";
import type { WindowMarks } from "./phases";
import type { Summary } from "./summarize";
import type { TranscriptCounts } from "./transcript";

function windowOf(marks: Record<string, readonly number[]>): WindowMarks {
  return { id: "w1788885163-abc", marks };
}

/** 読解の無い窓の本文。 */
function bodyOf(window: WindowMarks): string {
  return renderIssueBody(window, toObservation(window, undefined), undefined, "材料が無かった");
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
  const full = windowOf({
    openedAt: [0],
    implStartedAt: [60],
    commitAt: [120, 180],
    closedAt: [240],
  });

  // ----- 正常系 -----
  it("機械が読み戻す区画を先頭に置く", () => {
    const body = bodyOf(full);

    expect(body).toContain("```yaml closed-loop");
    expect(body).toContain("windowId: w1788885163-abc");
  });

  it("区間と回数を並べる", () => {
    const body = bodyOf(full);

    expect(body).toContain("| openedAt → implStartedAt | 60 秒 |");
    expect(body).toContain("- commitAt: 2 回");
    expect(body).toContain("- reviewStartedAt: 0 回");
  });

  it("打刻の所見を並べる", () => {
    // 必須の段（commitAt / reviewStartedAt）を飛ばして PR まで進んだ窓。
    const body = bodyOf(windowOf({ openedAt: [0], prOpenedAt: [120], closedAt: [240] }));

    expect(body).toContain("**段が飛んでいる**");
  });

  it("読解が在れば、その節を並べる", () => {
    const summary: Summary = {
      sections: { 摩擦: "ゲートを 2 回回した", 改善案: "commit スキルへ寄せる" },
      kinds: ["skill"],
      dropped: [],
    };
    const body = renderIssueBody(full, toObservation(full, undefined), summary, "読解済み");

    expect(body).toContain("## 摩擦\n\nゲートを 2 回回した");
    expect(body).toContain("## 改善案\n\ncommit スキルへ寄せる");
    // 埋まらなかった節は、空欄ではなく「該当なし」で出す。
    expect(body).toContain("## 根拠\n\n該当なし");
  });

  it("記録から数えた値が在れば、回数に添える", () => {
    const observation = toObservation(full, {
      commands: {},
      tools: { Read: 3 },
      toolErrors: 1,
      interruptions: 2,
      turns: 8,
      firstAt: 0,
      lastAt: 240,
    });
    const body = renderIssueBody(full, observation, undefined, "モデルを呼べなかった");

    expect(body).toContain("- 道具の呼び出し: 3 回（うち失敗 1）");
    expect(body).toContain("- 中断: 2 回");
  });

  // ----- 異常系 -----
  it("読めなかったことを「所見なし」へ倒さない", () => {
    expect(bodyOf(full)).toContain("読解なし — 材料が無かった");
    expect(
      renderIssueBody(full, toObservation(full, undefined), undefined, "モデルを呼べなかった"),
    ).toContain("読解なし — モデルを呼べなかった");
    expect(
      renderIssueBody(full, toObservation(full, undefined), undefined, "読解を省いた"),
    ).toContain("読解なし — 読解を省いて送出した");
  });

  it("落とした節を、書かれなかった節と混ぜない", () => {
    const summary: Summary = { sections: { 摩擦: "x" }, kinds: [], dropped: ["根拠"] };
    const body = renderIssueBody(full, toObservation(full, undefined), summary, "読解済み");

    expect(body).toContain("## 根拠\n\n**この節は出口の関門で落とした**");
    expect(body).toContain("## 結果\n\n該当なし");
  });

  it("区間を作れない窓はそう書く", () => {
    expect(bodyOf(windowOf({ openedAt: [0] }))).toContain("区間なし（打刻が 1 つ以下）");
  });

  // ----- 異常系 -----
  it("記録が読めなかった窓は、道具の回数の節ごと出さない", () => {
    const body = bodyOf(full);

    expect(body).not.toContain("道具の呼び出し");
    expect(body).not.toContain("- 中断:");
  });

  it("記録が読めた窓は、道具の回数も並べる", () => {
    const counts: TranscriptCounts = {
      commands: {},
      tools: {},
      toolErrors: 1,
      interruptions: 2,
      turns: 4,
      firstAt: 0,
      lastAt: 240,
    };
    const body = renderIssueBody(full, toObservation(full, counts), undefined, "材料が無かった");

    expect(body).toContain("- 道具の呼び出し: 0 回（うち失敗 1）");
    expect(body).toContain("- 中断: 2 回");
  });

  it("失敗と中断が観測できていなければ 0 として並べる", () => {
    const observation = {
      windowId: "w1-x",
      openedAt: 0,
      closedAt: 240,
      phases: [],
      toolCalls: 5,
    } as const;
    const body = renderIssueBody(full, observation, undefined, "材料が無かった");

    expect(body).toContain("- 道具の呼び出し: 5 回（うち失敗 0）");
    expect(body).toContain("- 中断: 0 回");
  });
});
