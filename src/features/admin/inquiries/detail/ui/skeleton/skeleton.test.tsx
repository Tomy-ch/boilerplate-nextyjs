// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { AdminInquiryDetailSkeleton, PLACEHOLDER_MESSAGES } from "./skeleton";

describe("AdminInquiryDetailSkeleton", () => {
  it("概要・やり取り・回答欄のぶんの枠を置く", () => {
    const { container } = render(<AdminInquiryDetailSkeleton />);
    const frames = [...container.querySelectorAll('[data-slot="skeleton"]')];

    expect(frames).toHaveLength(PLACEHOLDER_MESSAGES + 2);
    // 数だけでは、やり取りの枠が増えて概要か回答欄が消えても通る。
    expect(frames.at(0)).toHaveClass("h-16");
    expect(frames.at(-1)).toHaveClass("h-28");
  });

  it("やり取りの枠を左右へ交互に寄せる", () => {
    const { container } = render(<AdminInquiryDetailSkeleton />);
    const frames = [...container.querySelectorAll('[data-slot="skeleton"]')].slice(
      1,
      PLACEHOLDER_MESSAGES + 1,
    );

    for (const [index, frame] of frames.entries()) {
      expect(frame.classList.contains("self-end")).toBe(index % 2 === 1);
    }
  });

  it("読み上げへ何も伝えない", () => {
    const { container } = render(<AdminInquiryDetailSkeleton />);

    expect(container.textContent).toBe("");
  });

  it("a11y 自動検査に違反しない", async () => {
    const { container } = render(<AdminInquiryDetailSkeleton />);

    expect((await axe(container)).violations).toEqual([]);
  });
});
