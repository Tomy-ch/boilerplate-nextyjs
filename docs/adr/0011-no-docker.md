# Docker を boilerplate に含めない方針

本プロジェクトでは **アプリケーション配送としての Docker を採用しない** 方針とする。具体的には、Next.js アプリ本体を動かすための `Dockerfile` および本体配送用 `docker-compose.yml` / `.dockerignore` を同梱しない。あわせて本リポジトリの想定ロールを **「Next.js を表示層 (presentation layer) として用いる boilerplate」** と定義し、デプロイ先は PaaS / 静的 CDN を主想定とする。

一方、**dev インフラとしての docker-compose**（モック backend API・OpenAPI viewer・docs viewer・Lighthouse runner など、アプリ起動とは独立した補助ツール群）の利用は本 ADR の禁止対象外とする（後述「Dev インフラとしての docker-compose（例外）」節を参照）。

## Status

Accepted

## boilerplate の性格

本 boilerplate は **一般的な Next.js アプリケーション基盤** である。これは「Next.js を表示層として用いる」というロール定義の **具体化** であって、ロールの拡張・変更ではない。表示層に必要な汎用ライブラリを boilerplate 側で決めておく、という粒度である（バックエンド業務ロジック / DB・ORM / アプリ本体の self-host Docker はロール外）。

目指すものは 3 つ（哲学 3 本柱）。

1. **考えないでもフロントが組める** — 置き場・書き方・接続点が決まっていて、判断を毎回やり直さない
2. **デザインと README を見れば実装できる** — 画面の見た目はデザイン、部品の使い方と責務は層 README が答える
3. **責務分離されていて綺麗に実装できる** — 層の境界が機械で守られ、正しい置き場が名前から読める

### 同梱するライブラリの範囲

- **汎用・常用のライブラリ**（UI コンポーネント / form state / グローバル状態 / 表示フォーマット / 観測性 等）は **必要なものとして同梱** する。採用の内訳は各 ADR 本体が持つ
- **局所的に使うライブラリ**（i18n / リッチテキスト / DnD / 決済 / 分析 / PWA 等）は**同梱せず、seam だけを持つ**。要るかどうかがプロジェクトごとに割れる依存であり、既定で背負わせると、使わない側が外す作業を負う。seam が在れば、要る側は境界を自分で設計せずに足せる

### out-of-scope の意味

out-of-scope は「**ロール境界の外**」（バックエンド業務ロジック / DB・ORM / アプリ本体の self-host Docker 等）を指す。「まだ決めていない / 最小に留める」という選定の留保ではない。汎用ライブラリの未決は out-of-scope ではなく、各 ADR で **決定済み** である。したがって本 ADR が定める Docker 非採用・表示層ロールの out-of-scope も、「用途未定だから含めない」ではなく「ロール定義上そもそも対象外」という線引きである。

### 採用の規律（[0010](0010-standards-and-non-lockin.md) / [0004](0004-library-management.md)）

同梱する各ライブラリの採用は、本 ADR ではなく個別 ADR が所有する。本 ADR はロール整合の観点からこれを参照するに留めるが、いずれの採用も次を必須とする。

- [0010](0010-standards-and-non-lockin.md): デファクトに乗りつつ **vendor-independent な正当性材料を本体に明記**、かつ **adapters / カーネル境界の裏に置いて差し替え可能** に保つ（vendor 直参照を feature / component に散らさない）。
- [0004](0004-library-management.md): コア依存は **exact-pin**、追加時に **`pnpm audit`**。

## 同梱サンプルと破棄境界

本 boilerplate は題材を持つサンプル（画面・feature・ルート・E2E・モック・生成物からなるジャーニー）を同梱し、テンプレートから作った側はセットアップ時にそれを破棄してコアだけを受け取る（`make setup-remove-sample`）。

