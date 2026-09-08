---
imports-allowed: []
forbidden: [ui, fetch, business-logic]
test-requirement: unit
coverage-exclusions:
  - "src/config/environment.fixture.ts"
---

# config

型付き設定を目的別に提供するカーネルです。各 config は `#` private field と getter
だけを公開する不変の ESM singleton です。

## 受け入れるもの

- 環境変数の検証、目的別 config、設定値の不変な公開面

## 受け入れないもの

- UI、fetch、業務ロジック

## config 一覧

| モジュール | 用途 | 種別 | 利用者 |
| --- | --- | --- | --- |
| `api/api.schema.ts` / `api/api.server.ts` | API base URL と接続モードの schema / Config | server | `adapters/server` と起動・ビルド境界 |
| `auth/auth.schema.ts` / `auth/auth.server.ts` | OIDC と BFF session の schema / Config | server | `adapters/server` と起動・ビルド境界 |
| `clock/clock.schema.ts` / `clock/clock.server.ts` | 画面が読む「いま」の schema / Config | server | `app` と起動・ビルド境界 |
| `maintenance/maintenance.schema.ts` / `maintenance/maintenance.server.ts` | 配信を止めているかの schema / Config | server | `proxy` と起動・ビルド境界 |
| `media/media.schema.ts` / `media/media.server.ts` | media origin の schema / Config | server | `adapters/server` と起動・ビルド境界 |
| `observability/observability.schema.ts` / `observability/observability.server.ts` | service 名・OTLP endpoint・signal 別 exporter の schema / Config | server | 起動・ビルド境界 |
| `http/http.schema.ts` / `http/http.server.ts` / `http/http.client.ts` | 要求 URL とアップロードに許すバイト数の上限、BFF を別 origin から呼ばせる相手の schema / Config | server + client | `adapters/server` / `adapters/client` / `src/proxy.ts` と起動・ビルド境界 |
| `site/site.schema.ts` / `site/site.server.ts` | 外から見た origin と、索引させてよいかの schema / Config | server | `app`（metadata / `sitemap.ts` / `robots.ts`）と起動・ビルド境界 |
| `analytics/analytics.schema.ts` / `analytics/analytics.client.ts` | 同意ゲートの裏で読み込むタグマネージャの容器 ID の schema / Config。**空は「読み込まない」という指定**で、Google への依存を外す口になる | client | `app` の client island |
| `security-headers/security-headers.ts` | 全経路に付ける配信ヘッダ（CSP と同伴ヘッダ）の組み立て | build 境界 | `next.config.ts` |
| `bootstrap.server.ts` | 起動時の ENV 読込と全 config 検証 | server | `src/instrumentation.ts` |

各 `config/<purpose>/<purpose>.schema.ts` が自分の目的に属する Zod validator を、対応する
`<purpose>.server.ts` が不変 Config を所有します。`environment.ts` は validator を呼んで全量検証を
実行するだけで、個別の変数規則を持ちません。`next.config.ts` が build 時に、
`src/instrumentation.ts` がサーバー起動時に検証を実行します。

## 実行機序と評価タイミング

Config の評価はリクエストごとに行いません。ENV を一度だけ読み込み、検証済みの値から目的別の
singleton を作り、以後は import で配線します。

```text
build / Next.js 初期化
  next.config.ts
    ├─ loadEnvironment()
    │    └─ APP_ENV (指定必須) から env/.env.<環境> を選択
    └─ validateEnvironment()
         └─ getEnvironment() で全 ENV を一度だけ検証

Node.js サーバーインスタンスの起動
  Next.js → src/instrumentation.ts の register()
    └─ config/bootstrap.server.ts の bootstrapConfig()
         ├─ loadEnvironment()
         └─ validate-environment.server.ts を import
              └─ api / auth / http / media / observability の getter を呼び singleton を初期化
    └─ observability Config から signal 構成を読み、OTel SDK と logger を初期化

リクエスト処理
  adapters/server → 目的別 Config singleton を import
  （ENV 読込・schema parse は再実行しない）
```

