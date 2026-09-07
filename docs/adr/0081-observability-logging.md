# 観測性・ロギング

[0020](0020-adopted-architecture.md) / [0021](0021-frontend-responsibility.md) で枠を予約した **`logging` / `observability` カーネル** の中身を確定する。**構造化ログ / OTel(vendor-neutral OTLP)/ シグナル別 config gating / trace 相関 / ブラウザ側テレメトリの扱い** を定める。

## Status

Accepted

## 背景

構造化ログのスキーマ・出力先(ブラウザ → BFF 中継 vs 直接 SaaS)・観測性 SaaS SDK の採否・trace ID 伝播は、決めずに置くと feature ごとに vendor SDK を直接 import する形で散る。本 ADR がこれらを確定する。

logging は **抽象 `Logger` interface(ctx-native・実装ライブラリを隠蔽)** で提供し、observability は **vendor-neutral OTLP-only** / **シグナル別 config gating** / **公式 semconv のみ** で構成する —— vendor SDK をアプリコードが直接持つと差し替えが構造的に不可能になり、signal ごとに切れないと「trace だけ止める」が「全部止める」になる。本 ADR はこの構造を表示層(サーバ + ブラウザ)へ敷く。

## 決定

### 1. 構造化ログ(`logging` カーネル)

- ログは **抽象ロガー interface** 経由とし、実装(pino 等)をアプリコードから隠蔽する(実装ライブラリは [0004](0004-library-management.md) で確定)
- **ctx-native**: ロガーは実行コンテキスト(サーバは `AsyncLocalStorage` 等の request context)から **`trace_id` / `span_id` を自動注入**する(caller は明示的に渡さない)
- レベルは Debug / Info / Warn / Error。**出力先・format は注入で決める**(config を logging カーネルが直読しない。[0021](0021-frontend-responsibility.md)。production = JSON / development = console 相当)
- **ログキースキーマを 1 箇所に集約**する(`trace_id` / `span_id` / `error_code` / `error_message` / `latency_ms` / `request_id` 等)
- **PII / token / password をログに出さない**(masking。[0080](0080-error-handling.md) の redact と一致)。`console.log` はコミットに残さない([0002](0002-formatter-linter.md) `noConsole`)
- **伏せるのは名前で決め、値の形は見ない。** 値から秘密を見分けようとすると、見分けられなかったものが素通りし、見分けられたつもりのものが偽の安心になる。伏せる項目名の表はコード(`src/logging`)が持ち、名前に当たる値は形を問わず伏せる

### 2. OTel(`observability` カーネル)= vendor-neutral OTLP-only

- テレメトリの export transport は **OTLP に固定**する。**アプリコード(`features` / `components` / `model` 等の内層)は vendor SDK を import しない**。vendor SDK を使う場合でもそれは `observability` カーネルの **OTLP / OTel exporter 実装**として境界の裏に閉じ込め(§6)、vendor-specific なルーティング / 認証は **Collector / Agent 側 or その exporter 実装内**に置く
- resource attribute は **公式 semconv のみ**(`service.name` / `deployment.environment.name` / `service.version` 等)。custom / vendor-specific キーを typed config に入れない
- W3C `TraceContext` + `Baggage` を伝播規約とする(サービス境界越えの trace 伝播)。外向き `fetch` への注入先は **backend API の origin に限定**し、IdP など別の接続先へ `Baggage` を渡さない
- **span にもログと同じ redaction を掛ける**(上記 1 の PII / token / password 規則は span 属性と span 名の双方に及ぶ)。
- **query 文字列は span から落とさない。** 秘匿すべき値を query へ載せていること自体が誤りであり、そこに置いた時点でブラウザの履歴・リファラ・経路上のアクセスログへ残っている。trace で伏せても守るものが無く、代わりに「どの条件の要求が遅いか」を追えなくする。
- **span 名には query を載せない。** これは秘匿ではなく**集約**の要求である —— 条件は要求ごとに違うので、名前に含めると同じ経路の要求が別の名前へ散り、名前を単位にした集計が成り立たなくなる。条件そのものは属性(`url.full` / `url.query`)に残るので、1 件ずつ辿るときは読める。

