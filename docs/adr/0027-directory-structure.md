# ディレクトリ構造

[0020](0020-adopted-architecture.md)(採用アーキテクチャ)/ [0021](0021-frontend-responsibility.md)(責務分離)で宣言した **機能スライス × 表示層カーネル** の**論理**構成を、`src/` 配下の**物理**配置として確定する。本 ADR は **物理レイアウト / path alias / co-location 方針 / 共有モジュールの粒度 / 物理ディレクトリの作成タイミング** を定める。

## Status

Accepted

## 背景

[0020](0020-adopted-architecture.md) は 11 カーネル構成(`src/{app, features/<name>, model, components, adapters, capabilities, stores, config, errors, logging, observability}`。`capabilities` は [0022](0022-capabilities-kernel.md)、`stores` は [0023](0023-stores-kernel.md))と設計原則を、[0021](0021-frontend-responsibility.md) は各カーネルの責務・依存マトリクス・命名規律を宣言する。「`src/` 配下に何をどの粒度で物理配置するか」「path alias をどう使うか」「テスト・スタイルをどこに置くか(co-location)」は、その従属決定として本 ADR が持つ。

物理配置の基本形は **per-package co-location**(実装・テスト・README を同じ場所に共置)+ 浅い層構成 + 昇格基準を満たしたときだけ共有モジュールへ、である。バックエンド側と揃えた形であり、1 機能の変更が 1 か所に閉じることを物理配置で担保する。

## 決定

### 物理レイアウト

`src/` 直下は [0020](0020-adopted-architecture.md) の **11 カーネル**(9 + `capabilities` [0022](0022-capabilities-kernel.md) + `stores` [0023](0023-stores-kernel.md))とする(全体図・依存方向は [0020](0020-adopted-architecture.md) を正とする)。本 ADR は各カーネル**内部**の物理配置を定める。

```text
src/
├── app/                    # route-segment(page/layout/loading/error)/ route-handler(route.ts)/ metadata(robots等)。[0025]
├── features/
│   └── <name>/             # 1 feature = 1 ディレクトリ。内部は画面 × 性質で掘る(下記)
├── model/                  # 表示用 VO / フォーマッタ / 表示結果型(ActionState<T> 等)(フラット共置)
├── components/             # 横断 UI(フラット共置)
├── adapters/               # 外部接続。server/・client/ の 2 element に分割([0024]・RSC 境界)
│   ├── gen/                #   契約から生成した wire 型([0072]。手で編集しない区画)
│   ├── http/               #   両 element が従う要求の形の規則(実行文脈を持たない区画)
│   ├── server/             #   server-only(backend client・secret・config 可)
│   └── client/             #   "use client"(同一オリジン BFF fetch / WS / telemetry 送信・secret 不可)
├── capabilities/           # 横断 client hook(runtime 能力。[0022])
├── stores/                 # 横断 client 状態(複数 feature 共有の Zustand ストア。[0023])
├── config/                 # 目的別の型付き config(server / client 分割。[0030])
├── errors/                 # エラーの正規化([0080])
├── logging/                # 構造化ログ([0081])
└── observability/          # 計装([0081])
```

- `adapters/server`・`adapters/client` の分割は**恣意的なネストではなく、実行文脈(RSC 境界)という原理的な軸**での分割であり([0024](0024-adapters-server-client-split.md))、co-location 規約の「むやみにネストしない」の例外ではない(feature 都合の階層化とは別物)
- App Router セグメントの物理構造(`page.tsx` / `layout.tsx` / `loading.tsx` / `error.tsx` / `[slug]/` 等)は Next.js App Router の規約に従う([0040](0040-routing-rendering-strategy.md))

### path alias

- 層を跨ぐ import は tsconfig の **`@/*` → `./src/*`** alias を用いる。alias を層間 import の標準経路とする
- **相対 import は同一 feature / 同一カーネル内(= 物理的に近いファイル間)に限る**。カーネルや feature の境界を跨ぐ相対 import(`../../model/...` 等)は用いず、`@/model/...` の形にする。これにより ESLint boundaries([0021](0021-frontend-responsibility.md) Enforcement)の element 解決も安定する

### co-location 方針

1 機能の変更が 1 スライスに閉じるよう、関連ファイルは実装の隣に共置する([0020](0020-adopted-architecture.md) が機能スライス採用の根拠とする修正の局所性(co-location)/ フラット共置基本)。

