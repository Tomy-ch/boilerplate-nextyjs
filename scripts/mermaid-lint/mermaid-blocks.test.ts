import { describe, expect, it } from "vitest";

import { extractMermaidBlocks, isDependencyMissing } from "./mermaid-blocks";

/** ``` で囲んだフェンスを組み立てる。 */
const fence = (...lines: string[]): string => ["```mermaid", ...lines, "```"].join("\n");

describe("extractMermaidBlocks", () => {
  // ----- 正常系 -----
  it("フェンスの中身を開始行つきで返す", () => {
    expect(extractMermaidBlocks(fence("graph TD;", "  A-->B;"))).toEqual([
      { startLine: 1, code: "graph TD;\n  A-->B;" },
    ]);
  });

  it("同じ文書の複数のフェンスをすべて返す", () => {
    const content = [fence("graph TD;"), "", fence("flowchart LR;")].join("\n");

    expect(extractMermaidBlocks(content)).toHaveLength(2);
  });

  it("チルダのフェンスも読む", () => {
    const content = ["~~~mermaid", "graph TD;", "~~~"].join("\n");

    expect(extractMermaidBlocks(content)).toEqual([{ startLine: 1, code: "graph TD;" }]);
  });

  it("インデントされたフェンスも読む", () => {
    const content = ["  ```mermaid", "  graph TD;", "  ```"].join("\n");

    expect(extractMermaidBlocks(content)[0]?.startLine).toBe(1);
  });

  it("4 本以上のフェンス記号も対応する長さの閉じで読む", () => {
    const content = ["````mermaid", "graph TD;", "````"].join("\n");

    expect(extractMermaidBlocks(content)).toEqual([{ startLine: 1, code: "graph TD;" }]);
  });

  // ----- 異常系 -----
  it("mermaid でないフェンスを拾わない", () => {
    expect(extractMermaidBlocks("```ts\nconst a = 1;\n```")).toEqual([]);
  });

  it("閉じが無ければ末尾までを中身として扱う", () => {
    expect(extractMermaidBlocks("```mermaid\ngraph TD;")).toEqual([
      { startLine: 1, code: "graph TD;" },
    ]);
  });

  it("フェンスを持たない文書では空を返す", () => {
    expect(extractMermaidBlocks("# 見出し\n本文\n")).toEqual([]);
  });
});

describe("isDependencyMissing", () => {
  // ----- 正常系 -----
  it("モジュール解決の失敗コードを依存未整備として扱う", () => {
    const error = Object.assign(new Error("失敗"), { code: "ERR_MODULE_NOT_FOUND" });

    expect(isDependencyMissing(error)).toBe(true);
  });

  it("文言から依存未整備を読み取る", () => {
    expect(isDependencyMissing(new Error("Cannot find package 'mermaid'"))).toBe(true);
    expect(isDependencyMissing(new Error("cannot find module 'linkedom'"))).toBe(true);
  });

  // ----- 異常系 -----
  it("それ以外の失敗は依存未整備として扱わない", () => {
    expect(isDependencyMissing(new Error("想定外"))).toBe(false);
  });

  it("null と undefined は依存未整備として扱わない", () => {
    expect(isDependencyMissing(null)).toBe(false);
    expect(isDependencyMissing(undefined)).toBe(false);
  });
});
