"use client";

import { useParams, usePathname } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";
import { useCallback, useEffect, useRef } from "react";

import { reportClientError, reportWebVital } from "@/adapters/client/telemetry/report-telemetry";
import { toRoutePattern } from "@/adapters/client/telemetry/route-pattern";

/**
 * 1 回のページ読み込みで中継へ送る例外の上限。
 *
 * @remarks
 * 描画が投げ続ける壊れ方では、同じ例外が毎フレーム上がります。最初の数件で発生源は分かるので、
 * それ以降は送りません。上限に意味があるのは送る側だけで、受け口の防御は別に持ちます。
 */
const MAX_ERROR_REPORTS = 8;

/**
 * ブラウザ側のシグナルを中継へ送り出す計装。
 *
 * @remarks
 * root layout が一度だけ mount します。描画するものを持たないので、器の見た目には現れません。
 *
 * **計装は mount した後に、動的な import で読み込みます**（理由は `startBrowserTracing`）。
 *
 * **Web Vitals はページ読み込みに紐づけます。** LCP / FCP / TTFB はその読み込みの計測であり、
 * CLS / INP は読み込みから離脱までの累積です。client の遷移で route が変わっても測定は続くため、
 * 報告時点の route ではなく**読み込みが始まった route** を載せます。例外は起きた時点の route を
 * 載せます。
 *
 * 送信そのものは `adapters/client` が持ちます。
 *
 * @param traceparent - この画面を組んだ要求の trace。器がサーバ側で取り出して渡す。例外の記録を
 *   その要求へ紐づけるために送り返す。静的生成された画面では渡らない
 */
export function Telemetry({ traceparent }: Readonly<{ traceparent?: string }>): null {
  const route = toRoutePattern(usePathname(), useParams());
  const loadRoute = useRef(route);
  const currentRoute = useRef(route);

  useEffect(() => {
    currentRoute.current = route;
  }, [route]);

  useReportWebVitals(
    useCallback((metric) => {
      reportWebVital(metric, loadRoute.current);
    }, []),
  );

  useEffect(() => {
    void import("@/adapters/client/telemetry/browser-tracer").then((tracing) => {
      tracing.startBrowserTracing(traceparent);
    });
  }, [traceparent]);

  useEffect(() => {
    let remaining = MAX_ERROR_REPORTS;

    const report = (thrown: unknown): void => {
      if (remaining > 0) {
        remaining -= 1;
        reportClientError(thrown, currentRoute.current, traceparent);
      }
    };

    const onError = (event: ErrorEvent): void => {
      report(event.error ?? event.message);
    };
    const onRejection = (event: PromiseRejectionEvent): void => {
      report(event.reason);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [traceparent]);

  return null;
}
