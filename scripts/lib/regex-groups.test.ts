import { describe, expect, it } from "vitest";

import { groupAt, groupsAt } from "./regex-groups";

const OPTIONAL_TAIL = /^(\w+)(?:@(\w+))?$/;

describe("groupAt", () => {
  // ----- 正常系 -----
  it("参加した群をそのまま返す", () => {
    const match = OPTIONAL_TAIL.exec("checkout@v7");

    if (match === null) throw new Error("照合しませんでした");
    expect(groupAt(match, 2)).toBe("v7");
  });

  it("参加しなかった任意の群を空文字として返す", () => {
    const match = OPTIONAL_TAIL.exec("checkout");

    if (match === null) throw new Error("照合しませんでした");
    expect(groupAt(match, 2)).toBe("");
  });
});

describe("groupsAt", () => {
  // ----- 正常系 -----
  it("指した番号の順に並べて返す", () => {
    const match = OPTIONAL_TAIL.exec("checkout@v7");

    if (match === null) throw new Error("照合しませんでした");
    expect(groupsAt(match, 2, 1)).toEqual(["v7", "checkout"]);
  });

  it("参加しなかった群を含んでも並びの位置を保つ", () => {
    const match = OPTIONAL_TAIL.exec("checkout");

    if (match === null) throw new Error("照合しませんでした");
    expect(groupsAt(match, 1, 2)).toEqual(["checkout", ""]);
  });
});
