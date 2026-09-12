import * as z from "zod/mini";

import { streamCursorSchema } from "./cursor";

/**
 * 配送される event の封筒。
 *
 * @remarks
 * **本文（`payload`）の形はここで決めません。** 封筒は feature に依らず同じで、中身の形は
 * event の種別ごとに呼び出し側が宣言します（{@link openStream} の `schema`）。ここが確かめるのは
 * 「封筒として読めるか」までです。
 */
const streamEnvelopeSchema = z.object({
  eventId: z.string(),
  streamId: z.string(),
  sequence: streamCursorSchema,
  type: z.string(),
  occurredAt: z.string(),
  schemaVersion: z.number(),
  payload: z.unknown(),
});

/** 封筒として読めた event 1 件。 */
export type StreamEnvelope = z.infer<typeof streamEnvelopeSchema>;

/** サーバが client へ指示する動作。 */
export const CONTROL_ACTION = {
  /** 通常の再接続。 */
  reconnect: "RECONNECT",
  /** 指定された時間を置いてからの再接続。 */
  retryLater: "RETRY_LATER",
  /** ticket を取り直してからの再接続。 */
  reauthenticate: "REAUTHENTICATE",
  /** 正本を取り直してからの再接続。 */
  resync: "RESYNC",
  /** 再接続しない。 */
  stop: "STOP",
} as const;

/**
 * レスポンスが確定した後に届く制御指示。
 *
 * @remarks
 * **分岐に使うのは `action` だけです。** `reason` は記録のための安定した値で、同じ `action` に
 * 対して理由が増えても client の振る舞いは変わりません。理由で分岐すると、増えた理由を
 * 知らない client が既定の枝へ落ち、どちらへ倒れるかが宣言から読めなくなります。
 */
const controlEventSchema = z.object({
  action: z.enum([
    CONTROL_ACTION.reconnect,
    CONTROL_ACTION.retryLater,
    CONTROL_ACTION.reauthenticate,
    CONTROL_ACTION.resync,
    CONTROL_ACTION.stop,
  ]),
  reason: z.string(),
  retryAfterMs: z.optional(z.number()),
});

/** 制御指示 1 件。 */
export type ControlEvent = z.infer<typeof controlEventSchema>;

/** 受け取った文字列を封筒として読む。読めなければ `null`。 */
export function parseEnvelope(data: string): StreamEnvelope | null {
  const parsed = streamEnvelopeSchema.safeParse(toJson(data));

  return parsed.success ? parsed.data : null;
}

/** 受け取った文字列を制御指示として読む。読めなければ `null`。 */
export function parseControl(data: string): ControlEvent | null {
  const parsed = controlEventSchema.safeParse(toJson(data));

  return parsed.success ? parsed.data : null;
}

/**
 * 受け取った文字列を JSON として読む。
 *
 * @remarks
 * 読めない文字列は検証で落ちる値として返します。例外を投げないのは、1 件の壊れた event で
 * 購読そのものを止めないためです。
 */
function toJson(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}
