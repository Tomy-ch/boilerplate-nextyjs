// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AdminInquiryDetailBreadcrumb from "./page";

describe("AdminInquiryDetailBreadcrumb", () => {
  it("一覧へ戻る階層を出す", () => {
    render(<AdminInquiryDetailBreadcrumb />);

    expect(screen.getByRole("link", { name: "問い合わせ管理" })).toBeVisible();
  });
});