### 3. シグナル別 config gating

- traces / metrics / logs を **`OBS_*` config(例 `OBS_TRACES_EXPORTER` / `OBS_METRICS_EXPORTER` / `OBS_LOGS_EXPORTER` / `OBS_OTLP_ENDPOINT`)で個別に on/off** する。専用 enable flag は持たず、**exporter 値が non-empty かつ `none` でなければ enabled** と derive する
- **何を計装するかは transport と別の軸で持つ**。描画の計装は `OBS_RENDER_SPANS`(`none` / `screen` / `part`)で範囲を選び、起動境界から注入する。exporter の無効化を計装の無効化の代わりに使えない —— `OBS_TRACES_EXPORTER=none` でも他の signal が有効なら SDK は tracer provider を立て、span は記録されたうえで捨てられる(成果物だけがゼロになり計装のコストは残る)
- gating は **構築時**に効かせる(disabled シグナルは exporter / batcher / reader を一切作らない)。config は [0030](0030-environment-variable-management.md) の型付き Config で供給し、`observability` は config を注入で受ける([0021](0021-frontend-responsibility.md))
- **`logging` は `observability` を import しない**(依存方向を逆転させない)。trace 抽出は `observability` が提供する抽出器を logging へ**注入**する

### 4. ログと trace の相関

- active trace context を持つログ行に `trace_id` / `span_id` を載せ、backend で同一 trace に揃える(上記 1 の ctx-native 注入 + OTLP log export)。相関は上記の signal gate が支配する

### 5. ブラウザ側テレメトリの扱い(表示層固有)

**server 常駐の OTel exporter / batch 処理 / shutdown hook** を前提にした構成は、Next.js のブラウザ・serverless / edge には**そのまま載らない**ため、以下の形を採る:

- **サーバ側(Node runtime)**: 上記 1〜4 の pino + otel-js 相当を適用。serverless では長寿命 exporter を前提にせず、リクエスト境界での flush / OTLP 送信を基本とする
- **ブラウザ側テレメトリは BFF 中継を seam とする**: クライアントで計測した値は **`/api/*`(BFF)経由でサーバへ送り、サーバ側で OTLP export** する(ブラウザから直接 SaaS / collector へ送らない)。これは [0030](0030-environment-variable-management.md) の「secret を `NEXT_PUBLIC_` に出さない」「BFF runtime config」と整合し、vendor lock-in も避ける。fork が vendor SDK を使う場合も、ブラウザ→SaaS の直送でなく **自ドメイン `/api/*` 経由のリレー**でこの seam を保つ
- **ブラウザ側も OTel の SDK で計装する**: ブラウザは自分で span を作り、それを上記の中継へ流す。中継が受けるのは OTLP そのもので、サーバは読み替えずに collector へ渡す。**送り先だけがブラウザから見えない** —— collector の endpoint も資格情報もサーバ側に留まり、seam は変わらない。ブラウザは自分の trace を始めず、サーバが配った `traceparent` を親に取る(これが無いと、ブラウザ発の記録は中継要求の span に紐づき、測定が起きていない要求と親子になる)。**計装は最初の描画の後に読み込む** —— 計測のための資材を初期の読み込みへ載せると、測っている当のものを悪くする

### 6. 観測性バックエンド = OTLP/OTel(vendor-neutral・vendor SDK 非同梱)

観測性の export transport は **OTLP / OTel 一本**(vendor-neutral)とし、**特定の観測性 / RUM SaaS SDK(Sentry / Datadog 等)を本体に同梱しない**(fork 先判断)。エラー通知・アラート等の運用機能は、fork が向け先に選ぶ **OTLP 互換バックエンド**(任意の OTLP Collector / SaaS = Grafana / Honeycomb / Datadog / Sentry 等)側で行う —— vendor SDK を同梱してまで本体が持つべき運用機能は無く、向け先の側で足りる。本体は OTLP export の口だけを持ち、vendor 固有 SDK に依存しない。