- **サンプルは、component を実データ・実操作へ配線した実装例として作る。** `components` に持っている部品を、画面要件に直接現れないことだけを理由に使わずに終えない。API から取得した実データ・form の実入力・Server Action の実送信へ繋ぐ
- **残す / 破棄するの判定基準は「用途特化か汎用か」。** 破棄するのはジャーニーと、題材でしか使わない部品・装飾目的の部品。残すのはドメインを持たないもの — どのプロジェクトでも使う汎用 UI 部品・機構（`cn()` / `ActionState<T>` / 画像ローディングの仕組み等）・デザイントークン・認証・認可の機構
- **破棄対象をディレクトリ名で隔離しない。** ファイルは自然な場所・自然な名前に置き、破棄対象は manifest の明示パス宣言と、共有ファイル内のマーカーで表現する
- 破棄機構の設計は 3 点で成り立つ
  1. **マーカー 3 種** — `sample:begin` / `sample:end`（ブロック・ネスト可）、`sample:line`（行末）、`sample:replace-begin` / `sample:replace-with` / `sample:replace-end`（サンプル在時のコードを除去し、退避してあった代替コードを有効化する）。3 つめは、既定値の切替のように「削除後にだけ有効化したい代替コード」のためにある
  2. **マーカー除去を削除より先に実行する** — 不整合があれば中断し、「消したがマーカーが残った」半端な状態を作らない
  3. **`verify` が過不足を両方見て、最後に自身を消す** — 不足（登録パスの残留）と過剰（登録外の削除）・make ターゲットの消失・残留参照を検証し、検証後に自身とスナップショットを削除してコアのみを残す

## 採用理由

### 1. 想定ロールが「表示層」に限定される

本リポジトリは Next.js を「フロントエンド表示層」として用いる boilerplate と定義する。

- UI レンダリング（CSR / SSR / ISR / 静的書き出し）が主責務
- バックエンド API（DB / 認証 / ビジネスロジック）は **別リポジトリ・別サービス**（例: Go / Rails / NestJS / Supabase 等）
- Next.js の `/api/*` ルートは BFF（外部 API への薄いプロキシ・auth トークン交換）に留め、業務ロジックを抱え込まない

この前提では、アプリ本体の Docker 化が解決する「重い system 依存をコンテナに閉じ込める」「DB / Redis 等のバックエンドサービスを同居させる」というニーズがアプリ配送層では構造的に発生しない（dev 補助としての周辺サービスは別問題、後述）。

### 2. 想定デプロイ先がすべて Docker 不要

| デプロイ形態 | プラットフォーム例 | Docker |
| --- | --- | --- |
| 静的書き出し (`output: "export"`) + CDN | S3+CloudFront / GitHub Pages / Cloudflare Pages 等 | 不要 |
| SSR / ISR on PaaS | Vercel / Netlify / AWS Amplify | 不要 |
| SSR on Node 直接実行 PaaS | Railway / Render | 不要 |

- **Cloudflare は別枠**: Cloudflare 上の Next.js は Workers / OpenNext 方式が前提で、edge runtime 制約が大きく ISR も限定的（一般 PaaS と同列に「ISR も不要」とは扱えない）。静的書き出し + Cloudflare Pages 配信は上表の CDN 行に含まれるが、SSR / ISR は制約ありの別枠として扱う。
- **Fly.io は対象外**: Fly.io は OCI コンテナ実行基盤であり、`fly launch` は Dockerfile 生成を標準とする。Dockerfile を要するため本方針（アプリ本体の no-Docker）の対象外。

Next.js を self-host する選択肢（ECS / Kubernetes / オンプレ / Fly.io 等のコンテナ実行基盤）でのみ Docker が現実的に必要となるが、これは本 boilerplate の想定外。

### 3. `next/image` の sharp は外部 system 依存を持たない

`next/image` コンポーネントは内部で `sharp` を使うが、現代の `sharp`（≥ 0.32）は **prebuilt binary を同梱** しており、`vips-dev` / `libjpeg-turbo-dev` / `libpng-dev` / `libwebp-dev` 等を `apk add` する手順は不要。`pnpm install` だけで完結する。

