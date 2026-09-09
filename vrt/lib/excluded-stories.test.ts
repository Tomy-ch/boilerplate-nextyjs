import { describe, expect, it } from "vitest";

import { EXCLUDED_STORIES } from "./excluded-stories";

describe("EXCLUDED_STORIES", () => {
  // ----- 正常系 -----
  it("すべての宣言が理由と撤去条件を持つ", () => {
    const incomplete = EXCLUDED_STORIES.filter(
      (entry) => entry.reason.trim() === "" || entry.removeWhen.trim() === "",
    );

    expect(incomplete.map((entry) => entry.id)).toEqual([]);
  });

  it("同じ story を二重に宣言していない", () => {
    const ids = EXCLUDED_STORIES.map((entry) => entry.id);

    expect(ids).toEqual([...new Set(ids)]);
  });

  // ----- 異常系 -----
  it("除外が増え続けないよう、宣言の数を目に見える形に保つ", () => {
    // 増やすときはこの数を更新する。
    expect(EXCLUDED_STORIES).toHaveLength(2);
  });
});
