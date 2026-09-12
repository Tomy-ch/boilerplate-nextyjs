// @vitest-environment jsdom

import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import type { InquiryFeedEvent } from "@/adapters/client/api/inquiries";
import type { UseStreamOptions } from "@/adapters/client/stream/use-stream";
import { type InquiryId, toInquiryId } from "@/model/inquiry/inquiry";

const { useStream, refresh, useOnlineStatus } = vi.hoisted(() => ({
  useStream: vi.fn(),
  refresh: vi.fn(),
  useOnlineStatus: vi.fn(() => true),
}));

vi.mock("@/adapters/client/stream/use-stream", () => ({ useStream }));
vi.mock("@/capabilities/use-online-status", () => ({ useOnlineStatus }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { AdminInquiryFeedWatch } from "./feed-watch";

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
      sequence: 3,
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

describe("AdminInquiryFeedWatch", () => {
  it("開始位置を渡さずに購読する", () => {
    render(<AdminInquiryFeedWatch />);

    expect(lastOptions().initialCursor).toBeNull();
  });

  it("更新が届いたら一覧を取り直す", () => {
    render(<AdminInquiryFeedWatch />);

    act(() =>
      lastOptions().onEvents([feedEvent(toInquiryId("0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a60"))]),
    );

    expect(refresh).toHaveBeenCalledOnce();
  });

  it("取り直しを求められたときも一覧を取り直す", () => {
    render(<AdminInquiryFeedWatch />);

    act(() => lastOptions().onResync());

    expect(refresh).toHaveBeenCalledOnce();
  });

  it("受信の状態を出す", () => {
    render(<AdminInquiryFeedWatch />);

    expect(screen.getByRole("status")).toHaveAttribute("data-status", "receiving");
  });

  it("回線が切れていれば、購読の状態より先に伝える", () => {
    useOnlineStatus.mockReturnValue(false);
    render(<AdminInquiryFeedWatch />);

    expect(screen.getByRole("status")).toHaveAttribute("data-status", "offline");
  });

  it("a11y 自動検査に違反しない", async () => {
    const { container } = render(<AdminInquiryFeedWatch />);

    expect((await axe(container)).violations).toEqual([]);
  });
});
