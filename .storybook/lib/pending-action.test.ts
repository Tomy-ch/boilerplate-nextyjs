import { describe, expect, it } from "vitest";

import { neverSettlingAction } from "./pending-action";

/** 解決しないことを有限時間で確かめるための相手。 */
const SETTLED = Symbol("settled");

describe("neverSettlingAction", () => {
  // ----- 正常系 -----
  it("解決も棄却もしない Promise を返す", async () => {
    const raced = await Promise.race([neverSettlingAction(), Promise.resolve(SETTLED)]);

    expect(raced).toBe(SETTLED);
  });
});
