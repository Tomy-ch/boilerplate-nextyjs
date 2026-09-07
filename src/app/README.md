---
imports-allowed: [features, components, capabilities, stores, adapters, errors, logging, config, model, observability]
forbidden: [business-logic, direct-fetch]
test-requirement: route
coverage-exclusions:
  - "src/app/**/page.dev.tsx"
  - "src/app/**/page.tsx"
  - "src/app/fonts.ts"
  - "src/app/icon.tsx"
  - "src/app/apple-icon.tsx"
  - "src/app/opengraph-image.tsx"
---

# app

App Router の driving adapter です。`page.tsx` と `layout.tsx` は feature を薄く呼び出し、route handler は `adapters/server` を介して外部接続します。

## 受け入れるもの

- route segment、route handler、metadata と layout への横断 UI / Provider の mount
- Next.js が規定する特殊ファイルと route segment
- **複数の route group の器が共有する宣言モジュール**（`fonts.ts` / `site.ts`）。route
  要素のどれにも当たらないが、器ごとに書くと片方だけが動く。テストは `unit` として扱う
- **metadata ファイル**（`sitemap.ts` / `robots.ts` / `icon.tsx` / `apple-icon.tsx` /
  `opengraph-image.tsx`）。Next.js の規約で特殊な Route Handler になる（[0044](../../docs/adr/0044-seo-metadata-strategy.md)）。
  宣言は `architecture.ts` の `app-metadata` element が持つ —— 何を挙げるか・何を断るかの判定を持つ
  `sitemap.ts` / `robots.ts` は `unit` として扱い、絵を 1 枚返すだけの 3 つは判定を持たないので単体では
  回さない（`scripts/lib/untested-modules.ts`）。
  絵として返ることと、挙げた URL が実在すること・正規 URL が自分を指すことは、起動したアプリから
  取って見る（`make e2e-metadata`）
- **root layout が mount する計装**（`telemetry.tsx`）。描画するものを持たず、ブラウザ側のシグナルを
  中継へ送り出すだけの client component である。`components` にも `capabilities` にも置けない ——
  どちらも外部への送信を持てないため（[0082](../../docs/adr/0082-client-observability.md)）。
  テストは `component` として扱う
- **root layout が mount する同意の島**（`consent.tsx`）。同意を尋ねる面（`components`）と、同意を
  要する資材のゲートを、1 つの購読の裏で束ねる client component である。`components` にも
  `capabilities` にも置けない —— どちらも `stores` を引けないため
  （[0031](../../docs/adr/0031-policy-state-supply.md)）。テストは `component` として扱う
- **同意の島の裏へ置くタグマネージャ**（`analytics.tsx`）。容器 ID を config から読み、宣言のある
  配備でだけ読み込む client component である。`components` に置けない —— `config` を引けないため。
  テストは `component` として扱う

**shell を通らない画面は、自分で `main` を置く。** route group の外に立つ画面（`not-found.tsx` や
`dev/` の下）は、route group の layout が置く landmark を持たない。包む物が無いと、支援技術
から本文へ直接跳べない。

## 受け入れないもの

- 業務ロジック、画面ユースケースの編成、route segment からの直接 fetch

## この層が持つ判断

route ごとに決まることがここにあります。**そのうちいくつかは、この README にも ADR にも書けません**
—— 画面ごとに違う答えを持つものだからです。答えを書く場所は決まっています。

| 判断 | 宣言する場所 | 答えを持つ文書 |
| --- | --- | --- |
| 殻を配れないこと（`instant = false`） | `page.tsx` / `layout.tsx` | その画面の機能要件（[`docs/spec/route/**`](../../docs/spec/README.md)） + [0041](../../docs/adr/0041-cache-components-decision.md) |
| 待ちの境界（`Suspense` をどこへ掛けるか） | `page.tsx` | 同上 |
| 失敗と不在の面 | `error.tsx` / `not-found.tsx` | 同上 + [0080](../../docs/adr/0080-error-handling.md) |
| metadata | `page.tsx` / `layout.tsx` | [0044](../../docs/adr/0044-seo-metadata-strategy.md) |
| 横断 UI と Provider の mount | `layout.tsx` **だけ** | [0026](../../docs/adr/0026-layout-shell-mount.md) |
| 外部との往復 | `api/**/route.ts` | [0071](../../docs/adr/0071-bff-api-integration.md) / [0025](../../docs/adr/0025-app-layer-elements.md) |

