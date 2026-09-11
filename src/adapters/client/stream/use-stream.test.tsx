// @vitest-environment jsdom

import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as z from "zod/mini";

import type { OpenStreamOptions, StreamState } from "./subscription";

const { openStream, close, resume } = vi.hoisted(() => ({
  openStream: vi.fn(),
  close: vi.fn(),
  resume: vi.fn(),
}));

vi.mock("./subscription", () => ({ openStream }));

import { toStreamCursor } from "./cursor";
import { useStream } from "./use-stream";

const schema = z.object({ type: z.literal("message.created") });

type Event = z.infer<typeof schema>;

let opened: OpenStreamOptions<Event> | undefined;

function Probe({
  enabled = true,
  cursor = 3,
  onEvents = () => undefined,
}: {
  enabled?: boolean;
  cursor?: number;
  onEvents?: (events: readonly Event[]) => void;
}) {
  const { state, resume: resumeAt } = useStream<Event>({
    ticketPath: "/api/inquiries/me/stream-ticket",
    initialCursor: toStreamCursor(cursor),
    schema,
    onEvents,
    onResync: () => undefined,
    enabled,
  });

  return (
    <button onClick={() => resumeAt(toStreamCursor(9))} type="button">
      {state.kind}
    </button>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  opened = undefined;
  openStream.mockImplementation((options: OpenStreamOptions<Event>) => {
    opened = options;

    return { close, resume };
  });
});

describe("useStream", () => {
  // ----- 購読の寿命 -----
  it("開始位置を渡して購読を開く", () => {
    render(<Probe cursor={5} />);

    expect(opened?.cursor).toBe("5");
  });

  it("購読する条件が揃うまで開かない", () => {
    render(<Probe enabled={false} />);

    expect(openStream).not.toHaveBeenCalled();
  });

  it("描画し直しても購読を張り直さない", () => {
    const { rerender } = render(<Probe onEvents={() => undefined} />);

    rerender(<Probe onEvents={() => undefined} />);

    expect(openStream).toHaveBeenCalledTimes(1);
  });

  it("画面を離れたら閉じる", () => {
    render(<Probe />).unmount();

    expect(close).toHaveBeenCalledOnce();
  });

  // ----- 受け渡し -----
  it("最新の受け取り手へ流す", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<Probe onEvents={first} />);

    rerender(<Probe onEvents={second} />);
    act(() => opened?.onEvents([{ type: "message.created" }]));

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });

  it("購読の状態を画面へ返す", () => {
    render(<Probe />);

    act(() => opened?.onState({ kind: "open" } satisfies StreamState));

    expect(screen.getByRole("button")).toHaveTextContent("open");
  });

  it("開く前は繋ぎにいっている状態を返す", () => {
    render(<Probe />);

    expect(screen.getByRole("button")).toHaveTextContent("connecting");
  });

  it("取り直した位置を購読へ渡す", () => {
    render(<Probe />);

    act(() => screen.getByRole("button").click());

    expect(resume).toHaveBeenCalledWith("9");
  });
});
