import { describe, expect, it } from "vitest";

import { STREAM_STOP_REASON } from "@/adapters/client/stream/subscription";
import { CONNECTION_STATUS } from "@/components/app-starter/connection-status/connection-status.definition";

import { toFeedConnectionStatus } from "./connection-status";

describe("toFeedConnectionStatus", () => {
  it("受け取れている状態を伝える", () => {
    expect(toFeedConnectionStatus({ kind: "open" }, true)).toBe(CONNECTION_STATUS.RECEIVING);
  });

  it("繋ぎにいっている状態を伝える", () => {
    expect(toFeedConnectionStatus({ kind: "connecting" }, true)).toBe(CONNECTION_STATUS.CONNECTING);
  });

  it("張り直している状態を伝える", () => {
    expect(toFeedConnectionStatus({ kind: "reconnecting" }, true)).toBe(
      CONNECTION_STATUS.RECONNECTING,
    );
  });

  it("回線が無いことを、購読の状態より先に伝える", () => {
    expect(toFeedConnectionStatus({ kind: "open" }, false)).toBe(CONNECTION_STATUS.OFFLINE);
  });

  it("session が切れた打ち切りを、入り直せる状態として伝える", () => {
    const state = { kind: "stopped", reason: STREAM_STOP_REASON.unauthenticated } as const;

    expect(toFeedConnectionStatus(state, true)).toBe(CONNECTION_STATUS.EXPIRED);
  });

  it("それ以外の打ち切りを、停止として伝える", () => {
    const state = { kind: "stopped", reason: STREAM_STOP_REASON.server } as const;

    expect(toFeedConnectionStatus(state, true)).toBe(CONNECTION_STATUS.HALTED);
  });
});