- **カーネル(`model` / `components` の各部品ディレクトリ / `stores` / `adapters` の element 内 等)はフラット共置を基本**とする。判定を持つモジュールを 1 ファイル 1 役割で並置し、サブディレクトリで種類分けしない
- **`features/<name>/` は 2 つの軸だけで掘る**。第 1 軸は**画面(リソース)**、第 2 軸は**性質**である。恣意的な階層化を避けるためであり、この 2 軸以外(種類・レイヤ名・再利用予定など)では掘らない

  ```text
  features/<name>/
  ├── README.md
  ├── facade/                 # 他 feature が import してよい唯一の面([0021])
  │   └── <part>/
  ├── ui/                     # 画面を挟まない = feature 全体が所有する部材(内部)
  │   └── <part>/
  └── <resource>/             # 第 1 軸(任意の 1 段): 資源 = 画面の束
      ├── ui/                 #   その資源の画面が共有する部材
      │   └── <part>/
      └── <screen>/           # 第 1 軸: 画面 = リソース単位
          ├── page-content.tsx    #   取得と組み立て
          ├── query.ts            #   入力(URL / searchParams)の写し
          ├── actions.ts          #   変更(Server Action。置き場の条件は [0025])
          ├── view.tsx            # 第 2 軸: 表示 — 画面の合成
          └── ui/                 #   表示 — その部材
              └── <part>/         #   1 部品 = 1 ディレクトリ
                  ├── <part>.tsx
                  ├── <part>.test.tsx
                  ├── <part>.stories.tsx
                  └── <part>.definition.ts
  ```

- **性質で分けるのは、性質ごとに検証手段と import 可能な先が違うから**である。取得と組み立ては `adapters` を呼び、表示は呼ばない([0021](0021-frontend-responsibility.md) 依存マトリクス)。取得は module 境界の mock を伴い、表示は DOM を伴う([0091](0091-test-verification-methods.md))。置き場が性質を表していれば、そのファイルが何を呼べて何で検証されるかを読まずに決められる
- **画面の表示は `view.tsx`(合成)と `ui/<part>/`(部材)に分ける**。`view.tsx` は `page-content.tsx` が取得した値を受けて画面を組み立てるもので、`ui/` の部品と同格ではない
- **囲んでいるディレクトリの語をファイル名・ディレクトリ名で繰り返さない**。`features/<name>/list/ui/card/card.tsx` であり `<name>-card` とはしない。区別はパスが担い、識別子は PascalCase の側が担う([0028](0028-naming-convention.md) のファイル名と主 export は別軸)
- **`ui/` の中は 1 部品 = 1 ディレクトリ**とし、実装・テスト・stories・定義・README を共置する。`components/design-system/<役割>/<部品>/` と同形であり、部品ごとに stories([0054](0054-ui-catalog-storybook.md))の置き場を確保するためにこの粒度を採る
- **深さの上限は `features/<name>/<resource>/<screen>/ui/<part>/`** とする。`ui/` の中をさらに種類で掘らない。画面が部品を抱えきれなくなった場合は、`ui/` を深くするのではなく**画面(第 1 軸)を分ける**か、[0021](0021-frontend-responsibility.md) の昇格ルールで `components` へ出す
- **第 1 軸は 1 段だけ入れ子にしてよい**。`<resource>/` は「この資源に属する画面の束」であり、**第 3 の軸ではなく第 1 軸の再帰**である。第 1 軸は「どの画面が所有するか」を表し、どの画面のものでもないものは 1 段上が所有する —— その 1 段上が feature 全体とは限らず、**同じ資源を扱う画面の集まり**であることがある。feature 直下の `ui/` を認めるのと同じ理屈がもう 1 段だけ働く
  - **受入条件は「現に 2 つ以上の資源があり、そのうち少なくとも 1 つが 2 つ以上の画面を持つ」こと**。どちらかを欠けば入れ子にせず、`features/<name>/<screen>/` の平坦な形に留める。観測できる事実で決める点は feature 直下の判定と同じで、「後で資源が増えそう」という予測では掘らない
  - **入れ子は 1 段までとする**。2 段目が要るように見えたら、それは feature の切り方が資源の粒度に合っていない兆候であり、掘るのではなく feature を分ける
  - この形は、機能スライスを資源で束ねる広く使われている構成(Feature-Sliced Design の slice、App Router のルート単位 co-location)と一致する。**ルーティングの階層と置き場の階層が揃う**ため、URL から置き場を引ける
