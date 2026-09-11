// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./ui/conversation/conversation", () => ({
  AdminInquiryConversation: () => <p>やり取り</p>,
}));

import { ADMIN_INQUIRY_HISTORY, ADMIN_INQUIRY_ID } from "../inquiries.fixture";
import { AdminInquiryDetailView } from "./view";

describe("AdminInquiryDetailView", () => {
  it("やり取りを画面の本体として出す", () => {
    render(
      <AdminInquiryDetailView history={ADMIN_INQUIRY_HISTORY} inquiryId={ADMIN_INQUIRY_ID} />,
    );

    expect(screen.getByText("やり取り")).toBeVisible();
  });

  it("一覧と突き合わせられるよう、問い合わせの識別子を出す", () => {
    render(
      <AdminInquiryDetailView history={ADMIN_INQUIRY_HISTORY} inquiryId={ADMIN_INQUIRY_ID} />,
    );

    expect(screen.getByText(ADMIN_INQUIRY_ID)).toBeVisible();
  });

  it("やり取りの始まりを出す", () => {
    render(
      <AdminInquiryDetailView history={ADMIN_INQUIRY_HISTORY} inquiryId={ADMIN_INQUIRY_ID} />,
    );

    expect(screen.getByText("開始")).toBeVisible();
  });

  it("1 通も無ければ、始まりの代わりにその旨を出す", () => {
    render(
      <AdminInquiryDetailView
        history={{ ...ADMIN_INQUIRY_HISTORY, messages: [] }}
        inquiryId={ADMIN_INQUIRY_ID}
      />,
    );

    expect(screen.getByText("まだやり取りがありません")).toBeVisible();
  });
});
