import { describe, expect, it } from "vitest";

import type { Event } from "./events";
import { countEvents, neverInvoked, toProjectSlug } from "./transcript";

function at(seconds: number, event: Omit<Event, "at">): Event {
  return { at: seconds, ...event };
}

describe("countEvents", () => {
  // ----- 正常系 -----
  it("人とモデルの発話をやり取りとして数える", () => {
    const counts = countEvents([
      at(1, { kind: "prompt" }),
      at(2, { kind: "assistant" }),
      at(3, { kind: "tool_use", name: "Read" }),
    ]);

    expect(counts.turns).toBe(2);
  });

  it("道具の呼び出しを名前ごとに数える", () => {
    const counts = countEvents([
      at(1, { kind: "tool_use", name: "Read" }),
      at(2, { kind: "tool_use", name: "Read" }),
      at(3, { kind: "tool_use", name: "Bash" }),
    ]);

    expect(counts.tools).toEqual({ Read: 2, Bash: 1 });
  });

  it("同じ名前が別の種別に付いていても混ぜない", () => {
    // Skill の起動は道具の呼び出しと起動を必ず両方出す。種別で絞り損ねると、
    // 起動の回数と道具の回数が互いに混ざって二重に数えられる。
    const counts = countEvents([
      at(1, { kind: "tool_use", name: "Skill" }),
      at(1, { kind: "command", name: "commit" }),
      at(2, { kind: "tool_use", name: "commit" }),
    ]);

    expect(counts.tools).toEqual({ Skill: 1, commit: 1 });
    expect(counts.commands).toEqual({ commit: 1 });
  });

  it("起動を名前ごとに数える", () => {
    const counts = countEvents([
      at(1, { kind: "command", name: "commit" }),
      at(2, { kind: "command", name: "commit" }),
    ]);

    expect(counts.commands).toEqual({ commit: 2 });
  });

  it("道具の失敗と中断を数える", () => {
    const counts = countEvents([
      at(1, { kind: "tool_result", ok: false }),
      at(2, { kind: "tool_result", ok: true }),
      at(3, { kind: "interrupt", text: "中断" }),
    ]);

    expect(counts.toolErrors).toBe(1);
    expect(counts.interruptions).toBe(1);
  });

  it("最初と最後の時刻を、並び順ではなく値で決める", () => {
    const counts = countEvents([
      at(300, { kind: "prompt" }),
      at(100, { kind: "prompt" }),
      at(200, { kind: "prompt" }),
    ]);

    expect(counts.firstAt).toBe(100);
    expect(counts.lastAt).toBe(300);
  });

  // ----- 異常系 -----
  it("出来事が無ければ、時刻を null にする", () => {
    const counts = countEvents([]);

    expect(counts.firstAt).toBeNull();
    expect(counts.lastAt).toBeNull();
    expect(counts.turns).toBe(0);
  });

  it("時刻を持たない出来事を、最初と最後に数えない", () => {
    expect(countEvents([at(0, { kind: "prompt" })]).firstAt).toBeNull();
  });

  it("名前を持たない道具と起動を数えない", () => {
    const counts = countEvents([at(1, { kind: "tool_use" }), at(2, { kind: "command" })]);

    expect(counts.tools).toEqual({});
    expect(counts.commands).toEqual({});
  });
});

describe("neverInvoked", () => {
  // ----- 正常系 -----
  it("記録に現れなかった宣言だけを返す", () => {
    const counts = countEvents([at(1, { kind: "command", name: "commit" })]);

    expect(neverInvoked(["commit", "submit-pr"], counts)).toEqual(["submit-pr"]);
  });

  // ----- 異常系 -----
  it("宣言が無ければ空を返す", () => {
    expect(neverInvoked([], countEvents([]))).toEqual([]);
  });
});

describe("toProjectSlug", () => {
  // ----- 正常系 -----
  it("区切りを置き換える", () => {
    expect(toProjectSlug("/Users/x/dev/repo")).toBe("-Users-x-dev-repo");
  });

  it("隠しディレクトリの下の作業ツリーも取り落とさない", () => {
    expect(toProjectSlug("/Users/x/repo/.claude/worktrees/issue-1")).toBe(
      "-Users-x-repo--claude-worktrees-issue-1",
    );
  });

  // ----- 異常系 -----
  it("名前に使えない文字をすべて置き換える", () => {
    expect(toProjectSlug("/a b/c_d/e.f")).toBe("-a-b-c-d-e-f");
  });
});