**描くモードを画面が宣言しません。** 殻と穴の分かれ目は器の形 —— 何を `Suspense` の外に置き、
何を内に置くか —— で決まります（[0041](../../docs/adr/0041-cache-components-decision.md)）。
`dynamic` / `revalidate` のような segment config は持ちません。**殻を配れない画面だけが
`export const instant = false` を理由つきで名乗り**、`scripts/render-mode` が prerender の結果と
突き合わせます。

**殻を配れないと判断した理由は仕様書へ書きます。** route の隣の doc コメントだけに置くと、その
画面がいつ描かれるかを文書から辿れなくなります。コードのコメントに残すのは、その場で効く注意
だけです。

**待ちの境界も同じです。** 節ごとに分けるか画面全体で 1 つにするかは、何を同時に待つかで決まる
画面の判断であり、層の既定ではありません。

### metadata の土台と差分

root layout が `metadataBase`（外から見た origin。`config/site`）と `title.template` を置き、索引させ
ない環境では `noindex` も置く。各 segment が宣言するのはそこからの差分で、置くものは決まっている。

| 画面 | 宣言するもの |
| --- | --- |
| 誰でも開け、索引させたい画面 | `title` / `description` / `alternates.canonical`（自分の経路） |
| 認証の要る画面、利用者ごとに中身が変わる画面 | 上に加えて `robots: { index: false, follow: false }`。索引させる環境でも隠す |
| 動的セグメントの画面 | `generateMetadata`。取得の分類を写す判定は feature 側の module に置き、page は薄く呼ぶ |

canonical を root に置かないのは、`alternates` が segment 単位で丸ごと差し替わるためである。root
に置くと、宣言していない画面がすべて `/` を正規 URL として名乗る。

`sitemap.ts` が挙げるのは索引させたい画面だけで、`robots.ts` が断る経路は保護の宣言（`model/authz`）
から採る。どちらも書き写しを持たない。

## 運用

- **`route` の宣言が掛かるのは route segment の合成（`page.tsx` / `layout.tsx`）です**。
  **Route Handler（`api/**/route.ts`）は `integration` として扱います** ——
  [0090](../../docs/adr/0090-testing-strategy.md) の層別責務表が integration を「HTTP 境界のみ
  （`adapters` の API クライアント / route handler の境界）」と定めており、器の合成ではなく境界の
  検証だからです。実際の書き方も、モジュール境界を `vi.mock` で差し替え、応答の status と形を
  確かめる形になります

- **Server Action（`actions.ts`）は `unit` として扱います** —— 器の合成でも HTTP 境界でもなく、
  **値を返す対象**だからです（[0090](../../docs/adr/0090-testing-strategy.md) の軸は subject が
  何を返すかで決まり、`正常系` / `異常系` のコメント区切りで割ります）。書き方は、主体を断言する
  session と呼び先の adapter をモジュール境界で差し替え、**返した `ActionState` の分類・成立時の
  再検証・送り先**を確かめる形になります。HTTP の往復は adapter 側のテストが持つので、ここでは
  持ちません

- **受け口の本体を隣へ出したモジュールは `unit` として扱います** —— `route.ts` / `actions.ts` が
  薄い口に留まり、判断と組み立てを隣のモジュールへ委ねた場合、そのモジュールは呼び出し元を問わず
  `unit` です。判定は**応答（`Response` とステータスコード）の組み立てを持つかどうか**で、持たずに
  値を返すならこちらに当たります（`dev/session/authorize-development-session.ts`）。`Request` を
  引数に取るかどうかでは決まりません —— 受け取っていても、返すのが値なら軸は
  `正常系` / `異常系` です

