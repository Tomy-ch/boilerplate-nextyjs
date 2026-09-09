# フロント内責務分離方針

[0020](0020-adopted-architecture.md) で採用した **機能スライス × 表示層カーネル** アーキテクチャについて、本 ADR は各カーネルの **責務 / 依存マトリクス / 命名規律 / カーネル受入基準 / Server Action の置き場 / 機械的強制(Enforcement)/ 層別 README 運用** を定める。

[0020](0020-adopted-architecture.md) がパターンを**宣言**するのに対し、本 ADR は日常運用で参照する**規約**を定める。

## Status

Accepted

## 背景

[0020](0020-adopted-architecture.md) は `src/{app, features/<name>, model, components, adapters, capabilities, stores, config, errors, logging, observability}` の 11 カーネル構成(`capabilities` は [0022](0022-capabilities-kernel.md)、`stores` は [0023](0023-stores-kernel.md))と設計原則を宣言し、各カーネルが「何を受け入れ、どこを import してよいか」の詳細は従属決定として本 ADR に委ねる。本 ADR はその従属決定を成文化する。

## 各カーネルの責務

[0020](0020-adopted-architecture.md) の対応表を責務定義として展開する。

| カーネル | 系統 | 責務 | 受け入れないもの |
| --- | --- | --- | --- |
| `app` | スライス | driving adapter。**4 element**(`route-segment`=page/layout→features / `route-handler`=`route.ts`→adapters/server + model + feature の `facade/` / `server-action`=`actions.ts`→adapters/server+features / `metadata`=robots等→config。[0025](0025-app-layer-elements.md))。`layout` は横断 UI/Provider を薄く mount 可([0026](0026-layout-shell-mount.md)) | 業務ロジック / 編成 / (route-segment の)直接 fetch |
| `features/<name>` | スライス | 画面ユースケース(データ取得の編成 / 複数 API 集約 / フォーム送信フロー / 楽観更新)+ スライス専用 UI / hooks / Server Action(主体の断言を要さないもの)。hook + UI の合成点。内部はフラット共置 | 他 feature への依存(下記昇格ルール) |
| `model` | カーネル | 表示用 ValueObject / フォーマッタ / 単位変換 / 表示バリデーション規則 / **表示結果型(`ActionState<T>` 等)**。純粋・依存最小 | **ビジネスルール**(バックエンド責務)/ fetch / config |
| `components` | カーネル | 横断 UI(デザインシステム的な純 UI コンポーネント)。トースト等の UI 状態は持てる | fetch / config / 業務状態 / `capabilities` ・ `stores` の import |
| `adapters` | カーネル | 外部接続のみ(backend API client / BFF fetch / analytics 等)。**server / client の 2 element**([0024](0024-adapters-server-client-split.md)。server = config 可・secret / client = `"use client"`・secret 不可)。生成型・外部型を内層へ漏らさない変換の所有境界 | 業務ロジック / UI / local ブラウザ API(→ `capabilities`) |
| `capabilities` | カーネル | 横断 client hook(runtime 能力 = connectivity / mediaQuery / storage / clipboard / cookie 読み等)。**client-only**。[0022](0022-capabilities-kernel.md) | remote IO(→ adapters)/ `server config` / 業務状態 / UI / ポリシー状態(client config の NEXT_PUBLIC リテラルは可) |
| `stores` | カーネル | 横断 client 状態(複数 feature が共有する Zustand ストア = 選択状態 / ウィザード / グローバル UI トグル等)。**client-only**。[0023](0023-stores-kernel.md) | server state(→ RSC/adapters)/ 単一 feature の状態(→ feature 内 local)/ UI マークアップ(→ components)/ `server config` / secret / 業務ロジック |
| `config` | カーネル | 型付き config(**目的別**・単一オブジェクト非採用。server config〈secret〉/ client config〈NEXT_PUBLIC リテラル〉。[0030](0030-environment-variable-management.md))。`process.env` 直読の唯一の場所 | UI / fetch / 業務ロジック |
| `errors` | カーネル | エラー分類(protocol-agnostic なセンチネル分類)。全層から参照可。[0080](0080-error-handling.md) | 他カーネルへの依存 |
| `logging` | カーネル | 構造化ログ。config 値は注入で受ける。[0081](0081-observability-logging.md) | — |
| `observability` | カーネル | OTel / トレース。config 値は注入で受ける。[0081](0081-observability-logging.md) | — |

