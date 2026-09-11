import { describe, expect, it } from "vitest";

import { formatDate, formatDateTime, formatTime } from "./datetime";

/** バックエンドが返す形と同じ、タイムゾーンを含む絶対時刻。 */
const PUBLISHED_AT = new Date("2026-08-12T00:05:00.000Z");

describe("formatDateTime", () => {
  // ----- 正常系 -----
  it("既定の locale で日付と時刻を並べる", () => {
    expect(formatDateTime(PUBLISHED_AT)).toBe("2026/08/12 9:05");
  });

  it("locale を明示すればその表記にする", () => {
    expect(formatDateTime(PUBLISHED_AT, "en-US")).toBe("Aug 12, 2026, 9:05 AM");
  });

  it("UTC とは日付が変わる時刻を既定のタイムゾーンで示す", () => {
    expect(formatDateTime(new Date("2026-08-11T15:30:00.000Z"))).toBe("2026/08/12 0:30");
  });

  it("同じ locale を繰り返し渡しても同じ表記になる", () => {
    expect(formatDateTime(PUBLISHED_AT)).toBe(formatDateTime(PUBLISHED_AT));
  });
});

describe("formatDate", () => {
  // ----- 正常系 -----
  it("既定の locale で日付だけを出す", () => {
    expect(formatDate(PUBLISHED_AT)).toBe("2026/08/12");
  });

  it("既定のタイムゾーンで丸めるので、同じ日かどうかの判定に使える", () => {
    // UTC では 8/11 だが、表示するタイムゾーンでは 8/12 に当たる時刻。
    expect(formatDate(new Date("2026-08-11T15:30:00.000Z"))).toBe(formatDate(PUBLISHED_AT));
  });

  it("locale を明示すればその表記にする", () => {
    expect(formatDate(PUBLISHED_AT, "en-US")).toBe("Aug 12, 2026");
  });
});

describe("formatTime", () => {
  // ----- 正常系 -----
  it("既定の locale で時刻だけを出す", () => {
    expect(formatTime(PUBLISHED_AT)).toBe("9:05");
  });

  it("既定のタイムゾーンで示す", () => {
    expect(formatTime(new Date("2026-08-11T15:30:00.000Z"))).toBe("0:30");
  });

  it("locale を明示すればその表記にする", () => {
    expect(formatTime(PUBLISHED_AT, "en-US")).toBe("9:05 AM");
  });
});