Docker を残す動機になりうる「`sharp` の system 依存をコンテナに閉じ込める」は、現代の sharp では存在しない依存への手当てである。

### 4. メンテナンス負担の削減

Docker を維持する場合、以下を毎リリースで同期する必要がある。

- `Dockerfile` の `FROM` タグ ↔ `mise.toml` の `node` バージョン
- `Dockerfile` 内のインストールコマンド ↔ ADR 0001 の pnpm 方針（`npm ci` + `package-lock.json` を使わない）
- lockfile の二重化（`package-lock.json` ↔ `pnpm-lock.yaml`）

同梱しないことで、これら同期作業と「同期忘れによるドリフト」が構造的に消える。

## 想定デプロイ先

本 boilerplate を採用したプロジェクトは、原則として以下のいずれかにデプロイする想定。

- **Vercel**（Next.js 公式運営、新機能追従が最速）
- **AWS Amplify Hosting**（AWS エコシステム統合）
- **Netlify**（vendor 中立 PaaS）
- **Cloudflare Pages**（Edge 配信特化）
- **静的 CDN**（`output: "export"` 時。S3+CloudFront / GitHub Pages 等）

これら以外（ECS / Kubernetes / 自社オンプレ等）にデプロイしたい場合は、本 ADR を **役割拡張** として再評価する（後述「再評価のトリガー」参照）。

## 環境の定義

`APP_ENV` が選べるのは `local` / `ci` / `dev` / `stg` / `prd` の 5 つである
(`src/config/load-environment.ts`)。**各環境が何をする場所か**をここで定める。**変数をどう持つかは
[0030](0030-environment-variable-management.md) の責務**で、本節は扱わない —— 0011 が「どの環境が
何をする場所か」、0030 が「その環境の値をどう持つか」である。

### stand-alone と cloud

呼び名は 2 つだけ置く。**config の軸は増やさない** —— 実体は既存の `APP_ENV` と `env/.env.<環境>` で
あり、呼び名は文書がその 2 群を指すための語である。

| 呼び名 | `APP_ENV` | 何をする場所か |
| --- | --- | --- |
| **stand-alone** | `local` / `ci` | 何も契約せずに全画面が動く。compose を上げれば IdP も画像配信も API も揃い、外部サービスの account を持たない人がその日のうちに触れる |
| **cloud** | `dev` / `stg` / `prd` | `env/.env.<環境>` の接続先を、作った側自身の IdP / CDN / API へ向ける。作った側が本番でやることと同じ経路を通す |

各環境の位置づけ:

- **`local`** — 手元の開発。開発専用の口が開く
- **`ci`** — 自動検査。手元と同じ相手(mock)へ向き、人手を介さず全画面が動く必要がある。開発専用の
  口が開く
- **`dev`** — 作った側が最初に外部サービスへ繋ぐ場所。実 IdP・実 API を相手にし、**開発専用の口は
  閉じる**
- **`stg`** — 本番と同じ構成での確認
- **`prd`** — 本番

### 同梱サンプルはどちらでも動く

**サンプルは cloud でもフル構成で動かす。** backend と実 IdP を立て、作った側が本番でやることと同じ
経路を通す。**frontend だけを mock のまま cloud に置く形は採らない** —— それは IdP 無しで session を
出す口を cloud で開くことであり、`load-environment.ts` が名指しで閉じているものになる。

cloud 側の IdP の具体は**実装の一例であって推奨ではない**。逸脱の吸収は Resolver
([0079](0079-auth-frontend-seam.md) §6)の内側に閉じ、同梱するのは標準準拠の既定 Resolver のままと
する([0010](0010-standards-and-non-lockin.md) 非ロックイン)。

### 開発専用の口の判定

**判定は `APP_ENV` と宛先が持ち、接続先の種類にも上の呼び名にも依存させない。**

- **`APP_ENV`** — その環境で口を開けてよいか(`developmentOnlyEnvironments`)
- **宛先** — その口が誰に向いているか。route / handler の側が持つ

