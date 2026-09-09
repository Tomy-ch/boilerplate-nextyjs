import "server-only";

import { type Span, SpanStatusCode, trace } from "@opentelemetry/api";
import { unstable_rethrow } from "next/navigation";

import type { RenderSpanRunner } from "./render-span";

const tracer = trace.getTracer("render");

/**
 * 描画を span の中で実行する。
 *
 * @remarks
 * span が覆うのはこの実行だけです。子は戻り値を React が受け取った後に描画されるため中に入らず、
 * 本体で待つ取得だけが中に入ります。
 *
 * この実装を feature へ直接持たせません。起動境界が {@link RenderSpanRunner} としてここを注入します。
 */
export const runRenderSpan: RenderSpanRunner = (name, render) =>
  tracer.startActiveSpan(`render ${name}`, (span) => {
    try {
      const result = render();

      if (result instanceof Promise) {
        // 派生した promise ではなく元を返す。React が待つ対象を差し替えない。
        result.then(
          () => span.end(),
          (error: unknown) => endWithFailure(span, error),
        );

        return result;
      }

      span.end();

      return result;
    } catch (error) {
      endWithFailure(span, error);

      throw error;
    }
  });

/** 失敗として span を閉じる。ただし Next が制御に使う throw は失敗として記録しない。 */
function endWithFailure(span: Span, error: unknown): void {
  if (!isNavigationSignal(error)) {
    span.setStatus({ code: SpanStatusCode.ERROR });

    if (error instanceof Error) {
      span.recordException(error);
    }
  }

  span.end();
}

/**
 * Next が制御に使う throw（`notFound` / `redirect` など）か。
 *
 * @remarks
 * 判定を digest の中身から読み取らず `unstable_rethrow` に委ねます。対象は framework の内部表現で、
 * 版が変われば形も変わります。
 */
function isNavigationSignal(error: unknown): boolean {
  try {
    unstable_rethrow(error);

    return false;
  } catch {
    return true;
  }
}