- 層をまたぐ import は `@/*` alias を使う
- 役割を示さない `common`、`shared`、`utils`、`lib` 等の置き場は作らない
- 単一 feature 専用のコードは `features/<name>/` に置く
- 横断 UI と Provider を mount してよいのは `layout.tsx` だけで、`page.tsx` は feature のみを呼ぶ。mount は**配置だけ**を意味し、layout で hook を呼んでデータを組むことは含まない
- root layout は横断通知の Provider を mount する。通知を出す側は `useToast()` を呼ぶだけでよく、queue の state も dismiss の配線も持たない。ただし 1 画面で完結する表示状態を、ここを経由してグローバルへ持ち上げない
- metadata は Metadata API で宣言する。`<head>` の手書きと `next/head` は使わない。root は雛形の枠だけを持ち、各 segment はそこからの差分を宣言する
- **route segment は描画の span を持たない。** Next.js が `render route (app)` を張るので、同じ範囲を二重に持たない。画面の中の帰属は feature 層の最上位が持つ（[observability/README.md](../observability/README.md)）

## 関連する ADR

この層のコードが依存する決定です。**コメントからは ADR を直接指さず、この節を辿ります** ——
ADR は番号も節も動くので、動いたことに気づける場所を 1 つに寄せています（[docs/rules.md](../../docs/rules.md)
「コメントと文書」）。要素ごとに依存先が違うので、要素で分けます。

### 層全体

- [0025](../../docs/adr/0025-app-layer-elements.md) — この層の element（route segment / route handler / server action / metadata）と、それぞれが持てるもの
- [0090](../../docs/adr/0090-testing-strategy.md) — 層別の検証責務（`route` / `integration` / `unit` の割り当て）

### route segment（`page.tsx` / `layout.tsx` / `error.tsx` / `not-found.tsx`）

- [0040](../../docs/adr/0040-routing-rendering-strategy.md) — App Router の採用と、描画のモードを boilerplate として強制しないこと
- [0041](../../docs/adr/0041-cache-components-decision.md) — Cache Components（PPR）の採否。殻と穴の分け方
- [0026](../../docs/adr/0026-layout-shell-mount.md) — 横断 UI と Provider を mount してよいのは layout だけ
- [0079](../../docs/adr/0079-auth-frontend-seam.md) — 入口の前捌きと、画面で通す確定認可の置き場
- [0112](../../docs/adr/0112-data-classification-cache-boundary.md) — 主体に紐づく値をキャッシュ境界のどちら側へ置くか
- [0080](../../docs/adr/0080-error-handling.md) — 失敗と不在の面（`error.tsx` / `not-found.tsx`）の責務

### route handler（`dev/**/route.dev.ts`）

`api/` の下は [api/README.md](api/README.md) が持ちます。

- [0029](../../docs/adr/0029-type-design-discipline.md) — 境界での parse と、返す値の型の規律
- [0075](../../docs/adr/0075-file-upload-seam.md) — 受け口が本体を受け取るときの seam
- [0080](../../docs/adr/0080-error-handling.md) — 分類から status への対応

### server action（`actions.ts`）

- [0025](../../docs/adr/0025-app-layer-elements.md) — 主体の断言が要る action をこの層へ置く判断（`app/server-action`）
- [0075](../../docs/adr/0075-file-upload-seam.md) — アップロードの seam。受け口が最後の関所になること

### metadata（`sitemap.ts` / `robots.ts` / `icon.tsx` / `apple-icon.tsx` / `opengraph-image.tsx` と各 segment の宣言）

- [0044](../../docs/adr/0044-seo-metadata-strategy.md) — Metadata API の使い方、索引の可否と canonical
- [0045](../../docs/adr/0045-fonts-and-images.md) — 書体と画像の方針（OG 画像を含む）

### root layout が mount する島（`telemetry.tsx` / `consent.tsx` / `analytics.tsx`）

- [0031](../../docs/adr/0031-policy-state-supply.md) — 同意 / feature flag の状態をどこが供給するか
- [0082](../../docs/adr/0082-client-observability.md) — Web Vitals と client 例外の収集、送信面の置き場
- [0131](../../docs/adr/0131-cookie-consent.md) — 同意管理を採らない決定
- [0077](../../docs/adr/0077-bff-abuse-protection-boundary.md) — 認証を要求しない受け口の防御をどこが持つか
