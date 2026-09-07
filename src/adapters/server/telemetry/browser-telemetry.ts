import "server-only";

import {
  ATTR_EXCEPTION_MESSAGE,
  ATTR_EXCEPTION_STACKTRACE,
  ATTR_EXCEPTION_TYPE,
  ATTR_HTTP_ROUTE,
} from "@opentelemetry/semantic-conventions";
import { z } from "zod";

import {
  MAX_ERROR_MESSAGE_LENGTH,
  MAX_ERROR_NAME_LENGTH,
  MAX_ERROR_STACK_LENGTH,
  MAX_ROUTE_LENGTH,
  type TelemetryReport,
} from "@/adapters/http/telemetry-report";
import { getLogger, reportQuietly } from "@/logging/logging.server";
import { withRemoteTraceContext } from "@/observability/trace-context.server";
import { recordWebVital } from "@/observability/web-vital-metric.server";

/**
 * 中継が 1 回で受け取る本体に許すバイト数。
 *
 * @remarks
 * 契約が許す最大の報告——stack 2,000 + 文言 300 + 分類名 100 + route 200 文字——を UTF-8 の JSON へ
 * 直した大きさから置いています。1 文字は最悪 6 バイト（制御文字の `\uXXXX` 化）まで膨らむので、
 * 約 15.7 KB が上限になります。超過分を読む前に落とす仕組みは `readJsonBody` が持ちます。
 */
export const MAX_TELEMETRY_REPORT_BYTES = 16 * 1024;

const Report: z.ZodType<TelemetryReport> = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("web-vital"),
    route: z.string().max(MAX_ROUTE_LENGTH),
    name: z.enum(["LCP", "INP", "CLS", "FCP", "TTFB", "FID"]),
    value: z.number().finite().nonnegative(),
    rating: z.enum(["good", "needs-improvement", "poor"]),
    navigationType: z.enum([
      "navigate",
      "reload",
      "back-forward",
      "back-forward-cache",
      "prerender",
      "restore",
    ]),
  }),
  z.object({
    kind: z.literal("error"),
    route: z.string().max(MAX_ROUTE_LENGTH),
    name: z.string().max(MAX_ERROR_NAME_LENGTH),
    message: z.string().max(MAX_ERROR_MESSAGE_LENGTH),
    stack: z.string().max(MAX_ERROR_STACK_LENGTH).optional(),
    traceparent: z
      .string()
      .regex(/^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/)
      .optional(),
  }),
]);

/**
 * 中継が受け取った本体を、契約の形へ検証する。
 *
 * @remarks
 * 届く本体は誰が組んだものか分かりません。送る側にも同じ長さの宣言がありますが、それは通信量を
 * 抑えるためのもので、ここで確かめる根拠にはなりません（この口の防御方針は `readJsonBody`）。
 *
 * @param value - 読み込まれた本体
 * @returns 契約に沿わない本体では `undefined`
 */
export function parseTelemetryReport(value: unknown): TelemetryReport | undefined {
  const parsed = Report.safeParse(value);

  return parsed.success ? parsed.data : undefined;
}

/**
 * 検証済みの報告を signal へ載せる。
 *
 * @remarks
 * Web Vitals は metric へ、例外は構造化ログへ載せます —— 前者は分布を読むためのもので、
 * 後者は 1 件ずつ辿るためのものだからです。例外は `withRemoteTraceContext` を介して、
 * 画面を組んだ要求の trace へ紐づけます。
 *
 * 記録の失敗はここで止めます。ブラウザは応答を読まないので、投げても伝わる相手が居ません。
 */
export function recordTelemetryReport(report: TelemetryReport): void {
  reportQuietly(() => {
    if (report.kind === "web-vital") {
      recordWebVital(report);
      return;
    }

    withRemoteTraceContext(report.traceparent, () => {
      getLogger().error("ブラウザで捕捉されない例外が発生しました", {
        [ATTR_EXCEPTION_TYPE]: report.name,
        [ATTR_EXCEPTION_MESSAGE]: report.message,
        ...(report.stack === undefined ? {} : { [ATTR_EXCEPTION_STACKTRACE]: report.stack }),
        [ATTR_HTTP_ROUTE]: report.route,
      });
    });
  });
}
