# 観測

この文書は、ログ・trace・測定が**ブラウザからサーバ、その先の collector までどう繋がっているか**を通しで説明する。何を採り何を採らないかの判断は [ADR 0081](../adr/0081-observability-logging.md)（サーバ側）と [ADR 0082](../adr/0082-client-observability.md)（ブラウザ側）が持ち、ここはその判断が**コードのどこで、どの順に**実現されているかと、実装を読まないと踏む落とし穴を扱う。

`src/logging/` と `src/observability/` の各 README は、それぞれのカーネルの窓口である。この文書は両者と `adapters` / `app` / `instrumentation.ts` を跨いだ 1 本の線を引く。判断に迷ったら ADR を優先する。

## 2 つのカーネルの分担

観測はカーネル 2 つに割れている。**`logging` は書く側の契約、`observability` は OTel の実体**であり、依存は一方向（`observability` → `logging`）にしか無い。

| カーネル | 持つもの | 隠すもの |
| --- | --- | --- |
| `logging` | `Logger`（`debug` / `info` / `warn` / `error` と構造化フィールド）、伏せる名前の表 `REDACTED_FIELD_NAMES`、注入口 2 つ（`TraceContextExtractor` / `LogRecordSink`）、`getLogger()` / `reportQuietly()` | Pino。`pino.server.ts` の外に Pino の型は出ない |
| `observability` | `NodeSDK` の初期化、trace 相関の出し入れ、描画を span にする口、OTLP Logs sink、Web Vitals の計器 | OTel SDK と exporter。`features` が import する面（`render-span.ts`）は `@opentelemetry/*` を持たない |

`logging` は `observability` を知らない。trace の識別子をログ行へ付けるのは `TraceContextExtractor` という関数型の注入口で、`observability/trace-context.server.ts` の `extractActiveTraceContext` がそれを満たす。OTLP へログを流すのも同じ形で、`observability/otlp-log-sink.server.ts` が `LogRecordSink` を実装する。**両方を結線するのは起動境界（`src/instrumentation.ts`）だけ**である。

`observability` の中身は 6 つに分かれる。

| ファイル | 役割 | `@opentelemetry/*` |
| --- | --- | --- |
| `initialize.server.ts` | `NodeSDK` を 1 プロセス 1 回だけ構築し、signal ごとに exporter を付ける | 持つ |
| `trace-context.server.ts` | 現在の span から識別子を取り出す / `traceparent` を書き出す / ブラウザが返した `traceparent` の文脈で処理する | 持つ |
| `render-span.ts` | `withScreenSpan` / `withPartSpan`。`features` が import する面 | **持たない** |
| `render-span-runner.server.ts` | 描画を span で包む実装。起動境界が `render-span.ts` へ注入する | 持つ |
| `otlp-log-sink.server.ts` | 正規化済みログレコードを OTel Logs API へ渡す | 持つ |
| `web-vital-metric.server.ts` | ブラウザが測った Web Vitals をヒストグラムへ記録する | 持つ |

## 起動境界が全部を結ぶ

Next.js は Node サーバの準備時に `src/instrumentation.ts` の `register()` を呼ぶ。観測に関わる結線は**すべてここで、この順に**起きる。

1. `bootstrapConfig()` で env を検証する。観測の設定（`OBS_*`）はここで初めて読める
2. API の接続モードが `mock` なら interception を立てる（検証の後に置くのは、未検証の値で接続先を差し替えないため）
3. `initializeObservability(...)` —— signal がひとつでも有効なら `NodeSDK` を構築して `start()` する。resource は `service.name` だけ。伝播は W3C `TraceContext` + `Baggage`。計装は `HttpInstrumentation`（受信要求の root span）と `UndiciInstrumentation`（外向き `fetch`。**`APP_API_BASE_URL` の origin にしか伝播しない**）
4. `configureRenderSpans({ screens, parts, run: runRenderSpan })` —— 描画の計装の範囲と実装を注入する。`screens` / `parts` は **`tracesEnabled` と `OBS_RENDER_SPANS` の合成**で、合成はここが行う
5. `initializeLogger({ level, traceContextExtractor, logRecordSink? })` —— Pino を初期化する。`logRecordSink` は `OBS_LOGS_EXPORTER=otlp` のときだけ付く
6. trace と logs が両方有効なら、`observability.initialize` という span の中で起動ログを 1 行出す。**これが相関の疎通確認になる** —— ログ基盤の側でこの行に `trace_id` が付いていれば結線は通っている

