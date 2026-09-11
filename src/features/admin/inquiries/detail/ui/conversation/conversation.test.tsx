// @vitest-environment jsdom

import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { InquiryFeedEvent } from "@/adapters/client/api/inquiries";
import type { UseStreamOptions } from "@/adapters/client/stream/use-stream";
import type { InquiryId } from "@/model/inquiry/inquiry";

const { useStream, refresh, useOnlineStatus, replyInquiryAction } = vi.hoisted(() => ({
  useStream: vi.fn(),
  refresh: vi.fn(),
  useOnlineStatus: vi.fn(() => true),
  replyInquiryAction: vi.fn(),
}));

vi.mock("@/adapters/client/stream/use-stream", () => ({ useStream }));
vi.mock("@/capabilities/use-online-status", () => ({ useOnlineStatus }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("../../../actions", () => ({ replyInquiryAction }));

import {
  ADMIN_INQUIRY_HISTORY,
  ADMIN_INQUIRY_ID,
  OTHER_INQUIRY_ID,
} from "../../../inquiries.fixture";
import { AdminInquiryConversation } from "./conversation";

let opened: UseStreamOptions<InquiryFeedEvent> | null = null;

function lastOptions(): UseStreamOptions<InquiryFeedEvent> {
  if (opened === null) {
    throw new Error("購読が開かれていません。");
  }

  return opened;
}

function feedEvent(inquiryId: InquiryId): InquiryFeedEvent {
  return {
    type: "inquiry.thread.updated.v1",
    payload: {
      inquiryId,
      userId: "550e8400-e29b-41d4-a716-446655440000",
      sequence: 5,
      updatedAt: "2026-09-12T03:31:04.043410674+09:00",
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  opened = null;
  useOnlineStatus.mockReturnValue(true);
  useStream.mockImplementation((options: UseStreamOptions<InquiryFeedEvent>) => {
    opened = options;

    return { state: { kind: "open" }, resume: vi.fn() };
  });
});

describe("AdminInquiryConversation", () => {
  it("取得した正本を並べる", () => {
    render(
      <AdminInquiryConversation history={ADMIN_INQUIRY_HISTORY} inquiryId={ADMIN_INQUIRY_ID} />,
    );

    expect(screen.getByText(ADMIN_INQUIRY_HISTORY.messages[0]?.body ?? "")).toBeVisible();
  });

  it("開いている問い合わせが動いたら、正本を取り直す", () => {
    render(
      <AdminInquiryConversation history={ADMIN_INQUIRY_HISTORY} inquiryId={ADMIN_INQUIRY_ID} />,
    );

    act(() => lastOptions().onEvents([feedEvent(ADMIN_INQUIRY_ID)]));

    expect(refresh).toHaveBeenCalledOnce();
  });

  it("別の問い合わせの更新では取り直さない", () => {
    render(
      <AdminInquiryConversation history={ADMIN_INQUIRY_HISTORY} inquiryId={ADMIN_INQUIRY_ID} />,
    );

    act(() => lastOptions().onEvents([feedEvent(OTHER_INQUIRY_ID)]));

    expect(refresh).not.toHaveBeenCalled();
  });

  it("取り直しを求められたときも取り直す", () => {
    render(
      <AdminInquiryConversation history={ADMIN_INQUIRY_HISTORY} inquiryId={ADMIN_INQUIRY_ID} />,
    );

    act(() => lastOptions().onResync());

    expect(refresh).toHaveBeenCalledOnce();
  });

  it("回答欄を出す", () => {
    render(
      <AdminInquiryConversation history={ADMIN_INQUIRY_HISTORY} inquiryId={ADMIN_INQUIRY_ID} />,
    );

    expect(screen.getByLabelText("回答")).toBeInTheDocument();
  });

  it("受信の状態を出す", () => {
    render(
      <AdminInquiryConversation history={ADMIN_INQUIRY_HISTORY} inquiryId={ADMIN_INQUIRY_ID} />,
    );

    expect(screen.getByRole("status")).toHaveAttribute("data-status", "receiving");
  });
});
