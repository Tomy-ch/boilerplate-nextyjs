import { describe, expect, it } from "vitest";

import { fieldOf, itemsOf, numberOf, textOf } from "./payload";

describe("fieldOf", () => {
  // ----- 正常系 -----
  it("名前の付いた 1 段を取り出す", () => {
    expect(fieldOf({ task: { status: "SUCCESS" } }, "task")).toEqual({ status: "SUCCESS" });
  });

  it("配列も record として辿れる", () => {
    expect(fieldOf(["先頭"], "0")).toBe("先頭");
  });

  // ----- 異常系 -----
  it("その名前が無ければ undefined", () => {
    expect(fieldOf({}, "task")).toBeUndefined();
  });

  it("null は record として扱わない", () => {
    expect(fieldOf(null, "task")).toBeUndefined();
  });

  it("record ではない値は辿らない", () => {
    expect(fieldOf("応答ではない", "task")).toBeUndefined();
    expect(fieldOf(undefined, "task")).toBeUndefined();
  });
});

describe("textOf", () => {
  // ----- 正常系 -----
  it("文字列はそのまま返す", () => {
    expect(textOf("SUCCESS", "UNKNOWN")).toBe("SUCCESS");
  });

  it("数値は綴りへ直して返す", () => {
    expect(textOf(80, "?")).toBe("80");
  });

  it("空文字列は値として扱い、既定値へ倒さない", () => {
    expect(textOf("", "?")).toBe("");
  });

  // ----- 異常系 -----
  it("綴りにできない形は既定値へ倒す", () => {
    expect(textOf(null, "UNKNOWN")).toBe("UNKNOWN");
    expect(textOf({ status: "SUCCESS" }, "UNKNOWN")).toBe("UNKNOWN");
  });
});

describe("numberOf", () => {
  // ----- 正常系 -----
  it("数値はそのまま返す", () => {
    expect(numberOf(42, 1)).toBe(42);
  });

  it("0 は値として扱い、既定値へ倒さない", () => {
    expect(numberOf(0, 1)).toBe(0);
  });

  // ----- 異常系 -----
  it("数値でなければ既定値へ倒す", () => {
    expect(numberOf("42", 1)).toBe(1);
    expect(numberOf(undefined, 1)).toBe(1);
  });
});

describe("itemsOf", () => {
  // ----- 正常系 -----
  it("配列はそのまま返す", () => {
    expect(itemsOf([1, 2])).toEqual([1, 2]);
  });

  // ----- 異常系 -----
  it("配列でなければ空にする", () => {
    expect(itemsOf(null)).toEqual([]);
    expect(itemsOf({ issues: 1 })).toEqual([]);
  });
});
