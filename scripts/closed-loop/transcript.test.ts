import { describe, expect, it } from "vitest";

import { countTranscript, countUnparsable, neverInvoked, toProjectSlug } from "./transcript";

/** 記録の 1 行を組み立てる。 */
function line(entry: unknown): string {
  return JSON.stringify(entry);
}

/** 道具の呼び出しを 1 つ持つ行。 */
function toolUse(name: string, input?: unknown): string {
  return line({ type: "assistant", message: { content: [{ type: "tool_use", name, input }] } });
}

describe("countTranscript", () => {
  // ----- 正常系 -----
  it("人とモデルの発話をやり取りとして数える", () => {
    const counts = countTranscript([
      line({ type: "user" }),
      line({ type: "assistant" }),
      line({ type: "summary" }),
    ]);

    expect(counts.turns).toBe(2);
  });

  it("道具の呼び出しを名前ごとに数える", () => {
    const counts = countTranscript([toolUse("Read"), toolUse("Read"), toolUse("Bash")]);

    expect(counts.tools).toEqual({ Read: 2, Bash: 1 });
  });

  it("Skill 道具の起動を、スキル名で数える", () => {
    expect(countTranscript([toolUse("Skill", { skill: "commit" })]).commands).toEqual({
      commit: 1,
    });
  });

  it("`/name` を打った記録も同じスキルの起動として数える", () => {
    const counts = countTranscript([
      line({ type: "user", message: { content: "<command-name>/commit</command-name>" } }),
      toolUse("Skill", { skill: "commit" }),
    ]);

    expect(counts.commands).toEqual({ commit: 2 });
  });

  it("道具が返した失敗と、人の中断を数える", () => {
    const counts = countTranscript([
      line({ type: "user", message: { content: [{ type: "tool_result", is_error: true }] } }),
      line({
        type: "user",
        message: { content: [{ type: "text", text: "[Request interrupted by user]" }] },
      }),
    ]);

    expect(counts.toolErrors).toBe(1);
    expect(counts.interruptions).toBe(1);
  });

  it("最初と最後の時刻を、並び順ではなく値で決める", () => {
    const counts = countTranscript([
      line({ type: "user", timestamp: "2026-09-09T10:00:00Z" }),
      line({ type: "user", timestamp: "2026-09-09T09:00:00Z" }),
      line({ type: "user", timestamp: "2026-09-09T11:00:00Z" }),
    ]);

    expect(counts.firstAt).toBe("2026-09-09T09:00:00Z");
    expect(counts.lastAt).toBe("2026-09-09T11:00:00Z");
  });

  // ----- 異常系 -----
  it("空行を飛ばす", () => {
    expect(countTranscript(["", "   "]).turns).toBe(0);
  });

  it("壊れた行で落ちない", () => {
    expect(countTranscript(["{", line({ type: "user" })]).turns).toBe(1);
  });

  it("解釈できない形の行を飛ばす", () => {
    const counts = countTranscript([
      line(null),
      line("文字列"),
      line({ type: "assistant", message: null }),
      line({ type: "assistant", message: { content: 42 } }),
      line({ type: "assistant", message: { content: [null, { type: "tool_use" }] } }),
      line({
        type: "assistant",
        message: { content: [{ type: "tool_use", name: "Skill", input: null }] },
      }),
    ]);

    expect(counts.commands).toEqual({});
    expect(counts.tools).toEqual({ Skill: 1 });
  });

  it("時刻でない timestamp を無視する", () => {
    expect(countTranscript([line({ type: "user", timestamp: 1757400000 })]).firstAt).toBeNull();
  });
});

describe("countUnparsable", () => {
  // ----- 正常系 -----
  it("解釈できた行は数えない", () => {
    expect(countUnparsable([line({ type: "user" }), ""])).toBe(0);
  });

  // ----- 異常系 -----
  it("解釈できなかった行を数える", () => {
    expect(countUnparsable(["{", "not json", line({ type: "user" })])).toBe(2);
  });
});

describe("neverInvoked", () => {
  // ----- 正常系 -----
  it("記録に現れなかった宣言だけを返す", () => {
    const counts = countTranscript([toolUse("Skill", { skill: "commit" })]);

    expect(neverInvoked(["commit", "submit-pr"], counts)).toEqual(["submit-pr"]);
  });

  // ----- 異常系 -----
  it("宣言が無ければ空を返す", () => {
    expect(neverInvoked([], countTranscript([]))).toEqual([]);
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
