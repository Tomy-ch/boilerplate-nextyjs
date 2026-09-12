// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./ui/feed-watch/feed-watch", () => ({ AdminInquiryFeedWatch: () => null }));
vi.mock("./results", () => ({
  AdminInquiryResults: ({ location }: { location: { cursor: string | null } }) => (
    <output>{location.cursor ?? "先頭"}</output>
  ),
}));

import { AdminInquiryListPageContent } from "./page-content";

describe("AdminInquiryListPageContent", () => {
  it("URL の起点を読んで、取り直す範囲へ渡す", async () => {
    render(<AdminInquiryListPageContent searchParams={{ after: "c2" }} />);

    expect(await screen.findByText("c2")).toBeInTheDocument();
  });

  it("条件が無ければ先頭ページとして読む", async () => {
    render(<AdminInquiryListPageContent searchParams={{}} />);

    expect(await screen.findByText("先頭")).toBeInTheDocument();
  });
});
