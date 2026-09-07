/**
 * Next.js がサーバーインスタンスの準備時に自動実行する起動フック。
 *
 * Edge runtime ではファイル読込を行わず、Node.js runtime に限って server Config の bootstrap を委譲する。
 */
export async function register(): Promise<void> {
  if (process.env["NEXT_RUNTIME"] === "nodejs") {
    const [
      { bootstrapConfig },
      { getObservabilityConfig },
      { getLogger, initializeLogger },
      { LogLevel },
      { initializeObservability },
      { configureRenderSpans },
      { runRenderSpan },
      { createOtlpLogSink },
      { extractActiveTraceContext },
    ] = await Promise.all([
      import("./config/bootstrap.server"),
      import("./config/observability/observability.server"),
      import("./logging/logging.server"),
      import("./logging/logger"),
      import("./observability/initialize.server"),
      import("./observability/render-span"),
      import("./observability/render-span-runner.server"),
      import("./observability/otlp-log-sink.server"),
      import("./observability/trace-context.server"),
    ]);

    await bootstrapConfig();

    // API のモックは bootstrapConfig() の後に立てる。接続モードの決定を検証より前へ置くと、
    // 未検証の値で本番の接続先を差し替えうる（検証の実行点は `docs/rules.md`「設定と環境」）。
    const { getApiConfig } = await import("./config/api/api.server");

    const apiConfig = getApiConfig();

    if (apiConfig.mode === "mock") {
      const { mockServer } = await import("../mocks/node");

      mockServer.listen({ onUnhandledRequest: "bypass" });
    }

    const config = getObservabilityConfig();
    const { serviceName } = config;

    initializeObservability({
      otlpEndpoint: config.otlpEndpoint,
      tracesEnabled: config.tracesEnabled,
      metricsEnabled: config.metricsEnabled,
      logsEnabled: config.logsEnabled,
      serviceName,
      tracePropagationOrigins: [apiConfig.baseUrl],
    });
    configureRenderSpans({
      screens: config.tracesEnabled && config.renderScreenSpansEnabled,
      parts: config.tracesEnabled && config.renderPartSpansEnabled,
      run: runRenderSpan,
    });
    initializeLogger({
      level: LogLevel.INFO,
      traceContextExtractor: extractActiveTraceContext,
      ...(config.logsEnabled ? { logRecordSink: createOtlpLogSink(serviceName) } : {}),
    });

    if (config.tracesEnabled && config.logsEnabled) {
      const { trace } = await import("@opentelemetry/api");
      trace.getTracer(serviceName).startActiveSpan("observability.initialize", (span) => {
        getLogger().info("observability を初期化しました", {
          traces_enabled: config.tracesEnabled,
          metrics_enabled: config.metricsEnabled,
          logs_enabled: config.logsEnabled,
        });
        span.end();
      });
    }
  }
}
