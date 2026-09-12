import { describe, expect, it } from "vitest";

import type { WindowMarks } from "./phases";
import { parseSent, unsent, withSent } from "./sent-index";

function windowOf(id: string, marks: Record<string, readonly number[]>): WindowMarks {
  return { id, marks };
}

/** 閉じていて、段の境界を 1 つ越えた窓。 */
function closedWindow(id: string): WindowMarks {
  return windowOf(id, { openedAt: [0], commitAt: [10], closedAt: [20] });
}

describe("parseSent", () => {
  // ----- 正常系 -----
  it("項目を読む", () => {
    const index = parseSent({ entries: [{ windowId: "w1", issue: 7, sentAt: 100 }] });

    expect(index.entries).toEqual([{ windowId: "w1", issue: 7, sentAt: 100 }]);
  });

  it("時刻が無い項目を 0 で読む", () => {
    expect(parseSent({ entries: [{ windowId: "w1", issue: 7 }] }).entries).toEqual([
      { windowId: "w1", issue: 7, sentAt: 0 },
    ]);
  });

  // ----- 異常系 -----
  it("読めない索引を空にする", () => {
    expect(parseSent(undefined).entries).toEqual([]);
    expect(parseSent("壊れている").entries).toEqual([]);
    expect(parseSent({ entries: "配列ではない" }).entries).toEqual([]);
  });

  it("形の合わない項目だけを落として残りを活かす", () => {
    const index = parseSent({
      entries: [null, { windowId: "w1" }, { issue: 3 }, { windowId: "w2", issue: 9 }],
    });

    expect(index.entries).toEqual([{ windowId: "w2", issue: 9, sentAt: 0 }]);
  });
});

describe("unsent", () => {
  // ----- 正常系 -----
  it("閉じていて未送出の窓を通す", () => {
    expect(unsent([closedWindow("w1")], parseSent(undefined)).map((w) => w.id)).toEqual(["w1"]);
  });

  it("索引に在る窓を通さない", () => {
    const index = parseSent({ entries: [{ windowId: "w1", issue: 3 }] });

    expect(unsent([closedWindow("w1"), closedWindow("w2")], index).map((w) => w.id)).toEqual([
      "w2",
    ]);
  });

  // ----- 異常系 -----
  it("開いたままの窓を通さない", () => {
    const open = windowOf("w1", { openedAt: [0], commitAt: [10] });

    expect(unsent([open], parseSent(undefined))).toEqual([]);
  });

  it("開いて閉じただけの窓を通さない", () => {
    const empty = windowOf("w1", { openedAt: [0], closedAt: [10] });

    expect(unsent([empty], parseSent(undefined))).toEqual([]);
  });
});

describe("withSent", () => {
  // ----- 正常系 -----
  it("送出済みを足す", () => {
    const index = withSent(parseSent(undefined), { windowId: "w1", issue: 3, sentAt: 1 });

    expect(index.entries).toEqual([{ windowId: "w1", issue: 3, sentAt: 1 }]);
  });

  // ----- 異常系 -----
  it("同じ窓は置き換える", () => {
    const first = withSent(parseSent(undefined), { windowId: "w1", issue: 3, sentAt: 1 });
    const second = withSent(first, { windowId: "w1", issue: 4, sentAt: 2 });

    expect(second.entries).toEqual([{ windowId: "w1", issue: 4, sentAt: 2 }]);
  });
});
