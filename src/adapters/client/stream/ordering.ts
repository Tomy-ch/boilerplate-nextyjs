import { isAfterCursor, type StreamCursor } from "./cursor";
import type { StreamEnvelope } from "./envelope";

/**
 * 受け取った event を窓へ入れた結果。
 *
 * @remarks
 * `late` は「窓を越えて遅れた」と「一度流したものがもう一度届いた」の両方を指します。
 * **区別しません** —— 届いた時点の情報では見分けられず、どちらも同じ扱い（捨てて正本を
 * 取り直す）で整合するためです。
 */
export const ADMIT_RESULT = {
  /** 窓へ入れた。次の整列で上へ流れる。 */
  accepted: "accepted",
  /** 既に上へ流した位置。捨てて正本を取り直す。 */
  late: "late",
} as const;

/** {@link OrderingWindow.admit} の結果。 */
type AdmitResult = (typeof ADMIT_RESULT)[keyof typeof ADMIT_RESULT];

/**
 * 到達順の乱れを直す窓。
 *
 * @remarks
 * **「穴が埋まるまで待つ」ことはしません。** 歯抜けは正常なので、待ち続ける条件が成立しません。
 * この窓があるのは、同時に届いたものの順序を直すためだけです。
 */
export type OrderingWindow = {
  /** event を窓へ入れる。 */
  readonly admit: (envelope: StreamEnvelope) => AdmitResult;
  /** 窓を閉じ、位置の昇順に並べて返す。同じ位置は 1 件に畳む。 */
  readonly drain: () => readonly StreamEnvelope[];
  /** 上へ流した最大の位置。次に張り直すときの開始位置になる。 */
  readonly cursor: () => StreamCursor;
  /** 正本を取り直した後の位置で仕切り直す。窓に残っていたものは捨てる。 */
  readonly resume: (cursor: StreamCursor) => void;
  /** 窓に何か入っているか。 */
  readonly pending: () => boolean;
};

/**
 * 整列の窓を作る。
 *
 * @param initialCursor - 購読を始める位置。正本の取得が返した位置をそのまま渡す
 */
export function createOrderingWindow(initialCursor: StreamCursor): OrderingWindow {
  let cursor = initialCursor;
  let buffered = new Map<StreamCursor, StreamEnvelope>();

  return {
    admit(envelope) {
      if (!isAfterCursor(envelope.sequence, cursor)) {
        return ADMIT_RESULT.late;
      }

      buffered.set(envelope.sequence, envelope);

      return ADMIT_RESULT.accepted;
    },
    drain() {
      const ordered = [...buffered.values()].sort((left, right) =>
        isAfterCursor(left.sequence, right.sequence) ? 1 : -1,
      );

      buffered = new Map();

      const last = ordered.at(-1);

      if (last !== undefined) {
        cursor = last.sequence;
      }

      return ordered;
    },
    cursor() {
      return cursor;
    },
    resume(next) {
      buffered = new Map();
      cursor = next;
    },
    pending() {
      return buffered.size > 0;
    },
  };
}
