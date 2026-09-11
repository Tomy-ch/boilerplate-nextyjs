// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { AdminInquiryListSkeleton, PLACEHOLDER_ROWS } from "./skeleton";

describe("AdminInquiryListSkeleton", () => {
  it("宣言した数の枠を並べる", () => {
    const { container } = render(<AdminInquiryListSkeleton />);

    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(PLACEHOLDER_ROWS);
  });

  it("読み上げへ何も伝えない", () => {
    const { container } = render(<AdminInquiryListSkeleton />);

    expect(container.textContent).toBe("");
  });

  it("a11y 自動検査に違反しない", async () => {
    const { container } = render(<AdminInquiryListSkeleton />);

    expect((await axe(container)).violations).toEqual([]);
  });
});
