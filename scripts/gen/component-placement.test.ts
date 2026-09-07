import { describe, expect, it } from "vitest";

import { readComponentPlacement } from "./component-placement";

describe("readComponentPlacement", () => {
  // ----- 正常系 -----
  it("--as だけを渡すと design-system の指定した見出しに置く", () => {
    expect(readComponentPlacement(["--as=status"])).toEqual({
      placement: { layer: "design-system", as: "status" },
    });
  });

  it("--layer で design-system 以外の層を選べる", () => {
    expect(readComponentPlacement(["--layer=patterns", "--as=container"])).toEqual({
      placement: { layer: "patterns", as: "container" },
    });
  });

  // ----- 異常系 -----
  it("--as が無ければ、見出しの候補を挙げて拒む", () => {
    const result = readComponentPlacement([]);

    expect(result).toHaveProperty("error");
    expect("error" in result && result.error).toContain("--as=<見出し> は必須です");
    expect("error" in result && result.error).toContain("status");
  });

  it("台帳に無い見出しを拒む", () => {
    expect(readComponentPlacement(["--as=widgets"])).toHaveProperty("error");
  });

  it("台帳に無い層を、層の候補を挙げて拒む", () => {
    const result = readComponentPlacement(["--as=status", "--layer=ui"]);

    expect("error" in result && result.error).toContain("--layer=<層> は");
    expect("error" in result && result.error).toContain("app-starter");
  });

  it("配置以外の引数を拒む", () => {
    const result = readComponentPlacement(["--as=status", "design-system/status"]);

    expect("error" in result && result.error).toContain('"design-system/status" は受け付けません');
  });
});
