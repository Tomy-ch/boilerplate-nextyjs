# ルーティング・レンダリング戦略

App Router の採用を追認し、**Server / Client Components の境界 / Server Actions の採否 / `page.tsx` の責務 / レンダリングモード(CSR・SSR・SSG・ISR / Next.js 16 のキャッシュ)** の方針を定める。本 ADR は [0020](0020-adopted-architecture.md) / [0021](0021-frontend-responsibility.md) が定めた層構造の上で、App Router の各機構をどう使うかを確定する。

## Status

Accepted

## 背景

本リポジトリは **Next.js 16 / React 19** を採用しており、レンダリング・キャッシュの既定が従来の Next.js と異なる。実装前に `node_modules/next/dist/docs/` を確認した結果、以下を前提とする:

- Server Components が既定。`"use client"` はファイル先頭で **Server / Client のモジュールグラフ境界**を宣言し、それ以下の import・子は**すべて client バンドル**に含まれる(`getting-started/server-and-client-components`)
- Server Function(Server Action)は `"use server"` ディレクティブで定義し、Server Component にインライン、または `"use server"` ファイルにまとめて Client Component から import 起動できる(`getting-started/mutating-data`)
- `fetch` は**既定でキャッシュされない**(Cache Components の有無によらず。`getting-started/fetching-data`)。`use cache` ディレクティブによる opt-in キャッシュと、`<Suspense>` / `use cache` を伴う **Partial Prerendering (PPR)** は、**Cache Components(`next.config.ts` の `cacheComponents: true`)を有効化したときの機構**である(PPR は Cache Components 有効時の既定挙動。`getting-started/caching` / `api-reference/directives/use-cache`)。無効時は従来モデル(`cache: 'force-cache'` 等の opt-in)が適用される(`guides/caching-without-cache-components`)

## 決定

### App Router + Server Components 既定

- **App Router 単独**を採用する(Pages Router は採用しない)。ルート構造・特殊ファイル・セグメント記法は Next.js 規約に従う([0028](0028-naming-convention.md))
- **Server Components を既定**とする。`"use client"` を付けないコンポーネントはサーバで実行される

### `"use client"` は feature 内の葉へ押し下げる

- `"use client"` は **feature 内の、クライアント機能(state / event / ブラウザ API)を実際に使う葉コンポーネント**にのみ付ける([0021](0021-frontend-responsibility.md)「Server Action の置き場」の規約が正)
- 理由: `"use client"` 境界より内側は import・子まで丸ごと client バンドルに入るため、境界を上位(`layout.tsx` / `page.tsx`)に置くと不要に client 化が広がる。境界を葉へ下げて client バンドルを最小化する
- `page.tsx` / `layout.tsx` は Server Component のまま保つ

### Server Actions を採用する

- Server Action を**採用**し、`"use server"` で定義する。置き場は **feature 内 `actions.ts`**(controller 相当。[0021](0021-frontend-responsibility.md) が正)
- driving adapter として**編成のみ**を行い、**業務ロジックは書かない**([0011](0011-no-docker.md) thin proxy / [0020](0020-adopted-architecture.md) 設計原則 4 / [0021](0021-frontend-responsibility.md))

### `page.tsx` = 薄い driving adapter

- ルートセグメント(`app/` 配下)と `page.tsx` は **feature の画面 RSC を呼ぶ薄い呼び口**([0020](0020-adopted-architecture.md) 設計原則 4)。編成・業務ロジックを抱えない。コード分割の第一軸は route ではなく feature

### レンダリングモードは特定モードを強制しない

