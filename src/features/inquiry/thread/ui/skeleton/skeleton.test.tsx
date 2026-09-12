// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { InquiryThreadSkeleton, PLACEHOLDER_MESSAGES } from "./skeleton";

describe("InquiryThreadSkeleton", () => {
  it("出来上がりと同じ高さの器を先に置く", () => {
    const { container } = render(<InquiryThreadSkeleton />);

    // 正規化の順序は比較の主題ではない。器の高さが、画面の高さから header と余白を引いた値であること。
    const height = container.firstElementChild?.getAttribute("style") ?? "";

    expect(height).toContain("100dvh");
    expect(height).toContain("57px");
    expect(height).toContain("2rem");
  });

  it("宣言した数の枠を並べ、送信欄のぶんを加える", () => {
    const { container } = render(<InquiryThreadSkeleton />);
    const frames = [...container.querySelectorAll('[data-slot="skeleton"]')];

    expect(frames).toHaveLength(PLACEHOLDER_MESSAGES + 1);
    // 数だけでは、やり取りの枠を 1 つ増やして送信欄を作り忘れても通る。
    expect(frames.at(-1)).toHaveClass("h-24");
  });

  it("やり取りの枠を左右へ交互に寄せる", () => {
    const { container } = render(<InquiryThreadSkeleton />);
    const frames = [...container.querySelectorAll('[data-slot="skeleton"]')].slice(
      0,
      PLACEHOLDER_MESSAGES,
    );

    for (const [index, frame] of frames.entries()) {
      expect(frame.classList.contains("self-end")).toBe(index % 2 === 1);
    }
  });

  it("読み上げへ何も伝えない", () => {
    const { container } = render(<InquiryThreadSkeleton />);

    expect(container.textContent).toBe("");
  });

  it("a11y 自動検査に違反しない", async () => {
    const { container } = render(<InquiryThreadSkeleton />);

    expect((await axe(container)).violations).toEqual([]);
  });
});
