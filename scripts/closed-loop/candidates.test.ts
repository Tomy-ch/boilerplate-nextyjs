import { describe, expect, it } from "vitest";

import { excerpt, isCorrective, isInjected, looksSecret, selectCandidates } from "./candidates";
import type { Event } from "./events";

function prompt(at: number, text: string): Event {
  return { at, kind: "prompt", text };
}

describe("isInjected", () => {
  // ----- 正常系 -----
  it("人が打った本文を差し込みと見なさない", () => {
    expect(isInjected("ここを直して")).toBe(false);
  });

  // ----- 異常系 -----
  it("ハーネスが差し込んだ本文を見分ける", () => {
    expect(isInjected("<system-reminder>覚えておくこと</system-reminder>")).toBe(true);
    expect(isInjected("This session is being continued from a previous conversation")).toBe(true);
  });
});

describe("looksSecret", () => {
  // ----- 正常系 -----
  it("ふつうの本文を秘密と見なさない", () => {
    expect(looksSecret("token の扱いを直したい")).toBe(false);
    expect(looksSecret("cwd を確認する")).toBe(false);
  });

  // ----- 異常系 -----
  it("鍵らしき形を秘密と見なす", () => {
    expect(looksSecret("ghp_0123456789abcdefghij")).toBe(true);
    expect(looksSecret("SONAR_TOKEN=abcdefghijklmnop")).toBe(true);
    expect(looksSecret("https://user:pw12345@example.com")).toBe(true);
    expect(looksSecret("-----BEGIN RSA PRIVATE KEY-----")).toBe(true);
  });
});

describe("isCorrective", () => {
  // ----- 正常系 -----
  it("是正の語を含む発話を拾う", () => {
    expect(isCorrective("そうじゃなくて、こっち")).toBe(true);
  });

  // ----- 異常系 -----
  it("差し込まれた本文は、是正の語を含んでも拾わない", () => {
    expect(isCorrective("<system-reminder>間違いに注意</system-reminder>")).toBe(false);
  });

  it("是正の語が無ければ拾わない", () => {
    expect(isCorrective("ありがとう")).toBe(false);
  });
});

describe("excerpt", () => {
  // ----- 正常系 -----
  it("空白を潰して 1 行にする", () => {
    expect(excerpt("  a\n\n b  ", 100)).toBe("a b");
  });

  // ----- 異常系 -----
  it("長い本文を切り詰め、切ったことを示す", () => {
    expect(excerpt("abcdef", 3)).toBe("abc…");
  });
});

describe("selectCandidates", () => {
  // ----- 正常系 -----
  it("是正を最上位に置く", () => {
    const events: Event[] = [
      prompt(10, "ふつうの依頼"),
      prompt(20, "そうじゃなくて"),
      { at: 30, kind: "tool_result", ok: false },
      prompt(40, "ではもう一度"),
    ];
    const found = selectCandidates(events);

    expect(found[0]).toMatchObject({ at: 20, reason: "是正" });
  });

  it("中断の直前の発話を拾う", () => {
    const found = selectCandidates([prompt(10, "走らせて"), { at: 20, kind: "interrupt" }]);

    expect(found).toEqual([{ at: 10, reason: "中断の直前", text: "走らせて" }]);
  });

  it("失敗の直後の発話を拾う", () => {
    const found = selectCandidates([
      { at: 10, kind: "tool_result", ok: false },
      prompt(20, "なるほど"),
    ]);

    expect(found).toEqual([{ at: 20, reason: "失敗の直後", text: "なるほど" }]);
  });

  it("同じ発話を 2 つの理由で重ねない", () => {
    const found = selectCandidates([prompt(10, "違うよ"), { at: 20, kind: "interrupt" }]);

    expect(found).toEqual([{ at: 10, reason: "是正", text: "違うよ" }]);
  });

  // ----- 異常系 -----
  it("秘密らしき発話を候補にしない", () => {
    expect(selectCandidates([prompt(10, "違う。ghp_0123456789abcdefghij を使え")])).toEqual([]);
  });

  it("差し込まれた本文を候補にしない", () => {
    expect(selectCandidates([prompt(10, "<task-notification>違う</task-notification>")])).toEqual(
      [],
    );
  });

  it("上限を超えたぶんを落とす", () => {
    const events = [prompt(10, "違う 1"), prompt(20, "違う 2"), prompt(30, "違う 3")];

    expect(selectCandidates(events, 2)).toHaveLength(2);
    expect(selectCandidates(events, 0)).toEqual([]);
  });

  it("該当が無ければ空にする", () => {
    expect(selectCandidates([prompt(10, "ありがとう")])).toEqual([]);
  });

  it("直前に発話が無い中断は候補を生まない", () => {
    expect(selectCandidates([{ at: 10, kind: "interrupt" }, prompt(20, "その後の話")])).toEqual([]);
  });

  it("直後に発話が無い失敗は候補を生まない", () => {
    expect(
      selectCandidates([prompt(10, "先の話"), { at: 20, kind: "tool_result", ok: false }]),
    ).toEqual([]);
  });
});
