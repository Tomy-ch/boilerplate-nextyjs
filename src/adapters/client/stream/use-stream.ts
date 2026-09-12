"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { $ZodType } from "zod/v4/core";

import type { StreamCursor } from "./cursor";
import { openStream, type StreamState, type StreamSubscription } from "./subscription";

/** 購読を開く前の状態。接続はまだ始まっていない。 */
const INITIAL_STATE: StreamState = { kind: "connecting" };

/** {@link useStream} の指定。 */
export type UseStreamOptions<T> = {
  readonly ticketPath: string;
  /**
   * 購読を始める位置。
   *
   * @remarks
   * **最初に開くときだけ読みます。** 以降の開始位置は購読が持ち、正本を取り直したときだけ
   * {@link UseStreamResult.resume} で差し替えます。描画のたびに読み直すと、同じ位置から
   * 張り直す購読が再描画のたびに生まれます。
   *
   * **`null` は「発券が束ねた位置から」です。** 正本が購読の位置を返さない口で使います。
   */
  readonly initialCursor: StreamCursor | null;
  readonly schema: $ZodType<T>;
  /** 整列済みの event を受け取る。最新の関数がそのまま呼ばれる。 */
  readonly onEvents: (events: readonly T[]) => void;
  /**
   * 正本を取り直す。取り直した位置を {@link UseStreamResult.resume} へ渡す。
   *
   * @remarks
   * **{@link UseStreamOptions.initialCursor} が `null` の購読では渡す位置がありません。**
   * 取り直しを合図した購読は、そのまま発券が束ねた位置から張り直します。
   */
  readonly onResync: () => void;
  /** 購読する条件が揃っているか。揃うまで接続しない。 */
  readonly enabled?: boolean;
};

/** {@link useStream} が返すもの。 */
export type UseStreamResult = {
  /** 画面へ出す購読の状態。 */
  readonly state: StreamState;
  /** 正本を取り直した位置で購読を再開する。 */
  readonly resume: (cursor: StreamCursor) => void;
};

/**
 * 購読を component の寿命へ束ねる。
 *
 * @remarks
 * 購読そのものの組み立ては持ちません。ここが持つのは、画面を離れたときに閉じることと、
 * 受け取り手が描画のたびに変わっても購読を張り直さないことだけです。
 *
 * **event の畳み込みは呼び出し側が持ちます。** どの event で何がどう変わるかは画面の判断で、
 * 購読の側には現れません。
 */
export function useStream<T>({
  ticketPath,
  initialCursor,
  schema,
  onEvents,
  onResync,
  enabled = true,
}: UseStreamOptions<T>): UseStreamResult {
  const [state, setState] = useState<StreamState>(INITIAL_STATE);
  const cursor = useRef(initialCursor);
  const subscription = useRef<StreamSubscription | null>(null);
  const receivers = useRef({ onEvents, onResync });

  useEffect(() => {
    receivers.current = { onEvents, onResync };
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const opened = openStream({
      ticketPath,
      cursor: cursor.current,
      schema,
      onEvents: (events) => {
        receivers.current.onEvents(events);
      },
      onState: setState,
      onResync: () => {
        receivers.current.onResync();
      },
    });

    subscription.current = opened;

    return () => {
      opened.close();
      subscription.current = null;
    };
  }, [ticketPath, schema, enabled]);

  const resume = useCallback((next: StreamCursor) => {
    cursor.current = next;
    subscription.current?.resume(next);
  }, []);

  return { state, resume };
}
