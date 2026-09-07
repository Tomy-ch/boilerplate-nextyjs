import { describe, expect, it } from "vitest";

import { readFeaturePlacement } from "./feature-placement";

describe("readFeaturePlacement", () => {
  // ----- 正常系 -----
  it("--screen で画面を受け取る", () => {
    expect(readFeaturePlacement(["--screen=list"])).toEqual({ placement: { screen: "list" } });
  });

  it("複数語の画面名を kebab-case のまま受け取る", () => {
    expect(readFeaturePlacement(["--screen=order-detail"])).toEqual({
      placement: { screen: "order-detail" },
    });
  });

  // ----- 異常系 -----
  it("--screen が無ければ、必須であることと例を挙げて拒む", () => {
    const result = readFeaturePlacement([]);

    expect(result).toHaveProperty("error");
    expect("error" in result && result.error).toContain("--screen=<画面> は必須です");
    expect("error" in result && result.error).toContain("--screen=list");
  });

  it("kebab-case でない画面名を、どのオプションの値かを添えて拒む", () => {
    const result = readFeaturePlacement(["--screen=OrderDetail"]);

    expect("error" in result && result.error).toContain("--screen の名前");
    expect("error" in result && result.error).toContain("kebab-case ではありません");
  });

  it("空の画面名を拒む", () => {
    const result = readFeaturePlacement(["--screen="]);

    expect("error" in result && result.error).toContain("名前が空です");
  });

  it("画面以外の引数を拒む", () => {
    const result = readFeaturePlacement(["--screen=list", "--as=status"]);

    expect("error" in result && result.error).toContain('"--as=status" は受け付けません');
  });
});
