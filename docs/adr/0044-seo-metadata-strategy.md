# SEO / メタデータ戦略

表示層 boilerplate における **メタデータの体系(App Router Metadata API)/ クローラ制御(`sitemap.ts` / `robots.ts`)/ canonical・alternates / 構造化データ(JSON-LD)/ アイコン体系 / 公開面の検査** の規約を定める。Next.js 16 組込みの Metadata 機構を追認し、最小の運用ルールを敷く。具体値(タイトル文言・URL 一覧・schema.org type)は用途依存として fork 先に委ねる。

## Status

Accepted

## 背景

[0045](0045-fonts-and-images.md)(フォント・画像)は動的 OG 画像(`ImageResponse` / `opengraph-image`)と `public/` の favicon を**画像アセットの生成手段として**扱う。head 要素・クローラ制御・canonical・構造化データを含む**メタデータの体系は別軸**であり、本 ADR が持つ。

実装前に `node_modules/next/dist/docs/` を確認した結果、以下は Next.js 16 の第一級のファイル規約 / API として実在する(AGENTS.md「This is NOT the Next.js you know」):

- **Metadata API**: route セグメントで静的 `metadata` export または動的 `generateMetadata` を宣言すると、Next.js が `<head>` 要素を自動生成する
- **ファイルベース metadata**: `app/` 直下の `sitemap.(xml|ts)` / `robots.(txt|ts)` / `icon.*` / `apple-icon.*` / `manifest.*` / `opengraph-image.*` 等。特殊 Route Handler として既定でキャッシュされる(request-time API / dynamic config 使用時を除く)
- **大規模 sitemap**: `generateSitemaps` で分割生成
- **Proxy 交点(重要)**: 公式ドキュメントは「`proxy.ts` と併用する場合、メタデータファイルを Proxy の対象外とせよ」と明示。`proxy.ts`([0043](0043-middleware-policy.md))との交点となる

## 決定

### 1. メタデータ = App Router Metadata API を既定

- head メタデータ(title / description / OpenGraph / Twitter / robots meta 等)は **App Router の Metadata API** で宣言する。**`<head>` の手書き・`next/head` は使わない**
  - 静的に決まるものは **静的 `metadata` export**、リクエスト / パラメータ依存のものは **`generateMetadata`** を使い分ける
- ルート([`src/app/layout.tsx`](0027-directory-structure.md))に **`metadataBase` と `title.template`(サイト共通のタイトル雛形)の既定土台**を置く。各セグメントはそこからの差分だけを宣言する(重複定義を避ける)
- **絶対 URL の出所は config(`SITE_PUBLIC_ORIGIN`)の 1 つに限り、要求の `Host` から採らない。** canonical / sitemap / OG 画像の絶対 URL はすべてこの origin に経路を足して組み立てる。配信面(CDN / ロードバランサ)を挟むと要求が名乗る host は公開名と一致しなくなり、`Host` から採ると他人を指す canonical を配ることになる
- 具体的なタイトル文言・description・OG 画像割当は**用途依存**のため、雛形の枠のみ boilerplate 本体で持ち、値は fork 先 / feature 実装で確定する

### 2. クローラ制御 = `sitemap.ts` / `robots.ts`(Next.js 規約)

- サイトマップは **`app/sitemap.(xml|ts)`**、クローラ制御は **`app/robots.(txt|ts)`** で Next.js 規約に従い生成する(独自の静的ファイル配置・手書き XML 生成を作らない)。URL 数が多い場合は **`generateSitemaps`** で分割する
- 収録 URL・`Disallow` パス・`changefreq` 等の**具体内容は用途依存**(ルート構成に従属)のため fork 先で確定。boilerplate 本体は仕組み(このファイル規約を使う方針)を定める
- **索引させてよいかは環境が宣言する**(`SITE_INDEXABLE`。[0030](0030-environment-variable-management.md))。宣言の無い環境は `robots.txt` が巡回を拒み、画面が `noindex` を出す。索引を許す側だけが明示する

### 3. canonical / alternates

- 正規 URL・言語 alternates は Metadata API の **`alternates.canonical` / `alternates.languages`** で宣言する(手書き `<link rel="canonical">` を置かない)。i18n の alternates は [0121](0121-i18n-strategy.md) 採用時にこの seam へ載る

### 4. 構造化データ(JSON-LD)

- 構造化データ(schema.org / JSON-LD)は**採用可**とし、必要な feature の実装で埋め込む(Next.js 推奨どおり、コンポーネント内で JSON-LD の `<script type="application/ld+json">` を描画)。**採否・schema.org type は用途依存**のため boilerplate 本体では型を固定せず、枠のみ示す

