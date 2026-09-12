// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMyInquiryHistory } = vi.hoisted(() => ({ getMyInquiryHistory: vi.fn() }));

vi.mock("@/adapters/server/api/inquiries", () => ({ getMyInquiryHistory }));
vi.mock("./view", () => ({
  InquiryThreadView: ({ history }: { history: { streamCursor: number } }) => (
    <p>開始位置 {history.streamCursor}</p>
  ),
}));

import { HISTORY } from "../inquiry.fixture";
import { InquiryThreadPageContent } from "./page-content";

beforeEach(() => {
  vi.clearAllMocks();
  getMyInquiryHistory.mockResolvedValue(HISTORY);
});

describe("InquiryThreadPageContent", () => {
  it("取得した履歴をそのまま画面へ渡す", async () => {
    render(await InquiryThreadPageContent());

    expect(screen.getByText("開始位置 4")).toBeVisible();
  });

  it("1 ページだけ取る", async () => {
    await InquiryThreadPageContent();

    expect(getMyInquiryHistory).toHaveBeenCalledWith();
  });
});
