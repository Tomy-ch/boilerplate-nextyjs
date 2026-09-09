---
imports-allowed: []
forbidden: [business-logic, direct-config-access]
test-requirement: unit
---

# observability

OTel を用いた server-side の trace、metrics、logs のためのカーネルです。設定値は import せず、起動側から注入されます。

## 受け入れるもの

- OTel SDK の初期化、trace、signal 別の有効化
- 描画を span へ載せる口（`features` から呼ぶ唯一の公開面）
- 中継が受け取ったブラウザ側の測定を signal へ載せる口（`adapters/server` から呼ぶ）

## 受け入れないもの

- 業務ロジック、config の直接参照、特定 RUM SaaS への固定

## 構成

- `initialize.server.ts` は Node.js runtime の `NodeSDK` をプロセスごとに一度だけ初期化する。resource には公式 semantic convention の `service.name` を設定し、W3C Trace Context と W3C Baggage を伝播する。HTTP instrumentation は受信 HTTP request の trace を作り、Undici instrumentation は許可された API origin への server-side `fetch` へ trace context を注入する。伝播が働くのは signal のいずれかが有効で SDK が構築されたときだけである。
- `trace-context.server.ts` は trace 相関を出し入れする。現在の有効な span から trace ID と span ID を抽出し（logging にはこの関数を起動境界で注入する）、同じ span を W3C の `traceparent` として書き出し、ブラウザが返してきた `traceparent` の文脈で記録を行う。
- `render-span.ts` は描画を span にする。**feature が import する面であり、OTel を import しない。**載せる範囲も包む実装も起動境界から注入で受ける。対象と読み方は下記「描画の計装」が持つ。
- `render-span-runner.server.ts` は span で包む実装。`@opentelemetry/api` を使うのはこちらで、起動境界が `render-span.ts` へ注入する。
- `otlp-log-sink.server.ts` は logging が渡す正規化済みレコードを OTel Logs API へ変換する。OTLP 属性へ変換できない値は送出しない。
- `web-vital-metric.server.ts` はブラウザが測った Web Vitals を OTel の metric として記録する。下記「ブラウザ側のシグナル」が持つ。

## 描画の計装

`withScreenSpan(name, render)` と `withPartSpan(name, render)` は、渡されたコンポーネントを span で包んだ同じ形のコンポーネントを返す。span 名は `render <name>` で、`name` には `src/` からのモジュールパスを渡す。tracer の scope 名は `render` である。**span 名に利用者の入力を混ぜてはならない** —— 名前が要求ごとに散ると、名前を単位にした集計が成り立たなくなる。

2 つは載せる対象が違う。`withScreenSpan` は**画面の最上位**（`features/<name>/<screen>/` の `page-content` と `view`、および殻の側で取得を持つ合成。殻と穴に割れた画面では 1 route に複数立つ）、`withPartSpan` は **feature が持つ部品**（`ui/`）である。装備の手順と対象の線引きは [features/README.md](../features/README.md) が持つ。`components` は横断 UI であり画面ごとの帰属を持たないので対象にせず、route segment は Next.js が `render route (app)` を張るので二重に持たない。

### 載せる範囲

範囲と実装は `configureRenderSpans({ screens, parts, run })` で**起動境界から注入する**。注入を受けない実行（テスト・Storybook・ブラウザ）では span を作らない。

**実装を注入で渡すのは、feature 向けの面に OTel を持ち込まないためである。** `render-span.ts` は feature が import するのでブラウザのバンドルにも入る。`@opentelemetry/api` を連れて行くと、Vite が取り込む CJS ビルドがブラウザに無い `__dirname` を参照し、**モジュール評価の時点で落ちる** —— その面を import した story は 1 つも描けなくなる。

**SDK の有無を無効化の代わりに使えない。** `OBS_TRACES_EXPORTER=none` にしても、logs か metrics が有効なら `NodeSDK` は tracer provider を立てるため、span は記録されたうえで捨てられる —— 成果物だけがゼロになり、計装のコストは残る。だから範囲を独立した軸として持つ。

供給は `OBS_RENDER_SPANS`（`none` / `screen` / `part`、既定 `screen`）で、`tracesEnabled` との合成は起動境界が行う。`part` を開けると 1 描画の span が描く部品の数だけ増えるので、常用ではなく調査のときに開ける。

### span が覆う範囲

覆うのは**そのコンポーネント自身の実行だけ**である。子は戻り値を React が受け取った後に描画されるため、子の span はこの span の中に入らず、同じ親（`render route (app)`）の下に兄弟として並ぶ。したがって **span の時間は部分木の合計ではない**。画面ぜんぶの所要は `render route (app)` が持ち、最上位の span が答えるのは「そこまで到達したか」と「自分の本体で何を待ったか」である。

