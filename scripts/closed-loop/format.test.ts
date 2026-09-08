import { describe, expect, it } from "vitest";

import { humanize } from "./format";

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
