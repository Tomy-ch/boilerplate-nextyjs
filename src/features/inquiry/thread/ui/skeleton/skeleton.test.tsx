// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { InquiryThreadSkeleton, PLACEHOLDER_MESSAGES } from "./skeleton";

describe("InquiryThreadSkeleton", () => {
  it("出来上がりと同じ高さの器を先に置く", () => {
    const { container } = render(<InquiryThreadSkeleton />);

    expect(container.firstElementChild).toHaveStyle({
      height: "calc(100dvh - 57px - 2rem)",
    });
  });

  it("宣言した数の枠を並べ、送信欄のぶんを加える", () => {
    const { container } = render(<InquiryThreadSkeleton />);

    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(
      PLACEHOLDER_MESSAGES + 1,
    );
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