- **差し替え可能性([0010](0010-standards-and-non-lockin.md))**: OTLP / OTel semconv は W3C / CNCF の公開標準であり、向け先を任意の OTLP バックエンドへ変えられる。vendor SDK を本体に持たないため lock-in が構造的に生じない(設計者が選択主体)。
- vendor SDK を使う fork は、それを `observability` カーネルの **OTLP / OTel exporter 実装**として境界の裏に閉じ込める(アプリコードは `observability` の公開面〈構造的型〉に依存。vendor 具象を `features` / `components` / `model` へ散らさない。[0021](0021-frontend-responsibility.md))。導入時は exact-pin + `pnpm audit`([0004](0004-library-management.md))。

## 禁止事項

- ❌ **`features` / `components` / `model` から vendor 観測性 SDK(`@sentry/*` 等)を直接 import すること**(vendor 直参照を散らさない。vendor SDK の配線は `observability` / `adapters` / 起動境界に限る = §6 / [0010](0010-standards-and-non-lockin.md) / [0021](0021-frontend-responsibility.md))
- ❌ vendor 具象へアプリコードを直結し **差し替え不能にすること**(依存先は `observability` カーネルの公開面。OTLP / OTel 骨格を迂回して vendor 固有機能へロックインしない)
- ❌ custom / vendor-specific な semconv キーを typed config に入れること(公式 semconv のみ)
- ❌ `logging` が `observability` を import すること(依存逆転。trace 抽出は注入で受ける)
- ❌ 起動境界からの注入をモジュール変数へ置くこと(Next は起動境界と RSC を別のモジュールグラフとして組み、同じファイルが 1 プロセス内で 2 回インスタンス化される。realm を共有する registered symbol で渡す)
- ❌ `logging` / `observability` カーネルが config を直読すること(注入で受ける。直読は config カーネルのみ = [0030](0030-environment-variable-management.md)。vendor の DSN / endpoint も typed config 経由)
- ❌ ブラウザから直接 SaaS へテレメトリを送ること(BFF 中継 seam。vendor SDK 使用時も自ドメイン経由に保つ)
- ❌ PII / token / password をログに出すこと / `console.log` をコミットに残すこと([0002](0002-formatter-linter.md))

## 補足

- 本 ADR は logging と observability を 1 本にまとめて定める。両者は別カーネルだが、trace 相関(§4)と redaction(§1 / §2)が両方をまたぐため、分けると同じ規則を 2 箇所に書くことになる

## 関連 ADR

- [0021-frontend-responsibility.md](0021-frontend-responsibility.md) — `logging` / `observability` カーネル(config は注入で受ける)
- [0030-environment-variable-management.md](0030-environment-variable-management.md) — `OBS_*` config の供給 / BFF runtime config / secret 非露出
- [0080-error-handling.md](0080-error-handling.md) — エラーログのレベル(5xx=error / 4xx=warn)・redact(本 ADR がスキーマ・trace 相関を定める)
- [0071-bff-api-integration.md](0071-bff-api-integration.md) — fetch wrapper のログ / trace 伝播 / ブラウザ→BFF 中継の実装層
- [0082-client-observability.md](0082-client-observability.md) — ブラウザ発の経路(trace / RUM / client エラー / プロダクト分析)の具体化
- [0077-bff-abuse-protection-boundary.md](0077-bff-abuse-protection-boundary.md) — 中継 seam が生む公開エンドポイントの保護
- [0002-formatter-linter.md](0002-formatter-linter.md) — `noConsole`(console.log 抑止)
- [0010-standards-and-non-lockin.md](0010-standards-and-non-lockin.md) — vendor-independent 正当化 / 差し替え可能性(vendor SDK を抜いても正当・OTLP 経由で非ロックイン)
- [0004-library-management.md](0004-library-management.md) — fork が vendor 観測性 SDK を導入する場合の exact-pin + `pnpm audit`
- [0020-adopted-architecture.md](0020-adopted-architecture.md) / [0024-adapters-server-client-split.md](0024-adapters-server-client-split.md) — `observability` / `adapters` 境界(vendor SDK を裏に閉じ込める先)