## 依存マトリクス

各カーネルが import してよい先(import する側 → 許可される先)。**本表を正とする**。

| 層(import する側) | 許可される import 先 |
| --- | --- |
| `app/route-segment`(page/layout。[0025](0025-app-layer-elements.md)) | `features` / **入口の保護に限り** `adapters/server/auth` の確定認可(`verifySession()`)と `model` の述語([0079](0079-auth-frontend-seam.md))/ **計装の mount に限り** `observability` の trace 相関の取り出し([0082](0082-client-observability.md))(+ `layout` は横断 UI/Provider を `components`/`capabilities`/ポリシー seam から薄く mount 可。[0026](0026-layout-shell-mount.md))/ **Next.js の規約が route segment に置くことを要求する値に限り** `config`(root layout の `metadata` export が読む `config/site`、画面が読む `config/clock`。[0025](0025-app-layer-elements.md) の禁止事項の例外) |
| `app/route-handler`(`route.ts`) | `adapters/server` / `model` / `errors` / `logging` / feature の `facade/` のみ(thin proxy・業務ロジック禁止。[0025](0025-app-layer-elements.md)。`architecture.ts` の `APP_ELEMENTS` が機械強制する) |
| `app/server-action`(`actions.ts`。[0025](0025-app-layer-elements.md)) | `adapters/server` / `features` / `model` / `errors` / `logging`(**主体の断言をここで行う**・業務ロジック禁止) |
| `app/metadata`(robots等) | `config` / `model`(起動 / ビルド境界例外)。要求時に一覧を辿る `sitemap.ts` に限り `adapters/server` と対象 feature の `facade/`([0025](0025-app-layer-elements.md)) |
| `features` | `model` / `components` / `adapters`(公開面のみ)/ **`capabilities`** / **`stores`** / `errors` / `logging` / `observability`(描画を span へ載せる口。[0081](0081-observability-logging.md)) |
| `adapters/server`([0024](0024-adapters-server-client-split.md)) | `model` / `errors` / `logging` / **`config`(= `server config` の唯一の許可層)**/ `observability`(ブラウザから中継したテレメトリを signal へ載せる口。[0082](0082-client-observability.md))。`server-only` |
| `adapters/client`([0024](0024-adapters-server-client-split.md)) | `model` / `errors` / `logging` / client config(**`server config` 不可**・NEXT_PUBLIC リテラルは可)。`"use client"` |
| `capabilities`([0022](0022-capabilities-kernel.md)) | `model` / `errors` / `logging` / client config(`server config` 不可・NEXT_PUBLIC リテラルは可)。`"use client"` |
| `stores`([0023](0023-stores-kernel.md)) | `model` / `errors` / client config(`server config` 不可・NEXT_PUBLIC リテラルは可)。`"use client"` |
| `components` | `model` / `errors`(`capabilities` / `stores` は import しない) |
| `model` | **`errors` のみ**(安定核が知ってよいのはエラー分類だけ) |
| `errors` | なし。`logging` / `observability` は config 値を注入で受ける |

