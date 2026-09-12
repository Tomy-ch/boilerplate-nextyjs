// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

vi.mock("./ui/feed-watch/feed-watch", () => ({
  AdminInquiryFeedWatch: () => <p>受信の状態</p>,
}));

import { AdminInquiryListView } from "./view";

describe("AdminInquiryListView", () => {
  it("一覧本体を受け取って描く", () => {
    render(
      <AdminInquiryListView>
        <p>一覧</p>
      </AdminInquiryListView>,
    );

    expect(screen.getByText("一覧")).toBeVisible();
  });

  it("購読を一覧本体の外に置く", () => {
    render(
      <AdminInquiryListView>
        <p>一覧</p>
      </AdminInquiryListView>,
    );

    const watch = screen.getByText("受信の状態");
    const body = screen.getByText("一覧");

    expect(watch).toBeVisible();
    // 一覧の内側へ入ると、行の描き直しのたびに受信の状態も作り直される。
    expect(body.contains(watch)).toBe(false);
    expect(watch.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("a11y 自動検査に違反しない", async () => {
    const { container } = render(
      <AdminInquiryListView>
        <p>一覧</p>
      </AdminInquiryListView>,
    );

    expect((await axe(container)).violations).toEqual([]);
  });
});