Edge runtime とブラウザでは 1〜6 のどれも走らない（`NEXT_RUNTIME === "nodejs"` で分岐する）。ブラウザ側の計装は別の入口（後述の `Telemetry` island）から立ち上がり、ブラウザで測ったものは中継を通ってこのサーバ側 SDK に載る。

### signal の gate と描画の範囲は別の軸

`OBS_TRACES_EXPORTER` / `OBS_METRICS_EXPORTER` / `OBS_LOGS_EXPORTER` は **`otlp` だけが有効**で、`none` と空文字列は無効である。無効な signal は exporter も batch processor も metric reader も作らない。endpoint は `OTEL_EXPORTER_OTLP_ENDPOINT` の base に `/v1/<signal>` を足して組む（`getSignalEndpoint`）。

`OBS_RENDER_SPANS`（`none` / `screen` / `part`）は signal ではなく、**何を計装するか**の軸である。`OBS_TRACES_EXPORTER=none` にしても、他の signal が有効なら `NodeSDK` は tracer provider を立て、span は記録されたうえで捨てられる —— 出力がゼロになるだけで計装のコストは残る。だから範囲を独立に持つ。値の一覧は [`env/README.md`](../../env/README.md) が持つ。

## 注入は registered symbol で渡す

**これは実装を読まないと踏む筆頭である。** Next は起動境界（`instrumentation.ts` から辿るグラフ）と RSC の描画側を**別のモジュールグラフ**として組む。その結果、`src/logging/logging.server.ts` や `src/observability/render-span.ts` のような同じファイルが **1 プロセスの中で 2 回インスタンス化される**（`process.pid` は同じで、モジュールごとの識別子だけが違う）。

起動境界で作った値を `let logger` のようなモジュール変数に置くと、それは起動側のインスタンスにしか無く、Server Component から呼ぶ `getLogger()` は別のインスタンスの未初期化な変数を見て投げる。realm（`globalThis`）は共有されているので、両方から見える場所として **registered symbol**（`Symbol.for("nextjs-boilerplate.logging.logger")` など）をキーに `globalThis` へ置き、読む側は「別のインスタンスが書いた値」として形を確かめてから使う。`logging.server.ts` の `findLogger()` と `render-span.ts` の `findConfiguration()` がその形である。

この規則は「起動境界で**生成した**値を、描画側で**読む**」ものにだけ要る。モジュール変数のままで動いているものが 3 つあるが、それぞれ理由が違う。

| モジュール変数 | 動く理由 |
| --- | --- |
| `initialize.server.ts` の `let sdk` | 起動境界の中でしか触らない、二重起動の番人。描画側が tracer を引くときは `@opentelemetry/api` 自身の global 登録（これも `Symbol.for` で `globalThis` に置かれる）を通る |
| `config/environment.ts` の `cachedEnvironment` | 出所が `process.env` で、それはプロセス共有である。描画側のインスタンスは自分で同じ値を再評価するだけで、起動側の値を待っていない |
| `web-vital-metric.server.ts` の `histograms` | 計器のキャッシュに過ぎず、実体は `metrics.getMeter()` を通じて OTel の global へ辿り着く。作り直しても同じ計器になる |

新しい注入口を足すときは「出所はどこか」で判定する。**起動境界でしか作れないなら registered symbol**、プロセス共有の資源から再導出できるならモジュール変数で足りる。

## 1 本の trace がどう繋がるか

SSR からブラウザの取得、その先のバックエンドまでが 1 本になる仕組みを、要求の順に追う。