呼び名(`stand-alone` / `cloud`)を判定に使わないのは、呼び名が 2 群の**別名**であって独立した軸では
ないためである。`APP_API_MODE` のような接続モードにも依存させない —— mock を実環境に置かないことは
散文の約束でしかなく、約束を条件にした判定は約束が破られた瞬間に沈黙する。

### 軸を束ねない

`APP_MODE` のような「stand-alone / cloud」を値に持つ軸は**置かない**。束ねると
**IdP は Cognito・ストレージは自前**や **IdP は Keycloak・配信は CloudFront** のような組み合わせが
表現できなくなる。作った側の現実はその組み合わせであり、束ねることは
[0010](0010-standards-and-non-lockin.md) の非ロックインを config の形で否定することになる。
**実装が本当に割れる点だけ、割れた分だけ独立した指定を置く。**

## 同梱しないもの

以下（**アプリケーション本体の Docker 配送に関連するもの**）は同梱しない。

- `Dockerfile`（Next.js アプリ本体用）
- `docker-compose.yml`（本体配送用）
- `.dockerignore`
- README での「Docker による起動」推奨記述

`mise.toml` / `package.json` / `pnpm-lock.yaml` 等の構成ファイルが SSOT として機能する。

## Dev インフラとしての docker-compose（例外）

本 ADR は **アプリケーション本体（Next.js アプリそのもの）の配送に Docker を使わない** という方針であり、開発時に独立して立ち上げる **補助ツール群** を Docker / docker-compose で運用することは禁止対象外とする。

### backend / IdP / ストレージの compose は持たず、backend 側のスタックへ接続する

本リポジトリは backend / 観測性 / ストレージ / IdP を立てる compose を **持たない**。開発時に必要なそれらは、backend 側リポジトリの compose スタックへ接続して賄う（同梱サンプルの backend は go-boilerplate で、スタックの起動はそちらで行う）。表示層のリポジトリが backend の起動手順を抱えると、backend 側の変更に追随する二重管理が生じるためである。

| 接続先 | 既定 | 用途 |
| --- | --- | --- |
| API | `http://localhost:8080` | BFF の向き先 |
| OTLP | `http://localhost:4318` | 観測性（[0081](0081-observability-logging.md)）。Grafana は `:3000` |
| Object Storage | `http://gobp-local.web.garage.localhost:3902` | 画像配信（virtual-host 形式のみ。[0045](0045-fonts-and-images.md)） |
| 認証 | `http://localhost:4000` | 疑似 OIDC（[0079](0079-auth-frontend-seam.md)） |

フロント単独で作業する場合は **MSW モック**へ切り替える（`APP_API_MODE=mock`）。接続先はすべて env 経由で差し替え可能とし、コードに焼き込まない（[0030](0030-environment-variable-management.md)）。上記は開発時の既定値であり、作った側が別 backend を持つ場合は env の差し替えだけで足りる。

### 対象になりうる用途

| 用途 | ツール例 | 性質 |
| --- | --- | --- |
| モック backend API | `mockoon` / `prism` / `wiremock` | フロント開発を実 backend と独立させる |
| OpenAPI viewer | `redocly/redoc` / Swagger UI | backend の API spec を確認 |
| Docs viewer | `nginx` + Markdown / Mermaid renderer | `docs/` を Mermaid 込みで配信 |
| Lighthouse / e2e ランナー | 自前 headless Chrome / Playwright | 性能・回帰検証 |

これらは「アプリ本体を Docker で動かす」のとは別レイヤであり、`mise.toml` / `pnpm-lock.yaml` との同期問題も発生しない（base image を独自に管理して構わない）。

**採用済みは visual regression のランナーだけ**（[`docker-compose.dev-tools.yml`](../../docker-compose.dev-tools.yml) の `browser_runner`）。基準画像はフォントのラスタライズに依存し、それは OS でも CPU アーキテクチャでも変わるため、比較の基準を実行者の環境から切り離す手段が要る（[0091](0091-test-verification-methods.md) §3）。ここで Docker を採るのは「Docker でないと解決できないか」への答えが是であるためで、PaaS / SaaS で代替できる用途（下記）とは性質が違う。

