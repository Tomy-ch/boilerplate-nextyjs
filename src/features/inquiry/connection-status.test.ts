import { describe, expect, it } from "vitest";

import { STREAM_STOP_REASON } from "@/adapters/client/stream/subscription";
import { CONNECTION_STATUS } from "@/components/app-starter/connection-status/connection-status.definition";

import { toConnectionStatus } from "./connection-status";

const ONLINE = { online: true, subscribing: true };

describe("toConnectionStatus", () => {
  it("繋ぎにいっている状態を伝える", () => {
    expect(toConnectionStatus({ kind: "connecting" }, ONLINE)).toBe(CONNECTION_STATUS.CONNECTING);
  });

  it("受け取れている状態を伝える", () => {
    expect(toConnectionStatus({ kind: "open" }, ONLINE)).toBe(CONNECTION_STATUS.RECEIVING);
  });

  it("張り直している状態を伝える", () => {
    expect(toConnectionStatus({ kind: "reconnecting" }, ONLINE)).toBe(
      CONNECTION_STATUS.RECONNECTING,
    );
  });

  it("回線が無いことを、購読の状態より先に伝える", () => {
    expect(toConnectionStatus({ kind: "open" }, { ...ONLINE, online: false })).toBe(
      CONNECTION_STATUS.OFFLINE,
    );
  });

  it("購読していない間を、接続中と言わない", () => {
    expect(toConnectionStatus({ kind: "connecting" }, { ...ONLINE, subscribing: false })).toBe(
      CONNECTION_STATUS.SUSPENDED,
    );
  });

  it("購読していない間は、回線の有無より先に伝える", () => {
    expect(
      toConnectionStatus({ kind: "connecting" }, { online: false, subscribing: false }),
    ).toBe(CONNECTION_STATUS.SUSPENDED);
  });

  it("session が切れた打ち切りを、入り直せる状態として伝える", () => {
    const state = { kind: "stopped", reason: STREAM_STOP_REASON.unauthenticated } as const;

    expect(toConnectionStatus(state, ONLINE)).toBe(CONNECTION_STATUS.EXPIRED);
  });

  it("購読する対象が無い打ち切りを、待機として伝える", () => {
    const state = { kind: "stopped", reason: STREAM_STOP_REASON.absent } as const;

    expect(toConnectionStatus(state, ONLINE)).toBe(CONNECTION_STATUS.SUSPENDED);
  });

  it("権限を失った打ち切りを、停止として伝える", () => {
    const state = { kind: "stopped", reason: STREAM_STOP_REASON.permissionDenied } as const;

    expect(toConnectionStatus(state, ONLINE)).toBe(CONNECTION_STATUS.HALTED);
  });

  it("サーバからの打ち切りを、停止として伝える", () => {
    const state = { kind: "stopped", reason: STREAM_STOP_REASON.server } as const;

    expect(toConnectionStatus(state, ONLINE)).toBe(CONNECTION_STATUS.HALTED);
  });
});