1. **受信要求** —— `HttpInstrumentation` が root span を作る。Next.js 自身の計装が `render route (app)` などの span をその下に張る
2. **描画** —— `withScreenSpan` で包まれた画面の最上位が `render <module path>` の span を張る（次節）。本体で待つ `fetch` はこの中に入る
3. **外向き `fetch`** —— `UndiciInstrumentation` が span を張り、`traceparent` / `baggage` を注入する。**注入先は `APP_API_BASE_URL` の origin だけ**で、他の origin へは伝播しない（`ignoreRequestHook` で切っている）
4. **ブラウザへ配る** —— root layout の `TelemetryHole` が `findActiveTraceparent()` で現在の span を W3C の `traceparent` 文字列にし、`Telemetry` island へ props で渡す。request-time の値なので `Suspense` の中に置いてあり、殻の描画を止めない
5. **ブラウザ側の計装** —— `Telemetry` が mount した後、`adapters/client/telemetry/browser-tracer.ts` を**動的 import** で読み、`startBrowserTracing(traceparent)` を呼ぶ。`WebTracerProvider` を登録し、`FetchInstrumentation` で **`fetch` すべて**（BFF への取得も、router が遷移と先読みで出す RSC の要求も）を span にする
6. **親の決め方** —— **ブラウザは自分の trace を始めない。** `DocumentRootContextManager` が「何も囲まれていない文脈」のときだけ、配られた `traceparent` の文脈を返す。`fetch` を包む計装は呼ばれた時点の有効な文脈から親を取るので、これで全部の要求が画面を組んだ要求の子になる
7. **中継** —— ブラウザの span は `BatchSpanProcessor` → `relayExporter` で OTLP JSON に直列化され、`navigator.sendBeacon` で同一オリジンの `/api/telemetry/traces` へ送られる。画面が `hidden` になる直前に `forceFlush` する
8. **collector へ** —— `adapters/server/telemetry/browser-traces.ts` が封筒の形だけ検証し、`service.name` を上書きし、伏せる属性を censor へ置き換えてから、サーバ側の設定が知る collector の `/v1/traces` へ **読み替えずに** POST する

`traceparent` が渡らない実行（静的生成された画面）では 6 の文脈が `ROOT_CONTEXT` になり、ブラウザ側で新しい trace が始まる。これは仕様であって欠陥ではない —— 親にできる要求がそもそも無い。

**ブラウザが作った span は `observability` カーネルを通らない。** `adapters/server` が OTLP のまま collector へ渡す。カーネルが受け持つのは、4 の書き出しと、例外の記録を返ってきた `traceparent` の文脈で行う `withRemoteTraceContext` だけである。

## 中継の口

ブラウザから collector を直接叩かせないので、同一オリジンの Route Handler が受ける。口は 2 つある。

| 口 | 受けるもの | 契約の出所 | 受け側 |
| --- | --- | --- | --- |
| `POST /api/telemetry` | このリポジトリが決めた形の報告（Web Vitals / 例外）。型は `adapters/http/telemetry-report.ts` | このリポジトリ | `browser-telemetry.ts` が zod で検証し、signal へ載せ替える |
| `POST /api/telemetry/traces` | OTLP の `resourceSpans` そのもの | OTel | `browser-traces.ts` が封筒だけ検証し、読み替えずに転送する |

2 つに分けるのは中身が違うからではなく、**契約の出所が違う**からである。片方はこちらの都合で変えられ、もう片方は変えられない。

どちらも認証を要求しない口なので、**本体を読む前に落とす**防御を `adapters/server/http/json-request.ts` の `readJsonBody` が持つ。

- content-type が `application/json` を名乗らなければ **415**
- `content-length` の宣言が上限を超えていれば読まずに **413**。宣言が無い・偽っている要求は読んだ後の実測で **413**（大きさは 2 度見る）
- JSON として読めなければ **400**、契約の形に合わなければ **400**
- 通れば **204** で、本文は返さない。送り手は `sendBeacon` か `keepalive` 付きの `fetch` で、どちらも応答を読まない

上限は口ごとに置く。報告の口は **16 KB**（契約が許す最大の報告を UTF-8 の JSON に直した大きさから逆算）、trace の口は **128 KB**（ブラウザ側の `maxExportBatchSize: 32` が収まる大きさ）と `resourceSpans` **4 つ**まで。ブラウザ側の切り詰め（`MAX_ERROR_*_LENGTH`、`MAX_EXPORT_BATCH_SIZE`）は通信量を抑えるための**写し**であって、受け側の根拠ではない。

trace の口はさらに 2 つを持つ。**`service.name` の上書き** —— 名乗りをそのまま通すと誰でも任意の service の trace へ span を書けるので、サーバが知る `OBS_SERVICE_NAME` に揃える。**失敗を応答へ出さない** —— collector が落ちていることは中継の失敗ではなく、投げ直すと観測基盤の不調が無認証の口の 500 になる。`warn` ログを 1 行出して 204 を返す。

レート制限・大域的な遮断はここに無い。それは edge / WAF の責務である（[ADR 0077](../adr/0077-bff-abuse-protection-boundary.md)）。

## 描画の計装

`withScreenSpan(name, render)` / `withPartSpan(name, render)` は、コンポーネントを span で包んだ同じ形のコンポーネントを返す。span 名は `render <name>`、tracer の scope は `render` である。どちらで包むかは置き場で決まる。