- 表にない import 方向はすべて**禁止**(内向き依存原則。[0020](0020-adopted-architecture.md) 設計原則 1)
- **入口の保護は `app/route-segment` の名指しの例外**である([0079](0079-auth-frontend-seam.md) §4)。`verifySession()` を呼び、`model` の述語で判定し、満たさなければ `redirect()` する —— この 3 つだけを許し、取得も業務ロジックも許さない。例外にする理由は、保護が入口ごとに閉じていなければ意味を持たず、**route segment の集合を知っているのは app 層だけ**だからである。`features` へ回せないのは、DAL を含む `adapters/server/auth` へ触れてよいのが `app` と `adapters` だけという同じマトリクスの帰結による(下記「Server Action の置き場」と同型)
- **計装の mount も `app/route-segment` の名指しの例外**である([0082](0082-client-observability.md))。root layout がアクティブな span の trace 相関を取り出し、mount する client component へ渡す —— これだけを許し、span の生成も記録も許さない。例外にする理由は、**ブラウザに OTel SDK を置かない**([0081](0081-observability-logging.md))結果としてブラウザが自分の trace を持たず、サーバ側の trace id を渡せるのが器を組む層だけだからである。渡さなければ、ブラウザ発の記録は中継要求の span に紐づき、測定が起きていない要求と親子になる
- **`server config`(secret を持つ runtime config object)を import してよいのは `adapters/server` のみ**(実行時の唯一の許可層 = 境界アダプタ)。内側の層は server config でなく**値を引数で受け取る**(内側の層は config を知らない)。※ client config(= NEXT_PUBLIC のビルド時インライン**リテラル**。[0030](0030-environment-variable-management.md))は runtime object でなく公開定数のため、client 側の層(`adapters/client` / `capabilities` / Client Component)も import 可
- **`features` は config を読まない**のだから、外から見た origin を知るのは `app` だけである。絶対 URL の組み立て(構造化データの `url`、canonical 等)は `app` が行い、feature は自分がどこにあるかを画面の正規 URL から受け取るか、持たない
- **起動 / ビルド境界の例外**: config の検証実行点である `instrumentation.ts`(`src/` 直下)と `next.config.ts`(リポジトリルート)は config を import してよい。これらは 11 カーネルの**外側**にある起動 / ビルドのエントリである。`app/metadata`(robots等。[0025](0025-app-layer-elements.md))と `proxy.ts`(Edge 互換 config スライス。[0043](0043-middleware-policy.md))も同格の起動 / ビルド境界例外として config import を許す。ESLint boundaries では専用 element として扱う

### `features ↔ features` 禁止と昇格ルール

feature 間の直接 import は**禁止**する。複数 feature から共有が必要になった要素は、その性質に応じてカーネルへ**昇格**させる:

- 表示用ロジック(VO / フォーマッタ) → `model` へ
- UI コンポーネント → `components` へ
- 外部接続 → `adapters`(server / client の面を実行文脈で選ぶ。[0024](0024-adapters-server-client-split.md)) へ
- **reactive な横断 client hook(runtime 能力) → `capabilities`([0022](0022-capabilities-kernel.md)) へ**
- **横断する client 状態(stateful store) → `stores`([0023](0023-stores-kernel.md)) へ**(非横断〈単一 feature 内〉の状態は昇格せず feature 内 local。既定は [0060](0060-state-management.md))

feature を跨ぐ横断が必要になった時点で「どのカーネルへ昇格するか」を判断し、feature 間の横依存は作らない。

#### 昇格できないもの — feature の `facade/`

**どのカーネルも受け取れないのに、2 つ目の feature が要るものがある。** それだけを **feature が `facade/` に置き**、他の feature から import してよい。該当するのは次の 2 種で、いずれも「上げ先が無い」ことが条件である。

- **題材のドメイン語彙を持つ UI。** `components` はコア残留であり、サンプル除去の残留検査(`DANGLING_PATTERN`)が題材の語を弾く。`stores` に依存する UI も同じで、`components` は `stores` を import できない。つまり上の昇格表には**「特定ドメインの状態や語彙を持つ UI」の行を作れない**
- **その feature が所有するルートの識別子と、その組み立て。** パス定数や URL 構築は `model` の受け入れ範囲(表示用の値・変換・検証規則)ではなく、上げると `model` がアプリの URL 空間の登録簿になり、画面を足すたびに太る。ルートを所有しているのはその feature なので、外へ見せる口だけを `facade/` へ出す。
  **指す側は宛先を書き写さず、所有者の `facade/` から取る。** 書き写すと同じルートの定義が 2 つになり、
  変えたときに古いほうが残る —— `facade/` がそもそも在る理由がこれである

