import { describe, expect, it } from "vitest";

import { findPremises, survivingText } from "./scan";

describe("survivingText", () => {
  // ----- 正常系 -----
  it("サンプルの区画を落とす", () => {
    const text = [
      "残る行",
      "<!-- sample:begin -->",
      "同梱のサンプルが加えるもの",
      "<!-- sample:end -->",
    ].join("\n");

    expect(survivingText(text)).not.toContain("同梱のサンプル");
    expect(survivingText(text)).toContain("残る行");
  });

  it("boilerplate 限定の区画も落とす", () => {
    const text = [
      "残る行",
      "<!-- boilerplate-only:begin -->",
      "順次同梱する",
      "<!-- boilerplate-only:end -->",
    ].join("\n");

    expect(survivingText(text)).not.toContain("順次同梱");
  });

  it("差し替えマーカーの退避側を、剥がした後の本文として読む", () => {
    const text = [
      "<!-- sample:replace-begin -->",
      "同梱のサンプルの説明",
      "<!-- sample:replace-with -->",
      "<!-- = 抽象的な説明 -->",
      "<!-- sample:replace-end -->",
    ].join("\n");

    expect(survivingText(text)).toContain("抽象的な説明");
    expect(survivingText(text)).not.toContain("同梱のサンプル");
  });

  // ----- 異常系 -----
  it("対応の取れないマーカーは、囲われていない扱いで読む", () => {
    const text = ["<!-- sample:begin -->", "同梱のサンプル"].join("\n");

    expect(survivingText(text)).toContain("同梱のサンプル");
  });
});

describe("findPremises", () => {
  // ----- 正常系 -----
  it("前提の綴りを、形と理由つきで挙げる", () => {
    const found = findPremises("後続のリリースで順次同梱する", "docs/adr/x.md");

    expect(found.map((premise) => premise.phrase)).toEqual(["順次同梱", "後続のリリース"]);
    expect(found[0]?.shape).toBe("整備が途中であること");
    expect(found[0]?.file).toBe("docs/adr/x.md");
    expect(found[0]?.text).toBe("後続のリリースで順次同梱する");
  });

  // ----- 異常系 -----
  it("マーカーで囲われた前提を挙げない", () => {
    const text = [
      "<!-- sample:begin -->",
      "同梱のサンプルが加えるもの",
      "<!-- sample:end -->",
    ].join("\n");

    expect(findPremises(text, "src/features/README.md")).toEqual([]);
  });

  it("前提が無ければ空にする", () => {
    expect(findPremises("決定として書かれた本文", "docs/adr/x.md")).toEqual([]);
  });
});
