import { describe, expect, it } from "vitest";

import { diffLabels, type LabelSpec, parseLabelSpecs } from "./labels";

const spec = (name: string): LabelSpec => ({ name, description: name, color: "d73a4a" });

describe("parseLabelSpecs", () => {
  // ----- 正常系 -----
  it("宣言された順のままラベルを読み取る", () => {
    const source = JSON.stringify([
      { name: "bug", description: "バグ・不具合", color: "d73a4a" },
      { name: "release", description: "リリース用のラベル", color: "c5def5" },
    ]);

    expect(parseLabelSpecs(source)).toEqual([
      { name: "bug", description: "バグ・不具合", color: "d73a4a" },
      { name: "release", description: "リリース用のラベル", color: "c5def5" },
    ]);
  });

  it("説明が空のラベルも読み取る", () => {
    const source = JSON.stringify([{ name: "wontfix", description: "", color: "ffffff" }]);

    expect(parseLabelSpecs(source)).toEqual([expect.objectContaining({ description: "" })]);
  });

  // ----- 異常系 -----
  it("JSON として読めない宣言を拒む", () => {
    expect(() => parseLabelSpecs("[")).toThrow();
  });

  it("配列でない宣言を拒む", () => {
    // 1 件ぶんの項目としては揃えて渡す。欠けたまま渡すと、配列でないことではなく項目の不足で
    // 落ち、配列を要求している検査そのものは通っていない。
    expect(() =>
      parseLabelSpecs(JSON.stringify({ name: "bug", description: "不具合", color: "d73a4a" })),
    ).toThrow();
  });

  it("1 件も宣言されていなければ拒む", () => {
    expect(() => parseLabelSpecs("[]")).toThrow();
  });

  it("name が空のラベルを拒む", () => {
    const source = JSON.stringify([{ name: "", description: "", color: "d73a4a" }]);

    expect(() => parseLabelSpecs(source)).toThrow();
  });

  it("色が 6 桁の 16 進数でないラベルを拒む", () => {
    const source = JSON.stringify([{ name: "bug", description: "", color: "#d73a4a" }]);

    expect(() => parseLabelSpecs(source)).toThrow();
  });

  it("同じ name を二度宣言していれば拒む", () => {
    const source = JSON.stringify([
      { name: "bug", description: "", color: "d73a4a" },
      { name: "bug", description: "", color: "ffffff" },
    ]);

    expect(() => parseLabelSpecs(source)).toThrow(/重複/);
  });
});

describe("diffLabels", () => {
  // ----- 正常系 -----
  it("実在しないラベルだけを作る対象にする", () => {
    const diff = diffLabels(["bug"], [spec("bug"), spec("release")]);

    expect(diff.toCreate).toEqual([spec("release")]);
    expect(diff.alreadyPresent).toEqual(["bug"]);
  });

  it("実在するラベルが宣言に無くても消す対象にはしない", () => {
    const diff = diffLabels(["stale"], [spec("bug")]);

    expect(diff.toCreate).toEqual([spec("bug")]);
    expect(diff.alreadyPresent).toEqual([]);
  });

  // ----- 異常系 -----
  it("ラベルが 1 つも実在しなければ宣言の全数を作る", () => {
    const diff = diffLabels([], [spec("bug"), spec("release")]);

    expect(diff.toCreate).toEqual([spec("bug"), spec("release")]);
    expect(diff.alreadyPresent).toEqual([]);
  });

  it("宣言の全数が実在すれば作る対象を出さない", () => {
    const diff = diffLabels(["bug", "release"], [spec("bug"), spec("release")]);

    expect(diff.toCreate).toEqual([]);
    expect(diff.alreadyPresent).toEqual(["bug", "release"]);
  });
});
