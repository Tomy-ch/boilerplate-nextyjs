import { describe, expect, it } from "vitest";

import { humanize, issueRefs, percent } from "./format";

describe("humanize", () => {
  // ----- 正常系 -----
  it("短い区間は秒で出す", () => {
    expect(humanize(89)).toBe("89 秒");
  });

  it("分に届いたら分で出す", () => {
    expect(humanize(600)).toBe("10 分");
  });

  it("時間に届いたら時間で出す", () => {
    expect(humanize(7200)).toBe("2.0 時間");
  });

  // ----- 異常系 -----
  it("負の区間を丸めずに出す", () => {
    expect(humanize(-60)).toBe("-60 秒");
  });
});

describe("issueRefs", () => {
  // ----- 正常系 -----
  it("番号へ # を付けて空白で繋ぐ", () => {
    expect(issueRefs([12, 34])).toBe("#12 #34");
  });

  // ----- 異常系 -----
  it("空の並びは空文字にする", () => {
    expect(issueRefs([])).toBe("");
  });
});

describe("percent", () => {
  // ----- 正常系 -----
  it("割合を小数 1 桁の百分率にする", () => {
    expect(percent(0.125)).toBe("12.5%");
  });

  it("0 は 0.0% として出し、未計測と見分けが付く形にする", () => {
    expect(percent(0)).toBe("0.0%");
  });

  // ----- 異常系 -----
  it("測っていないものは 0% へ倒さない", () => {
    expect(percent(undefined)).toBe("—");
  });
});
