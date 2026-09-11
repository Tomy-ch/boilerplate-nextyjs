import type { StreamState } from "@/adapters/client/stream/subscription";
import { STREAM_STOP_REASON } from "@/adapters/client/stream/subscription";
import {
  CONNECTION_STATUS,
  type ConnectionStatusValue,
} from "@/components/app-starter/connection-status/connection-status.definition";

/**
 * 更新フィードの状態を、画面へ出す 1 語へ写す。
 *
 * @remarks
 * 回線の有無を先に見る理由は、利用者側の問い合わせ画面と同じです。**同じ写しを共有していないのは、
 * 画面の slice どうしが互いを参照しないため**で、運営側と利用者側では出す語も違います —— こちらは
 * 受け取る対象が常にあり、「待機中」へ落ちる経路がありません。
 */
export function toFeedConnectionStatus(state: StreamState, online: boolean): ConnectionStatusValue {
  if (!online) {
    return CONNECTION_STATUS.OFFLINE;
  }

  if (state.kind === "stopped") {
    return state.reason === STREAM_STOP_REASON.unauthenticated
      ? CONNECTION_STATUS.EXPIRED
      : CONNECTION_STATUS.HALTED;
  }

  if (state.kind === "open") {
    return CONNECTION_STATUS.RECEIVING;
  }

  return state.kind === "connecting"
    ? CONNECTION_STATUS.CONNECTING
    : CONNECTION_STATUS.RECONNECTING;
}
