import { describe, expect, it } from "vitest";

import { PREMISE_SHAPES, UNCHECKED_SHAPES } from "./vocabulary";

describe("PREMISE_SHAPES", () => {
  // ----- 正常系 -----
  it("形ごとに、なぜ前提なのかを持つ", () => {
    for (const shape of PREMISE_SHAPES) {
      expect(shape.why).not.toBe("");
      expect(shape.phrases.length).toBeGreaterThan(0);
    }
  });

  // ----- 異常系 -----
  it("同じ綴りを 2 つの形に持たない", () => {
    const all = PREMISE_SHAPES.flatMap((shape) => shape.phrases);

    expect(new Set(all).size).toBe(all.length);
  });

  it("判断の要る言い回しを綴りにしない", () => {
    const all = PREMISE_SHAPES.flatMap((shape) => shape.phrases);

    // 決定の理由として正しく使われる語。入れると赤が日常になり、検査が読まれなくなる。
    for (const loose of ["現時点", "まだ", "いまは", "暫定"]) {
      expect(all).not.toContain(loose);
    }
  });
});

describe("UNCHECKED_SHAPES", () => {
  // ----- 正常系 -----
  it("検査していない形を、空にしない", () => {
    expect(UNCHECKED_SHAPES.length).toBeGreaterThan(0);
  });
});
