// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { AspectRatio } from "./aspect-ratio";
import rawSource from "./aspect-ratio.tsx?raw";

/**
 * 実装そのもの。client boundary の有無は描画の結果に出ないため、宣言を文面として読む。
 *
 * @remarks
 * バンドラの生読み込みで引きます。`import.meta.url` から辿ると、ブラウザを模した環境では
 * 文書の URL になって `file:` で解決できません。
 */
const source: string = rawSource;

/** それだけで 1 行になった `"use client"`。あるとこの部品から先が client の束へ入る。 */
const USE_CLIENT_DIRECTIVE = /^\s*(["'])use client\1;?\s*$/m;

/** 値として引いている出所。`import type` は束に残らないので数えない。 */
const VALUE_IMPORT = /^import\s+(?!type\s)[^;]*?from\s+"([^"]+)";$/gm;

/** 引いた時点で client runtime を要求する出所。 */
const CLIENT_ONLY_ORIGINS = ["react-dom", "next/navigation", "@/capabilities/", "@/stores/"];

/** hook の呼び出し。出所を跨がなくても、hook を使えば client runtime が要る。 */
const HOOK_CALL = /\buse[A-Z]\w*\(/;

describe("AspectRatio", () => {
  it("指定した比率を CSS の aspect-ratio として与える", () => {
    const { container } = render(<AspectRatio ratio={16 / 9}>内容</AspectRatio>);

    const box = container.querySelector("[data-slot='aspect-ratio']");

    expect(box).toHaveStyle({ aspectRatio: String(16 / 9) });
  });

  it("比率を省略すると正方形になる", () => {
    const { container } = render(<AspectRatio>内容</AspectRatio>);

    expect(container.querySelector("[data-slot='aspect-ratio']")).toHaveStyle({ aspectRatio: "1" });
  });

  it("内容に押し広げられないよう溢れを切る", () => {
    const { container } = render(<AspectRatio ratio={16 / 9}>内容</AspectRatio>);

    expect(container.querySelector("[data-slot='aspect-ratio']")).toHaveClass("overflow-hidden");
  });

  it("client runtime を必要としない Server Component として描画する", () => {
    render(<AspectRatio ratio={16 / 9}>内容</AspectRatio>);

    const origins = [...source.matchAll(VALUE_IMPORT)].flatMap(([, origin]) =>
      origin === undefined ? [] : [origin],
    );
    const clientOnly = origins.filter((origin) =>
      CLIENT_ONLY_ORIGINS.some((prefix) => origin.startsWith(prefix)),
    );

    expect(screen.getByText("内容")).toBeInTheDocument();
    expect(source).not.toMatch(USE_CLIENT_DIRECTIVE);
    expect(clientOnly).toEqual([]);
    expect(source).not.toMatch(HOOK_CALL);
  });

  it("className と style を呼び出し元が拡張できる", () => {
    const { container } = render(
      <AspectRatio className="rounded-md" ratio={2} style={{ maxWidth: "20rem" }}>
        内容
      </AspectRatio>,
    );

    const box = container.querySelector("[data-slot='aspect-ratio']");

    expect(box).toHaveClass("rounded-md", "overflow-hidden");
    expect(box).toHaveStyle({ aspectRatio: "2", maxWidth: "20rem" });
  });

  it("a11y 自動検査に違反しない", async () => {
    const { container } = render(<AspectRatio ratio={16 / 9}>内容</AspectRatio>);

    const result = await axe(container, { rules: { "color-contrast": { enabled: false } } });

    expect(result.violations).toEqual([]);
  });
});
