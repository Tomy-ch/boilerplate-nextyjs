// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { InquiryBreadcrumbTrail } from "./breadcrumb-trail";

describe("InquiryBreadcrumbTrail", () => {
  it("先頭に一覧への導線を置く", () => {
    render(<InquiryBreadcrumbTrail trail={[]} />);

    expect(screen.getByRole("link", { name: "問い合わせ管理" })).toHaveAttribute(
      "href",
      "/admin/inquiries",
    );
  });

  it("受け取った段を、渡された順に並べる", () => {
    const { container } = render(<InquiryBreadcrumbTrail trail={["対応", "履歴"]} />);
    const labels = [...container.querySelectorAll("li")]
      .map((item) => item.textContent?.trim() ?? "")
      .filter((label) => label !== "");

    // 1 段だけでは「並べる」かどうかが出ない。順序が反転しても通ってしまう。
    expect(labels).toEqual(["問い合わせ管理", "対応", "履歴"]);
  });

  it("一覧より下の段は戻り先を持たない", () => {
    render(<InquiryBreadcrumbTrail trail={["対応"]} />);

    expect(screen.queryByRole("link", { name: "対応" })).not.toBeInTheDocument();
  });

  it("a11y 自動検査に違反しない", async () => {
    const { container } = render(<InquiryBreadcrumbTrail trail={["対応"]} />);

    expect((await axe(container)).violations).toEqual([]);
  });
});