| 対象 | 包む口 | 既定 |
| --- | --- | --- |
| 画面の最上位（`features/<name>/<screen>/` の `page-content` / `view`、殻の側で取得を持つ合成） | `withScreenSpan` | 有効（`OBS_RENDER_SPANS=screen`） |
| feature が持つ部品（`<screen>/ui/**`） | `withPartSpan` | 無効（`part` で開く） |

包む側（`render-span.ts`）は `globalThis` の構成を読んで、範囲が有効なら注入された `run` に渡し、無効ならそのまま呼ぶ。注入が無い実行（テスト・Storybook・ブラウザ）では何も作らない。

包まれる側（`render-span-runner.server.ts`）は `tracer.startActiveSpan` で描画を実行する。戻り値が Promise なら**元の Promise をそのまま返し**、解決 / 拒否の後で span を閉じる —— 派生した Promise を返すと React が待つ対象が変わる。描画が投げれば span を `ERROR` にし、`Error` なら例外として記録して投げ直す。ただし `notFound()` / `redirect()` のような Next が制御に使う throw は `unstable_rethrow` で見分け、失敗として記録しない。

**span が覆うのはそのコンポーネント自身の実行だけ**である。子は戻り値を React が受け取った後に描かれるので、子の span はこの span の中に入らず、同じ親（`render route (app)`）の下に兄弟として並ぶ。画面全体の所要は `render route (app)` が持つ。

## Web Vitals は metric、例外は log

ブラウザで測ったものは 2 種類あり、載せる signal が違う。

**Web Vitals** は `next/web-vitals` の `useReportWebVitals` で拾い、`/api/telemetry` へ送り、サーバ側で**指標ごとのヒストグラム**（`browser.web_vital.lcp` など）に記録する。属性は `http.route` と `browser.web_vital.rating` / `browser.web_vital.navigation_type` の 3 つだけである。event ではなく metric なのは、event で出すと 1 レコードごとに中継の POST の span が付き、測定が起きていない要求と親子になるからである。この報告は `traceparent` を持たない —— metric は trace を持てない。

`http.route` には 1 件ぶんのパスではなく **route の型**（`/docs/[slug]`）を載せる。復元はブラウザ側の `toRoutePattern(usePathname(), useParams())` が行う。載せるのは**読み込みが始まった route** で、client 遷移で route が変わっても報告時点の route ではない（CLS / INP は離脱までの累積で、読み込みに紐づく）。

刻みは指標ごとに持つ。時間の指標はミリ秒の並び、`CLS` は 0〜1 の並びで、既定の刻みに任せると `CLS` が最初の 1 区間へ全部入って百分位が内挿だけで決まる。

**例外**（`window` の `error` / `unhandledrejection`）は同じ口へ送り、サーバ側で `getLogger().error(...)` の構造化ログに **`exception.type` / `exception.message` / `exception.stacktrace` / `http.route`** を付けて載せる。記録は `withRemoteTraceContext(report.traceparent, ...)` の中で行うので、**`trace_id` は画面を組んだ要求のもの**になる。渡ってこなければ `ROOT_CONTEXT` で記録し、中継要求の span には紐づけない。1 回のページ読み込みで送るのは **8 件**まで（`Telemetry` island が数える）。

**エラー境界が捕まえた例外は、この経路に乗らない。** React は明示的な境界（自前の `error.tsx` / `global-error.tsx`）が捕まえた例外を `onCaughtError` から`console.error` へ流すだけで、**`window` の `error` を発火しない**。`window` へ上がるのは組み込みの暗黙境界に落ちたときだけである。取得の失敗は大半が `error.tsx` に捕まるので、**いちばん記録したい経路がここで抜ける。**

境界で受けた失敗も残したいなら、**境界の側から報告を呼ぶ**しかない。ただし`global-error.tsx` は root layout ごと差し替わるので、**そのとき島は既に居ない** ——報告の口を島の外から引ける形にしておく必要がある。

## 秘匿と query の境界

伏せる名前の表は **`src/logging/logger.ts` の `REDACTED_FIELD_NAMES`（`authorization` / `cookie` / `password` / `token`）1 つ**で、ログと span の双方がこれを見る。掛かる場所は 3 つある。

