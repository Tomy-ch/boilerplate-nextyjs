import { describe, expect, it } from "vitest";

import type { Observation } from "./observation";
import {
  BODY_SECTIONS,
  buildPrompt,
  containsQuote,
  dropSecretSections,
  FINDING_KINDS,
  IMPROVEMENT_SECTION,
  issueLabels,
  kindLabels,
  parseSections,
  parseSummary,
  readingGap,
} from "./summarize";

const OBSERVATION: Observation = {
  windowId: "w1-x",
  openedAt: 0,
  closedAt: 100,
  phases: [{ from: "openedAt", to: "commitAt", sec: 60 }],
  prompts: 4,
  toolCalls: 20,
  toolFailures: 2,
  interrupts: 1,
};

describe("BODY_SECTIONS", () => {
  // ----- 正常系 -----
  it("週次が拾う節を含む", () => {
    expect(BODY_SECTIONS).toContain(IMPROVEMENT_SECTION);
  });
});

describe("IMPROVEMENT_SECTION", () => {
  // ----- 正常系 -----
  it("節の一覧と綴りが一致する", () => {
    expect(BODY_SECTIONS.filter((section) => section === IMPROVEMENT_SECTION)).toHaveLength(1);
  });
});

describe("FINDING_KINDS", () => {
  // ----- 正常系 -----
  it("重複を持たない", () => {
    expect(new Set(FINDING_KINDS).size).toBe(FINDING_KINDS.length);
  });
});

describe("buildPrompt", () => {
  // ----- 正常系 -----
  it("観測と候補と出力の形を並べる", () => {
    const prompt = buildPrompt(OBSERVATION, [{ at: 10, reason: "是正", text: "違うよ" }]);

    expect(prompt).toContain("窓 ID: w1-x");
    expect(prompt).toContain("道具の失敗: 2");
    expect(prompt).toContain("段 openedAt → commitAt: 60 秒");
    expect(prompt).toContain("> 違うよ");
    expect(prompt).toContain(`## ${IMPROVEMENT_SECTION}`);
  });

  it("読み取れないことを書かせない指示を含む", () => {
    expect(buildPrompt(OBSERVATION, [])).toContain("読み取れないことは書かない");
  });

  // ----- 異常系 -----
  it("候補が無ければ、無いと書く", () => {
    expect(buildPrompt(OBSERVATION, [])).toContain("該当したターンはありません。");
  });

  it("観測できなかった項目を 0 として書かない", () => {
    const bare = buildPrompt({ windowId: "w1-x", openedAt: null, closedAt: null, phases: [] }, []);

    expect(bare).not.toContain("道具の失敗");
    expect(bare).not.toContain("中断:");
  });
});

describe("parseSections", () => {
  // ----- 正常系 -----
  it("既知の見出しの中身を取り出す", () => {
    expect(parseSections("## 摩擦\n本文\n\n## 根拠\n証拠")).toEqual({ 摩擦: "本文", 根拠: "証拠" });
  });

  // ----- 異常系 -----
  it("知らない見出しと、その中身を捨てる", () => {
    expect(parseSections("## 未知\n本文\n## 摩擦\nこちら")).toEqual({ 摩擦: "こちら" });
  });

  it("中身が空の節を落とす", () => {
    expect(parseSections("## 摩擦\n\n")).toEqual({});
  });
});

describe("parseSummary", () => {
  // ----- 正常系 -----
  it("節と分類を読み分ける", () => {
    const summary = parseSummary("## 摩擦\nゲートを 2 回回した\n\nkinds: skill, ci");

    expect(summary?.sections).toEqual({ 摩擦: "ゲートを 2 回回した" });
    expect(summary?.kinds).toEqual(["skill", "ci"]);
  });

  it("知らない分類を捨てる", () => {
    expect(parseSummary("## 摩擦\nx\n\nkinds: skill, 未知")?.kinds).toEqual(["skill"]);
  });

  it("分類の行が無くても節を読む", () => {
    expect(parseSummary("## 摩擦\nx")?.kinds).toEqual([]);
  });

  // ----- 異常系 -----
  it("既知の節が 1 つも無ければ、読解が無かったことにする", () => {
    expect(parseSummary("前置きだけ")).toBeUndefined();
    expect(parseSummary("")).toBeUndefined();
  });

  it("秘密らしき節を落とす", () => {
    const summary = parseSummary("## 根拠\nghp_0123456789abcdefghij\n\n## 摩擦\nx");

    expect(summary?.sections).toEqual({ 摩擦: "x" });
    expect(summary?.dropped).toEqual(["根拠"]);
  });

  it("接頭辞の無い分類の行も、分類として読む", () => {
    const summary = parseSummary("## 摩擦\nx\n\nskill, ci");

    expect(summary?.kinds).toEqual(["skill", "ci"]);
    expect(summary?.sections["摩擦"]).toBe("x");
  });

  it("既知の分類だけの行でなければ、本文として残す", () => {
    const summary = parseSummary("## 摩擦\nskill, これは本文");

    expect(summary?.kinds).toEqual([]);
    expect(summary?.sections["摩擦"]).toBe("skill, これは本文");
  });

  it("候補の逐語を含む節を落とす", () => {
    const quote =
      "ここは 40 文字を超える十分に長い発話の逐語であり、引用されたらすぐに分かるものである";
    const summary = parseSummary(`## 根拠\n${quote}\n\n## 摩擦\nx`, [
      { at: 1, reason: "是正", text: quote },
    ]);

    expect(summary?.dropped).toEqual(["根拠"]);
    expect(summary?.sections).toEqual({ 摩擦: "x" });
  });

  it("本文の途中の `kinds:` を分類として読まない", () => {
    const summary = parseSummary("## 根拠\nkinds: skill と書かれていた\n\n## 摩擦\nx");

    expect(summary?.kinds).toEqual([]);
    expect(summary?.sections["根拠"]).toBe("kinds: skill と書かれていた");
  });
});

