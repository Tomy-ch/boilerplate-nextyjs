import { describe, expect, it } from "vitest";

import { ORPHANED_ACTIONS } from "./pins";

describe("ORPHANED_ACTIONS", () => {
  // ----- 正常系 -----
  it("版を含まない action の名前だけを宣言する", () => {
    expect(ORPHANED_ACTIONS.every((action) => !action.includes("@"))).toBe(true);
  });
});