| 時点 | 実行するもの | 評価内容 | 回数 |
| --- | --- | --- | --- |
| Next.js の設定評価 | `next.config.ts` | 選択済み env ファイルの読込と全 ENV の形式検証 | build / dev 起動ごと |
| Node.js サーバー起動 | `src/instrumentation.ts` → `bootstrap.server.ts` | server Config singleton の生成 | 新しいサーバーインスタンスごと |
| Config singleton の生成 | `getApiConfig()` など | `getEnvironment()` の共有済み評価結果を private field へ写す | getter の初回呼出し時、プロセスごとに一度 |
| 通常のリクエスト | `adapters/server` | singleton の getter を読む | リクエストごと。ただし parse なし |
| unit test | `vi.stubEnv()` と `vi.resetModules()` | env スタブを設定して Config module を再評価する | テスト呼出しごと |

`loadEnvironment()` は `override: false` で読み込むため、CI / PaaS がすでに注入した変数を
上書きしません。`env/.env.dev`・`.env.stg`・`.env.prd` は変数名の宣言に留め、実値は PaaS の
環境設定または secret store から供給します。

`src/instrumentation.ts` は Next.js の規約ファイルであり、`register()` はサーバーインスタンスの
準備時に Next.js が自動実行します。Edge runtime では Node.js のファイル読込を行えないため、
Node.js runtime だけが `bootstrapConfig()` を呼びます。bootstrap 後は observability Config を読んで
OTel SDK と logger へ値を注入します。Config 自身は logger / observability を import しません。

## Config の配線

- `next.config.ts` は build 境界として `loadEnvironment()` と `validateEnvironment()` を直接呼ぶ。
- `src/instrumentation.ts` は起動境界として `bootstrapConfig()` だけを呼ぶ。
- `bootstrap.server.ts` は `validate-environment.server.ts` を import し、全 server Config getter を一度呼ぶ。
- `adapters/server` と `proxy.ts` は必要な目的の `get*Config()` だけを import し、feature / model / component は Config を import しない。
- 内側のロジックへ設定値が必要な場合は、adapter が getter から取り出した値を引数で渡す。
- Config class と ENV parser は module 外へ export しない。通常コードが任意の ENV から Config を再生成する経路を持たせない。
- unit test は `vi.stubEnv()` と `vi.resetModules()` で module cache を再評価し、公開 singleton を検証する。

## 運用

- `process.env` の直読はこのカーネルだけに置く。
- server config は `import "server-only"` で保護し、`adapters/server` と起動・ビルド境界、そして入口の `proxy.ts` だけが import する。
- client config は `NEXT_PUBLIC_` の静的ドット参照だけを持つ `*.client.ts` に置く（`http/http.client.ts`）。ここで検証はしない（ブラウザは検証の実行点ではない）。server config の値を props として client へ渡さない。
- 環境変数の一覧・テンプレート・secret 管理ラベルは [env/README.md](../../env/README.md) を正とする。

## 関連する ADR

- [0021](../../docs/adr/0021-frontend-responsibility.md) — 設定を読めるのがどの層までかという線
- [0030](../../docs/adr/0030-environment-variable-management.md) — `env/` の構成、目的別 config、`NEXT_PUBLIC_` の境界、secret の扱い、code default の位置付け
- [0075](../../docs/adr/0075-file-upload-seam.md) — アップロードの経路と、中継に許すバイト数をどこより内側に取るか
- [0076](../../docs/adr/0076-payment-ui-seam.md) — 決済 UI の seam。`payment` を既定で閉じる根拠
- [0079](../../docs/adr/0079-auth-frontend-seam.md) — 認証モードと session の front 側の持ち分
- [0111](../../docs/adr/0111-csp-security-headers.md) — CSP と同伴ヘッダの内容、要求に依らないヘッダを配信側へ置く判断、別 origin から BFF を呼ばせる条件
- [0131](../../docs/adr/0131-cookie-consent.md) — 同意管理を採らない決定と、タグマネージャを既定で読み込まない指定
