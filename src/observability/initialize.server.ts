import "server-only";

import {
  CompositePropagator,
  W3CBaggagePropagator,
  W3CTraceContextPropagator,
} from "@opentelemetry/core";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

/** 起動境界が observability SDK へ注入する構成です。 */
type ObservabilityInitialization = Readonly<{
  otlpEndpoint: string;
  tracesEnabled: boolean;
  metricsEnabled: boolean;
  logsEnabled: boolean;
  serviceName: string;
  /** W3C trace context を外向きの `fetch` へ注入してよい接続先。path は無視して origin で照合する。 */
  tracePropagationOrigins: readonly string[];
}>;

export type OtelSignal = "traces" | "metrics" | "logs";

export const OtelSignal: Readonly<Record<Uppercase<OtelSignal>, OtelSignal>> = {
  TRACES: "traces",
  METRICS: "metrics",
  LOGS: "logs",
};

let sdk: NodeSDK | undefined;

/**
 * Node runtime 用の OTel trace SDK を一度だけ初期化する。
 *
 * signal ごとに無効なら exporter・batcher・reader を構築しない。
 */
export function initializeObservability({
  otlpEndpoint,
  tracesEnabled,
  metricsEnabled,
  logsEnabled,
  serviceName,
  tracePropagationOrigins,
}: ObservabilityInitialization): void {
  if ((!tracesEnabled && !metricsEnabled && !logsEnabled) || sdk !== undefined) {
    return;
  }

  const allowedOrigins = new Set(tracePropagationOrigins.map((origin) => new URL(origin).origin));

  sdk = new NodeSDK({
    resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: serviceName }),
    textMapPropagator: new CompositePropagator({
      propagators: [new W3CTraceContextPropagator(), new W3CBaggagePropagator()],
    }),
    instrumentations: [
      new HttpInstrumentation(),
      new UndiciInstrumentation({
        requireParentforSpans: true,
        // 許可 origin 以外へは伝播しない。
        ignoreRequestHook: ({ origin }) => !allowedOrigins.has(new URL(origin).origin),
      }),
    ],
    ...(tracesEnabled
      ? {
          traceExporter: new OTLPTraceExporter({
            url: getSignalEndpoint(otlpEndpoint, OtelSignal.TRACES),
          }),
        }
      : {}),
    ...(metricsEnabled
      ? {
          metricReaders: [
            new PeriodicExportingMetricReader({
              exporter: new OTLPMetricExporter({
                url: getSignalEndpoint(otlpEndpoint, OtelSignal.METRICS),
              }),
            }),
          ],
        }
      : {}),
    ...(logsEnabled
      ? {
          logRecordProcessors: [
            new BatchLogRecordProcessor({
              exporter: new OTLPLogExporter({
                url: getSignalEndpoint(otlpEndpoint, OtelSignal.LOGS),
              }),
            }),
          ],
        }
      : {}),
  });
  sdk.start();
}

/** OTLP HTTP の base endpoint から signal 固有の resource endpoint を組み立てる。 */
export function getSignalEndpoint(otlpEndpoint: string, signal: OtelSignal): string {
  return `${otlpEndpoint.endsWith("/") ? otlpEndpoint : `${otlpEndpoint}/`}v1/${signal}`;
}