入れ子にするには、子を要素として返す代わりに関数として呼ぶしかない。その部分木は Suspense 境界・streaming の単位・reconciliation を失う。**描画モデルを捨てる対価に見合わないので入れ子にしない。** React の context で親の実行文脈を配る方法は Server Component が context を持たないため採れず、`AsyncLocalStorage` も子がレンダラのタスクから呼ばれるため届かない。

### 何が中に入るか

**本体で待つ取得は中に入る。** 外向きの `fetch` がどの画面のどの合成から出たのかは、この入れ子で辿れる。取得を `layout` や app shell が持つ場合、その通信は最上位の span の外に出る —— 呼んでいるのが feature ではないためである。

### 失敗

描画が投げると span を `ERROR` にし、`Error` であれば例外として記録して投げ直す。**Next.js が制御に使う throw（`notFound` / `redirect` など）は失敗として扱わない。** 判定は `unstable_rethrow` に委ね、framework の内部表現を読み取らない。

### 記録しない実行

範囲が無効な呼び出しでは span を作らず、包んだコンポーネントをそのまま呼ぶ。ブラウザでの描画も同じで、注入を受けないため何も作らない。

## ブラウザ側のシグナル

ブラウザで測った値と、ブラウザで捕捉されなかった例外は、**同一オリジンの BFF が中継する**。ブラウザから collector を直接叩かせない ——endpoint も資格情報もブラウザへ出さないためであり、RUM の SaaS SDK を同梱しないのと同じ理由に立つ。経路は `adapters` が持ち、口は `app/api/telemetry/route.ts` である。

このカーネルが受け持つのは、届いた測定を signal へ載せるところと、**ブラウザへ渡す trace 相関の出し入れ**（`trace-context.server.ts`）である。

**ブラウザは自分の trace を始めない。** root layout がアクティブな span を `traceparent` として渡し、ブラウザはそれを親に取る。こうすると SSR から、その画面が後で出した取得までが 1 本の trace になる。渡らない実行（静的生成された画面）ではブラウザ側で新しい trace が始まる。ブラウザが作った span は OTLP のまま中継され、このカーネルは通らない（`adapters/server` が collector へ渡す）。

**Web Vitals は分布として持つ。** 指標ごとにヒストグラムを 1 つ立て、`http.route` と評価・遷移種別を属性に載せる。求めたいのは実利用者ぶんの百分位であり、1 件ずつのレコードから毎回それを組むより、計器の側が分布を持つほうが読む側の手数も保持のコストも小さい。

| 計器 | 単位 | 値の刻み |
| --- | --- | --- |
| `browser.web_vital.lcp` / `.fcp` / `.ttfb` | `ms` | 読み込みの時間（0〜10,000） |
| `browser.web_vital.inp` / `.fid` | `ms` | 操作の応答（0〜1,000。1 フレームから刻む） |
| `browser.web_vital.cls` | `1` | ずれの量（0〜1） |

**刻みは指標ごとに持つ。** 既定はミリ秒の量を想定した並びなので、0 から 1 に収まる `CLS` は最初の 1 区間へ全部入り、百分位が区間の内挿だけで決まる —— 0.03 の実測から 3.75 が出る。刻みは分布をどの粗さで持つかの選択であって、good / poor の境界ではない。

属性は `http.route`（公式 semconv）と `browser.web_vital.rating` / `browser.web_vital.navigation_type` である。route は 1 件ぶんのパスではなく **route の型**（`/docs/[slug]`）で、これはブラウザ側で戻している —— パスをそのまま載せると属性の値が閲覧された件数だけ増え、識別子も一緒に流れる。

**log の event にはしない。** 公式 semantic convention が web vitals へ与えているのは `browser.web_vital` という event 名だけで、metric 名は定めていない。それでも event で出さないのは、そうすると **1 レコードごとに中継の POST の span が付く**ためである —— 測定はブラウザで起きており、その要求の中では起きていない。因果の無いところに親子が生まれ、trace から辿っても「beacon が届いた」以上のことは言わない。計器の名前はこのリポジトリが決めるが、下記「運用」が禁じているのは vendor 固有のスキーマを持ち込むことであり、名前空間を切って OTel の命名規則に沿わせる限り移送先を選ばない。

**dev では同じ測定が 2 回届く。** React の Strict Mode が effect を 2 度呼び、`useReportWebVitals` は購読を解除しないため、計測器への登録が 2 つ残る。production build では 1 回である。

