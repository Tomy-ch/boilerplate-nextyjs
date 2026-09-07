import "server-only";

import {
  ATTR_EXCEPTION_MESSAGE,
  ATTR_EXCEPTION_TYPE,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_SERVICE_NAME,
} from "@opentelemetry/semantic-conventions";
import { z } from "zod";

import { getObservabilityConfig } from "@/config/observability/observability.server";
import { REDACTED, REDACTED_FIELD_NAMES } from "@/logging/logger";
import { getLogger, reportQuietly } from "@/logging/logging.server";
import { getSignalEndpoint, OtelSignal } from "@/observability/initialize.server";

/**
 * 1 回の送信に許すバイト数。
 *
 * @remarks
 * ブラウザ側が 1 回に載せる span の数（`MAX_EXPORT_BATCH_SIZE`）を切っているので、その最大が
 * 収まる大きさで置いています。超過分を読む前に落とす仕組みは `readJsonBody` が持ちます。
 */
export const MAX_TRACE_EXPORT_BYTES = 128 * 1024;

/** 1 回の送信に許す resource の数。ブラウザ 1 つが名乗る resource は 1 つである。 */
const MAX_RESOURCE_SPANS = 4;

const attribute = z.looseObject({ key: z.string(), value: z.unknown().optional() });

const span = z.looseObject({ attributes: z.array(attribute).optional() });

const TraceExport = z.looseObject({
  resourceSpans: z
    .array(
      z.looseObject({
        resource: z.looseObject({ attributes: z.array(attribute).optional() }).optional(),
        scopeSpans: z.array(z.looseObject({ spans: z.array(span).optional() })).optional(),
      }),
    )
    .min(1)
    .max(MAX_RESOURCE_SPANS),
});

/** ブラウザが送ってきた OTLP の span 群。 */
export type TraceExport = z.infer<typeof TraceExport>;

/**
 * 中継が受け取った本体を、OTLP の封筒として検証する。
 *
 * @remarks
 * 中身の span までは見ません。読み替えずにそのまま collector へ渡すので、**この境界が確かめるのは
 * 封筒の形と大きさだけ**です。span の妥当性は受け取る collector が判断します。
 *
 * @param value - 読み込まれた本体
 * @returns OTLP の封筒に見えない本体では `undefined`
 */
export function parseTraceExport(value: unknown): TraceExport | undefined {
  const parsed = TraceExport.safeParse(value);

  return parsed.success ? parsed.data : undefined;
}

/**
 * ブラウザが作った span を collector へ中継する。
 *
 * @remarks
 * **service 名はここで上書きします。** 名乗りをそのまま通すと、誰でも任意の service の trace へ
 * span を書けます。ブラウザは自分がどの service の一部かを知る必要がなく、知っているのはこちらです。
 *
 * trace が無効な構成では送りません。collector の endpoint も資格情報もブラウザへ出さないので、
 * 送るか捨てるかを決められるのはこちら側だけです。
 *
 * **渡せなかったことを呼び出し元へ持ち出しません。** collector が落ちていることは中継の口の失敗では
 * なく、送り手（exporter）はどのみち再送しません。投げ直すと、観測基盤の不調がそのまま無認証の口の
 * 500 になります。
 */
export async function forwardTraceExport(traces: TraceExport): Promise<void> {
  const config = getObservabilityConfig();

  if (!config.tracesEnabled) {
    return;
  }

  try {
    const response = await fetch(getSignalEndpoint(config.otlpEndpoint, OtelSignal.TRACES), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(redactAttributes(withServiceName(traces, config.serviceName))),
    });

    if (!response.ok) {
      reportFailure({ [ATTR_HTTP_RESPONSE_STATUS_CODE]: response.status });
    }
  } catch (error) {
    reportFailure({
      [ATTR_EXCEPTION_TYPE]: error instanceof Error ? error.name : "UnknownError",
      [ATTR_EXCEPTION_MESSAGE]: String(error),
    });
  }
}

/** 渡せなかったことを記録する。記録できないことで中継の応答まで変えない。 */
function reportFailure(fields: Readonly<Record<string, unknown>>): void {
  reportQuietly(() => {
    getLogger().warn("ブラウザの span を collector へ渡せませんでした", fields);
  });
}

/**
 * 伏せる名前を持つ span の属性を censor へ置き換える。
 *
 * @remarks
 * **ここで掛けるのは、ここが全部を通る唯一の場所だからです。** ブラウザ側で掛けても、送信者は
 * 差し替えられるので受け側の根拠になりません。
 *
 * **名前の表は `logging` が持ちます。** ログと span へ同じ redaction を掛けるので、表が 2 つに
 * 割れると片方だけが緩みます。
 *
 * **値の中身は見ません。** 上流や第三者が組んだ URL の中まで洗い出すことは表現層の設計目標に
 * 入れていません。名前で持ち回っている限り効き、そうでないものは元の設計が誤っています。
 */
function redactAttributes(traces: TraceExport): TraceExport {
  return {
    ...traces,
    resourceSpans: traces.resourceSpans.map((resourceSpan) => ({
      ...resourceSpan,
      scopeSpans: resourceSpan.scopeSpans?.map((scopeSpan) => ({
        ...scopeSpan,
        spans: scopeSpan.spans?.map((item) => ({
          ...item,
          attributes: item.attributes?.map(censorSecret),
        })),
      })),
    })),
  };
}

/** 伏せる名前の属性なら値を差し替える。 */
function censorSecret(item: z.infer<typeof attribute>): z.infer<typeof attribute> {
  return REDACTED_FIELD_NAMES.includes(item.key.toLowerCase())
    ? { ...item, value: { stringValue: REDACTED } }
    : item;
}

/** 各 resource の service 名を、このアプリが名乗っているものへ揃える。 */
function withServiceName(traces: TraceExport, serviceName: string): TraceExport {
  return {
    ...traces,
    resourceSpans: traces.resourceSpans.map((resourceSpan) => ({
      ...resourceSpan,
      resource: {
        ...resourceSpan.resource,
        attributes: [
          ...(resourceSpan.resource?.attributes ?? []).filter(
            (item) => item.key !== ATTR_SERVICE_NAME,
          ),
          { key: ATTR_SERVICE_NAME, value: { stringValue: serviceName } },
        ],
      },
    })),
  };
}
