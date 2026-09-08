import "server-only";

import {
  context,
  isSpanContextValid,
  ROOT_CONTEXT,
  type SpanContext,
  TraceFlags,
  trace,
} from "@opentelemetry/api";

/** OTel から抽出した trace 相関情報です。 */
export type ActiveTraceContext = Readonly<{
  traceId: string;
  spanId: string;
}>;

/** W3C Trace Context の `traceparent` ヘッダ形式。version は `00` で固定されている。 */
const TRACEPARENT = /^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/;

/** 現在アクティブな span から、ログ相関に使う識別子を抽出する。 */
export function extractActiveTraceContext(): ActiveTraceContext | undefined {
  const spanContext = findActiveSpanContext();

  if (spanContext === undefined) {
    return undefined;
  }

  return { traceId: spanContext.traceId, spanId: spanContext.spanId };
}

/**
 * 現在アクティブな span を W3C の `traceparent` として書き出す。
 *
 * @remarks
 * ブラウザへ渡す形です。なぜサーバから配る必要があるのかは、[README](./README.md) の
 * 「ブラウザ側のシグナル」が持ちます。
 *
 * @returns アクティブな span が無い実行（静的生成・テスト）では `undefined`
 */
export function findActiveTraceparent(): string | undefined {
  const spanContext = findActiveSpanContext();

  if (spanContext === undefined) {
    return undefined;
  }

  const flags = spanContext.traceFlags.toString(16).padStart(2, "0");

  return `00-${spanContext.traceId}-${spanContext.spanId}-${flags}`;
}

/**
 * ブラウザが返してきた `traceparent` の文脈で処理を行う。
 *
 * @remarks
 * **読めない値では文脈を空にします。** そのまま呼ぶと記録は中継要求の span へ紐づき、因果の無い
 * ところに親子が生まれます（同層の README「ブラウザ側のシグナル」）。相関できないなら、間違った
 * 相関よりも何も無いほうが読み違えを生みません。
 *
 * **値の真正性は確かめられません。** 送ってくるのはブラウザなので、書式が通ることだけを見ます。
 *
 * @param traceparent - 報告に載って戻ってきた W3C Trace Context
 * @param run - その文脈で行う記録
 */
export function withRemoteTraceContext(traceparent: string | undefined, run: () => void): void {
  const spanContext = traceparent === undefined ? undefined : toSpanContext(traceparent);
  const remote =
    spanContext === undefined
      ? ROOT_CONTEXT
      : trace.setSpanContext(ROOT_CONTEXT, { ...spanContext, isRemote: true });

  context.with(remote, run);
}

/** アクティブな span の識別子。無効なものは無いものとして扱う。 */
function findActiveSpanContext(): SpanContext | undefined {
  const spanContext = trace.getActiveSpan()?.spanContext();

  return spanContext !== undefined && isSpanContextValid(spanContext) ? spanContext : undefined;
}

/** `traceparent` を span の識別子へ読み替える。形が違う値と全 0 の識別子は受け付けない。 */
function toSpanContext(traceparent: string): SpanContext | undefined {
  if (!TRACEPARENT.test(traceparent)) {
    return undefined;
  }

  // 書式を確かめた後は、各項目が固定長で並ぶことが保証されるので位置で切り出せる。
  const spanContext: SpanContext = {
    traceId: traceparent.slice(3, 35),
    spanId: traceparent.slice(36, 52),
    traceFlags: Number.parseInt(traceparent.slice(53, 55), 16) & TraceFlags.SAMPLED,
  };

  return isSpanContextValid(spanContext) ? spanContext : undefined;
}
