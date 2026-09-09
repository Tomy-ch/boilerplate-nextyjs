import { describe, expect, it } from "vitest";

import { optionValue } from "./option-value";

describe("optionValue", () => {
  // ----- 正常系 -----
  it("--name=value の value を返す", () => {
    expect(optionValue(["--screen=list"], "--screen")).toBe("list");
  });

  it("同じ名前が並んだら最初の値を返す", () => {
    expect(optionValue(["--as=status", "--as=layout"], "--as")).toBe("status");
  });

  it("空の値をそのまま返す", () => {
    expect(optionValue(["--screen="], "--screen")).toBe("");
  });

  // ----- 異常系 -----
  it("名前が無ければ undefined を返す", () => {
    expect(optionValue(["--layer=patterns"], "--screen")).toBeUndefined();
  });

  it("接頭辞だけが一致する引数を取らない", () => {
    expect(optionValue(["--screen-name=list"], "--screen")).toBeUndefined();
  });
});
