import { describe, expect, it } from "vitest";

import { LINT_STEPS } from "./steps";

describe("LINT_STEPS", () => {
  // ----- 正常系 -----
  it("体裁の検査を先頭に置く", () => {
    expect(LINT_STEPS[0]?.name).toBe("markdownlint");
  });

  it("各段が名前と起動コマンドを持つ", () => {
    for (const step of LINT_STEPS) {
      expect(step.name).not.toBe("");
      expect(step.command.length).toBeGreaterThan(0);
    }
  });

  // ----- 異常系 -----
  it("同じ名前の段を二度置かない", () => {
    const names = LINT_STEPS.map((step) => step.name);

    expect(new Set(names).size).toBe(names.length);
  });
});