### 補助ツールの image は digest で固定する

registry の tag は同じ名前のまま別の中身を指せるため、tag だけの参照では実行環境が黙って変わる。そこで **版の SSOT は tag 側に残し、`image:tag` → digest の対応をロックファイル（`docker/images-pin.toml`）が持つ**。固定してあれば、指し先が変わった時点で pull が失敗する。手順は [`docker/README.md`](../../docker/README.md)。

- **registry の image を指す参照は、書かれた場所によらずこの機構が固定する。** 対象は compose の `image:` と `docker/<用途>/Dockerfile` の `FROM` に加え、workflow / composite action の `uses: docker://<image>:<tag>`（GitHub Actions が registry の image を直接実行するステップ記法）。`uses:` の行であっても参照先は GitHub のリポジトリではないため、tag を `git ls-remote` で commit SHA へ解決する actions-pin（[0153](0153-ci-configuration.md)）では扱えない。走査するファイルは両機構で重なるが、掴む行は重ならない。`docker://` 参照に tag を必須とし、省略（＝`:latest`）は fail-closed で落とす
- **検疫を通した digest だけを採る。** 解決は公開から 14 日未満の digest を採らない（`IMAGES_PIN_MIN_AGE_DAYS`。窓の長さは [0110](0110-security-operations.md) の供給網検疫と同じ理由で決まる）。上流が乗っ取りを検知して取り消すまでの時間を稼ぐためで、既存のピンがあればそれを維持する。退行先の無い出来立ての image は、tag のまま残さず失敗させる
- **tag の付け替えは検知しない。** base image の tag は patch 版が出るたび前進するのが通例で、「解決先が変わったら止める」を入れると日常的な更新と区別が付かなくなる。Actions の SHA ピン（[0153](0153-ci-configuration.md)）とはここだけ運用が異なる。image に対して働く防壁は **検疫と固定の 2 つ** である
- **image を tag でしか受け取れない公式 action は使わない。** 例えば DAST ツールの公式 action は image を tag で受け取り、その input はこの機構の走査対象に入らない。固定したつもりで誰も検査していないピンを 1 つ増やすより、他の補助ツールと同じ compose の service に揃える

### 採用する場合のルール

1. **ファイル名で本体配送と区別する** — 例: `docker-compose.dev-tools.yml` / `docker-compose.docs.yml`。`docker-compose.yml`（無印）は本体配送と誤解されやすいため使わない
2. **起動コマンドを明示** — `docker compose -f docker-compose.dev-tools.yml up` 等、専用ファイルを指す形にする。`docker compose up` 単独では起動しない設計
3. **アプリ本体の Node / pnpm はコンテナ外で実行する** — Next.js 自身は `pnpm dev` でホスト実行が前提（mise が PATH を解決する、ADR 0003 と整合）
4. **README / docs に「補助ツールであり配送物ではない」旨を明記** — 利用者が本番デプロイ対象と誤解しないように
5. **`docker-compose.dev-tools.yml` を新規導入する PR は ADR の追補 or 関連 issue を必ず参照** — 例外運用であることを履歴に残す

### 採用しない場合

ここで挙げた用途も、PaaS / SaaS で代替可能なものが多い（モック API は MSW のような Node 内モック、OpenAPI viewer は Stoplight Studio / Postman、docs viewer は GitHub Pages 等）。**Docker でないと解決できないか** を一度問うこと。

## 自己ホスト・コンテナ化したい場合（作った側向け）

本 boilerplate から作ったプロジェクトが、Docker / self-host が必要なロールに拡張する場合の指針:

