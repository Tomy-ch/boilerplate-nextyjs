import type { StreamState } from "@/adapters/client/stream/subscription";
import { STREAM_STOP_REASON } from "@/adapters/client/stream/subscription";
import {
  CONNECTION_STATUS,
  type ConnectionStatusValue,
} from "@/components/app-starter/connection-status/connection-status.definition";

/** 購読の状態を読むときの、画面の側の事情。 */
export type ConnectionContext = {
  /** 回線が繋がっているか。 */
  readonly online: boolean;
  /** 購読する対象があるか。最初の 1 通を送るまでは無い。 */
  readonly subscribing: boolean;
};

/**
 * 購読の状態を、画面へ出す 1 語へ写す。
 *
 * @remarks
 * **回線の有無を先に見ます。** 回線が切れているときの購読は必ず張り直しの途中にあり、そこで
 * 「再接続中」とだけ出すと、直すべき相手が backend に見えます。
 *
 * 購読していない間を「接続中」と言いません。繋ぎにいっていないものを繋ぎにいっていると言うと、
 * 待っていれば繋がるように読めます。
 */
export function toConnectionStatus(
  state: StreamState,
  { online, subscribing }: ConnectionContext,
): ConnectionStatusValue {
  if (!subscribing) {
    return CONNECTION_STATUS.SUSPENDED;
  }

  if (!online) {
    return CONNECTION_STATUS.OFFLINE;
  }

  if (state.kind === "stopped") {
    if (state.reason === STREAM_STOP_REASON.unauthenticated) {
      return CONNECTION_STATUS.EXPIRED;
    }

    return state.reason === STREAM_STOP_REASON.absent
      ? CONNECTION_STATUS.SUSPENDED
      : CONNECTION_STATUS.HALTED;
  }

  if (state.kind === "open") {
    return CONNECTION_STATUS.RECEIVING;
  }

  return state.kind === "connecting"
    ? CONNECTION_STATUS.CONNECTING
    : CONNECTION_STATUS.RECONNECTING;
}