- 本リポジトリは **CSR / SSR / SSG / ISR のいずれのモードも閉ざさない**。特定モードを一律強制せず、静的シェルのプリレンダーと request-time のストリーミングの**両対応を保つ**
- 導出根拠: [0011](0011-no-docker.md) の想定デプロイは静的 CDN と SSR PaaS の**両方が主想定**であり、本リポジトリはどのモードも前提にしない
- **モードの選択は機密性に従属する。** Server Components 既定は**性能と UX 上の既定値**であって、PII / user-scoped データの機密性を上回る制約ではない。PII を含む範囲のモード選択は [0112](0112-data-classification-cache-boundary.md)(不変条件 1 / 決定 8・10)が正であり、**PII のために SSR / PPR を諦めることは許可される**(ただし CSR にする範囲は最小の Client Island に限る)
- **ただし、どちらで描くかを画面が宣言することはない。** Cache Components が有効なので([0041](0041-cache-components-decision.md))、殻と穴の分かれ目は器の形そのもの —— 何を `<Suspense>` の外に置き、何を内に置くか —— で決まり、segment config(`export const dynamic`)は併存しない。取得・`params` / `searchParams`・cookie・認可の判定・実時計は、すべて穴の内側で解く。**殻を配れない画面だけが `export const instant = false` を理由つきで名乗る。** 宣言と実態の突合は `scripts/render-mode` が `prerender-manifest.json` の `compute` に照らし、宣言なしにブロックしている route と、宣言が余っている route の双方を見る。**機械で確かめられるのは殻を配れたかどうかまで**で、「殻へ入れてよい内容か」は成果物から読めない
- **描画モードは page 単体ではなく、layout の連なりを含めた route 全体で決まる。** 祖先の器が request 時の API(`cookies()` / `headers()` 等)を穴の外で読めば、その配下の画面は**自分が取得を持たなくても**殻を配れなくなる。画面側から逃げる手立ては無い。したがって**固めたい画面を含む route group の器は、request 時の読みを穴の内側に閉じるか、持たない**。器がその読みを殻の側で必要とするなら、固めたい画面をその器の外へ出す(器を分ける判断は [0026](0026-layout-shell-mount.md))
- **宣言は行儀ではなく、この伝播を検知する唯一の手段である。** 前段のとおり機械が読めるのは殻を配れたかまでで、**「配れるのに配れていない」は成果物から読めない**。宣言の無い画面が器の都合でブロックしても何も赤くならず、静的にできる画面が黙って動的なまま座り続ける。`instant = false` を名乗る画面を「殻を配れない画面だけ」に限っておけば、宣言の無い画面がブロックした時点で `scripts/render-mode` が落とし、器へ足された読みが露見する
- **キャッシュは opt-in とする**(`fetch` 既定 uncached を前提に `use cache`)。ただし**具体的なキャッシュ方針(どこを `use cache` するか / `cacheLife` / `<Suspense>` 境界の切り方)は本 ADR で固定しない**。データ取得のキャッシュ・再検証設計は [0071](0071-bff-api-integration.md)「データ取得のキャッシュ・再検証」節、`loading.tsx` / Suspense 境界は [0080](0080-error-handling.md) が正
- **`Cache Components`(PPR を既定化する設定)の有効化判断は [0041](0041-cache-components-decision.md) が持つ**(採用)。本 ADR は「モードを強制しない」ことのみ確定する

### route-as-modal(intercepting / parallel routes)を認める

- **route をモーダルとして表示する選択肢を認める**。実現手段は Next.js ネイティブの **intercepting routes(`(.)` / `(..)` / `(..)(..)` / `(...)` 記法)+ parallel routes(`@modal` などの名前付きスロット + `default.tsx`)** の組み合わせとする。ライブラリは導入しない([0004](0004-library-management.md) の対象外 = 新規依存を増やさない。これは非ロックインの強みでもある。[0010](0010-standards-and-non-lockin.md))
- 挙動の前提: **ソフトナビゲーション**(feed 内の `<Link>` クリック等)では intercept してモーダルを重ね、URL をマスクする。**ハードナビゲーション**(共有 URL 直開き・リフレッシュ)では intercept が起きず**独立したフルページが描画**される。これにより「モーダル内容の URL 共有可能性」「リフレッシュで閉じずコンテキスト保持」「戻る/進むでの開閉」を満たす(`intercepting-routes` / `parallel-routes`)
- **モーダル境界(`Modal` コンポーネント)とモーダル内容を分離**し、内容側は Server Component のまま保てる構成を既定とする(`"use client"` は開閉制御の葉に押し下げる本 ADR の原則と整合)。未マッチのスロットには `default.tsx`(`null` 返し)を必ず置く

**[0010](0010-standards-and-non-lockin.md) 準拠(vendor-independent 正当化)**:

- intercepting / parallel routes は **Next.js 固有 API** だが、これは「App Router を選んだ」という別既決([0011](0011-no-docker.md) / App Router 単独)の帰結であって、機能固有のロックインではない([0010](0010-standards-and-non-lockin.md) §2 運用テスト)。route-as-modal を採る/採らないという **構造決定**自体は、`?modal=` 等の search-param 駆動モーダルや純クライアント状態モーダル([0053](0053-ui-component-interaction-seam.md) が既定を所有)へ**代替可能**であり、Next.js を正当化から抜いても「URL に紐づくモーダルという UI パターン」は成立する = 非ロックイン
- seam の形は **Next.js 規約(`@modal` / `(.)` file convention)にそのまま乗る**(独自発明・中立化しない。[0010](0010-standards-and-non-lockin.md) §1・命名優先順位 [0028](0028-naming-convention.md))
- 本 ADR は route-as-modal を **選択肢として認める(受け皿)**にとどめる。モーダル全体の既定手段(native `<dialog>` / focus trap / Escape / scroll lock / route-as-modal をいつ選ぶか)の方針は **[0053](0053-ui-component-interaction-seam.md) が所有**し、本節を URL 設計側の受け皿として参照する

### `loading.tsx` / `error.tsx` の配置

- App Router の `loading.tsx` / `error.tsx` / `not-found.tsx` / `global-error.tsx` の配置・責務は [0080](0080-error-handling.md) が正(`error.tsx` 系 = 同 3 節 / `loading.tsx`・Suspense 境界 = 同 4 節)。本 ADR は特殊ファイルの命名([0028](0028-naming-convention.md))と「driving adapter に業務ロジックを置かない」原則のみを敷く

