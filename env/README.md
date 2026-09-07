# 環境変数

環境別の実体は `env/.env.<環境>` に置きます。`src/config/load-environment.ts` が Next.js の
起動・build 前に選択したファイルを読み込みます。

`APP_ENV` が選択子であり、**指定は必須です**。未指定のまま起動すると、読み込むファイルを
選べないものとして落とします。既定を持たせると、設定を忘れた実環境が同梱の `env/.env.local`
を読み、注入し忘れた変数だけが手元向けの値で埋まった状態で起動します。

CI と PaaS は環境設定で `APP_ENV` をそれぞれ `ci`、`dev`、`stg`、`prd` に設定します。PaaS の
環境変数はファイルの値より優先されます。手元の開発では `pnpm dev` / `pnpm storybook` /
`pnpm build-storybook` が `local` を渡すため、clone 直後はそのまま動きます。配信物を作る
`pnpm build` と `pnpm start` は既定を持たないので、`APP_ENV=local pnpm build` のように指定します。

**`APP_API_BASE_URL` は build 時にも使われます。** リクエストをまたいで残す取得
（[ADR 0071](../docs/adr/0071-bff-api-integration.md) の `use cache`）は、キャッシュの中身を作るために
build 中にも呼ばれます。`APP_API_MODE=live` で取得先へ到達できない場所から `pnpm build` を回すと、
そこで落ちます。

**`mock` のときは `pnpm build` が取得先を自分で立てます**（[mocks/serve.ts](../mocks/serve.ts)）。
`src/instrumentation.ts` の interception はそれを立てたプロセスにしか効かず、プリレンダーは別の worker
プロセスで走るため、HTTP の口として立てないと届きません。`APP_API_BASE_URL` はその待ち受け先になります。

`dev` / `stg` / `prd` の required 値は PaaS の環境設定または secret store から供給します。
そのため、これらのファイルは変数名と既定値候補だけをコメントで保持します。

## サブシステム別の変数

### Application

| Variable Name | Description | Type | Example | Notes |
| --- | --- | --- | --- | --- |
| `APP_API_BASE_URL` | BFF が接続する API の base URL | URL | `http://localhost:8080` | Required。環境ごとの API 接続先 |
| `APP_API_MODE` | API 接続モード | `live` / `mock` | `live` | Required。`mock` は local / CI のみで用いる |
| `APP_MAINTENANCE_MODE` | 配信を止めているか | `off` / `on` | `on` | Code default `off`。`on` で全ルートを停止画面へ差し替える。切り替えには起動し直しが要る |

### Clock

| Variable Name | Description | Type | Example | Notes |
| --- | --- | --- | --- | --- |
| `CLOCK_FIXED_NOW` | 画面が「いま」として読む瞬間の固定 | ISO 8601 の日時 | `2026-01-01T00:00:00.000Z` | Optional。未設定・空文字なら実時計。検証の環境だけが指定する |

暦日で区切る画面は、区切りを要求のクエリへ載せます。クエリが実時計から導かれると、契約から応答を
組み立てるモックの seed も一緒に動くため、その画面の基準画像は撮った暦日のあいだしか一致しません。
`env/.env.ci` だけが値を持つのはこのためで、配信する環境は未設定のまま実時計で動きます。

### Media

| Variable Name | Description | Type | Example | Notes |
| --- | --- | --- | --- | --- |
| `MEDIA_ORIGIN` | バックエンドが返すオブジェクトキーの配信 origin | URL | `https://media.example.com` | Required。この値だけが `next/image` の許可 host と CSP の `img-src` を決める（[0045](../docs/adr/0045-fonts-and-images.md) / [0111](../docs/adr/0111-csp-security-headers.md)）。配信元が host 名でバケットを解決する形式なら、その host を含めた origin を置く |

### Observability

| Variable Name | Description | Type | Example | Notes |
| --- | --- | --- | --- | --- |
| `OBS_SERVICE_NAME` | テレメトリの発信元を表す service 名 | string | `Boilerplate Web` | Required。trace / metrics / logs の resource に `service.name` として載る。backend と同じ trace の中で発信元を見分けるため、相方のサービスと異なる値にする |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP HTTP の base endpoint | URL | `http://localhost:4318` | Required。OpenTelemetry 標準名をそのまま使う。各 signal は `/v1/traces` などを自動付与する |
| `OBS_TRACES_EXPORTER` | trace exporter の有効化値 | string | `otlp` / `none` | 空文字列または `none` は無効。`otlp` は OTLP exporter を構築する |
| `OBS_METRICS_EXPORTER` | metrics exporter の有効化値 | string | `otlp` / `none` | 空文字列または `none` は無効。`otlp` は OTLP exporter を構築する |
| `OBS_LOGS_EXPORTER` | logs exporter の有効化値 | string | `otlp` / `none` | 空文字列または `none` は無効。`otlp` は OTLP exporter を構築する |
| `OBS_RENDER_SPANS` | 描画を span に載せる範囲 | `none` / `screen` / `part` | `screen` | Code default `screen`。`screen` は画面の最上位（`page-content` / `view`）、`part` は feature が持つ部品まで。`part` は 1 描画の span が描く部品の数だけ増えるため、調査のときに開ける。trace 自体が無効なら効かない |

