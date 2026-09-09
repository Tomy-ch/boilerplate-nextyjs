import { describe, expect, it } from "vitest";

import {
  COUNTED_MARKS,
  countOf,
  isSubstantive,
  MARK_ORDER,
  markAt,
  NO_WINDOWS_MESSAGE,
  toAnomalies,
  toPhases,
  type WindowMarks,
} from "./phases";

/** 打刻の並びから窓を組み立てる。値は epoch(秒)。 */
function windowOf(marks: Record<string, readonly number[]>): WindowMarks {
  return { id: "w1-test", marks };
}

describe("toPhases", () => {
  // ----- 正常系 -----
  it("隣り合う打刻のあいだを区間にする", () => {
    const phases = toPhases(windowOf({ openedAt: [100], implStartedAt: [160], closedAt: [400] }));

    expect(phases).toEqual([
      { name: "openedAt → implStartedAt", from: "openedAt", to: "implStartedAt", seconds: 60 },
      { name: "implStartedAt → closedAt", from: "implStartedAt", to: "closedAt", seconds: 240 },
    ]);
  });

  it("途中の打刻が無ければ、その前後を 1 つの区間にする", () => {
    expect(toPhases(windowOf({ openedAt: [0], prOpenedAt: [90] }))).toEqual([
      { name: "openedAt → prOpenedAt", from: "openedAt", to: "prOpenedAt", seconds: 90 },
    ]);
  });

  it("繰り返し刻まれた打刻は最初の 1 つで区間を作る", () => {
    expect(toPhases(windowOf({ openedAt: [0], commitAt: [50, 70, 90] }))).toEqual([
      { name: "openedAt → commitAt", from: "openedAt", to: "commitAt", seconds: 50 },
    ]);
  });

  // ----- 異常系 -----
  it("打刻が 1 つなら区間を作らない", () => {
    expect(toPhases(windowOf({ openedAt: [0] }))).toEqual([]);
  });

  it("打刻が無ければ空にする", () => {
    expect(toPhases(windowOf({}))).toEqual([]);
  });
});

describe("toAnomalies", () => {
  // ----- 正常系 -----
  it("順序どおりに閉じた窓は所見を出さない", () => {
    expect(
      toAnomalies(windowOf({ openedAt: [0], implStartedAt: [10], commitAt: [20], closedAt: [30] })),
    ).toEqual([]);
  });

  // ----- 異常系 -----
  it("開いたままの窓を挙げる", () => {
    expect(toAnomalies(windowOf({ openedAt: [0], commitAt: [10] }))).toContainEqual({
      kind: "窓が開いたまま",
      detail: "closedAt がない。集計の対象は閉じた窓だけ",
    });
  });

  it("開始しか刻まれていない窓を挙げる", () => {
    expect(toAnomalies(windowOf({ openedAt: [0] }))).toContainEqual({
      kind: "打刻が開始だけ",
      detail: "窓は開いたが、どの段の境界も越えていない",
    });
  });

  it("開いて閉じただけの窓も、段を飛ばしたとは数えない", () => {
    const anomalies = toAnomalies(windowOf({ openedAt: [0], closedAt: [10] }));

    expect(anomalies.map((a) => a.kind)).toEqual(["打刻が開始だけ"]);
  });

  it("順序が逆の打刻を、差とともに挙げる", () => {
    expect(
      toAnomalies(windowOf({ openedAt: [100], implStartedAt: [40], closedAt: [200] })),
    ).toContainEqual({ kind: "順序が逆", detail: "implStartedAt が openedAt より早い（60 秒）" });
  });

  it("刻まれた範囲の途中で飛んだ段を挙げる", () => {
    expect(
      toAnomalies(windowOf({ openedAt: [0], prOpenedAt: [50], closedAt: [60] })),
    ).toContainEqual({
      kind: "段が飛んでいる",
      detail: "刻まれていない: planApprovedAt / implStartedAt / commitAt / reviewStartedAt",
    });
  });

  it("刻まれた範囲の外側は飛んだと数えない", () => {
    const anomalies = toAnomalies(windowOf({ openedAt: [0], implStartedAt: [10], closedAt: [20] }));

    expect(anomalies.filter((a) => a.kind === "段が飛んでいる")).toEqual([]);
  });
});

describe("countOf", () => {
  // ----- 正常系 -----
  it("刻まれた回数を返す", () => {
    expect(countOf(windowOf({ commitAt: [1, 2, 3] }), "commitAt")).toBe(3);
  });

  // ----- 異常系 -----
  it("刻まれていなければ 0 を返す", () => {
    expect(countOf(windowOf({}), "commitAt")).toBe(0);
  });
});

describe("MARK_ORDER", () => {
  // ----- 正常系 -----
  it("窓の開閉で挟まれている", () => {
    expect(MARK_ORDER[0]).toBe("openedAt");
    expect(MARK_ORDER.at(-1)).toBe("closedAt");
  });
});

describe("NO_WINDOWS_MESSAGE", () => {
  // ----- 正常系 -----
  it("0 件が「異常なし」ではないことを述べる", () => {
    expect(NO_WINDOWS_MESSAGE).toContain("1 件もありません");
  });
});

describe("markAt", () => {
  // ----- 正常系 -----
  it("繰り返し刻まれた打刻は最初の 1 つを返す", () => {
    expect(markAt(windowOf({ commitAt: [10, 20, 30] }), "commitAt")).toBe(10);
  });

  // ----- 異常系 -----
  it("刻まれていなければ null を返す", () => {
    expect(markAt(windowOf({}), "commitAt")).toBeNull();
  });
});

describe("COUNTED_MARKS", () => {
  // ----- 正常系 -----
  it("窓の開閉を数えない", () => {
    expect(COUNTED_MARKS).not.toContain("openedAt");
    expect(COUNTED_MARKS).not.toContain("closedAt");
  });
});

describe("isSubstantive", () => {
  // ----- 正常系 -----
  it("段の境界を越えた窓を通す", () => {
    expect(isSubstantive(windowOf({ openedAt: [0], commitAt: [10] }))).toBe(true);
  });

  // ----- 異常系 -----
  it("開いて閉じただけの窓を通さない", () => {
    expect(isSubstantive(windowOf({ openedAt: [0], closedAt: [10] }))).toBe(false);
  });

  it("打刻が無い窓を通さない", () => {
    expect(isSubstantive(windowOf({}))).toBe(false);
  });
});