### 5. アイコン体系(`icon.*` / `apple-icon.*` と `public/` favicon の役割分担)

- **生成 / 複数解像度のアイコンは Next.js の metadata ファイル規約**(`app/icon.*` / `apple-icon.*`)を用いる。**単純な静的 favicon は `public/`**([0045](0045-fonts-and-images.md))に置く。両者の役割分担を本 ADR で明示する(0045 は「画像アセットとしての favicon」、本 ADR は「メタデータ体系としてのアイコン」)

### 6. Proxy との交点

- `proxy.ts`([0043](0043-middleware-policy.md))は、**メタデータファイル(`sitemap` / `robots` / `icon` / `opengraph-image` 等)を対象外とする**(Next.js 公式の good-to-know。メタデータの配信を Proxy が横取りしないため)。除外は `proxy.ts` の `matcher` で行い、選び足りなさは e2e が負う([0043](0043-middleware-policy.md) §4)

### 7. 公開面の検査は「在るか」ではなく「成立しているか」を見る

- metadata は**中身が壊れていても画面が壊れない**ため、通常のテストとレビューでは気づけない。存在検査だけを置くと、空の `sitemap.xml`・他人を指す canonical・実行時に落ちる OG 画像が、いずれも緑で通る
- したがって索引を許す設定で build した公開面に対し、e2e(`make e2e-metadata`)が次を確かめる:
  - `robots.txt` が巡回を許す
  - `sitemap.xml` が挙げる URL が実在し(404 を挙げていない)、各ページの canonical が自分自身を指す
  - `icon` / `opengraph-image` が絵として返る(`ImageResponse` は build を通っても実行時に落ちうる)
- 索引させない側(`noindex` / 巡回拒否)は通常の e2e が見る。両側を見て初めて「環境で切り替わる」ことが確かめられる

## 責務境界(0045 との切り分け)

| 関心事 | 所在 |
| --- | --- |
| メタデータ体系(head 要素・title.template・metadataBase・canonical・robots meta) | **本 ADR(0044)** |
| クローラ制御(`sitemap.ts` / `robots.ts`)・構造化データ | **本 ADR(0044)** |
| 動的 OG 画像(`ImageResponse` / `opengraph-image`)の**生成手段** | [0045](0045-fonts-and-images.md)(本 ADR は「どの OG を割り当てるか」= Metadata 側) |
| 静的 favicon の `public/` 配置 | [0045](0045-fonts-and-images.md)(本 ADR は生成 / 複数解像度アイコン規約) |

## 禁止事項

- ❌ `<head>` の手書き / `next/head` の使用(Metadata API を使う)
- ❌ 同一メタデータを複数箇所で重複定義すること(root の `title.template` / `metadataBase` を土台に差分宣言)
- ❌ 絶対 URL を要求の `Host` から組み立てること(出所は config の公開 origin 1 つ)
- ❌ `sitemap` / `robots` を独自の静的配置・手書き生成で実装すること(Next.js のファイル規約 `app/sitemap.ts` / `app/robots.ts` を使う)
- ❌ 手書き `<link rel="canonical">` を置くこと(`alternates.canonical` を使う)
- ❌ `proxy.ts` でメタデータファイルを巻き込むこと(Proxy の対象外とする)
- ❌ 公開面の検査を存在確認だけで済ませること(§7)
- ❌ 用途依存の具体値(タイトル文言・収録 URL・JSON-LD type)を boilerplate 本体で固定すること(枠のみ・値は fork 先)

## 関連 ADR

- [0045-fonts-and-images.md](0045-fonts-and-images.md) — OG 画像生成 / `public/` favicon(本 ADR と責務境界を共有)
- [0040-routing-rendering-strategy.md](0040-routing-rendering-strategy.md) — App Router / Metadata API / 特殊ファイルの土台
- [0028-naming-convention.md](0028-naming-convention.md) — `sitemap` / `robots` / `opengraph-image` 等の特殊ファイル命名
- [0030-environment-variable-management.md](0030-environment-variable-management.md) — 公開 origin と索引可否の供給(`SITE_PUBLIC_ORIGIN` / `SITE_INDEXABLE`)
- [0043-middleware-policy.md](0043-middleware-policy.md) — `proxy.ts` がメタデータファイルを対象外とする交点
- [0091-test-verification-methods.md](0091-test-verification-methods.md) — 公開面の検査を e2e が負う根拠
- [0121-i18n-strategy.md](0121-i18n-strategy.md) — 言語 alternates(i18n 採用時に本 ADR の canonical/alternates seam へ載る)
- [0101-performance-budget.md](0101-performance-budget.md) — メタデータ / OG は SEO・共有体験に直結
