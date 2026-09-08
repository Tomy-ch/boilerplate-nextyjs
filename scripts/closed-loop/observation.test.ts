import { describe, expect, it } from "vitest";

import { parseObservation, renderObservation, toObservation } from "./observation";
import type { WindowMarks } from "./phases";
import type { TranscriptCounts } from "./transcript";

const WINDOW: WindowMarks = {
  id: "w1-x",
  marks: { openedAt: [100], commitAt: [160], closedAt: [400] },
};

const COUNTS: TranscriptCounts = {
  commands: { commit: 1 },
  tools: { Read: 3, Bash: 2 },
  toolErrors: 1,
  interruptions: 2,
  turns: 8,
  firstAt: 100,
  lastAt: 400,
};

describe("toObservation", () => {
  // ----- 正常系 -----
  it("打刻と記録の数を 1 つにまとめる", () => {
    expect(toObservation(WINDOW, COUNTS)).toEqual({
      windowId: "w1-x",
      openedAt: 100,
      closedAt: 400,
      phases: [
        { from: "openedAt", to: "commitAt", sec: 60 },
        { from: "commitAt", to: "closedAt", sec: 240 },
      ],
      prompts: 8,
      toolCalls: 5,
      toolFailures: 1,
      interrupts: 2,
    });
  });

  // ----- 異常系 -----
  it("記録が無ければ、数えた項目を置かない", () => {
    const observation = toObservation(WINDOW, undefined);

    expect(observation.toolCalls).toBeUndefined();
    expect(observation.interrupts).toBeUndefined();
    expect(observation.phases).toHaveLength(2);
  });

  it("打刻が無ければ、両端を null にする", () => {
    expect(toObservation({ id: "w1-x", marks: {} }, undefined)).toEqual({
      windowId: "w1-x",
      openedAt: null,
      closedAt: null,
      phases: [],
    });
  });
});

describe("renderObservation", () => {
  // ----- 正常系 -----
  it("読み戻せる区画にする", () => {
    const text = renderObservation(toObservation(WINDOW, COUNTS));

    expect(text.startsWith("```yaml closed-loop")).toBe(true);
    expect(text).toContain("windowId: w1-x");
    expect(text).toContain("toolCalls: 5");
    expect(text).toContain("  - from: openedAt");
  });

  // ----- 異常系 -----
  it("観測できなかった項目の行を書かない", () => {
    const text = renderObservation(toObservation(WINDOW, undefined));

    expect(text).not.toContain("toolCalls");
    expect(text).not.toContain("interrupts");
  });

  // ----- 異常系 -----
  it("観測できなかった端は行ごと落とす", () => {
    const block = renderObservation({
      windowId: "w1-x",
      openedAt: null,
      closedAt: null,
      phases: [],
    });

    expect(block).not.toContain("openedAt:");
    expect(block).not.toContain("closedAt:");
  });
});

describe("parseObservation", () => {
  // ----- 正常系 -----
  it("書き出した区画を、そのまま読み戻す", () => {
    const observation = toObservation(WINDOW, COUNTS);
    const body = `前置き\n\n${renderObservation(observation)}\n\n## 摩擦\n本文`;

    expect(parseObservation(body)).toEqual(observation);
  });

  it("観測できなかった項目を 0 にしない", () => {
    const observation = toObservation(WINDOW, undefined);

    expect(parseObservation(renderObservation(observation))).toEqual(observation);
  });

  // ----- 異常系 -----
  it("区画が無い本文を読まない", () => {
    expect(parseObservation("## 摩擦\n本文")).toBeUndefined();
  });

  it("窓 ID が無い区画を読まない", () => {
    expect(parseObservation("```yaml closed-loop\ntoolCalls: 3\n```")).toBeUndefined();
  });

  it("閉じ忘れた区画も、読める行まで読む", () => {
    expect(parseObservation("```yaml closed-loop\nwindowId: w1-x")?.windowId).toBe("w1-x");
  });

  it("数として読めない値を落とす", () => {
    const observation = parseObservation(
      "```yaml closed-loop\nwindowId: w1-x\ntoolCalls: 多い\n```",
    );

    expect(observation?.toolCalls).toBeUndefined();
  });

  it("鍵の形をしていない行は読み飛ばす", () => {
    const block = ["```yaml closed-loop", "windowId: w1-x", "  ぶら下がりの行", "```"].join("\n");

    expect(parseObservation(block)?.windowId).toBe("w1-x");
  });
});
