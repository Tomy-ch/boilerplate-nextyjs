// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { AdminInquiryDetailSkeleton, PLACEHOLDER_MESSAGES } from "./skeleton";

describe("AdminInquiryDetailSkeleton", () => {
  it("概要・やり取り・回答欄のぶんの枠を置く", () => {
    const { container } = render(<AdminInquiryDetailSkeleton />);

    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(
      PLACEHOLDER_MESSAGES + 2,
    );
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
