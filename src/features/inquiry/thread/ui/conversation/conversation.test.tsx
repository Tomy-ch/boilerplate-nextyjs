// @vitest-environment jsdom

import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import type { InquiryConversationEvent } from "@/adapters/client/api/inquiries";
import type { UseStreamOptions } from "@/adapters/client/stream/use-stream";
import { failedActionState, succeededActionState } from "@/model/action-state";
import { INQUIRY_AUTHOR_KIND, type InquiryMessage } from "@/model/inquiry/inquiry";

const { useStream, resume, refresh, useOnlineStatus, sendInquiryMessageAction } = vi.hoisted(
  () => ({
    useStream: vi.fn(),
    resume: vi.fn(),
    refresh: vi.fn(),
    useOnlineStatus: vi.fn(() => true),
    sendInquiryMessageAction: vi.fn(),
  }),
);

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
  useStream.mockImplementation((options: UseStreamOptions<InquiryConversationEvent>) => {
    opened = options;

    return { state: { kind: "open" }, resume };
  });
});

/** 送信欄へ本文を入れて送る。返るのは、送信の応答を手元で確定させる関数。 */
async function send(body: string): Promise<void> {
  const user = userEvent.setup();

  await user.type(screen.getByLabelText("お問い合わせ内容"), body);
  await user.click(screen.getByRole("button", { name: "送信" }));
}

/** 送信欄が次の 1 通へ載せる冪等キー。 */
function idempotencyKeyOf(container: HTMLElement): string {
  return container.querySelector<HTMLInputElement>('input[name="idempotencyKey"]')?.value ?? "";
}

describe("InquiryConversation", () => {
  // ----- 受信しているとき -----
  it("取得した正本を並べる", () => {
    render(<InquiryConversation history={HISTORY} />);

    expect(screen.getByText(HISTORY.messages[0]?.body ?? "")).toBeVisible();
  });

  it("受信の状態を出す", () => {
    render(<InquiryConversation history={HISTORY} />);

    expect(screen.getByRole("status")).toHaveAttribute("data-status", "receiving");
  });

  it("取得が返した位置から購読する", () => {
    render(<InquiryConversation history={HISTORY} />);

    expect(lastOptions().initialCursor).toBe("4");
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

  it("取り直した正本の位置が変わらなくても、購読を再開する", () => {
    const { rerender } = render(<InquiryConversation history={HISTORY} />);

    act(() => lastOptions().onResync());
    rerender(<InquiryConversation history={{ ...HISTORY }} />);

    expect(resume).toHaveBeenCalledWith(String(HISTORY.streamCursor));
  });

  it("求めていない取り直しでは、位置が同じまま購読を張り直さない", () => {
    const { rerender } = render(<InquiryConversation history={HISTORY} />);

    rerender(<InquiryConversation history={{ ...HISTORY }} />);

    expect(resume).not.toHaveBeenCalled();
  });

  it("最初の描画では購読を張り直さない", () => {
    render(<InquiryConversation history={HISTORY} />);

    expect(resume).not.toHaveBeenCalled();
  });

  // ----- まだ 1 通も無いとき -----
  it("まだ 1 通も無いときは、案内を出す", () => {
    render(<InquiryConversation history={EMPTY_HISTORY} />);

    expect(screen.getByText(/まだやり取りはありません/)).toBeVisible();
  });

  it("まだ問い合わせが無ければ購読しない", () => {
    render(<InquiryConversation history={EMPTY_HISTORY} />);

    expect(lastOptions().enabled).toBe(false);
  });

  it("まだ問い合わせが無ければ、受信の状態は待機として出る", () => {
    render(<InquiryConversation history={EMPTY_HISTORY} />);

    expect(screen.getByRole("status")).toHaveAttribute("data-status", "suspended");
  });

  // ----- 回線が切れているとき -----
  it("回線が切れていれば、購読の状態より先に伝える", () => {
    useOnlineStatus.mockReturnValue(false);
    render(<InquiryConversation history={HISTORY} />);

    expect(screen.getByRole("status")).toHaveAttribute("data-status", "offline");
  });

  // ----- 送っているとき -----
  it("応答を待つあいだ、送った本文を仮に並べる", async () => {
    const settle: { resolve: (() => void) | null } = { resolve: null };

    sendInquiryMessageAction.mockImplementation(
      async () =>
        new Promise((resolve) => {
          settle.resolve = () => {
            resolve(succeededActionState(undefined));
          };
        }),
    );
    render(<InquiryConversation history={EMPTY_HISTORY} />);
    await send("在庫はいつ戻りますか。");

    try {
      // 送信欄の中身ではなく、やり取りの器へ載っていることを見る。
      expect(
        within(screen.getByLabelText("サポートとのやり取り")).getByText("在庫はいつ戻りますか。"),
      ).toBeVisible();
    } finally {
      // 応答を待たせたままにすると、次のファイルのテストへ遷移が残る。
      await act(async () => {
        settle.resolve?.();
      });
    }
  });

  // ----- 送り終えたとき -----
  it("送信が成立したら、次の 1 通は別の鍵で飛ばす", async () => {
    sendInquiryMessageAction.mockResolvedValue(succeededActionState(undefined));

    const { container } = render(<InquiryConversation history={EMPTY_HISTORY} />);
    const before = idempotencyKeyOf(container);

    await send("在庫はいつ戻りますか。");

    expect(idempotencyKeyOf(container)).not.toBe(before);
  });

  it("送信が通らなかったら、同じ鍵のまま送り直させる", async () => {
    sendInquiryMessageAction.mockResolvedValue(failedActionState({ formError: "送れません" }));

    const { container } = render(<InquiryConversation history={EMPTY_HISTORY} />);
    const before = idempotencyKeyOf(container);

    await send("在庫はいつ戻りますか。");

    expect(idempotencyKeyOf(container)).toBe(before);
  });

  // ----- 送れなかったとき -----
  it("項目に紐づかない失敗を、送信欄の隣で知らせる", async () => {
    sendInquiryMessageAction.mockResolvedValue(
      failedActionState({ formError: "しばらくしてからお試しください。" }),
    );
    render(<InquiryConversation history={EMPTY_HISTORY} />);
    await send("在庫はいつ戻りますか。");

    expect(await screen.findByText("送信できませんでした")).toBeVisible();
    expect(screen.getByText("しばらくしてからお試しください。")).toBeVisible();
  });

  it("項目のエラーだけの失敗では、送信欄の隣に知らせを出さない", async () => {
    sendInquiryMessageAction.mockResolvedValue(
      failedActionState({ fieldErrors: { body: ["本文を入力してください。"] } }),
    );
    render(<InquiryConversation history={EMPTY_HISTORY} />);
    await send("在庫はいつ戻りますか。");

    expect(await screen.findByText("本文を入力してください。")).toBeVisible();
    expect(screen.queryByText("送信できませんでした")).not.toBeInTheDocument();
  });

  it("a11y 自動検査に違反しない", async () => {
    const { container } = render(<InquiryConversation history={HISTORY} />);

    expect((await axe(container)).violations).toEqual([]);
  });
});