| 場所 | 何に掛かるか | 方法 |
| --- | --- | --- |
| `pino.server.ts` の `redactFields` | stdout と OTLP sink へ渡す前のフィールド | 名前を小文字化して表と突き合わせ、値を `[REDACTED]` に置換 |
| `pino.server.ts` の Pino `redact` | Pino 自身の出力 | 同じ表を `paths` に渡す |
| `browser-traces.ts` の `censorSecret` | ブラウザが作った span の属性 | 同じ表に当たる `key` の `value` を `{ stringValue: "[REDACTED]" }` へ差し替え |

**名前で伏せ、値の形は見ない。** span 側で掛けるのが中継なのは、そこが全部を通る唯一の場所だからである —— ブラウザ側で掛けても送信者は差し替えられる。

query は落とさない。秘匿すべき値を query に載せていること自体が誤りで、trace で伏せても守るものが無い。ただし **span 名には載せない** —— これは秘匿ではなく集約の要求で、条件が要求ごとに違うので名前に含めると同じ経路が別の名前へ散る。ブラウザ側は `nameByPath` が `<method> <pathname>` に名前を付け直し、`url.path` を属性に置く。query を含む URL は既定の計装が `url.full` に残すので、1 件ずつ辿るときはそちらを読む。

## vendor SDK が内層に無いこと

`@opentelemetry/*` を import してよいのは、`observability/*.server.ts`、`adapters/server/telemetry/`、`adapters/client/telemetry/browser-tracer.ts`、そして `instrumentation.ts` だけである。`features` が触るのは `observability/render-span.ts` の 2 関数と `logging` の `Logger` で、どちらも OTel の型を露出しない。`logging` が持つ外部依存は Pino だけで、それも `pino.server.ts` の外へ出ない。

Sentry / Datadog / Faro のような SaaS SDK は同梱しない。向け先は任意の OTLP バックエンドで、切り替えは `OTEL_EXPORTER_OTLP_ENDPOINT` と collector 側の設定で済む。

## 間違えやすいところ

### 起動境界で作った値をモジュール変数に置くと描画側へ届かない

前述のとおり、同じファイルが 1 プロセスで 2 回インスタンス化される。起動境界で `initializeX()` を呼び、Server Component や Route Handler から `getX()` を呼ぶ形を新しく足すなら、置き場は `Symbol.for` をキーにした `globalThis` である。テストは 1 つのモジュールグラフで動くので、**テストでは再現しない**。実機で「初期化していないと投げる」が出たら、まずこれを疑う。

### `OBS_TRACES_EXPORTER=none` は計装を止めない

他の signal が有効なら tracer provider は立ち、描画の span も `fetch` の span も作られたうえで捨てられる。計装のコストを落としたいなら `OBS_RENDER_SPANS=none` を使う。逆に `OBS_RENDER_SPANS=screen` でも trace が無効なら描画の span は出ない —— 合成は起動境界が行っている。

### 描画の span の時間は部分木の合計ではない

`render <name>` が覆うのは自分の本体だけで、子の描画は兄弟として並ぶ。「この画面が遅い」の答えは `render route (app)` を見る。最上位の span が答えるのは「そこまで到達したか」と「本体で何を待ったか」である。入れ子にしようとして子を関数として直接呼ぶと、Suspense 境界と streaming の単位を失う。

### 外向き `fetch` は親が無いと span にならない

`UndiciInstrumentation` は `requireParentforSpans: true` で構築されている。受信要求の外（build 時の静的生成、起動処理の中）で出した `fetch` は span にならず、`traceparent` も注入されない。これは「span が消えた」のではなく、親にする要求が無いだけである。

### 伝播先は API の origin だけである

`traceparent` / `baggage` が付くのは `APP_API_BASE_URL` と同じ origin への要求だけで、IdP や第三者の origin には付かない。別の origin で trace が切れているのを「バグ」として伝播先を広げてはならない —— `Baggage` を渡してよい相手を絞っている（[ADR 0081](../adr/0081-observability-logging.md) §2）。

### 属性名が span の出所で違う

同じ trace の中でも、Next.js 自身の計装（scope `next.js`）は `http.method` / `http.target` / `http.status_code` という v1.0 前の名前を使い、このリポジトリの計装（`browser-telemetry` / `@opentelemetry/instrumentation-undici`）は `http.request.method` / `url.path` / `http.response.status_code` を使う。片方の名前だけで絞ると、もう片方が全部落ちる。

### Next.js 自身の `fetch` span は名前に query を載せる

Next.js が自前で張る `fetch` span は、span 名に query 付きの URL をそのまま載せるため、名前が要求ごとに散る。同じ通信は Undici の span も覆っていて、そちらの名前は経路だけを持つ。抑止するなら `NEXT_OTEL_FETCH_DISABLED=1` である。