### Authentication

| Variable Name | Description | Type | Example | Notes |
| --- | --- | --- | --- | --- |
| `AUTH_MODE` | 認可の開始先 | `idp` / `dev` | `idp` | Code default `idp`。`dev` は IdP を立てずに `/dev/session` から session を発行させる。開発専用の口が開く環境（`local` / `ci`）でしか効かない |
| `AUTH_ISSUER` | OIDC issuer と Discovery の起点 | URL | `https://idp.example.com/realms/main` | Required。**同梱の `local` / `ci` が指すのは開発用の IdP**で、テンプレートから作った側は最初に自分の IdP へ差し替える |
| `AUTH_CLIENT_ID` | Authorization Code + PKCE の public client ID | string | `<IdP が発行した public client ID>` | Required。client secret は不要。同梱の値は開発用の IdP に登録されたものなので、自分の IdP へ登録し直した ID に差し替える |
| `AUTH_REDIRECT_URI` | OIDC callback URL | URL | `http://localhost:3000/api/auth/callback` | Required。IdP 登録値と完全一致させる |
| `AUTH_SCOPES` | 認可リクエストの space-delimited scope | string | `openid profile email api.read api.write` | Required |
| `AUTH_SESSION_SECRET` | BFF session cookie を保護する秘密値 | string | `local-development-session-secret-change-before-production` | **Secret management required**。32 文字以上。`local` / `ci` に同梱している値は公開リポジトリに載っているため、それ以外の環境では起動時に拒否される |

### HTTP

| Variable Name | Description | Type | Example | Notes |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_HTTP_MAX_URL_BYTES` | 1 つの要求 URL に許すバイト数の上限 | integer | `8000` | Required。ブラウザ / CDN / リバースプロキシ / backend のうち、経路上で最も小さい上限を入れる。既定値はどれも持たない |
| `NEXT_PUBLIC_HTTP_MAX_UPLOAD_BYTES` | 中継する 1 件のアップロードに許すバイト数の上限 | integer | `4194304` | Required。配備先が要求本体に課す上限より内側に取る。外側の値は配備先が先に打ち切るため効かない |
| `HTTP_ALLOWED_ORIGINS` | BFF（`/api/*`）を別 origin から呼ばせる相手 | origin のカンマ区切り | `https://admin.example.com,https://app.example.com` | Optional。空なら同一 origin だけ。挙げた origin は CORS で開き、状態を変える要求の送信元としても信頼する（[0111](../docs/adr/0111-csp-security-headers.md) §5）。パス付き・`*` は不可 |

### Site

| Variable Name | Description | Type | Example | Notes |
| --- | --- | --- | --- | --- |
| `SITE_PUBLIC_ORIGIN` | 外から見たこのサイトの origin | origin（パス無し） | `https://www.example.com` | Required。canonical / `sitemap.xml` / OG 画像の絶対 URL はこの値へ経路を足して組み立てる。要求の `Host` からは採らない（配信面を挟むと公開名と一致しない） |
| `SITE_INDEXABLE` | 検索エンジンに索引させてよいか | `off` / `on` | `on` | Code default `off`。`on` で `robots.txt` が巡回を許し、画面から `noindex` が外れる。**索引させてよい環境（通常は `prd`）だけが `on` を宣言する**（[`docs/rules.md`](../docs/rules.md) #63） |

**この 2 つは build 時にも読まれる。** 静的に描かれる画面の metadata と `robots.txt` はプリレンダーに
焼き込まれるため、`pnpm build` と `pnpm start` に同じ値を渡す。起動時の差し替えだけでは効かない。

### Analytics

| Variable Name | Description | Type | Example | Notes |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_ANALYTICS_GTM_CONTAINER_ID` | 同意ゲートの裏で読み込むタグマネージャの容器 ID | string | `GTM-ABC1234` | Optional。**空は「未設定」ではなく「読み込まない」** —— 作った側が Google への依存を外す口がこれで、外した状態でも画面は成立する（[0131](../docs/adr/0131-cookie-consent.md) §2）。secret ではない（容器 ID はタグを読む URL に現れるため、使っているサイトでは常に公開されている）。値を入れる配備は、`script-src` / `connect-src` / `img-src` が Google の origin を許し、`Cross-Origin-Embedder-Policy` が降りることを受け入れる |

## 運用

- config を経由して利用する変数は `src/config/` のスキーマで、ビルド時とサーバー起動時に検証される。
- `NEXT_PUBLIC_` 変数にはブラウザへ露出してよい公開値だけを置く。secret を置いてはならない。
- `NEXT_PUBLIC_` はビルド時にリテラルへ置換されるため、値の変更には再ビルドが要る。起動時の差し替えは効かない。
- 新しい変数を追加する前に、利用目的・server/client 境界・required/default・secret 管理ラベルを確認する。