- **昇格が先である。** `facade/` に置いてよいのは、上の表のどのカーネルも受け取れないものに限る。純粋な表示ロジックは `model`、題材を知らない UI は `components`、横断 hook は `capabilities` へ上げる
- **置くのは 2 つ目の feature が実際に必要としたときだけ**。1 つの feature しか使わないものは、その feature の内側([0027](0027-directory-structure.md) の co-location 方針)に置く。使う feature が 1 つに戻ったら下ろす
- **`facade/` 以外は外から見えない。** 画面の下も feature 直下も、その feature の内部である
- **上の 2 種は「他 feature へ見せる公開面」の列挙であって、`facade/` に置けるファイルの網羅ではない。**
  公開面が依存する内部実装（判定の純関数など）も `facade/` に同居する。境界検査上 `facade/` は
  **feature 内部を import できない**（区画が import できるものは `features` と同じで、`features`
  自身を含まない）ため、公開面が使うものを feature 直下へ置くと、公開面からの参照がそこで落ちる。
  つまり同居は便宜ではなく構造の帰結である。ただし**同居させたものが公開面になるわけではない** ——
  他 feature が import してよいのは上の 2 種だけである
- **名前が指すのは「この feature が外へ見せる顔」**である。`public` を採らないのは、Next.js では静的配信のディレクトリを指す語であり「Web への公開」へ連想が寄るため。`exports` を採らないのは、制約しているのが**外から import してよいか**であって export の集積ではないため(どのファイルも export は持つ)。役割を名指ししているので `common` / `shared` 等の禁止名とは性質が異なる
- **包んで単純化する層ではない。** 部品をそのまま置く面であり、`facade/` のために wrapper を作らない

**例外は画面まるごとの story(`src/features/**/*.stories.tsx`)だけ**とする。画面が実際に組み合わせている別 feature の部品を含まない story は、その画面の確認に使えない。story は実行時の依存を持たない確認専用の面であり、そこで合成しても製品コードの依存方向は変わらない。したがってこの 1 種のファイルには app 層と同じ合成の権限を与える(`architecture.ts` の `ENTRY_POINTS` の `feature-story` カテゴリが機械強制する)。**製品コード側の出口は上記 5 つのみで、story を経由して型や実装を渡すことは禁止**する。

### 公開面は宣言で示す —— barrel を作らない

**barrel(`index.ts`)は作らない。** 公開面は `architecture.ts` の区画宣言と層 README の frontmatter が宣言するものであり、barrel はそれを曖昧にする —— 「index から export されているか」が事実上の公開面になり、宣言と食い違っても誰も咎めない。加えて barrel は循環参照の温床になり、tree-shaking も阻む。import は実ファイルを直接指す(生成物が持つ `index.ts` は生成器の出力であり、本規約の対象外)。

## feature 内で部品を分ける基準

昇格ルールが feature を**跨ぐ**分割を決めるのに対し、ここは**跨がない**分割 —— 1 つの feature の内側で部品・hook・純関数をどこで切るか —— を決める。

**分けるのは次のいずれかに当たるときだけ**とする。

- **変わる理由が 2 つ以上ある**。変更の依頼が別々の出来事から来るなら、それは別の部品である
- **技術的に境界が強制される**。`"use client"` の境界、Server Action、focus trap のように DOM を残せない機構、状態を form の子でしか読めない API など、仕様の側が分割を要求する
- **状態の寿命と持ち主が違う**。操作の途中経過と表示、方針と器は、置き場所も差し替えのタイミングも別である
- **2 つ目の参照が実際に出た**。予測では分けない(昇格ルールと同じ規律)。**3 回目まで待つ流儀(rule of three / AHA)は採らない** —— 待つのは「2 箇所目では正しく抽象化できない」という前提を置くことであり、その前提は設計を詰めれば成立しない。2 箇所目で**正しい抽象を選ぶ**ことを要求する
- **React を外して検証できる形になる**。順序・判定・変換は純関数として切り出す
- **状態や購読を伴う方針が、2 つ目の部品でも要る**。この場合だけ hook にする(純粋な計算は hook にしない。関数で足りる)

**分けないのは次のとき**である。過剰分割は、分割しないことと同じだけ設計を壊す。

