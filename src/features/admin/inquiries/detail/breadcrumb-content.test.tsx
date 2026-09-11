// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AdminInquiryDetailBreadcrumbContent } from "./breadcrumb-content";

describe("AdminInquiryDetailBreadcrumbContent", () => {
  it("一覧へ戻る段を出す", () => {
    render(<AdminInquiryDetailBreadcrumbContent />);

    expect(screen.getByRole("link", { name: "問い合わせ管理" })).toHaveAttribute(
      "href",
      "/admin/inquiries",
    );
  });

  it("現在地に識別子を出さない", () => {
    render(<AdminInquiryDetailBreadcrumbContent />);

    expect(screen.getByText("対応")).toBeVisible();
  });
});
