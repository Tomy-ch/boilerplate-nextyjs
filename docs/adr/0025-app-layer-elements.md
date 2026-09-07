# app レイヤの element 構成(Route Handler / Server Action / metadata)

`src/app/` には `page.tsx` 以外にも App Router 特殊ファイル(`route.ts` / `actions.ts` / `robots.ts` 等)が同居する。「`app` は feature の画面を呼ぶ薄い driving adapter(import 先は `features` のみ)」という 1 行では、**Route Handler**(`route.ts`)や metadata routes(`robots.ts` 等)が `adapters` / `config` を import する必要と矛盾する —— [0030](0030-environment-variable-management.md) は「Route Handler → adapters 直 import」を前提にしている。

本 ADR は `app` レイヤを **4 element に分割**してこれを解消する(新カーネル不要)。root layout への横断 UI / Provider mount([0026](0026-layout-shell-mount.md))は、本 ADR が定める `app/route-segment` を土台にそちらで定める。

## Status

Accepted

## 背景

Server Action の家を `feature/actions.ts` だけに置くと、2 つの穴が残る。

- **Route Handler に対応する家が無い。** BFF 中継エンドポイント([0081](0081-observability-logging.md) テレメトリ受け・health)のような**どの feature にも属さない横断エンドポイント**は、物理が framework 規約で `src/app/**/route.ts` に強制されるため feature 内には置けず、`app → features のみ`のマトリクスでは書けない。metadata routes が config 値(site URL / env 別 noindex)へ到達する経路も同様に無い
- **Server Action が feature の家に住めない場合がある。** Server Action は action id を知る者が任意の route へ POST できる**公開 HTTP 口**であり、それを描いた画面の認可は前提にできない。したがって役割の断言は action の内側に要るが、`adapters/server/auth` へ触れてよいのは `app` と `adapters` だけで、`features` からは届かない

## 決定: `app` を 4 element に分割(すべて App Router 特殊ファイル)

Pages Router(`pages/` / `pages/api`)は採用しない。裏取り: 公式 doc `route-handlers.md`「Route Handlers are the equivalent of API Routes … you do not need to use API Routes and Route Handlers together」+ [0040](0040-routing-rendering-strategy.md)(App Router 単独)。

| element | 対象ファイル | 許可 import 先 | 原則 |
| --- | --- | --- | --- |
| `app/route-segment` | `page.tsx` / `layout.tsx` / `loading.tsx` / `error.tsx`(App Router UI) | `features` / **入口の保護に限り** `adapters/server/auth` の `verifySession()` と `model` の述語([0079](0079-auth-frontend-seam.md) §4) | driving adapter・薄い呼び口。保護の編成は「呼ぶ・判定する・送り返す」だけで、取得も業務ロジックも持たない |
| `app/route-handler` | **`route.ts`**(= Pages API Routes の App Router 置換・**唯一の HTTP 口**) | `adapters/server`([0024](0024-adapters-server-client-split.md))/ `model` / `errors` / `logging` / feature の **`facade/` のみ**([0021](0021-frontend-responsibility.md)) | **thin proxy・業務ロジック禁止**([0011](0011-no-docker.md) / [0070](0070-backend-role-separation.md))。`actions.ts` の HTTP 版。送り先を指すのに要るのはルートの識別子だけで、それは所有する feature が `facade/` へ出している。スライスの内側まで開けると業務ロジックがここへ降りる |
| `app/server-action` | **`actions.ts`**(`"use server"` の変更口) | `adapters/server` / `features` / `model` / `errors` / `logging` | **主体の断言をここで行う**。公開 HTTP 口であり、描画した画面の認可を前提にしない |
| `app/metadata` | `robots.ts` / `sitemap.ts` / `manifest.ts` / `opengraph-image` 等 | `config` / `model`(+ 要求時に一覧を辿る `sitemap.ts` に限り `adapters/server` と対象 feature の `facade/`) | ビルド / 描画時の framework ファイル。起動・ビルド境界の薄い例外(`instrumentation.ts` と同格)。サイトマップが動的な一覧を挙げるには取得の口が要り、それは `adapters/server` にしか無い |

