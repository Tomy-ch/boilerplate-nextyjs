import { toErrorResponse } from "@/adapters/server/http/error-response";
import { readJsonBody } from "@/adapters/server/http/json-request";
import {
  MAX_TELEMETRY_REPORT_BYTES,
  parseTelemetryReport,
  recordTelemetryReport,
} from "@/adapters/server/telemetry/browser-telemetry";
import { ErrorKind } from "@/errors/error-kind";

/**
 * ブラウザ発の報告を OTLP へ中継する。
 *
 * @remarks
 * ブラウザから collector を直接叩かせないための口です。endpoint も資格情報もブラウザへ出さず、
 * ここが受けて `adapters/server` へ渡します。
 *
 * 認証を要求しない口なので、本体を読む前に型と大きさで落とします（防御の中身と根拠は
 * [`readJsonBody`](../../../adapters/server/http/json-request.ts)）。
 *
 * 成功しても内容を返しません。送り手は `sendBeacon`（使えない実行では `keepalive` を付けた取得）で、
 * どちらも応答を読まないためです。
 */
export async function POST(request: Request): Promise<Response> {
  const read = await readJsonBody(request, MAX_TELEMETRY_REPORT_BYTES);

  if (!read.ok) {
    return toErrorResponse(read.kind);
  }

  const report = parseTelemetryReport(read.value);

  if (report === undefined) {
    return toErrorResponse(ErrorKind.INVALID_ARGUMENT);
  }

  recordTelemetryReport(report);

  return new Response(null, { status: 204 });
}