describe("dropSecretSections", () => {
  // ----- 正常系 -----
  it("秘密を含まない節を残す", () => {
    expect(dropSecretSections({ 摩擦: "ふつうの本文" })).toEqual({
      sections: { 摩擦: "ふつうの本文" },
      dropped: [],
    });
  });

  // ----- 異常系 -----
  it("候補の逐語を含む節を落とす", () => {
    const quote =
      "ここは 40 文字を超える十分に長い発話の逐語であり、引用されたらすぐに分かるものである";
    const result = dropSecretSections({ 根拠: `前置き。${quote}` }, [
      { at: 1, reason: "是正", text: quote },
    ]);

    expect(result.dropped).toEqual(["根拠"]);
  });

  it("落とした節の名前を返す", () => {
    const result = dropSecretSections({ 根拠: "ghp_0123456789abcdefghij", 摩擦: "x" });

    expect(result.dropped).toEqual(["根拠"]);
    expect(result.sections).toEqual({ 摩擦: "x" });
  });
});

describe("readingGap", () => {
  // ----- 正常系 -----
  it("読解が在れば読解済みにする", () => {
    expect(readingGap({ sections: { 摩擦: "x" }, kinds: [], dropped: [] }, true)).toBe("読解済み");
  });

  // ----- 異常系 -----
  it("材料の有無で、読めなかった理由を分ける", () => {
    expect(readingGap(undefined, true)).toBe("モデルを呼べなかった");
    expect(readingGap(undefined, false)).toBe("材料が無かった");
  });

  it("人が省いたことを、呼べなかったことと混ぜない", () => {
    expect(readingGap(undefined, true, true)).toBe("読解を省いた");
  });
});

describe("kindLabels", () => {
  // ----- 正常系 -----
  it("分類にラベルの接頭辞を付ける", () => {
    expect(kindLabels(["skill", "ci"])).toEqual(["feedback/skill", "feedback/ci"]);
  });

  // ----- 異常系 -----
  it("分類が無ければ空にする", () => {
    expect(kindLabels([])).toEqual([]);
  });
});

describe("issueLabels", () => {
  // ----- 正常系 -----
  it("読解できた窓に分類のラベルを付ける", () => {
    expect(issueLabels({ sections: { 摩擦: "x" }, kinds: ["skill"], dropped: [] })).toEqual([
      "feedback",
      "feedback/skill",
    ]);
  });

  // ----- 異常系 -----
  it("読めなかった窓に分類を与えない", () => {
    expect(issueLabels(undefined)).toEqual(["feedback"]);
  });
});

describe("containsQuote", () => {
  const quote =
    "ここは 40 文字を超える十分に長い発話の逐語であり、引用されたらすぐに分かるものである";

  // ----- 正常系 -----
  it("自分の言葉で言い直した文を逐語と見なさない", () => {
    expect(
      containsQuote("人が是正を 3 回入れている", [{ at: 1, reason: "是正", text: quote }]),
    ).toBe(false);
  });

  it("候補が無ければ、何も逐語と見なさない", () => {
    expect(containsQuote(quote, [])).toBe(false);
  });

  // ----- 異常系 -----
  it("候補の逐語が現れたら見つける", () => {
    expect(containsQuote(`前置き。${quote}`, [{ at: 1, reason: "是正", text: quote }])).toBe(true);
  });

  it("空白の入れ方が違っても見つける", () => {
    const spaced = quote.replace(/。/g, "。\n");

    expect(containsQuote(spaced, [{ at: 1, reason: "是正", text: quote }])).toBe(true);
  });

  it("短すぎる本文は判定の対象にしない", () => {
    expect(containsQuote("短い", [{ at: 1, reason: "是正", text: quote }])).toBe(false);
  });

  it("十分に長い本文でも、候補と重ならなければ見つけない", () => {
    const other =
      "こちらは別の話題について同じくらいの長さで書かれた別の文章であり、重なりをまったく持たない";

    expect(containsQuote(other, [{ at: 1, reason: "是正", text: quote }])).toBe(false);
  });
});