これで **Route Handler が `adapters/server` を import できる明示 element**ができ、[0021](0021-frontend-responsibility.md) の依存マトリクスと [0030](0030-environment-variable-management.md) の config 受け手表が整合する。`route.ts` は `page.tsx` と同一セグメントに共存できない(Next.js 規約)ため element 判定は filename で成立する。

**`actions.ts` の置き場は、主体の断言が要るかで決まる。**要るものは `app/server-action`、要らないものは `features/<name>/<screen>/actions.ts` に留まる([0027](0027-directory-structure.md))。同じ file 名が 2 か所に現れるのは、element 判定が **path と filename の組**で成立するためで、`src/app/**/actions.ts` だけがこの element に当たる。置き場を分けるのは、`features` から `adapters/server/auth` へ届かないという依存マトリクスの帰結であり、Next.js 公式の例が `app/**/actions.ts` を採ることとも一致する。

**この表のうち機械で強制されるのは `app/route-handler` の行だけである。** `architecture.ts` の
`APP_ELEMENTS` がファイル名で `route.ts` / `route.dev.ts` を分類し、層の許可から UI 部品・横断状態・
設定・feature の内側を削る。`route-segment` / `server-action` は `app` の粒度（層の許可の和集合）で
検査される —— 境界検査の要素はディレクトリに対応するため、同じディレクトリに居るファイルを名前で
分けるには層の許可を後から削るしかなく、その 2 つは削る側の集合が実装と合っていない（`components` /
`errors` / client 側 `config` を表が挙げていない）。**表を実態へ合わせる作業が先に要る**ため、
現時点では指針として読む。

`app/route-segment` のうち `layout.tsx` の横断 UI / Provider mount 規約は [0026](0026-layout-shell-mount.md) が定める。

## 禁止事項

- ❌ `route.ts` に業務ロジック / 重い集約を書くこと(thin proxy。[0011](0011-no-docker.md) / [0070](0070-backend-role-separation.md))
- ❌ Pages Router(`pages/` / `pages/api`)を追加すること(App Router 単独)
- ❌ `app/route-handler` から `config` を直接 import すること(config は `adapters/server` 経由。metadata は例外として config 可)
- ❌ `app/server-action` から **`server config`** を直接 import すること(route-handler と同じ理由。secret を持つ runtime object は `adapters/server` の側で読む)
- ❌ `app/server-action` で主体の断言を省き、その action を描いた画面が保護されていることに依拠すること(action id を知る者は任意の route から呼べる)
- ❌ `app/route-segment` が入口の保護の名目で取得や業務ロジックを持つこと(許すのは `verifySession()` の呼び出し・`model` の述語による判定・`redirect()` だけ。[0079](0079-auth-frontend-seam.md) §4)
- ❌ `app/route-segment` から **`server config`** を直接 import すること(値は `adapters` か、全層が読める `NEXT_PUBLIC` の公開定数から受け取る。[0021](0021-frontend-responsibility.md) の「内側は値を引数で受け取る」と同じ規定)。**例外は Next.js の規約が route segment に置くことを要求する値だけ** —— root layout の `metadata` export が読む `metadataBase` / `robots`(`config/site`。[0044](0044-seo-metadata-strategy.md))と、画面が「いま」として読む `config/clock`。どちらも `adapters` を経由させると、値の置き場が規約で決まっているのに取得の口だけを増やすことになる

## 関連 ADR

- [0021-frontend-responsibility.md](0021-frontend-responsibility.md) — 責務 / 依存マトリクスの SSOT(本 ADR が `app` の element を細分化)
- [0030-environment-variable-management.md](0030-environment-variable-management.md) — config 受け手表(Route Handler / metadata の config 到達)
- [0040-routing-rendering-strategy.md](0040-routing-rendering-strategy.md) — App Router 単独(Pages Router 除外)
- [0011-no-docker.md](0011-no-docker.md) / [0070-backend-role-separation.md](0070-backend-role-separation.md) — thin proxy(Route Handler の業務ロジック禁止)
- [0024-adapters-server-client-split.md](0024-adapters-server-client-split.md) — `adapters/server`(Route Handler の import 先)
- [0026-layout-shell-mount.md](0026-layout-shell-mount.md) — `layout.tsx` の横断 UI / Provider mount(本 ADR の route-segment が土台)
