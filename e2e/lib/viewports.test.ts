import { describe, expect, it } from "vitest";

import {
  loadBands,
  loadBreakpoints,
  parseBreakpoints,
  responsiveBands,
  toPixels,
} from "./viewports";

/** design token と同じ形の宣言を組み立てる。 */
function tokens(breakpoint: Record<string, string>): string {
  return JSON.stringify({
    breakpoint: Object.fromEntries(
      Object.entries(breakpoint).map(([name, value]) => [
        name,
        { $type: "dimension", $value: value },
      ]),
    ),
  });
}

describe("toPixels", () => {
  // ----- 正常系 -----
  it("rem を根の font-size で px へ直す", () => {
    expect(toPixels("48rem")).toBe(768);
  });

  it("px はそのまま読む", () => {
    expect(toPixels("768px")).toBe(768);
  });

  it("小数を持つ値も読む", () => {
    expect(toPixels("47.5rem")).toBe(760);
  });

  // ----- 異常系 -----
  it("viewport の幅として比べられない単位を落とす", () => {
    expect(() => toPixels("50%")).toThrow();
  });

  it("単位の無い値を落とす", () => {
    expect(() => toPixels("768")).toThrow();
  });
});

describe("parseBreakpoints", () => {
  // ----- 正常系 -----
  it("宣言された段をすべて px で返す", () => {
    expect([...parseBreakpoints(tokens({ md: "48rem", lg: "64rem" }))]).toEqual([
      ["md", 768],
      ["lg", 1024],
    ]);
  });

  it("値を持たない宣言を読み飛ばす", () => {
    const json = JSON.stringify({
      breakpoint: { md: { $type: "dimension" }, lg: { $value: "64rem" } },
    });

    expect([...parseBreakpoints(json)]).toEqual([["lg", 1024]]);
  });

  it("値が文字列でない宣言を読み飛ばす", () => {
    const json = JSON.stringify({ breakpoint: { md: { $value: 48 }, lg: { $value: "64rem" } } });

    expect([...parseBreakpoints(json)]).toEqual([["lg", 1024]]);
  });

  // ----- 異常系 -----
  it("breakpoint を持たない宣言を落とす", () => {
    expect(() => parseBreakpoints(JSON.stringify({ color: {} }))).toThrow(
      /breakpoint がありません/,
    );
  });

  it("段が 1 つも読めない宣言を落とす", () => {
    expect(() => parseBreakpoints(JSON.stringify({ breakpoint: {} }))).toThrow(
      /breakpoint に値がありません/,
    );
  });
});

describe("responsiveBands", () => {
  const breakpoints = new Map([
    ["md", 768],
    ["lg", 1024],
  ]);

  // ----- 正常系 -----
  it("固定された 3 段を返す", () => {
    expect(responsiveBands(breakpoints).map(({ name }) => name)).toEqual([
      "mobile",
      "tablet",
      "desktop",
    ]);
  });

  it("モバイルを md の 1 つ手前の幅で撮る", () => {
    expect(responsiveBands(breakpoints)[0]?.width).toBe(767);
  });

  it("タブレットと PC を段の下端の幅で撮る", () => {
    expect(responsiveBands(breakpoints).map(({ width }) => width)).toEqual([767, 768, 1024]);
  });

  // ----- 異常系 -----
  it("境界にする段が欠けていれば落とす", () => {
    expect(() => responsiveBands(new Map([["md", 768]]))).toThrow();
  });
});

describe("loadBreakpoints", () => {
  // ----- 正常系 -----
  it("design token の宣言から段を読む", () => {
    expect(loadBreakpoints().get("lg")).toBe(1024);
  });
});

describe("loadBands", () => {
  // ----- 正常系 -----
  it("design token が持つ値そのもので帯を組み立てる", () => {
    // 実装の呼び出しを写すのではなく、token を変えたときに動く具体値で固定する。
    expect(loadBands()).toEqual([
      { name: "mobile", width: 767 },
      { name: "tablet", width: 768 },
      { name: "desktop", width: 1024 },
    ]);
  });
});
