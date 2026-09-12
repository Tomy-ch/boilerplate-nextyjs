// @vitest-environment jsdom

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import type { InquiryFeedEvent } from "@/adapters/client/api/inquiries";
import type { UseStreamOptions } from "@/adapters/client/stream/use-stream";
import { failedActionState, idleActionState, succeededActionState } from "@/model/action-state";
import type { InquiryId } from "@/model/inquiry/inquiry";

const { useStream, refresh, useOnlineStatus } = vi.hoisted(() => ({
  useStream: vi.fn(),
  refresh: vi.fn(),
  useOnlineStatus: vi.fn(() => true),
}));

vi.mock("@/adapters/client/stream/use-stream", () => ({ useStream }));
vi.mock("@/capabilities/use-online-status", () => ({ useOnlineStatus }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import {
  ADMIN_INQUIRY_HISTORY,
  ADMIN_INQUIRY_ID,
  OTHER_INQUIRY_ID,
} from "../../../inquiries.fixture";
import { AdminInquiryConversation } from "./conversation";

/** 送信先。canvas と同じく、押しても何も起きない形で渡す。 */
const replyAction = vi.fn(async () => idleActionState<void, "body">());

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

/**
 * jsdom は scroll の口を持たない。追従の器がその口を呼ぶため、呼べる形にだけしておく。
 *
 * @remarks
 * 追従そのものは器の側のテストが確かめます。ここで確かめるのは畳み込みと購読なので、
 * 動きは再現せず、呼べることだけを用意します。
 */
beforeAll(() => {
  Object.defineProperty(Element.prototype, "scrollTo", {
    configurable: true,
    value: () => undefined,
  });
});

afterAll(() => {
  Reflect.deleteProperty(Element.prototype, "scrollTo");
});

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
      <AdminInquiryConversation
        history={ADMIN_INQUIRY_HISTORY}
        inquiryId={ADMIN_INQUIRY_ID}
        replyAction={replyAction}
      />,
    );

    expect(screen.getByText(ADMIN_INQUIRY_HISTORY.messages[0]?.body ?? "")).toBeVisible();
  });

  it("開いている問い合わせが動いたら、正本を取り直す", () => {
    render(
      <AdminInquiryConversation
        history={ADMIN_INQUIRY_HISTORY}
        inquiryId={ADMIN_INQUIRY_ID}
        replyAction={replyAction}
      />,
    );

    act(() => lastOptions().onEvents([feedEvent(ADMIN_INQUIRY_ID)]));

    expect(refresh).toHaveBeenCalledOnce();
  });

  it("別の問い合わせの更新では取り直さない", () => {
    render(
      <AdminInquiryConversation
        history={ADMIN_INQUIRY_HISTORY}
        inquiryId={ADMIN_INQUIRY_ID}
        replyAction={replyAction}
      />,
    );

    act(() => lastOptions().onEvents([feedEvent(OTHER_INQUIRY_ID)]));

    expect(refresh).not.toHaveBeenCalled();
  });

  it("取り直しを求められたときも取り直す", () => {
    render(
      <AdminInquiryConversation
        history={ADMIN_INQUIRY_HISTORY}
        inquiryId={ADMIN_INQUIRY_ID}
        replyAction={replyAction}
      />,
    );

    act(() => lastOptions().onResync());

    expect(refresh).toHaveBeenCalledOnce();
  });

  it("回答欄を出す", () => {
    render(
      <AdminInquiryConversation
        history={ADMIN_INQUIRY_HISTORY}
        inquiryId={ADMIN_INQUIRY_ID}
        replyAction={replyAction}
      />,
    );

    expect(screen.getByLabelText("回答")).toBeInTheDocument();
  });

  it("受信の状態を出す", () => {
    render(
      <AdminInquiryConversation
        history={ADMIN_INQUIRY_HISTORY}
        inquiryId={ADMIN_INQUIRY_ID}
        replyAction={replyAction}
      />,
    );

    expect(screen.getByRole("status")).toHaveAttribute("data-status", "receiving");
  });

  it("a11y 自動検査に違反しない", async () => {
    const { container } = render(
      <AdminInquiryConversation
        history={ADMIN_INQUIRY_HISTORY}
        inquiryId={ADMIN_INQUIRY_ID}
        replyAction={replyAction}
      />,
    );

    expect((await axe(container)).violations).toEqual([]);
  });

  it("項目に紐づかない失敗を、回答欄の隣で知らせる", async () => {
    const user = userEvent.setup();

    replyAction.mockResolvedValue(
      failedActionState({ formError: "しばらくしてからお試しください。" }),
    );
    render(
      <AdminInquiryConversation
        history={ADMIN_INQUIRY_HISTORY}
        inquiryId={ADMIN_INQUIRY_ID}
        replyAction={replyAction}
      />,
    );
    await user.type(screen.getByLabelText("回答"), "承知しました。");
    await user.click(screen.getByRole("button", { name: "回答する" }));

    expect(await screen.findByText("回答を送信できませんでした")).toBeVisible();
    expect(screen.getByText("しばらくしてからお試しください。")).toBeVisible();
  });

  it("回答が成立したら、次の 1 通は別の鍵で飛ばす", async () => {
    const user = userEvent.setup();

    replyAction.mockResolvedValue(succeededActionState(undefined));

    const { container } = render(
      <AdminInquiryConversation
        history={ADMIN_INQUIRY_HISTORY}
        inquiryId={ADMIN_INQUIRY_ID}
        replyAction={replyAction}
      />,
    );
    const keyOf = () =>
      container.querySelector<HTMLInputElement>('input[name="idempotencyKey"]')?.value ?? "";
    const before = keyOf();

    await user.type(screen.getByLabelText("回答"), "承知しました。");
    await user.click(screen.getByRole("button", { name: "回答する" }));

    expect(keyOf()).not.toBe(before);
  });
});