### dev では同じ Web Vitals が 2 回届く

React の Strict Mode が effect を 2 度呼び、`useReportWebVitals` は購読を解除しないため、計測器への登録が 2 つ残る。production build では 1 回になる。ブラウザ側の trace の立ち上げ（`startBrowserTracing`）は `started` の番人で 2 度目を素通しにしている —— 番人が無いと `provider.register()` の 2 回目は黙って失敗し、`fetch` の計装だけが二重に包まれて、以後の要求が親子 2 本の span になる。

### 静的生成された画面ではブラウザの trace が繋がらない

`traceparent` はアクティブな span から取るので、request-time の描画でしか得られない。静的生成された画面では `Telemetry` に `undefined` が渡り、ブラウザは新しい trace を始める。例外の記録も trace 無しで載る。SSR と繋げたければ、その画面を dynamic にする以外に無い。

### `traceparent` の真正性は確かめられない

ブラウザが返してくる値は書式（`00-<32hex>-<16hex>-<2hex>`）と全 0 でないことしか見ない。誰でも任意の trace ID を名乗れるので、**trace の紐づけを認可や監査の根拠にしてはならない**。読めない値では文脈を空にし、中継要求の span へは決して紐づけない。

### 配信を止めているあいだ、ブラウザ発の報告は届かない

`src/proxy.ts` は停止中 `GET` / `HEAD` 以外を 503 で断り、通す経路も `/maintenance` と `/api/health` だけである。`/api/telemetry` 系は `POST` なので落ちる。停止中の画面で起きた例外や測定はどこにも残らない —— これは停止の約束を自分の境界で言い切った帰結で、口を開けて回避するものではない。

### `getLogger()` は初期化前に投げる

起動境界を通らない実行（テスト、`instrumentation.ts` を経ない script）で `getLogger()` を呼ぶと投げる。**記録の失敗で記録の対象まで失敗させない**ために `reportQuietly()` があり、中継の受け側はすべてこれで包んでいる。新しく観測を足す側も、成否が利用者へ見える処理の中では同じ形にする。

### `Error` や `Date` をそのままフィールドに載せると空になる

OTLP sink（`toOtlpValue`）は `string` / `number` / `boolean` / `null` / `Uint8Array` / 配列 / plain object 以外を落とし、object は `Object.entries` で列挙する。`Error` の `message` / `stack` は列挙不能なので `{}` になり、`Date` も `{}` になる。ログのフィールドには `exception.message` のように**文字列へ直してから**載せる。`browser-telemetry.ts` の例外ログがその形である。

### `render-span.ts` に `@opentelemetry/api` を import してはならない

このファイルは `features` が import するのでブラウザのバンドルにも入る。`@opentelemetry/api` を連れて行くと、Vite が取り込む CJS ビルドがブラウザに無い `__dirname` を参照し、**モジュール評価の時点で落ちる** —— その面を import した story は 1 つも描けなくなる。実装は `render-span-runner.server.ts` に置き、起動境界が注入する。

### Route Handler は自分で観測を初期化しない

`/api/telemetry` 系の handler は `initializeObservability` も `initializeLogger` も呼ばない。起動境界が済ませたものを registered symbol と OTel の global 経由で使うだけである。handler の中で SDK を触り始めると、二重起動か、起動側と違う設定の別 provider ができる。

## 関連する ADR

- [0081](../adr/0081-observability-logging.md) — 構造化ログ / OTLP-only / signal 別 gate / trace 相関 / redaction。この文書の土台
- [0082](../adr/0082-client-observability.md) — ブラウザ側の trace / Web Vitals / 例外を BFF 中継に載せる判断と、metric で採る理由
- [0077](../adr/0077-bff-abuse-protection-boundary.md) — 中継の口が自分で持つ最小防御と、edge へ委ねる範囲
- [0021](../adr/0021-frontend-responsibility.md) — カーネルが config を直読せず起動境界から注入を受ける線
- [0024](../adr/0024-adapters-server-client-split.md) — 送信面（`adapters/client`）と受け側（`adapters/server`）の家
- [0030](../adr/0030-environment-variable-management.md) — `OBS_*` の供給と、endpoint を `NEXT_PUBLIC_` に出さないこと
- [0101](../adr/0101-performance-budget.md) — Core Web Vitals を一次指標に置く判断。good / poor の閾値はこの文書にも無い
