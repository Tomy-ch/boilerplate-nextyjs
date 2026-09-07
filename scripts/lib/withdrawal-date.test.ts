import { describe, expect, it } from "vitest";

import { calendarDay, dayAfter, daysSince, latestDateIn } from "./withdrawal-date";

describe("latestDateIn", () => {
  // ----- 正常系 -----
  it("日付が 1 つなら、それを返す", () => {
    expect(latestDateIn("2026-08-02 以降に削除する")).toBe("2026-08-02");
  });

  it("日付が複数あれば、最も遅いものを返す", () => {
    expect(latestDateIn("2026-08-29 公開。冷却が明ける 2026-09-05 以降")).toBe("2026-09-05");
  });

  it("本文の中で時系列と逆に書かれていても、値として最も遅いものを返す", () => {
    expect(latestDateIn("2026-09-05 以降に削除する（当初は 2026-08-02 の予定だった）")).toBe(
      "2026-09-05",
    );
  });

  // ----- 異常系 -----
  it("日付を含まなければ undefined を返す", () => {
    expect(latestDateIn("上流が 5.0.9 以上を要求したら撤去する")).toBeUndefined();
  });
});

describe("calendarDay", () => {
  // ----- 正常系 -----
  it("日本時間の暦日で返す", () => {
    // UTC ではまだ 5 日だが、日本時間では 6 日に入っている。
    expect(calendarDay(new Date("2026-09-05T20:00:00Z"))).toBe("2026-09-06");
  });
});

describe("dayAfter", () => {
  // ----- 正常系 -----
  it("公開から数えた日数の暦日を返す", () => {
    expect(dayAfter(new Date("2026-03-30T17:49:21Z"), 14)).toBe("2026-04-14");
  });

  it("日本時間で日付をまたぐ時刻でも、暦日は日本時間で数える", () => {
    expect(dayAfter(new Date("2026-03-30T20:00:00Z"), 1)).toBe("2026-04-01");
  });
});

describe("daysSince", () => {
  // ----- 正常系 -----
  it("経過した日数を返す", () => {
    expect(daysSince(new Date("2026-03-30T00:00:00Z"), new Date("2026-04-13T00:00:00Z"))).toBe(14);
  });

  // ----- 異常系 -----
  it("1 日に満たない端数は切り捨て、まだ次の日を満たしたとは数えない", () => {
    expect(daysSince(new Date("2026-03-30T00:00:00Z"), new Date("2026-04-12T23:00:00Z"))).toBe(13);
  });
});
