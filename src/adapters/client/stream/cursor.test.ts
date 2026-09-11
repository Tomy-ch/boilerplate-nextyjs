import { describe, expect, it } from "vitest";

import { isAfterCursor, STREAM_ORIGIN, toStreamCursor } from "./cursor";

describe("toStreamCursor", () => {
  it("履歴が返した位置を、そのまま 10 進の文字列にする", () => {
    expect(toStreamCursor(12)).toBe("12");
  });

  it("先頭を 0 として受け取る", () => {
    expect(toStreamCursor(0)).toBe(STREAM_ORIGIN);
  });

  it("契約の形を外れた値を落とす", () => {
    expect(() => toStreamCursor(-1)).toThrow();
  });
});

describe("isAfterCursor", () => {
  it("後ろの位置を後ろと判定する", () => {
    expect(isAfterCursor(toStreamCursor(3), toStreamCursor(2))).toBe(true);
  });

  it("同じ位置は後ろではない", () => {
    expect(isAfterCursor(toStreamCursor(2), toStreamCursor(2))).toBe(false);
  });

  it("前の位置を後ろと判定しない", () => {
    expect(isAfterCursor(toStreamCursor(1), toStreamCursor(2))).toBe(false);
  });

  it("整数として正確に表せない桁でも、隣り合う位置を取り違えない", () => {
    // 2^53 を超える 2 つの位置。数値へ直すと同じ値へ丸められる。
    expect(isAfterCursor("9007199254740993", "9007199254740992")).toBe(true);
  });
});
