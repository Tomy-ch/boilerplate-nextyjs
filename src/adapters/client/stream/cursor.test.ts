import { describe, expect, it } from "vitest";

import { isAfterCursor, STREAM_ORIGIN, streamCursorSchema, toStreamCursor } from "./cursor";

describe("toStreamCursor", () => {
  // ----- 正常系 -----
  it("履歴が返した位置を、そのまま 10 進の文字列にする", () => {
    expect(toStreamCursor(12)).toBe("12");
  });

  it("先頭を 0 として受け取る", () => {
    expect(toStreamCursor(0)).toBe(STREAM_ORIGIN);
  });

  // ----- 異常系 -----
  it("契約の形を外れた値を落とす", () => {
    expect(() => toStreamCursor(-1)).toThrow();
  });
});

describe("streamCursorSchema", () => {
  // ----- 正常系 -----
  it("契約が許す最大の桁数まで受け取る", () => {
    expect(streamCursorSchema.safeParse("9".repeat(19)).success).toBe(true);
  });

  // ----- 異常系 -----
  it("桁数が契約を超えた位置を落とす", () => {
    expect(streamCursorSchema.safeParse("9".repeat(20)).success).toBe(false);
  });

  it("先頭に 0 を並べた位置を落とす", () => {
    // 同じ位置が 2 通りの綴りを持つと、突き合わせが綴りに依存する。
    expect(streamCursorSchema.safeParse("007").success).toBe(false);
  });
});

describe("isAfterCursor", () => {
  // ----- 正常系 -----
  it("後ろの位置を後ろと判定する", () => {
    expect(isAfterCursor(toStreamCursor(3), toStreamCursor(2))).toBe(true);
  });

  it("同じ位置は後ろではない", () => {
    expect(isAfterCursor(toStreamCursor(2), toStreamCursor(2))).toBe(false);
  });

  it("前の位置を後ろと判定しない", () => {
    expect(isAfterCursor(toStreamCursor(1), toStreamCursor(2))).toBe(false);
  });

  it("桁数が違う位置を、綴りの並びではなく数の大小で比べる", () => {
    // 辞書順なら "10" は "9" より前に来る。数として比べていなければここで落ちる。
    expect(isAfterCursor(toStreamCursor(10), toStreamCursor(9))).toBe(true);
  });

  it("整数として正確に表せない桁でも、隣り合う位置を取り違えない", () => {
    // 2^53 を超える 2 つの位置。数値へ直すと同じ値へ丸められる。
    expect(isAfterCursor("9007199254740993", "9007199254740992")).toBe(true);
  });
});
