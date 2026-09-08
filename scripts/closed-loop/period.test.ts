import { describe, expect, it } from "vitest";

import { DAY_BOUNDARY_OFFSET_SEC, resolvePeriod, withinPeriod } from "./period";

/** 2026-09-09 00:00 JST。 */
const JST_DAY_START = Date.parse("2026-09-08T15:00:00Z") / 1000;

describe("DAY_BOUNDARY_OFFSET_SEC", () => {
  // ----- 正常系 -----
  it("実行環境の TZ に依らない固定値である", () => {
    expect(DAY_BOUNDARY_OFFSET_SEC).toBe(9 * 3600);
  });
});

describe("resolvePeriod", () => {
  // ----- 正常系 -----
  it("指定した日の 1 日ぶんを、両端を含めて返す", () => {
    const period = resolvePeriod("2026-09-09", "2026-09-09", 0);

    expect(period.from).toBe(JST_DAY_START);
    expect(period.to).toBe(JST_DAY_START + 86_400 - 1);
  });

  it("省略時は、基準時刻の日から 7 日前までを取る", () => {
    const period = resolvePeriod(undefined, undefined, JST_DAY_START + 3600);

    expect(period.from).toBe(JST_DAY_START - 7 * 86_400);
    expect(period.to).toBe(JST_DAY_START + 86_400 - 1);
  });

  it("同じ引数なら、基準時刻が動いても同じ期間になる", () => {
    expect(resolvePeriod("2026-09-01", "2026-09-07", 0)).toEqual(
      resolvePeriod("2026-09-01", "2026-09-07", 999_999_999),
    );
  });

  // ----- 異常系 -----
  it("日付の形が違えば落とす", () => {
    expect(() => resolvePeriod("2026/09/09", undefined, 0)).toThrow("YYYY-MM-DD");
    expect(() => resolvePeriod("2026-13-45", undefined, 0)).toThrow();
  });

  it("期間が逆転していれば落とす", () => {
    expect(() => resolvePeriod("2026-09-10", "2026-09-01", 0)).toThrow("逆転");
  });
});

describe("withinPeriod", () => {
  const period = resolvePeriod("2026-09-09", "2026-09-09", 0);

  // ----- 正常系 -----
  it("両端を含める", () => {
    expect(withinPeriod(period.from, period)).toBe(true);
    expect(withinPeriod(period.to, period)).toBe(true);
  });

  // ----- 異常系 -----
  it("外側を含めない", () => {
    expect(withinPeriod(period.from - 1, period)).toBe(false);
    expect(withinPeriod(period.to + 1, period)).toBe(false);
  });
});
