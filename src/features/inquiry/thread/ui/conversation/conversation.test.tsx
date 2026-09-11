// @vitest-environment jsdom

import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UseStreamOptions } from "@/adapters/client/stream/use-stream";
import type { InquiryConversationEvent } from "@/adapters/client/api/inquiries";
import { INQUIRY_AUTHOR_KIND, type InquiryMessage } from "@/model/inquiry/inquiry";

const { useStream, resume, refresh, useOnlineStatus, sendInquiryMessageAction } = vi.hoisted(() => ({
  useStream: vi.fn(),
  resume: vi.fn(),
  refresh: vi.fn(),
  useOnlineStatus: vi.fn(() => true),
  sendInquiryMessageAction: vi.fn(),
}));

vi.mock("@/adapters/client/stream/use-stream", () => ({ useStream }));
vi.mock("@/capabilities/use-online-status", () => ({ useOnlineStatus }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("../../../actions", () => ({ sendInquiryMessageAction }));

import { EMPTY_HISTORY, HISTORY, INQUIRY_ID } from "../../../inquiry.fixture";
import { InquiryConversation } from "./conversation";

/** 購読へ渡された指定。差し替えた `useStream` が受け取ったものをそのまま覚える。 */
let opened: UseStreamOptions<InquiryConversationEvent> | null = null;

function lastOptions(): UseStreamOptions<InquiryConversationEvent> {
  if (opened === null) {
    throw new Error("購読が開かれていません。");
  }

  return opened;
}

function eventFor(sequence: number, body: string): InquiryConversationEvent {
  return {
    type: "inquiry.message.created.v1",
    payload: {
      messageId: `m${sequence}`,
      inquiryId: INQUIRY_ID,
      author: { kind: INQUIRY_AUTHOR_KIND.operator },
      body,
      sequence,
      createdAt: "2026-09-02T05:00:00.000Z",
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  opened = null;
  useOnlineStatus.mockReturnValue(true);
  useStream.mockImplementation((options: UseStreamOptions<InquiryConversationEvent>) => {
    opened = options;

    return { state: { kind: "open" }, resume };
  });
});

describe("InquiryConversation", () => {
  // ----- 表示 -----
  it("取得した正本を並べる", () => {
    render(<InquiryConversation history={HISTORY} />);

    expect(screen.getByText(HISTORY.messages[0]?.body ?? "")).toBeVisible();
  });

  it("まだ 1 通も無いときは、案内を出す", () => {
    render(<InquiryConversation history={EMPTY_HISTORY} />);

    expect(screen.getByText(/まだやり取りはありません/)).toBeVisible();
  });

  it("受信の状態を出す", () => {
    render(<InquiryConversation history={HISTORY} />);

    expect(screen.getByRole("status")).toHaveAttribute("data-status", "receiving");
  });

  it("回線が切れていれば、購読の状態より先に伝える", () => {
    useOnlineStatus.mockReturnValue(false);
    render(<InquiryConversation history={HISTORY} />);

    expect(screen.getByRole("status")).toHaveAttribute("data-status", "offline");
  });

  // ----- 購読 -----
  it("取得が返した位置から購読する", () => {
    render(<InquiryConversation history={HISTORY} />);

    expect(lastOptions().initialCursor).toBe("4");
  });

  it("まだ問い合わせが無ければ購読しない", () => {
    render(<InquiryConversation history={EMPTY_HISTORY} />);

    expect(lastOptions().enabled).toBe(false);
  });

  it("届いた 1 通を並びへ足す", () => {
    render(<InquiryConversation history={HISTORY} />);

    act(() => lastOptions().onEvents([eventFor(5, "追跡番号をご案内します。")]));

    expect(screen.getByText("追跡番号をご案内します。")).toBeVisible();
  });

  it("同じ 1 通が二度届いても、二重に並ばない", () => {
    render(<InquiryConversation history={HISTORY} />);

    act(() => lastOptions().onEvents([eventFor(5, "重複")]));
    act(() => lastOptions().onEvents([eventFor(5, "重複")]));

    expect(screen.getAllByText("重複")).toHaveLength(1);
  });

  it("取り直しを求められたら、正本を取り直す", () => {
    render(<InquiryConversation history={HISTORY} />);

    act(() => lastOptions().onResync());

    expect(refresh).toHaveBeenCalledOnce();
  });

  // ----- 取り直しの反映 -----
  it("取り直した正本の位置で購読を再開する", () => {
    const { rerender } = render(<InquiryConversation history={HISTORY} />);
    const settled: InquiryMessage = {
      id: "m5",
      authorKind: INQUIRY_AUTHOR_KIND.operator,
      body: "追跡番号をご案内します。",
      sequence: 5,
      createdAt: new Date("2026-09-02T05:00:00.000Z"),
    };

    act(() => lastOptions().onEvents([eventFor(5, settled.body)]));
    rerender(
      <InquiryConversation
        history={{ ...HISTORY, messages: [...HISTORY.messages, settled], streamCursor: 5 }}
      />,
    );

    expect(resume).toHaveBeenCalledWith("5");
    expect(screen.getAllByText(settled.body)).toHaveLength(1);
  });

  it("最初の描画では購読を張り直さない", () => {
    render(<InquiryConversation history={HISTORY} />);

    expect(resume).not.toHaveBeenCalled();
  });
});
