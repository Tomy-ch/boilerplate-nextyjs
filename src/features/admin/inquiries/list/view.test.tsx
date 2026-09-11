// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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

    expect(screen.getByText("受信の状態")).toBeVisible();
  });
});