1. 本 ADR を、作った側のプロジェクトで superseded（廃止）扱いとし、別 ADR で「本プロジェクトでは Docker を採用する」と上書き宣言する
2. `Dockerfile` を新規作成する
3. 以下を SSOT と整合させる:
   - `FROM node:<X.Y.Z>-alpine` を `mise.toml` の `node` と一致
   - `RUN pnpm install --frozen-lockfile` を採用（`npm ci` は使わない）
   - `package-lock.json` は使わない（`pnpm-lock.yaml` を使う）

## 再評価のトリガー

以下のいずれかが発生した時点で、本 ADR の維持是非を再評価する。

- 本リポジトリのロールが「表示層」から「フルスタック（API も同居）」に拡張された
- Next.js の self-host（ECS / Kubernetes / 自社オンプレ）が本リポジトリの **第一級デプロイ先** として要求された

> 「ローカル開発で DB / Redis / モック API / docs viewer 等を container で立てたい」というのは Type B (dev インフラ) の領域であり、本 ADR の再評価トリガーには含めない（「Dev インフラとしての docker-compose（例外）」節に従い、専用ファイル名で導入する）。

## 禁止事項

- ❌ **アプリケーション本体の `Dockerfile`** や **本体配送目的の `docker-compose.yml`**（無印）を主要構成として復活させること（作った側での個別判断は対象外）
- ❌ README / ドキュメントで「Docker での起動」を **アプリ本体の推奨デプロイ手段** として記載すること
- ❌ CI / scripts に **アプリ本体の** Docker build を組み込むこと
- ❌ `stand-alone` / `cloud` を値に持つ config の軸を置くこと(呼び名は 2 群の別名であって独立した軸ではない。組み合わせが表現できなくなる。§環境の定義)
- ❌ 開発専用の口の開閉を、接続モード(`APP_API_MODE` 等)や環境の呼び名で判定すること(判定は `APP_ENV` と宛先が持つ。§環境の定義)
- ❌ frontend だけを mock のまま cloud へ置くこと(IdP 無しで session を出す口を cloud で開くことになる。§環境の定義)
- ❌ 補助ツールの image を tag だけで参照すること / tag でしか image を受け取れない action を経由して image を実行すること(digest 固定の走査対象から外れる。§補助ツールの image は digest で固定する)

> Dev インフラとしての docker-compose（`docker-compose.dev-tools.yml` 等の名前付きファイル）は本禁止事項の対象外。

## 補足

- 本 ADR が否定するのは **「アプリ本体の配送手段としての Docker」**（Type A）。**「補助ツール群を docker-compose で立ち上げる」**（Type B、例: モック API / OpenAPI viewer / docs viewer）は対象外であり、専用ファイル名で導入してよい
- 「Docker を全否定する」のではなく、「本 boilerplate のロール定義（表示層）には Type A が不要」という整理。作った側で必要になったら導入すればよい
- 本 ADR は **ロール定義の文書化** でもある。boilerplate を採用する開発者は、本 ADR を読むことで「このリポジトリで何を作る前提か」を理解できる

## 関連 ADR

- [0001-package-manager.md](0001-package-manager.md) — pnpm 採用（Dockerfile を持つ場合も `npm ci` を使わない根拠）
- [0003-version-manager.md](0003-version-manager.md) — Node / pnpm バージョンの SSOT（Dockerfile FROM タグとの同期問題を消す根拠）
- [0004-library-management.md](0004-library-management.md) — `sharp` の prebuilt binary 等、現代ライブラリの system 依存に関する評価指針 / 同梱ライブラリの exact-pin・`pnpm audit`
- [0010-standards-and-non-lockin.md](0010-standards-and-non-lockin.md) — 同梱ライブラリの採用の規律(vendor-independent 正当化 + adapters/seam 越し差替可能)。本 ADR の表示層ロール定義は 0010 §2「フレームワーク選択は別既決」の根拠でもある
- [0110-security-operations.md](0110-security-operations.md) / [0153-ci-configuration.md](0153-ci-configuration.md) — 供給網検疫の窓 / Actions の SHA ピン（image の digest 固定と対になる機構）
