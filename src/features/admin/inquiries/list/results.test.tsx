// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

const { listInquiries } = vi.hoisted(() => ({ listInquiries: vi.fn() }));

vi.mock("@/adapters/server/api/inquiries", () => ({ listInquiries }));

import { ADMIN_INQUIRY_ROWS } from "../inquiries.fixture";
import { AdminInquiryResults } from "./results";

const FIRST_PAGE = { cursor: null, trail: [] };

beforeEach(() => {
  vi.clearAllMocks();
  listInquiries.mockResolvedValue({ items: ADMIN_INQUIRY_ROWS, nextCursor: null });
});

describe("AdminInquiryResults", () => {
  it("いま見ている位置の 1 ページを取る", async () => {
    render(await AdminInquiryResults({ location: { cursor: "c1", trail: [] } }));

    expect(listInquiries).toHaveBeenCalledWith("c1");
  });

  it("先頭ページでは起点を渡さない", async () => {
    render(await AdminInquiryResults({ location: FIRST_PAGE }));

    expect(listInquiries).toHaveBeenCalledWith(undefined);
  });

  it("続きがあれば、次へ進む導線を出す", async () => {
    listInquiries.mockResolvedValue({ items: ADMIN_INQUIRY_ROWS, nextCursor: "c2" });

    render(await AdminInquiryResults({ location: FIRST_PAGE }));

    expect(screen.getByRole("link", { name: "次へ" })).toHaveAttribute(
      "href",
      "/admin/inquiries?after=c2",
    );
  });

  it("続きが無ければ、次へ進む導線を押せなくする", async () => {
    render(await AdminInquiryResults({ location: FIRST_PAGE }));

    expect(screen.queryByRole("link", { name: "次へ" })).not.toBeInTheDocument();
  });

  it("先頭ページでは、前へ戻る導線を押せなくする", async () => {
    render(await AdminInquiryResults({ location: FIRST_PAGE }));

    expect(screen.queryByRole("link", { name: "前へ" })).not.toBeInTheDocument();
  });

  it("a11y 自動検査に違反しない", async () => {
    const { container } = render(await AdminInquiryResults({ location: FIRST_PAGE }));

    expect((await axe(container)).violations).toEqual([]);
  });
});
