import * as z from "zod/mini";

/**
 * stream 内の位置。
 *
 * @remarks
 * **10 進の文字列として持ちます。** 契約が許す桁数は JavaScript の整数が正確に表せる範囲を
 * 超えるため、数値へ直すと大きい位置で隣の値と区別が付かなくなります。比較は
 * {@link isAfterCursor} が `BigInt` で行います。
 */
export const streamCursorSchema = z.string().check(z.regex(/^(0|[1-9][0-9]{0,18})$/));

/** 購読の開始位置と、届いた event の位置。 */
export type StreamCursor = z.infer<typeof streamCursorSchema>;

/** stream の先頭。まだ 1 件も受け取っていない購読はここから始まる。 */
export const STREAM_ORIGIN: StreamCursor = "0";

/**
 * 履歴の応答が返した位置を、購読の開始位置として確定させる。
 *
 * @remarks
 * 契約は履歴の側の位置を整数で返し、stream の側を文字列で扱います。両方が同じ位置を指すため、
 * 綴りの違いはこの 1 か所で吸収します。
 */
export function toStreamCursor(value: number): StreamCursor {
  return streamCursorSchema.parse(String(value));
}

/** `candidate` が `baseline` より後ろの位置かどうか。 */
export function isAfterCursor(candidate: StreamCursor, baseline: StreamCursor): boolean {
  return BigInt(candidate) > BigInt(baseline);
}