- **画面が 1 つの間は第 1 軸を省略してよい**。`features/<name>/` の直下に `page-content.tsx` / `view.tsx` / `ui/` を置く。2 つ目の画面が来た時点で画面ディレクトリへ割る
- **どの画面にも属さず feature 全体が所有するものは、画面を挟まず feature 直下の性質へ置く**(`features/<name>/ui/<part>/` 等)。これは第 3 の軸ではない。第 1 軸が「**どの画面が所有するか**」を表す以上、どの画面のものでもないものは 1 段上が所有する、という同じ軸の帰結である
  - **判定は「現に 2 つ以上の画面が使っていること」**。禁止する 再利用予定 の軸は「後で使いそう」という**予測**で先に上げることを指す。予測は外れても誰も戻さないため禁じるのであって、**観測できる現在の事実**で置き場を決めることは禁止に当たらない
  - 1 つの画面しか使っていないものは、その画面の下に置く。使う画面が 1 つに戻ったら戻す
  - **feature を跨いだ場合はこの規則の対象外**であり、[0021](0021-frontend-responsibility.md) の昇格ルールへ移る。`features ↔ features` は禁止のため、**一方の feature から他方の内部を import して解決してはならない**
  - feature 直下が部品で膨れたら、それは feature の切り方が合っていない兆候である。`ui/` を深くせず、feature を分けるか `components` へ昇格させる
- **他の feature が使うものは `features/<name>/facade/<part>/` へ置く**。ここだけが外から import してよい面であり、画面の下も feature 直下の `ui/` も内部である(条件と規律は [0021](0021-frontend-responsibility.md)「昇格できないもの」が正)
  - 置くのは**昇格先のカーネルがどれも受け取れないもの**に限る。特定ドメインの語彙を持つ UI がこれにあたる
  - **2 つ目の feature が実際に必要としたとき**に `ui/` から上げ、1 つに戻ったら下ろす
  - 深さは `features/<name>/facade/<part>/` までとし、`ui/` と同じく 1 部品 = 1 ディレクトリとする
- **テストは実装の隣に co-location する**。`__tests__/` への一括集約はしない。テストファイルの拡張子・命名規約は [0090](0090-testing-strategy.md) が正(本 ADR は配置方針のみ)
- **スタイルは Tailwind ユーティリティを既定**とし([0050](0050-styling-strategy.md))、別ファイルの CSS は最小化する。グローバル CSS は `src/app/globals.css` に集約する。design token / `cn()` ヘルパの置き場は [0050](0050-styling-strategy.md) が正
- **契約から生成するモック**(MSW ハンドラ等)は `src/` 外の **`mocks/`** に置き、生成型([0072](0072-api-type-generation.md) の do-not-edit)と分離する
- **カタログが差し替えるモジュールの実体は、対象と同じディレクトリの `__mocks__/<対象と同じ名前>` に置く**([0054](0054-ui-catalog-storybook.md))。これは種類による掘り下げではなく、差し替えの道具が名前と位置を固定するための例外であり、`facade/<part>/__mocks__/` のように深さの上限を 1 段超える形もこの理由の範囲でだけ許す。置けるのは**カタログでしか読まれない差し替え**に限り、本番の経路が import するものを置かない

### 共有モジュールの粒度

- **判定を持つモジュールは per-file を基本**とし(1 ファイル 1 役割・フラット共置)、肥大化した時点で **per-folder へ昇格**する(ネスト深化の防止)
- **UI 部品は per-folder を基本**とする。実装のほかに stories・定義・README を伴い、それらを部品ごとに共置するため(`components/design-system/<役割>/<部品>/` と `features/<name>/<screen>/ui/<part>/` が同形)
- **feature を跨いで**共有が必要になった要素は、フォルダを増やす前に [0021](0021-frontend-responsibility.md) の**昇格ルール**(`model` / `components` / `adapters` / `capabilities` / `stores` へ昇格)に従う。共有の受け皿となる汎用フォルダ(`common` / `utils` 等)は作らない([0021](0021-frontend-responsibility.md) 命名規律)
- **同じ feature の画面を跨ぐだけ**の共有は昇格の対象ではない。feature 直下へ置く(上記 co-location 方針)。**昇格も画面跨ぎも当てはまらない —— 他の feature が必要とするが、特定ドメインの語彙を持つためどのカーネルも受け取れない —— 場合だけ** `facade/` を使う([0021](0021-frontend-responsibility.md))