- props を素通しするだけになる(`Wrapper` / `Inner` のように、役割を名指しできない)
- 常に一緒にしか変わらない
- 使う場所が 1 つしかない方針を hook へ出す(早すぎる抽象)
- 分割の結果として真偽値の props が増える。**これは分割ではなく合成へ直す合図**である

「使う場所に置く」という主張(Locality of Behaviour)と、小ささより読み取りやすさを採る主張(CUPID)は、この「分けない基準」として取り込んでいる。分割そのものを否定する立場は採らない。

**重複は 2 箇所目で統合する(DRY)。** `components` の部品が上流の実装を複製して持つのは、参照実装として取り込む決定([0052](0052-ui-component-policy.md))であって、DRY の例外ではない。

判定に迷ったときは、次を順に当てる。**命名**(「〜と〜」でしか説明できないか)/ **早期 return**(別の姿を返しているか)/ **props**(2 群に割れ、片方しか使わない分岐があるか)/ **import**(系統が 2 つに割れているか)/ **state**(互いに無関係な状態が 2 つ以上あるか)。

**Container / Presentational は採らない。** その分割線は [0040](0040-routing-rendering-strategy.md) の server(取得・編成)/ client(相互作用)に置き換わっており、実務上の線引きは `"use client"` を葉へ押し下げることである。

**client の器へ server の出力を渡すときは `children` を使う。** 相互作用を持つ器の中に server が組み立てた内容を置く場合、内容を props の値として運ばず `children` として渡す。器が内容の型を知らずに済み、`"use client"` の境界が器の縁で止まる。

**型で表せることは型で表す。** 状態の表し方・境界での確定・識別子の brand・`satisfies` の使い方は [0029](0029-type-design-discipline.md) が持つ。

**props は使う側の必要に合わせて分ける**(Interface Segregation)。1 つの部品が受け取る props に、特定の呼び出し元しか使わない群があるなら、それは 2 つの部品である。

### 別名で立て直さない考え方

次の考え方は**規則として別立てしない**。実体は既に別の形で規定されており、標語として並べると同じ規則が 2 か所に現れる。**同じ概念を思いついたときは、ここを見て既存の規定へ戻ること。**

| 考え方 | 実体の所在 |
| --- | --- |
| Single source of truth | 「server state の写しを持たない」([0023](0023-stores-kernel.md))と「入力規則の SSOT は zod スキーマ」([0060](0060-state-management.md) / [0062](0062-form-input-validation.md)) |
| YAGNI / KISS / Rule of Least Power | 上の「分けない基準」(予測では分けない / 早すぎる抽象 / 量を基準にしない) |
| Conway の法則 | 採らない。組織構造を判断材料にしない。置き場所は責務で決める |
| SOLID の S 以外(O / L / D) | 依存の向きは依存マトリクス、抽象への依存は seam を持つ ADR([0079](0079-auth-frontend-seam.md) 等)が個別に規定する |

**分割はテストと story の単位を動かす**([0090](0090-testing-strategy.md) の 1 モジュール 1 テスト / [0054](0054-ui-catalog-storybook.md))。実装が固まった後、テストを書く前に済ませる。

## 命名規律

カーネル・ディレクトリは **役割名のみ許可**する。名前だけから受入基準を推定できない名称は**禁止**する。

- **禁止名**: `common` / `shared` / `utils` / `util` / `helpers` / `lib` / `misc` 等(役割を名指ししていない置き場)
- **根拠**: 役割を名指しできない置き場が必要になった時点で、それは**設計の欠落**である。汎用ユーティリティの家は作らない。表示系ヘルパは `model`、非表示系は feature 内に置く。真に横断が必要になったら、**ADR 追補で役割を定義してから**作る
- **適用例**: 境界アダプタ層は `lib` ではなく **`adapters`** と命名する

命名規律(名前が役割を宣言)と後述のカーネル受入基準(受入基準が中身を検査)で**二段防衛**とする。

## カーネル受入基準

カーネルへ要素を追加してよい基準は次の 4 つである。1〜3 は「横断参照されるものだけを置き、単一責務を保つ」というカーネル一般の方針、4 は表示層ロール定義([0011](0011-no-docker.md))の帰結である。