**閾値はここに置かない。** [0101](../../docs/adr/0101-performance-budget.md) が持つのは計測の仕組みであり、good / poor の境界をどこに引くかはテンプレートから作った側の判断である。属性の `rating` は web.dev が公表している境界による評価で、このリポジトリが引いた線ではない。

**伏せる項目は中継が伏せる。** ブラウザが作った span の属性のうち、`logging` が持つ表（`authorization` / `cookie` / `password` / `token`）に当たる名前は、collector へ渡す前に censor へ置き換わる。掛ける場所が中継なのは、そこが全部を通る唯一の場所だからである —— ブラウザ側で掛けても送信者は差し替えられる。**値の中身は見ない**（名前で持ち回っている限り効き、そうでないものは元の設計が誤っている）。

例外のほうは metric ではなく `logging` の構造化ログへ載せる。1 件ずつ辿るものであり、`exception.type` / `exception.message` / `exception.stacktrace` という公式 semconv の属性がそのまま使える。**`trace_id` は画面を組んだ要求のもの**である —— ブラウザが返してきた `traceparent` の文脈で記録するためで、渡ってこなければ trace を付けない。中継要求の span を付けると、例外が起きていない要求と親子になる。

## span の属性名は出所で違う

同じ trace の中でも、span を張った計装によって HTTP の属性名が違う。**`http.request.method` で絞ると Next.js のスパンだけが引っかからない。**

| scope | 属性名 |
| --- | --- |
| `next.js` | `http.method` / `http.target` / `http.status_code` / `http.url` |
| `browser-telemetry` / `@opentelemetry/instrumentation-undici` | `http.request.method` / `url.path` / `http.response.status_code` |

Next.js 自身の計装が v1.0 前の命名のままであり、このカーネルからは変えられない。**絞り込むときは両方の名前を見る。**

```text
{ span.http.request.method = "GET" || span.http.method = "GET" }
```

## signal の有効化

`OTEL_EXPORTER_OTLP_ENDPOINT` は OTLP HTTP の base endpoint を、`OBS_TRACES_EXPORTER`、`OBS_METRICS_EXPORTER`、`OBS_LOGS_EXPORTER` は signal ごとの有効化を表す。各値は `otlp`、`none`、または空文字列であり、`otlp` だけが有効である。base endpoint には各 signal の `/v1/traces`、`/v1/metrics`、`/v1/logs` を自動付与する。無効な signal は exporter、batch processor、metric reader を生成しない。描画の範囲を決める `OBS_RENDER_SPANS` は signal ではないので、この gate とは別に効く（trace 自体が無効なら描画 span も出ない）。変数の一覧と環境別の供給方法は [env/README.md](../../env/README.md) を参照する。

## 実行機序

Next.js は Node.js サーバーを準備すると `src/instrumentation.ts` の `register()` を自動実行する。そこで Config を bootstrap し、signal 構成を `initializeObservability()` へ注入する。続いて `OBS_LOGS_EXPORTER=otlp` の場合だけ OTLP Logs sink を logging に注入する。Edge runtime と browser ではこの SDK を初期化しない。ブラウザ側のシグナルは BFF 中継を通ってサーバー側のこの SDK に載る（上記「ブラウザ側のシグナル」）。

## 運用

- OTLP と公式 semconv のみを使用する
- 実装時に設定値を注入し、vendor 固定を避ける
- local 開発では go 側 compose の `observability` が公開する OTLP HTTP `http://localhost:4318` と Grafana `http://localhost:3000` を使う
- テンプレートから作った側のバックエンドや collector に合わせて endpoint、`service.name`(`OBS_SERVICE_NAME`)、signal 有効化を設定する。`service.name` は同じ trace に載る他サービスと異なる値にする。Grafana、Sentry、Faro などの SDK をこのカーネルへ直接固定しない
- Next.js が自前で張る `fetch` span は、span 名に query 付きの URL をそのまま載せる。名前が要求ごとに散って集計の単位にならないので、抑止するなら `NEXT_OTEL_FETCH_DISABLED=1` を使う。同じ外向き通信は Undici instrumentation の span が覆い、そちらの名前は経路だけを持つ

## 関連する ADR

- [0021](../../docs/adr/0021-frontend-responsibility.md) — config を import せず起動境界から注入を受ける層の線
- [0081](../../docs/adr/0081-observability-logging.md) — OTLP と公式 semconv だけを使うベンダ中立の方針、伝播先と redaction
- [0082](../../docs/adr/0082-client-observability.md) — ブラウザ側の測定と例外を同一オリジンの BFF が中継する経路
- [0101](../../docs/adr/0101-performance-budget.md) — Core Web Vitals をどう測るか。good / poor の閾値はここに置かない
