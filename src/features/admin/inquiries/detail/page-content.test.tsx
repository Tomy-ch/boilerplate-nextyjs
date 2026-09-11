// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getInquiryHistory } = vi.hoisted(() => ({ getInquiryHistory: vi.fn() }));

vi.mock("@/adapters/server/api/inquiries", () => ({ getInquiryHistory }));
vi.mock("./view", () => ({
  AdminInquiryDetailView: ({ inquiryId }: { inquiryId: string }) => <p>{inquiryId}</p>,
}));

import { idleActionState } from "@/model/action-state";

import { ADMIN_INQUIRY_HISTORY, ADMIN_INQUIRY_ID } from "../inquiries.fixture";
import { AdminInquiryDetailPageContent } from "./page-content";

beforeEach(() => {
  vi.clearAllMocks();
  getInquiryHistory.mockResolvedValue(ADMIN_INQUIRY_HISTORY);
});

describe("AdminInquiryDetailPageContent", () => {
  it("動的セグメントが指す問い合わせを取る", async () => {
    render(
      await AdminInquiryDetailPageContent({
        inquiryId: ADMIN_INQUIRY_ID,
        replyAction: async () => idleActionState<void, "body">(),
      }),
    );

    expect(getInquiryHistory).toHaveBeenCalledWith(ADMIN_INQUIRY_ID);
    expect(screen.getByText(ADMIN_INQUIRY_ID)).toBeVisible();
  });
});
