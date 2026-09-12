/**
 * queue へ積まれた解析が終わるのを待つ、その 1 回ぶんの判断。
 *
 * @remarks
 * 所見もゲートも、queue の entry が SUCCESS を名乗ってからでないと読めません。**待ちに上限が
 * 要るのは、いつまでも捌けない queue が「所見の無い走査」と見分けが付かないから**です。上限は
 * 呼び出し側（[`index.ts`](index.ts)）が持ちます。
 */

import { fieldOf, textOf } from "./payload.js";

/** queue の entry。 */
export type CeTask = {
  /** entry が名乗る状態。読めなければ `UNKNOWN`。 */
  readonly status: string;
  /** 解析の id。まだ付いていなければ空。 */
  readonly analysisId: string;
};

/** 1 回問い合わせた結果、次に何をするか。 */
export type PollOutcome =
  | {
      /** 解析が終わった。所見とゲートを読みに進む。 */
      readonly kind: "completed";
      /** 読みに行く先の解析。空のことがあり、その扱いは呼び出し側が決める。 */
      readonly analysisId: string;
    }
  | {
      /** 解析が終わり切ったが、結果を持たない。 */
      readonly kind: "failed";
      /** 終わり方。人が読む。 */
      readonly status: string;
    }
  | {
      /** まだ終わっていない。もう一度問い合わせる。 */
      readonly kind: "pending";
    };

const SUCCEEDED = "SUCCESS";

/** 結果を持たずに終わり切った状態。 */
const SETTLED_WITHOUT_RESULT: ReadonlySet<string> = new Set(["FAILED", "CANCELED"]);

/**
 * `/api/ce/task` の応答から entry を読む。
 *
 * @remarks
 * 状態が読めないことと、状態が「処理中」であることを同じ `UNKNOWN` へ寄せています。どちらも
 * 「まだ読みに行けない」で、区別できたとしても次の一手は変わりません。
 */
export function readCeTask(payload: unknown): CeTask {
  const task = fieldOf(payload, "task");

  return {
    status: textOf(fieldOf(task, "status"), "UNKNOWN"),
    analysisId: textOf(fieldOf(task, "analysisId"), ""),
  };
}

/**
 * entry を見て、進むか・落とすか・待つかを決める。
 *
 * @remarks
 * **知らない状態は待ちです。** queue の状態語は増えうるので、知らない語を失敗として扱うと、
 * 処理中を表す語が 1 つ増えただけで走査が落ちます。落ち切らない側の取りこぼしは、呼び出し側の
 * 上限が拾います。
 */
export function nextPollOutcome(task: CeTask): PollOutcome {
  if (task.status === SUCCEEDED) {
    return { kind: "completed", analysisId: task.analysisId };
  }

  if (SETTLED_WITHOUT_RESULT.has(task.status)) {
    return { kind: "failed", status: task.status };
  }

  return { kind: "pending" };
}
