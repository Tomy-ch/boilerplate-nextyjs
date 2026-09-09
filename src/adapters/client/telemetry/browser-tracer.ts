import { type Context, ROOT_CONTEXT, type Span, TraceFlags, trace } from "@opentelemetry/api";
import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";
import { JsonTraceSerializer } from "@opentelemetry/otlp-transformer";
import {
  BatchSpanProcessor,
  type ReadableSpan,
  StackContextManager,
  WebTracerProvider,
} from "@opentelemetry/sdk-trace-web";
import { ATTR_URL_PATH } from "@opentelemetry/semantic-conventions";

/** span の送り先。同一オリジンの中継で、collector の endpoint はブラウザへ出さない。 */
const ENDPOINT = "/api/telemetry/traces";

/**
 * 1 回の送信に載せる span の数。
 *
 * @remarks
 * 既定より小さく取ります。中継の受け口は本体の大きさに上限を持つので、1 回ぶんがその上限に収まる
 * 数で切ります。
 */
const MAX_EXPORT_BATCH_SIZE = 32;

/**
 * 何も囲まれていないときの文脈を、画面を組んだ要求のものにする。
 *
 * @remarks
 * **要求の計装は親を選べません。** 自分で span を開くなら親を渡せますが、`fetch` を包む計装は
 * 呼ばれた時点で有効な文脈から親を決めます。ブラウザでは何も囲まれていない —— React の描画も
 * イベントも別々のタスクから始まる —— ので、そのままでは要求のたびに新しい trace の根ができます。
 *
 * span を持たない文脈のときだけ、サーバーが配った文脈を返します。囲まれている間はその内側が勝つ
 * ので、入れ子は壊れません。**空であることを根の文脈との同一性では判定しません** —— 同じ値が
 * 束の中に 2 つ入ると一致しなくなり、条件が黙って成り立たなくなります。
 */
class DocumentRootContextManager extends StackContextManager {
  readonly #document: Context;

  constructor(documentContext: Context) {
    super();
    this.#document = documentContext;
  }

  override active(): Context {
    const current = super.active();

    return trace.getSpanContext(current) === undefined ? this.#document : current;
  }
}

/**
 * 立ち上げ済みかどうか。
 *
 * @remarks
 * **2 度目の呼び出しを黙って壊れた状態にしないための番人です。** React の Strict Mode は effect を
 * mount のたびに 2 度実行するので、素通しにすると立ち上げが 2 回走ります。そのとき
 * `provider.register()` の 2 回目は OTel API が上書きを許さず**黙って失敗**する一方、`fetch` の計装は
 * インスタンスごとの状態しか見ないので、**すでに包まれた `fetch` をさらに包みます** —— 以後その画面が
 * 出す要求はすべて親子 2 本の span になります。
 *
 * 計装はページの読み込みに 1 度だけ立ち上がれば足りるので、2 度目は何もしません。
 */
let started = false;

/** span を OTLP の JSON へ直列化し、中継へ送る。公式 exporter の再送・圧縮の機構は要らない。 */
const relayExporter = {
  export: (spans: ReadableSpan[], done: (result: { code: number }) => void): void => {
    const body = JsonTraceSerializer.serializeRequest(spans);

    if (body !== undefined) {
      navigator.sendBeacon(ENDPOINT, new Blob([body.slice()], { type: "application/json" }));
    }

    done({ code: 0 });
  },
  shutdown: async (): Promise<void> => undefined,
  forceFlush: async (): Promise<void> => undefined,
};

/**
 * ブラウザ側の計装を立ち上げる。
 *
 * @remarks
 * **呼び出し元は mount した後に、動的な import でこの面を読み込みます。** OTel の実装を初期の
 * 読み込みへ載せると、計装のために最初の描画が遅れ、測っている当のものを悪くします。
 *
 * 有効にすると、ブラウザが出す要求はすべて span になります —— BFF への取得だけでなく、router が
 * 画面遷移と先読みで出す RSC の要求も含みます。span は `traceparent` を親に取り、画面を組んだ
 * 要求と同じ trace に載ります。この設計の理由は [adapters の README](../../README.md) が持ちます。
 *
 * @param traceparent - 画面を組んだ要求の trace。静的生成された画面では渡らず、その場合は
 *   ブラウザ側で新しい trace が始まる
 */
export function startBrowserTracing(traceparent: string | undefined): void {
  if (started) {
    return;
  }

  started = true;

  const provider = new WebTracerProvider({
    spanProcessors: [
      new BatchSpanProcessor(relayExporter, {
        maxExportBatchSize: MAX_EXPORT_BATCH_SIZE,
      }),
    ],
  });

  provider.register({
    contextManager: new DocumentRootContextManager(toDocumentContext(traceparent)).enable(),
  });

  new FetchInstrumentation({ applyCustomAttributesOnSpan: nameByPath }).enable();

  // 画面を離れる直前に送り切る。溜めたまま閉じられると、その画面ぶんの span が失われる。
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      void provider.forceFlush();
    }
  });
}

/** W3C Trace Context の `traceparent`。version は `00` で固定されている。 */
const TRACEPARENT = /^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/;

/**
 * サーバーが配った `traceparent` を文脈へ読み替える。渡っていなければ新しい trace を始める。
 *
 * @remarks
 * **伝播器を通しません。** 大域に登録されたものは `register()` が済むまで何もしない実装のままで、
 * この読み替えはその前に要ります（登録の引数に渡す文脈だからです）。読む形式は 1 つだけなので、
 * 書式を確かめて位置で切り出します。
 */
function toDocumentContext(traceparent: string | undefined): Context {
  if (traceparent === undefined || !TRACEPARENT.test(traceparent)) {
    return ROOT_CONTEXT;
  }

  return trace.setSpanContext(ROOT_CONTEXT, {
    traceId: traceparent.slice(3, 35),
    spanId: traceparent.slice(36, 52),
    traceFlags: Number.parseInt(traceparent.slice(53, 55), 16) & TraceFlags.SAMPLED,
    isRemote: true,
  });
}

/**
 * span を、要求の方式とパスで名づける。
 *
 * @remarks
 * 既定の名前は方式だけ（`GET`）で、どの経路への要求かを持ちません。集約の単位にするためにパスを
 * 足し、**クエリは名前に載せません**（理由は[同区画の README](README.md)）。
 * クエリを含む URL は既定の計装が属性の `url.full` へ残すので、1 件ずつ辿るときはそちらを読みます。
 */
function nameByPath(span: Span, request: Request | RequestInit, result: unknown): void {
  const url = request instanceof Request ? request.url : findResponseUrl(result);

  if (url === undefined) {
    return;
  }

  const { pathname } = new URL(url, location.origin);
  const method = request.method ?? "GET";

  span.updateName(`${method} ${pathname}`);
  span.setAttribute(ATTR_URL_PATH, pathname);
}

/** 応答から要求先を読む。失敗した要求は応答を持たない。 */
function findResponseUrl(result: unknown): string | undefined {
  if (typeof result !== "object" || result === null || !("url" in result)) {
    return undefined;
  }

  return typeof result.url === "string" && result.url.length > 0 ? result.url : undefined;
}