1. **複数箇所から参照される、または外部ライブラリの wrap である**もののみ受け入れる
2. **単一機能ヘルパ**(1 つの feature でしか使わないもの)は feature 内に置く。カーネルへ上げない
3. **単一責務**を保つ(1 カーネル = 1 役割)
4. **ビジネスロジック禁止**(バックエンド責務。[0011](0011-no-docker.md))

命名規律(禁止名)と本受入基準の両方を満たさない要素は、カーネルへ追加してはならない。

## Server Action の置き場

Server Action は `actions.ts`(controller 相当)に置く。**どこの `actions.ts` かは、主体の断言が要るかで決まる**([0025](0025-app-layer-elements.md) の element 表が正)。

| 主体の断言 | 置き場 | element |
| --- | --- | --- |
| 要る | `src/app/**/actions.ts` | `app/server-action` |
| 要らない | `features/<name>/<screen>/actions.ts` | `features` |

- **Server Action は公開 HTTP 口である**。action id を知る者は、その action を描いていない route へも POST できる。したがって役割・所有の判定を「この画面は保護されているから」で代替せず、**action の内側で断言する**
- 断言に要る `adapters/server/auth` へ触れてよいのは `app` と `adapters` だけなので、断言を持つ action は `features` に住めない。置き場が 2 つに分かれるのはこの依存マトリクスの帰結であって、例外規定ではない
- **feature の画面は送信先を自分で決めない。** 断言を持つ action を使う画面は、その action を `app` の route から props で受け取る。session の封緘は `adapters/server/auth` の領分で、そこへ触れてよいのが `app` だけである以上、送信先を知っているのも `app` だけだからである
- driving adapter として扱い、**編成のみ**を行う(feature の編成関数 / server 関数を呼ぶ)。**業務ロジックは書かない**([0011](0011-no-docker.md) の thin proxy 決定と接続)
- `"use client"` は feature 内の葉コンポーネントへ押し下げ、`page.tsx` は Server Component の薄い呼び口に留める([0040](0040-routing-rendering-strategy.md))

## Enforcement(機械的強制)

層の依存方向は文書だけで守らず、ESLint boundaries 相当のプラグインで機械強制する。強制手段の全体方針は [0002](0002-formatter-linter.md)「ESLint による補完」節に接続する(フォーマットと biome が表現できる検査は biome、「import する側の層」を文脈に取る境界検査のみ ESLint で補完)。

- **プラグイン選定(本 ADR で確定)**: 層境界検査には **`eslint-plugin-boundaries`** を採用する([0002](0002-formatter-linter.md) が「具体プラグインの選定と層定義マッピングは 0021 の Enforcement 節で定める」としている、その確定をここで行う)。「import する側の層」を element として文脈に取れるのが選定理由で、biome の `noRestrictedImports` では表現できない検査だからである(0002 の能力ベース分担に合致)
- **層定義マッピング(本 ADR で確定)**: 上記「依存マトリクス」がそのまま element(層 = カーネル / feature 単位)+ allowed-import ルールの定義である。11 カーネルを element とし(`app` は route-segment / route-handler / server-action / metadata の 4 element、`adapters` は server / client の 2 element に細分。[0025](0025-app-layer-elements.md) / [0024](0024-adapters-server-client-split.md))、`features` は feature 単位の element として `features ↔ features` を禁止する。`server config`(runtime config object)を import してよい element は `adapters/server` と起動 / ビルド境界(`instrumentation.ts` / `next.config.ts` / `app/metadata` / `proxy.ts`〈Edge 互換 config スライス。[0043](0043-middleware-policy.md)〉)のみ(client config の NEXT_PUBLIC リテラルは client 側も可)。server-only(`adapters/server`)と use-client(`adapters/client` / `capabilities` / `stores`)も element 属性で分ける
- **violation severity**: 境界違反は CI(`pnpm lint:ci`)でブロック(error)とする
- **マトリクスの正(本 ADR で確定)**: 依存マトリクスの機械可読な表現は **`architecture.ts` 1 箇所**に置く。ESLint はそれを import して強制へ変換し、層 README の frontmatter は人間向けの同内容を持つため**機械的な突合で守る**(食い違えば `lint:ci` が落ちる)。宣言を 2 箇所へ書き写すと、片方だけ直したコミットが咎められずに通る
- **静的強制 vs 意味的監査の分担**: 静的な層境界強制は ESLint、意味的な層責務の監査(置いたものが README の受け入れ範囲に合っているか)は層 README を読むレビューが担う