### 採らない分割モデル

次は**採らない**。RSC が同じ分割をより細かい単位で提供しており、語彙を二重に持つと境界の判断が揺れる。**同じ発想に至ったときは、ここを見て RSC の枠へ戻ること。**

| モデル | 採らない理由 |
| --- | --- |
| Islands architecture | 「静的な面の中に動く島を置く」分割は、Server Component の中に Client Component を置く形と同じである。島の単位を別に宣言する必要がない |
| render-as-you-fetch | 取得と描画を分けて先に走らせる手法は、取得が描画の内側にある RSC では前提が成立しない。取得は Server Component が行い、待つ範囲は `Suspense` の境界が決める |

### 境界の粒度

`Suspense` の境界は**待つものの単位**で置く。1 つの境界が複数の取得を覆うと、最も遅い 1 つが他を止める。逆に、同時に届くものを別々の境界へ割ると、画面が何度も継ぎ足されて読み始めた位置が動く。

**外枠が既に await しているものを、画面側の境界で待たない。** 取得を `cache` で memo 化していれば、外枠が出せる時点で画面の中身も揃っている。そこへ境界を置くと、**手元にある値を待つために待機表示を出す**ことになり、後から入れ替わるぶんだけ下の要素が動く。一覧のように長さがデータで決まるものでは、待機表示の高さが実物と一致しないため、この差はそのまま CLS になる([0101](0101-performance-budget.md) §4)。**待つものが無い画面は待機表示を持たない**([0080](0080-error-handling.md) §4)。

境界の内側は**待っているあいだ操作できない**。操作できる必要があるものを内側へ入れない(検索欄・絞り込み・戻る導線)。

## 禁止事項

- ❌ Pages Router の追加(App Router 単独)
- ❌ `page.tsx` / `layout.tsx` / route / Server Action に業務ロジックを書くこと(薄い driving adapter。[0011](0011-no-docker.md) thin proxy)
- ❌ `"use client"` を `layout.tsx` / `page.tsx` や上位に不要に置くこと(境界は葉へ押し下げる)
- ❌ コード分割の第一軸を route にすること(第一軸は feature。[0020](0020-adopted-architecture.md))
- ❌ 特定レンダリングモード(全面 SSG / 全面 dynamic 等)を 本リポジトリで一律強制すること
- ❌ route-as-modal を全モーダルの既定として強制すること(あくまで**選択肢**。既定手段の判断は [0053](0053-ui-component-interaction-seam.md) 管轄)
- ❌ intercepting / parallel routes の代替に独自ルーティング機構を発明・中立化すること(Next.js file convention にそのまま乗る。[0010](0010-standards-and-non-lockin.md) §1)

## 関連 ADR

- [0020-adopted-architecture.md](0020-adopted-architecture.md) — driving adapter 非分割軸 / `page.tsx` 薄化 / feature 第一軸(本 ADR の親原則)
- [0021-frontend-responsibility.md](0021-frontend-responsibility.md) — Server Action の置き場(`actions.ts`)・`"use client"` 押し下げ
- [0011-no-docker.md](0011-no-docker.md) — thin proxy(driving adapter に業務ロジックを置かない)/ 静的 CDN・SSR 両対応の想定デプロイ(モード非強制の根拠)
- [0026-layout-shell-mount.md](0026-layout-shell-mount.md) — 器を分ける判断(描画モードが route 全体で決まることの相方)
- [0028-naming-convention.md](0028-naming-convention.md) — App Router 特殊ファイル・route セグメントの命名
- [0030-environment-variable-management.md](0030-environment-variable-management.md) — プリレンダーでの env 凍結
- [0041-cache-components-decision.md](0041-cache-components-decision.md) — Cache Components(PPR)の採用(殻と穴・`instant` 宣言の機構)
- [0060-state-management.md](0060-state-management.md) — Server state = Server Component fetch 既定 / URL state(search params / route params は本 ADR の App Router 標準機構の上で扱う)
- [0090-testing-strategy.md](0090-testing-strategy.md) — Server Components / route handler / E2E のテスト線引き
- [0071-bff-api-integration.md](0071-bff-api-integration.md) — データ取得のキャッシュ・再検証設計
- [0080-error-handling.md](0080-error-handling.md) — `loading.tsx` / Suspense 境界 + `error.tsx` 系の配置・責務
- [0053-ui-component-interaction-seam.md](0053-ui-component-interaction-seam.md) — モーダル/ダイアログの既定手段(native `<dialog>` / a11y 必須要件)。route-as-modal 採否を本 ADR に委譲(本節がその受け皿)
- [0010-standards-and-non-lockin.md](0010-standards-and-non-lockin.md) — 標準準拠と非ロックインの判断軸(route-as-modal = Next.js 規約に乗る seam / 構造は代替可能 = vendor-independent 正当化の根拠)
- [0004-library-management.md](0004-library-management.md) — ライブラリ管理方針(route-as-modal はネイティブ機能で新規依存を増やさない = 本 ADR は同方針の対象外)