### 物理ディレクトリの作成タイミング

- **空ディレクトリは生やさない**([0020](0020-adopted-architecture.md))。ディレクトリは中身を伴って初めて作る
- 新規ディレクトリを `src/` 直下に増設する(= 12 個目以降のカーネルを足す)には、[0021](0021-frontend-responsibility.md) の命名規律・カーネル受入基準を満たしたうえで **ADR 追補で役割を定義してから**行う。11 カーネルの範囲内は本 ADR が追認しており、範囲外は ADR 追補を要する。`capabilities`([0022](0022-capabilities-kernel.md))・`stores`([0023](0023-stores-kernel.md))は、この規約に従って追加されたカーネルである

## 禁止事項

- ❌ 中身を伴わない空ディレクトリを生やすこと
- ❌ テストを `__tests__/` へ一括集約すること(実装の隣に co-location する)
- ❌ feature / カーネルの境界を跨ぐ相対 import(`../../` で層を跨ぐ)。層跨ぎは `@/*` alias を使う
- ❌ feature 内を**画面(リソース)と性質以外の軸**で掘ること(種類・レイヤ名・再利用予定など。差し替えの道具が位置を固定する `__mocks__/` だけが例外 —— co-location 方針)
- ❌ `features/<name>/<resource>/<screen>/ui/<part>/` より深く掘ること(画面を分けるか `components` へ昇格させる)
- ❌ 第 1 軸を 2 段以上入れ子にすること、および受入条件(資源 2 つ以上 かつ いずれかが画面 2 つ以上)を満たさないうちに `<resource>/` を挟むこと
- ❌ カーネル内をサブディレクトリで種類分けすること(フラット共置。UI 部品の per-folder は種類分けではなく 1 部品 1 ディレクトリ)
- ❌ 11 カーネルの範囲外の新規ディレクトリを ADR 追補なしに `src/` 直下へ作ること
- ❌ 共有の受け皿となる汎用フォルダ(`common` / `shared` / `utils` / `lib` 等)を作ること([0021](0021-frontend-responsibility.md) 命名規律)
- ❌ 再輸出だけを持つ `index.ts`(barrel file)を**手で**置くこと(import 元がファイルではなくディレクトリになり、実体の所在が読めなくなる。循環参照と不要な読み込みの温床でもある。import は実体のパスを指す。**生成物は対象外** —— 生成の形は上流の道具が決めるため。実行の入口として置く `index.ts` は再輸出ではないので該当しない)

## 補足

- 各カーネル・各 feature への層別 README 配置は [0021](0021-frontend-responsibility.md)「層別 README 運用」を正とする

## 関連 ADR

- [0020-adopted-architecture.md](0020-adopted-architecture.md) — 11 カーネルの論理構成・全体図・依存方向(本 ADR の物理配置の親決定)
- [0023-stores-kernel.md](0023-stores-kernel.md) — 11 個目のカーネル `stores`(横断 client 状態。本 ADR の構造図に反映)
- [0021-frontend-responsibility.md](0021-frontend-responsibility.md) — カーネル責務・依存マトリクス・命名規律・昇格ルール(本 ADR の共有粒度・境界 import の根拠)
- [0011-no-docker.md](0011-no-docker.md) — 表示層ロール定義(PaaS / 静的 CDN 配送。物理配置がデプロイ前提と矛盾しないこと)
- [0028-naming-convention.md](0028-naming-convention.md) / [0030-environment-variable-management.md](0030-environment-variable-management.md) — 本 ADR の物理配置の上に載るファイル・識別子命名と `config` カーネルの中身
- [0040-routing-rendering-strategy.md](0040-routing-rendering-strategy.md) / [0050-styling-strategy.md](0050-styling-strategy.md) / [0090-testing-strategy.md](0090-testing-strategy.md) — 本 ADR の物理配置の上に、App Router 構造・スタイル配置・テスト配置を具体化する ADR