## 層別 README 運用

11 カーネル(`app` / `features` / `model` / `components` / `adapters` / `capabilities` / `stores` / `config` / `errors` / `logging` / `observability`)+ 各 feature に README を配置する。

- 各 README を **層別アーキ監査とテスト観点の実行時読込元**(= 正)とする。監査する側が規約の写しを持つと、README を直しても監査が古い規約で裁く
- 各 README には、本 ADR の**命名規律**(役割名のみ・禁止名)と**カーネル受入基準**を転記し、その場で参照できるようにする

## 禁止事項

- ❌ 依存マトリクスにない import 方向(外向き依存 / `model` からの外部 import 等)
- ❌ `features ↔ features` の直接 import(昇格ルールに従いカーネルへ上げる)。**例外は 2 つ** —— 画面まるごとの story と、**相手の `facade/`**(上記「昇格できないもの」)
- ❌ `server config` を `adapters/server`(+ 起動 / ビルド境界)以外の層から import すること(内側は値を引数で受け取る)。※ client config の NEXT_PUBLIC リテラルは client 側の層も import 可
- ❌ 役割を名指ししない置き場(`common` / `shared` / `utils` / `lib` / `misc` 等)の作成
- ❌ barrel(`index.ts`)を作ること(公開面は `architecture.ts` と README frontmatter が宣言する)
- ❌ Server Action / `actions.ts` に業務ロジックを書くこと(編成のみ)
- ❌ カーネルに単一機能ヘルパ・ビジネスロジックを置くこと(受入基準違反)
- ❌ 行数・props の数・ファイルの大きさを基準に部品を分けること(基準は変わる理由であり、量ではない)
- ❌ 役割を名指しできない分割(`Wrapper` / `Inner` / `Base` 等)を作ること

## 補足

- 本 ADR が持つ**依存ルール・命名規律**は [0140](0140-documentation-operations.md) のタクソノミーで rule 分類に当たる。「やったら違反」と機械的に言える形のものは `docs/rules.md` が本 ADR への逆参照付きで持ち、判断の根拠は本 ADR が持つ

## 関連 ADR

- [0020-adopted-architecture.md](0020-adopted-architecture.md) — 採用アーキテクチャの宣言(本 ADR の親決定)
- [0022-capabilities-kernel.md](0022-capabilities-kernel.md) — `capabilities` カーネル(横断 client hook。本 ADR のマトリクス / 昇格ルールに反映)
- [0023-stores-kernel.md](0023-stores-kernel.md) — `stores` カーネル(横断 client 状態。本 ADR の責務テーブル / 依存マトリクス / 昇格ルール 5 出口目に反映)
- [0024-adapters-server-client-split.md](0024-adapters-server-client-split.md) — `adapters` の server/client 2 element 分割
- [0025-app-layer-elements.md](0025-app-layer-elements.md) — `app` の route-segment/route-handler/server-action/metadata の 4 element（許可 import 先の正は同 ADR の element 表）
- [0031-policy-state-supply.md](0031-policy-state-supply.md) — consent/flag の供給方針(source adapter + stateless props)
- [0026-layout-shell-mount.md](0026-layout-shell-mount.md) — `layout` の横断 UI/Provider mount 例外
- [0011-no-docker.md](0011-no-docker.md) — 表示層ロール定義(ビジネスロジック禁止 / thin proxy)。`model` のビジネスルール禁止・Server Action 編成限定の根拠
- [0002-formatter-linter.md](0002-formatter-linter.md) — ESLint による層境界検査の補完(Enforcement の接続先)
- [0027-directory-structure.md](0027-directory-structure.md) / [0028-naming-convention.md](0028-naming-convention.md) / [0030-environment-variable-management.md](0030-environment-variable-management.md) — 本 ADR の物理配置・命名・config 詳細を具体化する ADR
