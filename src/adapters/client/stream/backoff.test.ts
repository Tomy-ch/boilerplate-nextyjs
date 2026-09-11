import { describe, expect, it } from "vitest";

import { nextDelayMs } from "./backoff";

describe("nextDelayMs", () => {
  it("続けて失敗した回数だけ待ち時間を伸ばす", () => {
    const first = nextDelayMs(0, () => 0);
    const second = nextDelayMs(1, () => 0);

    expect(second).toBeGreaterThan(first);
  });

  it("伸び続けず、上限で頭打ちになる", () => {
    expect(nextDelayMs(20, () => 1)).toBe(30_000);
  });

  it("同じ回数でも乱数の分だけ散らす", () => {
    expect(nextDelayMs(0, () => 0)).not.toBe(nextDelayMs(0, () => 1));
  });

  it("散らしても、待ち時間の下限を割らない", () => {
    expect(nextDelayMs(0, () => 0)).toBe(500);
  });

  it("サーバが示した目安を使う", () => {
    expect(nextDelayMs(5, () => 1, 2_000)).toBe(2_000);
  });

  it("サーバが示した目安にも散らしを掛ける", () => {
    expect(nextDelayMs(5, () => 0, 2_000)).toBe(1_000);
  });
});
