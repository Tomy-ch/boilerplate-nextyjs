---
imports-allowed: [model, errors]
forbidden: [fetch, config, capabilities, stores, business-state]
test-requirement: component
---

# components

複数 feature で使うデザインシステム的な純 UI コンポーネントを置くカーネルです。

## ここにあるものは参考実装です

**作り替えてもよく、捨ててもよい。**この目録に並んでいる部品も、[`tokens/`](../../tokens/README.md)
が持つ値も、fork した先が自分のデザインへ差し替える前提で置いてあります。**そのまま使うことは
要件ではありません。**

残してほしいのは部品ではなく、部品の**置き方**です。

| 残るもの | 捨ててよいもの |
| --- | --- |
| 層の分け方（`design-system` / `patterns` / `shell` / `app-starter`）と、その軸（誰が書き換えるか × 何のための部品か） | 個々の部品の見た目・variant・命名 |
| 依存の向き（`model` と `errors` だけを引く。fetch も config も業務状態も持たない） | shadcn/ui を起点にするという選択そのもの |
| 部品ごとに README と story を co-locate するという規律 | いま並んでいる story の内容 |
| semantic token を通して色と余白を決めるという形 | token の値 |

**`app-starter` は特に作り替える前提の層です。**バックエンドの契約を知っている部品がそこに居る
ので、契約が変われば作り直しになります（[配置・命名](#配置命名)）。

## 受け入れるもの

- 横断 UI、表示に必要な UI 状態、アクセシブルな操作部品

## 受け入れないもの

- fetch、config、業務状態、`capabilities`・`stores` の import

## 運用

- 本ディレクトリの部品は shadcn/ui の copy-in を起点にする。Radix など vendor の import を採る場合も `components` に閉じ、feature から直接参照しない
- **SSR first** とし、初期表示に必要な基礎部品は native HTML と Server Component を優先する。`"use client"`、Radix、Portal など browser runtime を必要とする実装は、native 要素では満たせない操作要件がある client island に限る。静的な少数選択は `select-native` を優先し、初期配置だけを理由に CSR へ寄せない
- 見た目は Storybook の story を正として確認する。story は対象コンポーネントと同じディレクトリに co-locate する
- 各 component ディレクトリには `README.md` を co-locate する。短い props の転記ではなく、少なくとも**用途・役割・配置される公開 component・利用ケース・責務境界・Storybook / test の確認範囲**を記す。公開 component がある場合は、名称と個別の役割を表にする。native / Server Component を既定にする部品と client island の部品は、その境界と hydration の要否を明記する
- shadcn CLI はアイコンを lucide で出力する（`components.json` の `iconLibrary` に Tabler の選択肢が無い）。copy-in したら、その import を [`icon.ts`](./icon.ts) 経由へ差し替える。必要な名前が無ければ `icon.ts` へ 1 行足す。差し替え漏れは、package が解決できないことと `pnpm lint:eslint` の両方で落ちる
- 新しい shadcn copy-in では [`component-template.md`](./component-template.md) を component ディレクトリの `README.md` として自動コピーする。テンプレートの placeholder は、同じ取り込み作業で実装に合わせて必ず具体化する
- component を足したら [component 目録](#component-目録) へ 1 行足す。名前を変えたら書き換え、消したら消す。目録に無い component は、これを読む人にとって存在しないのと同じである。`ContextMenu` のように可視の trigger を持たず、既存の部品を読まなければ気付けないものほどこの影響を受ける
- どこに置くかは [`shadcn-manifest.yaml`](./shadcn-manifest.yaml) の `layer` と `as` が正であり、`pnpm check:ui` が `directory` との一致を検査する。**`layer` は「誰が書き換えるか」、`as` は「何のための部品か」**で軸が違うので畳まない。`design-system/navigation/pagination` と `app-starter/cursor-pagination` がどちらも `as: navigation` になるのは、目的が同じで層が違うためである
- Story は boilerplate を利用する人がそのまま参照できる中立なカタログとして保つ。汎用的な文言・props・リンクで部品自身の使い方を示し、特定の業務や画面に結び付く例は feature 側の Story に置く
- 状態を自身の責務として持つ UI は loading / empty / error / success を story で示す。`Button` のようにその状態を所有しない UI へ無意味な state story は作らず、disabled・pending など当該 UI の操作状態を示す。画面固有の状態は feature 側で合成する
- 単一 feature 専用の UI は feature 内に置く
- 依存先は `model` と `errors` に限定する
- class 名の条件分岐と Tailwind utility の競合解消には [`cn.ts`](./cn.ts) を使う。`clsx` と `tailwind-merge` を直接利用する実装は増やさない
- アイコンは [`icon.ts`](./icon.ts) から取る。供給元を直接 import する実装は `components` の内側にも置かない。差し替えを 1 ファイルへ閉じるためで、`eslint.config.ts` の `no-restricted-imports` が締め出す。**この面は名前付き再輸出に限る** —— 名前から component を引く表を置くと、使っていないアイコンまで束へ乗る
- 「一度満たしたら以後 mount を維持する」判断には [`use-latched.ts`](./use-latched.ts) を使う。器が閉じるたびに中身を外すと、**外すと復元できないもの**（開いた時点の内容からしか組み立てられない編集面、送信に載せる必要がある入力欄）が作り直しになる。層をまたいで要るため層の下ではなくここに置く
- 色・余白などは [`tokens/`](../../tokens/README.md) の semantic token を使う。primitive token の直接利用はしない
- shadcn/ui の追加は `pnpm add:ui <component> --as=<見出し> [--layer=<層>] [-- <shadcn add のオプション>]` を使う。一度に一部品だけを層と見出しに応じた場所へ copy-in し、成功時に [`shadcn-manifest.yaml`](./shadcn-manifest.yaml) へ層・見出し・レジストリ・追加日時・CLI 版を記録するため、`pnpm exec shadcn add` を直接実行しない。`--as` は必須、`--layer` の既定は `design-system` で、いずれも値が不正なら `shadcn add` を走らせる前に弾かれる
- **描画の span を持たない。** 横断 UI は画面ごとの帰属を持たないため、計装は feature 層の最上位に限る（[observability/README.md](../observability/README.md)）

## 変更したあとの確認

component を足した・変えたときは次を通す。順序に意味があるのは最初の 2 つだけで、`pnpm fix` が直せるものを直してから `pnpm lint:ci` に残りを出させる。

```bash
pnpm fix
pnpm lint:ci
pnpm typecheck
pnpm vitest run <触った component のパス>
pnpm build-storybook
git diff --check
```

**判定は自分が触った範囲で行う。** このリポジトリの component は互いに独立で、複数人・複数セッションが別々の component を同時に触る。全体を緑にすることを完了条件にすると、他人の途中の状態が自分の完了を止め、直そうとすれば相手の作業を壊す。

- カバレッジは `--coverage.include` で対象へ絞る。リポジトリ全体の数字は、自分の変更の良し悪しを何も言わない
- `pnpm check:ui` の指摘も自分の component の分だけ直す。他の component に付いた指摘は報告に書いて残す
- 触っていない component が落ちている場合、直すのではなく報告する。落ちていること自体が、その component を持っている側への情報である

`pnpm build-storybook` が出す Vite の chunk-size warning は build の成功を妨げない。これは分割の助言であり、component 側の欠陥を指していない。

## TSDoc の基準

TSDoc が満たすべき条件は一つである。**呼び出し側が内部の振る舞いを知らないまま、props を与えるだけで実装できること。** 実装の手順や内部状態の遷移は書かず、公開 API から見える契約だけを書く。加えて **Storybook の配置先を併記し、どのような見た目かが一目で分かるようにする。**

公開する component には次を揃える。

| 要素 | 内容 |
| --- | --- |
| 先頭の一行 | この component の責務。名前の言い換えではなく、何を引き受けるかを書く |
| `@remarks` | 呼び出し側が知らないと誤用する制約。SSR / client island の境界、必須の a11y 属性、この component が**持たない**責務 |
| `@example` | そのまま動く最小の呼び出し例。import が要る場合は import ごと書く |
| `@param props` | 受け取るものの総称（native 属性を透過するならその旨） |
| `@param props.<名前>` | props ごとの意味。値集合を持つものは各値が何を表すかまで書く |
| `@see` | Storybook の title。``@see Storybook `Action/Button` `` の形式で書く |

型・定数にも TSDoc を書く。`<Component>Props` は対応する component へ `{@link}` を張り、値集合の定数は各値の使い分けを列挙する。

subcomponent が多い compound では、root に `@example` で組み合わせ全体を示し、各 subcomponent には責務の一行と固有の制約だけを書く。同じ内容を全 subcomponent へ複製しない。

書かないもの。

- 内部の実装手順、state の遷移、どの hook を使っているか
- 開発の経緯、過去の不具合、移行の履歴（git history が持つ）
- 型シグネチャを日本語へ言い換えただけの記述

## focus 表示と装飾的な輪の使い分け

要素の周りに輪を描く手段は CSS の `outline` と `box-shadow`（Tailwind の `ring-*`）の二つがある。**focus 表示は `outline`、装飾的な輪は `ring`** と用途で分ける。同じ見た目を二つの機構で作ると、focus の見え方が component ごとに割れる。

### focus 表示

- focus ring は `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active focus-visible:shadow-glow-primary` に統一する。shadcn 生成物が使う `ring-ring` / `border-ring` / `outline-ring` の `ring` トークンは採らず、取り込み時にこの指定へ置換する
- 色に `active` を使うのは、休止時の枠（`input`）と focus とを見分けられるようにするためである。`active` はどの地の上でも **4.5:1** を満たし、`input` の **3:1** より一段強い
- **`shadow-glow-primary` は装飾であり、focus を示しているのは `outline` である。** forced-colors モードでは UA が `box-shadow` を `none` にするため光は消えるが、`outline` は残るので focus は失われない。光を焦点の唯一の手掛かりにしてはならない理由もここにある
- `ring` を focus に使わない理由は二つある。**forced-colors モードでは UA が `box-shadow` を強制的に `none` にする**ため focus ring が完全に消えること、および **`ring-offset` の隙間は透明ではなく `ring-offset-color` で塗った帯**であり、その色と一致しない面の上では帯が露出することである
- **同じ要素に `outline-none` を併記しない。** Tailwind v4 の `outline-none` は要素へ `--tw-outline-style: none` を立て、`focus-visible:outline-2` が出力する `outline-style: var(--tw-outline-style)` をそこで打ち消すため、focus ring が一切描画されなくなる。既定の outline を抑えたいだけなら `focus-visible` 側の指定だけで足りる
- 面の focus を塗りで示す menu 項目（`dropdown-menu`、`context-menu`、`command`、`select-client` の item）は例外で、`outline-hidden` と `focus:bg-accent` の組み合わせを使う

### 文字の太さ

- **強調は `font-emphasis` で書く。太さを直に指定しない。** 書体ごとに持っている太さが違い、持っていない段を指定しても丸められるだけで強調にならない（`tokens/README.md`「強調は 1 段だけ持つ」）。**`no-raw-font-weight` が機械で見る**（`eslint-rules/`）。`font-normal` は「強調しない」の打ち消しなので使ってよい
- **段は 1 つしかない。** 見出しと本文の差は寸法（`text-lg` 等）と位置が作り、太さはその上乗せである。太さで階層をもう 1 段作ろうとしない —— OS 同梱の書体では出ない環境がある（[0051](../../docs/adr/0051-styling-system.md) §5）

### 系統（`data-surface`）と Portal

- **系統の属性は Portal の出口を含む位置に置く。** `overlay/` の部品は Radix の Portal で `document.body` 直下へ出るため、本文の内側の要素に属性を置くと overlay の中身だけ既定の系統で描かれる（`tokens/README.md`「属性を置く場所は、Portal を含む位置でなければならない」）
- 部品側で `container` を差し替える場合も同じ制約が掛かる。**どちらを採るかは系統を導入する画面が決める**

### 発光

- **光ってよい色は決まっている。** `shadow-glow-primary` / `-info` / `-success` / `-warning` / `-destructive` の 5 つだけが存在し、`secondary` と `emphasis` には token が無い（`tokens/README.md`「発光の可否と時機」）
- **`warning` と `destructive` は休止時に光らせない。** `hover:` / `focus-visible:` に付ける。危険な操作が常時光っていると「いま押せる」と読める
- **面の色と違う色で光らせない。** 赤い面を主色の光で囲むと、光でできた世界では破綻して見える

### 境界を示す線

- **その線が要素の境界を示すなら `border-input`、区画の仕切りなら `border-border` を使う。** `Input` / `Textarea` のように枠が無いと入力できる範囲が判らなくなるもの、`Badge` の `outline` のように縁だけで成り立つ variant は、いずれも `input` を取る
- 分けるのは**コントラストの要求が違う**ためである。入力できる範囲の境界は **WCAG 1.4.11 が隣接色との 3:1 を求める**対象で（[0100](../../docs/adr/0100-accessibility-target.md)）、`border` は仕切りとしてどの面でも 1.2〜1.6:1 しかなく満たさない。`input` は `background` / `card` / `popover` / `muted` / `accent` のすべての上で 3:1 を満たすよう定めてある。仕切りは同条の対象外なので `border` のままでよい
- **`primary` と `emphasis` を本文の色に使わない。** この 2 つは面と図形のための色で、WCAG 1.4.11 の **3:1** しか満たさない。文字に置くと AA の 4.5:1 を割る。リンクや状態の文言には `secondary` / `success` / `warning` / `destructive` / `info` を使う（いずれも 4.5:1 を満たす）。アイコンは非テキストなので 3:1 で足り、`primary` を置いてよい
- 判断の根拠は token の値にあるため、配色を変えたときはこの節を先に確認し、**比を測り直す**。呼び出し側のコメントに理由を書くと、token を直しても気づかれない

### 装飾的な輪

`outline` は 1 要素に 1 本しか引けず、必ず外側に描かれる。次の要件は `outline` では満たせないため `ring-*` を使う。

- 輪を重ねる、または輪と影を合成する
- 要素の内側に引く（`ring-inset`）。`overflow: hidden` の内側や container の端に密着した要素で使う

太さの変化を遷移させたいことは `ring` を選ぶ理由にならない。`outline-width` も遷移可能なため、
`outline-solid outline-0` を基底に置いて `hover:outline-4` のように太さだけを変えれば同じ表現になる。

`ring-offset` が隙間を背景色で塗る性質は、focus では欠陥だが装飾では機能になる。重なり合う `avatar` を背景色の帯で切り分ける `ring-2 ring-background` がその例である。

## 定義の無い class

Tailwind は認識できない class に対して CSS を出力せず、そのことを何も報告しない。要素はその宣言が無いまま描画されるだけなので、**面が透明になる・focus ring が出ない・選択状態が見えない**といった欠陥が、browser で見るまで現れない。shadcn 生成物は上流の theme が持つトークンを前提にしているため、取り込みのたびにこれが混入しうる。

検出は `pnpm check:classes` が行う。`globals.css` を実際に build し、`src/components` 配下の `.tsx` に書かれた class がすべて出力に現れるかを照合する。CI では component・`globals.css`・トークンのいずれかを触った PR で走る。

**「定義が無いから消す」は行わない。** 出力が無いことと、書いてはいけないことは別である。animation plugin を採らないために CSS が出ない `animate-in` / `fade-in-*` / `slide-in-from-*` や、子孫の variant から参照されるだけの `group` / `peer` は、意図して CSS を持たない。これらは [`scripts/check-classes.ts`](./scripts/check-classes.ts) の `KNOWN_WITHOUT_CSS` に理由とともに置いてあり、新たに見つけた場合も実装から消さずにそこへ足す。生成物から消すと、その生成物が持っていた情報が失われる。

一方、次のものは「トークンの話ではなく壊れているもの」なので直ちに直す。

- 解決しない import パス（生成物の `@/components/design-system/button` はこのリポジトリの配置と合わない）
- 型と実際に render する要素の不一致
- lint / typecheck が落ちる記述
- アクセシブルな名前の欠落など a11y の配線

## CSS 変数の接頭辞

このリポジトリの CSS 変数は `--color-*`（primitive）と `--semantic-color-*`（semantic）である。shadcn 生成物が使う接頭辞なしの `var(--primary)` / `var(--secondary)` / `var(--muted)` / `var(--foreground)` は**一つも解決しない**。

解決しない変数が `color-mix()` や `oklch(from …)` の引数に入ると、値が無効になった時点で**宣言全体が破棄され、面がまるごと出ない**。class 名の検出には掛からないため、取り込み時は変数も別に検出する。

```bash
grep -ohE 'var\(--[a-z0-9-]+\)' src/components/<層>/**/<component>/*.tsx \
  | sed 's/var(//;s/)//' | sort -u | grep -vE '^--(radix|tw)-' \
  | while read -r v; do grep -qF -e "$v:" storybook-static/assets/*.css || echo "未解決: $v"; done
```

`--radix-*` は Radix が、component 自身が `style` で渡す変数はその component が runtime で設定するため除外してよい。

## 配置・命名

Next.js と React は、`components/` 配下のディレクトリ構造・ディレクトリ名・テストや story の配置を規定しない。Next.js のファイルシステム規約は `app/` 配下の route segment と特殊ファイルに限られ、React が定めるのは JSX で使うコンポーネント識別子の PascalCase などである。以下はフレームワーク規約ではなく、本リポジトリの規約として採る。

- コンポーネントは実装・テスト・story を 1 つのディレクトリへ co-locate する。3 ファイル以上が横並びに増え続けることを避けるため、`design-system/<目的>/<コンポーネント名>/`（`patterns` と `app-starter` は `<層>/<コンポーネント名>/`）を基本形とする
- component の README は実装・テスト・story と同じディレクトリに置く。単なる props の転記ではなく、用途・役割・公開 component・利用ケース・責務境界・Storybook / test の確認範囲を見出しで示す。公開 component ごとの役割は表にする
- **`README.md` を持つディレクトリが component である。** `pnpm check:ui` はこれを唯一の目印にして、台帳と実体を突き合わせる。役割ディレクトリを列挙する方式を採らないのは、役割が増えるたびに script を直すことになり、直し忘れた役割が台帳から静かに抜けるためである
- **`design-system/<目的>/` のようなまとめるためのディレクトリには README を置かない。** 置くとそれ自体が component として数えられ、台帳に記録が無いものとして落ちる。まとめるためのディレクトリが何を受け持つかは、この README の下の一覧が持つ
- component かどうかを実装ファイルの有無で判定しない。`layout-patterns` のように story だけを持つ component が実在するため、内容から身元を推測すると破綻する
- 同じ UI 概念に SSR first と client island の実装が並ぶ場合、ディレクトリ・ファイル名は `<concept>-native` / `<concept>-client`、公開 component 名は `ConceptNative` / `ConceptClient` にする。`client` は利用上の境界を表し、現在の Radix など vendor 名は README にだけ記す
- `native` / `client` の対は runtime 実装だけを分ける。取り込み監査の時点でもサイズ・semantic token・focus・disabled・invalid の基本設計を可能な限り揃え、SSR・form・a11y と公開 API を確認する。layout・motion・visual regression を含む完全整合は P3-8 のデザインシステム構築で Storybook を見ながら仕上げる。OS が描画する popup など native 固有の部分まで pixel-perfect に一致させる必要はない
- コンポーネントの静的な定数・値集合・型・見た目の定義は `<コンポーネント名>.definition.ts` に置く。描画・操作を担う公開コンポーネントは `<コンポーネント名>.tsx` に置き、静的定義を import して使う
- 値集合の公開定数は `export const BUTTON_SIZE: Readonly<{ ... }> = { ... }` の形式で定義する
- 公開 API でなくても、複数ファイルが同じ UI 概念の値を使う場合は owner を一つ決めて定義し、各ファイルから参照する。native HTML 要素名など JSX／型構文そのものを表す値は直接記述してよい
- 層・目的・コンポーネント名は小文字 kebab-case にする。これは全ソースの kebab-case 規約と揃えるためであり、Next.js / React の強制ではない
- `foundation` は個々の component ではなく、UI を横断して支える CSS 基盤の目的である。`typeset` の組版と `scrollbar` の scrollbar 表示が属し、いずれも `globals.css` から import する。**React component を公開しない**のが共通点であり、効き方は 2 通りある。`scrollbar` のように継承プロパティを `:root` へ一度宣言して指定なしに効くものと、`typeset` のように `.typeset` を付けた範囲だけに効く opt-in のものがある。どちらかを README の冒頭で明示する

### 層

`components/` 直下は層で分ける。**層は「その部品を誰が書き換えるか」で決まり、目的とは別の軸である。**判定は契約から先に当てる。

| 層 | 受け持つもの | 割り方 |
| --- | --- | --- |
| `design-system` | 契約を知らず、**読んでも役割が増えない**部品。`list` が `separator` を使うように、合成していても役割の中で閉じているものはここに入る | 目的別に割る |
| `patterns` | 契約は知らないが、**複数の役割を合成する**部品。目的を一つに決められないので割らない | 割らない |
| `shell` | **どこに・いくつ置くかが部品側で決まっている**部品。`toaster` は root layout に一度、`content-container` は `main` の内側、`page-header` はページ先頭 | 割らない |
| `app-starter` | **バックエンドの契約を知っている**部品。HTTP status の意味付け、送信結果、upload の段取りなど。fork 先が作り替える前提 | 割らない |

判定はこの順に当てる。**契約 → mount 位置 → 役割の閉じ方**である。順序を変えると、契約を知りつつ mount 位置も決まっている部品の行き先が揺れる。

依存の向きは `app-starter・shell → patterns → design-system` の一方向にする。逆流は層が成立していない印なので、見つけたら層の判定を疑う。

**「アプリの機能単位だから」を層の判定に使わない。** `import-export` のような機能そのものは、語彙にも構造にも現れないため条件にすると必ず主観へ戻る。機能単位として扱うものは [`shadcn-manifest.yaml`](./shadcn-manifest.yaml) の `layer: app-starter` が名簿として持ち、そこに載ったものだけを指す。

`design-system` の内側は依存の向きを問わない。`list` と `separator` のように、同じ目的の中で組み合わせるのは正常である。

### `design-system/` の目的別ディレクトリ

`design-system/` は件数が多いため、目的で分けて置く。`patterns/` と `app-starter/` は目的を一つに決められないものの置き場なので割らない。どこに置くかは [`shadcn-manifest.yaml`](./shadcn-manifest.yaml) の `layer` と `as` が正で、`pnpm check:ui` が実配置との一致を検査する。

| ディレクトリ | 受け持つもの | 置かないもの |
| --- | --- | --- |
| `action` | 利用者の操作の起点そのもの。押す・切り替えるという行為だけを持つ | 何を起こすかの決定。呼び出し元が callback で渡す |
| `form` | 値を受け取り、form の値として送信する部品 | 検証ルール・送信先・送信結果の解釈 |
| `overlay` | trigger から本文の上へ面を開く部品。開閉・focus・Escape を持つ | 面の中身。呼び出し元が children で渡す |
| `navigation` | 移動先を示す部品と、移動そのものを扱う部品 | 移動先 URL の組み立て。呼び出し元が渡す |
| `display` | 受け取った内容を読める形にして見せる部品 | 値の整形。`model/` の formatter が持つ |
| `status` | 処理がいまどうなっているかを伝える部品 | 状態の判定。呼び出し元が決めて渡す |
| `container` | 内容を収める枠と、その面の見え方を制御する部品 | 中身の構造。呼び出し元が組む |

目的が二つに跨がるときは、**その部品が無いと成立しない側**を採る。`selection-toolbar` は選択という面の状態に従属するので `container`、`copy-button` は押す行為が主なので `action` に置く。

```text
components/
├── design-system/                  ← 契約を知らず、役割も閉じている
│   ├── foundation/                 ← まとめるためのディレクトリ。README を置かない
│   │   └── typeset/
│   │       ├── typeset.css
│   │       ├── typeset.stories.tsx
│   │       └── README.md
│   ├── action/
│   │   └── button/
│   │       ├── button.definition.ts
│   │       ├── button.tsx
│   │       ├── button.test.tsx
│   │       ├── button.stories.tsx
│   │       └── README.md
│   ├── form/  overlay/  navigation/  display/  status/  container/
│   ├── layout/
│   └── rich-text/
├── patterns/                       ← 役割をまたぐが、契約は知らない
│   ├── wizard-form/
│   └── table/                      ← 入れ子。置き場は親が決める
│       ├── columns.tsx
│       ├── README.md
│       └── static-data/
├── shell/                          ← mount 位置・数が決まっている
│   ├── app-shell/
│   ├── toaster/
│   ├── pull-to-refresh/
│   ├── content-container/
│   └── page-header/
├── app-starter/                    ← バックエンドの契約を知っている
│   └── auth-state-feedback/
│       ├── auth-state-feedback.definition.ts
│       ├── auth-state-feedback.tsx
│       └── README.md
├── scripts/
├── cn.ts
├── icon.ts
├── use-latched.ts
└── shadcn-manifest.yaml
```

## Storybook の表示規約

- Story の `title` の先頭セグメントは、その component の**目録の見出しと同じ**にする。値は [`shadcn-manifest.yaml`](./shadcn-manifest.yaml) の `as` が正で、`pnpm check:ui` が突合する。`Foundation` / `Action` / `Form` / `Overlay` / `Navigation` / `Display` / `Status` / `Container` / `Layout` / `Feedback` / `Rich Text` / `View State` / `Sugar` の 13 種で、ディレクトリ・目録・sidebar が同じ区画になる
- 粒度（単体で最小の部品か、合成か）は sidebar の区画にしない。実装が育てば subcomponent は増えるため、粒度は変わる属性である。変わらない属性だけを配置に焼く
- **feature の story は上の 13 見出しに入れない。** 目録はこのカーネルが持つ部品の一覧であり、feature の部品はここの持ち物ではないためである。feature 側は次の 2 つの先頭セグメントを使う
  - `Page/<feature>/<画面>` — 画面の合成（`features/<name>/<screen>/view.tsx`）。取得を伴わない状態で画面全体の見え方を確かめる場所
  - `Features/<feature>/…` — 画面固有の部品（`features/<name>/<screen>/ui/<part>/`）。以降のセグメントは実装のディレクトリと同じ形にする
- **取得を行うもの（`page-content.tsx`）は story にしない。** story は取得の実体を持てないため、確かめられるのは合成した結果だけである。取得の検証は unit テストが持つ（[0091](../../docs/adr/0091-test-verification-methods.md)）
- **`Icons/` も component の見出しではない。** [`icon.ts`](./icon.ts) が配るアイコンの目録（[`.storybook/icon.stories.tsx`](../../.storybook/icon.stories.tsx)）で、`Tokens/` と同じ理由で層にも目録にも載らない。名前を書き写さず公開面から実行時に読むので、`icon.ts` へ足せばこの画面に出る
- **`Tokens/` は component の見出しではない。** design token の目録（[`.storybook/design-token.stories.tsx`](../../.storybook/design-token.stories.tsx)）で、アプリが描画する部品ではないため `components/` の層にも目録にも載らない。`components/` 直下は「誰が書き換えるか」で層を分ける規約なので、そこへ 5 つ目の層として足すと規約が嘘になる。Storybook 自身の資料として `.storybook/` に置き、`main.ts` の `stories` が拾う
- sidebar の並び順は [`.storybook/preview.ts`](../../.storybook/preview.tsx) の `storySort` が持つ。**`Page` → `Features` → `Tokens` → `Icons` → 目録**の順に置き、その中は名前順である。組んでいる間に開くのは前の 2 つで、目録は参照物として後ろにある方が探す手数が少ない。目録自身の並びは sidebar に持ち込まない。目録は層と目的で読む順を作るが、sidebar は目当ての部品を名前で引く場所なので、二つの並びを揃える必要がない
- Storybook Canvas の座標や余白はアプリのレイアウト規約ではない。`layout: "centered"` は、小さな単体 UI を確認しやすくする story 側の表示指定である。画面・幅いっぱいに広がる部品には `fullscreen` または `padded` を story ごとに選ぶ
- Controls が推論した props は任意の React 要素を生成できない。`asChild` のように単一の要素 child を必要とする props は Control を公開せず、必要な child を `render` で明示した専用 story を用意する
- **どの story file にも component の説明と story ごとの説明を書く。** component の説明には、その部品が何のためにあるかと、**隣の似た部品との使い分け**を書く。`Accordion` と `Collapsible`、`Alert` と `Toaster` と `FeedbackState` のように、見た目が近く責務が違う部品は、並べて初めて選び分けられる。story の説明は、その story が何を示しているのかを書く
- 説明の置き場は 2 つある。component 全体は `parameters.docs.description.component`、story ごとは export の直前の JSDoc（または `parameters.docs.description.story`）である。**どちらも Docs ページにしか描画されない。** [`.storybook/preview.ts`](../../.storybook/preview.tsx) が `tags: ["autodocs"]` を付けているのはこのためで、外すと書いた説明がどこにも出なくなる

## component 目録

このリポジトリが持つ component の全件である。改造・削除・置き換えの前に、同じ責務の部品が既にあるかをここで確かめる。各行の概要は一行の要約であり、責務境界・公開 API・確認範囲は各 README を正とする。

見出しは層と目的で、[`shadcn-manifest.yaml`](./shadcn-manifest.yaml) の `layer` と `as` が正である。`design-system` だけが目的別に分かれ、`patterns` と `app-starter` は目的を一つに決められないものの置き場なので分けない。

### design-system

契約を知らず、読んでも役割が増えない部品。fork 後も土台として残る。

#### foundation

UI を横断して支える CSS 基盤。React component を公開しない。

| component | 概要 |
| --- | --- |
| [`print`](./design-system/foundation/print/README.md) | 紙と PDF 保存へ出したときの体裁を定める CSS 基盤 |
| [`scroll-fade`](./design-system/foundation/scroll-fade/README.md) | scrollbar を消した横スクロール領域の端をぼかし、続きがあることを示す CSS 基盤 |
| [`scrollbar`](./design-system/foundation/scrollbar/README.md) | スクロールする面すべてに共通する scrollbar の見た目を一箇所で定める CSS 基盤 |
| [`surface`](./design-system/foundation/surface/README.md) | design token の系統を部分木と Portal の出口へ効かせる |
| [`shimmer`](./design-system/foundation/shimmer/README.md) | 進捗が測れない処理が動き続けていることを、面の上を流れる帯で示す CSS 基盤 |
| [`typeset`](./design-system/foundation/typeset/README.md) | sanitizer 済みの Markdown / HTML を一定の組版 rhythm で表示する CSS 基盤 |

#### action

操作の起点になる部品。

| component | 概要 |
| --- | --- |
| [`button`](./design-system/action/button/README.md) | 利用者の操作を開始する |
| [`button-group`](./design-system/action/button-group/README.md) | 同じ対象への複数の操作を、隣接した一続きの帯としてまとめる |
| [`copy-button`](./design-system/action/copy-button/README.md) | 値を clipboard へ写す |
| [`print-button`](./design-system/action/print-button/README.md) | 表示中の文書を印刷する |
| [`toggle`](./design-system/action/toggle/README.md) | 今その表示が適用されているかを押下状態として示し、切り替える |

#### form

値を受け取り、form の値として送信する部品。

| component | 概要 |
| --- | --- |
| [`calendar`](./design-system/form/calendar/README.md) | 日付または日付範囲を選ぶ |
| [`checkbox-client`](./design-system/form/checkbox-client/README.md) | indeterminate を含む custom checkbox 操作の client island |
| [`checkbox-native`](./design-system/form/checkbox-native/README.md) | 二値の同意・設定・複数選択を native form として送信する |
| [`combobox-client`](./design-system/form/combobox-client/README.md) | 候補が多い選択肢から、入力語で絞り込みながら 1 件を選ぶ |
| [`date-picker-client`](./design-system/form/date-picker-client/README.md) | カレンダー popup から単一の日付を選ぶ |
| [`editable-table`](./design-system/form/editable-table/README.md) | native form control を table の cell に置いて編集する |
| [`field`](./design-system/form/field/README.md) | label・入力・説明・エラーを一つの form field として構成する |
| [`input`](./design-system/form/input/README.md) | 単一行の native `input` を表示・送信する |
| [`input-group`](./design-system/form/input-group/README.md) | 単位記号・アイコン・補助操作を入力欄と一続きの枠に収める |
| [`label`](./design-system/form/label/README.md) | form control の項目名を利用者へ伝える |
| [`multi-select-client`](./design-system/form/multi-select-client/README.md) | 候補を畳んだまま、checkbox で複数の値を同時に選ぶ |
| [`radio-group-client`](./design-system/form/radio-group-client/README.md) | native radio では満たせない custom interaction の client island |
| [`requirement-badge`](./design-system/form/requirement-badge/README.md) | 入力項目が必須か任意かを label の隣で示す |
| [`radio-group-native`](./design-system/form/radio-group-native/README.md) | 静的な候補から一つを選び、native form として送信する |
| [`search-field-client`](./design-system/form/search-field-client/README.md) | 打鍵に追従してキーワード検索を通知する検索欄 |
| [`search-field-native`](./design-system/form/search-field-native/README.md) | キーワード検索欄を、JavaScript を必要としない GET form として置く |
| [`segmented-input`](./design-system/form/segmented-input/README.md) | 長さの決まったコードを、桁ごとに区切った形で受け取る |
| [`select-client`](./design-system/form/select-client/README.md) | native select では満たせない custom popup と keyboard / focus 操作を提供する |
| [`select-native`](./design-system/form/select-native/README.md) | 静的で少数の候補から一つを選び、native form として送信する |
| [`slider-client`](./design-system/form/slider-client/README.md) | 数値または範囲を連続的な操作で指定する。下限と上限を一つの操作面で選べる |
| [`slider-native`](./design-system/form/slider-native/README.md) | 数値を連続的な操作で指定する native range |
| [`switch-client`](./design-system/form/switch-client/README.md) | 設定の入り / 切りを切り替え、結果を即座に画面へ反映する |
| [`switch-native`](./design-system/form/switch-native/README.md) | 設定の入り / 切りを、native form の値として切り替える |
| [`textarea`](./design-system/form/textarea/README.md) | 複数行の native `textarea` を表示・送信する |
| [`toggle-group-client`](./design-system/form/toggle-group-client/README.md) | 関連する切り替えを一つの集合として並べ、browser 側の state へ即座に反映する |
| [`toggle-group-native`](./design-system/form/toggle-group-native/README.md) | 関連する切り替えを一つの集合として並べ、選んだ値を form として送信する |

#### overlay

trigger から本文の上へ面を開く部品。

| component | 概要 |
| --- | --- |
| [`alert-dialog`](./design-system/overlay/alert-dialog/README.md) | 削除など不可逆な操作を実行前に確認する |
| [`command`](./design-system/overlay/command/README.md) | 入力語で候補を絞り込む検索可能な一覧。面としても modal としても置ける |
| [`context-menu`](./design-system/overlay/context-menu/README.md) | 右クリックで対象固有の操作を手元へ出す、可視の導線に対する加速手段 |
| [`dialog`](./design-system/overlay/dialog/README.md) | 補助表示や通常の編集を、画面を覆う modal として開く |
| [`drawer`](./design-system/overlay/drawer/README.md) | 画面端から引き出し、drag でも閉じられる modal panel |
| [`dropdown-menu`](./design-system/overlay/dropdown-menu/README.md) | trigger から操作の一覧を開く |
| [`hover-card`](./design-system/overlay/hover-card/README.md) | hover / keyboard focus で、trigger の近くへ短い補足を表示する |
| [`image-viewer`](./design-system/overlay/image-viewer/README.md) | 縮小して並べた画像を、押したときに大きく表示する |
| [`popover`](./design-system/overlay/popover/README.md) | trigger の近傍に補足内容や補助操作を開く |
| [`sheet`](./design-system/overlay/sheet/README.md) | 補助的な navigation や絞り込み面を、画面端から現れる modal パネルとして開く |
| [`tooltip`](./design-system/overlay/tooltip/README.md) | それだけでは意味が自明でない要素へ、短い補足を添える |

#### navigation

移動先を示す部品と、移動そのものを扱う部品。

| component | 概要 |
| --- | --- |
| [`breadcrumb`](./design-system/navigation/breadcrumb/README.md) | 現在地までの階層を示し、上位階層へ戻れるようにする |
| [`menubar`](./design-system/navigation/menubar/README.md) | 画面全体に対する操作を分類ごとの menu にまとめ、常に見えている横一列として示す |
| [`navigation-menu`](./design-system/navigation/navigation-menu/README.md) | 主要な遷移先を並べ、必要に応じて下位階層を開く |
| [`pagination`](./design-system/navigation/pagination/README.md) | URL 遷移する一覧のページ移動を表す |
| [`tabs-client`](./design-system/navigation/tabs-client/README.md) | 同じ URL のまま、複数のパネルを切り替えて表示する |
| [`tabs-native`](./design-system/navigation/tabs-native/README.md) | 同じ対象を複数の観点で見せ分け、観点を URL で切り替える |

#### display

受け取った内容を読める形にして見せる部品。

| component | 概要 |
| --- | --- |
| [`activity-timeline`](./design-system/display/activity-timeline/README.md) | 起きた出来事を時刻順に並べて表示する |
| [`amount-with-reference`](./design-system/display/amount-with-reference/README.md) | 金額と、切り替えで現れる別通貨の参考換算額を表示する |
| [`avatar`](./design-system/display/avatar/README.md) | 利用者や組織を小さな円形で識別する |
| [`badge`](./design-system/display/badge/README.md) | 短い分類や状態を視覚的に補助する |
| [`bubble`](./design-system/display/bubble/README.md) | 発話や通知の 1 かたまりを吹き出しとして表示する。`Message` の中では送信者の向きへ追従する |
| [`card`](./design-system/display/card/README.md) | 関連する情報や補助操作を一つの視覚的なまとまりにする |
| [`chart`](./design-system/display/chart/README.md) | 集計値の推移や内訳を、系列ごとの色と形で表示する |
| [`json-ld`](./design-system/display/json-ld/README.md) | 画面が持つ構造化データを `application/ld+json` の script として埋め込む。読み手は検索エンジンで、見える要素を持たない |
| [`kbd`](./design-system/display/kbd/README.md) | 利用者が押すキーを、キーボード入力として表示する |
| [`key-value-list`](./design-system/display/key-value-list/README.md) | 項目名と値の対を並べて表示する |
| [`keyboard-shortcut`](./design-system/display/keyboard-shortcut/README.md) | キーボードで実行できる操作を、説明とキーの対として案内する |
| [`list`](./design-system/display/list/README.md) | 同型の行を縦に並べ、アイコン・見出し・説明・補助操作を一貫した構造で表示する |
| [`marker`](./design-system/display/marker/README.md) | 本文より一段控えた一行の注釈・区切りラベルを置く |
| [`media-image`](./design-system/display/media-image/README.md) | `next/image` に比率固定・CSS Skeleton・LCP 用 preload を一貫して適用する |
| [`message`](./design-system/display/message/README.md) | 送信者と本文を持つ 1 件のメッセージを表示する |
| [`separator`](./design-system/display/separator/README.md) | 近接する内容のまとまりを区切る |
| [`stepper`](./design-system/display/stepper/README.md) | 既知で有限の段階を定義順に並べ、現在位置とまだ到達していない先を示す |
| [`table`](./design-system/display/table/README.md) | 列と行の関係が利用者の理解に必要な、構造化データを表示する |
| [`text-highlight`](./design-system/display/text-highlight/README.md) | 検索した語が本文のどこに当たったかを示す |

#### status

処理がいまどうなっているかを伝える部品。

| component | 概要 |
| --- | --- |
| [`alert`](./design-system/status/alert/README.md) | 注意・失敗・次に取る行動を文脈内で伝える |
| [`progress-client`](./design-system/status/progress-client/README.md) | browser 側で更新される進捗度を、値と最大値の関係として示す |
| [`progress-native`](./design-system/status/progress-native/README.md) | 長さの決まった処理の進捗を、native `progress` として示す |
| [`skeleton`](./design-system/status/skeleton/README.md) | 読み込み中の最終コンテンツに近い形状を一時表示する |
| [`spinner`](./design-system/status/spinner/README.md) | 終わりの見えない短い処理が進行中であることを、その場で示す |

#### container

内容を収める枠と、その面の見え方を制御する部品。

| component | 概要 |
| --- | --- |
| [`accordion`](./design-system/container/accordion/README.md) | 関連する複数の詳細を、必要な項目だけ開いて確認する |
| [`aspect-ratio`](./design-system/container/aspect-ratio/README.md) | 子要素を指定した縦横比の枠へ収める |
| [`carousel`](./design-system/container/carousel/README.md) | 限られた横幅の中で、同じ種類の内容を順に閲覧する |
| [`collapsible`](./design-system/container/collapsible/README.md) | 一つの補助内容を、必要なときだけ開いて確認する |
| [`direction`](./design-system/container/direction/README.md) | 配下の component へ文字送りの向きを配る Provider |
| [`message-scroller`](./design-system/container/message-scroller/README.md) | 末尾に追加され続ける一覧の scroll 位置を扱い、末尾にいる間だけ新着へ追従する |
| [`resizable`](./design-system/container/resizable/README.md) | 隣り合う表示領域の境界を掴んで動かし、配分を利用者が決められるようにする |
| [`scroll-area`](./design-system/container/scroll-area/README.md) | 内容の一部だけを局所的にスクロールさせる |

#### layout

ページの骨格を組む合成例。

| component | 概要 |
| --- | --- |
| [`layout-patterns`](./design-system/layout/layout-patterns/README.md) | ページの骨格を utility だけで組む合成例。component は公開しない |

#### rich-text

書き手が構造を付けた文章を扱う部品。

| component | 概要 |
| --- | --- |
| [`rich-text-content`](./design-system/rich-text/rich-text-content/README.md) | sanitize 済みのリッチテキストを本文として表示する |
| [`rich-text-editor`](./design-system/rich-text/rich-text-editor/README.md) | 書式付きの本文を、sanitizer が通す範囲だけで書けるようにする |

### patterns

契約は知らないが、複数の役割を合成する部品。目的を一つに決められないので目的別に分けない。

| component | 概要 |
| --- | --- |
| [`filter-bar`](./patterns/filter-bar/README.md) | 一覧の絞り込み操作と、いま効いている条件をまとめて表示する |
| [`form-field`](./patterns/form-field/README.md) | 項目名・必須の印・入力欄・補足・誤りを、入力欄の種類によらず同じ並びで組む |
| [`selection-toolbar`](./patterns/selection-toolbar/README.md) | 一覧で選んだ件数と、その選択に対して行える操作をまとめる |
| [`table`](./patterns/table/README.md) | 列と行の関係が利用者の理解に必要な、構造化データを表示する |
| [`table-view-options`](./patterns/table-view-options/README.md) | 表の表示する列・表示密度・固定列・画面幅ごとの出し分けをまとめて設定する |
| [`editable-data`](./patterns/table/editable-data/README.md) | 編集 cell を含む列定義から、native form と table を組み立てる |
| [`row-actions`](./patterns/table/row-actions/README.md) | 行ごとに繰り返す操作 menu を、行操作の定義から組み立てる |
| [`static-data`](./patterns/table/static-data/README.md) | 読み取り専用の列定義から、列幅・見出し・行・空表示を組み立てる |
| [`wizard-form`](./patterns/wizard-form/README.md) | 複数段階に分けた入力の枠。現在位置の保持と前後移動を持つ |

### shell

どこに・いくつ置くかが部品側で決まっている部品。mount 位置が制約になるため目的別に分けない。

| component | 概要 |
| --- | --- |
| [`content-container`](./shell/content-container/README.md) | `main` の内側で、ページ本文の読み幅と左右余白を揃える |
| [`page-header`](./shell/page-header/README.md) | ページ先頭で、そのページの名前・説明・主要な操作を示す |
| [`toaster`](./shell/toaster/README.md) | redirect しない mutation の成功・失敗を一時的な通知として表示する |
| [`pull-to-refresh`](./shell/pull-to-refresh/README.md) | 画面の上端から引き下げて、いまの route を取り直す。touch のある環境でだけ働く |
| [`consent-banner`](./shell/consent-banner/README.md) | 任意の用途に cookie を使ってよいかを、選び終えるまで下端で尋ね続ける |

### app-starter

アプリの契約や画面骨格を前提にする部品。fork 先が作り替える前提で、目的別に分けない。

| component | 概要 |
| --- | --- |
| [`invalid-query-feedback`](./app-starter/invalid-query-feedback/README.md) | URL の条件が契約を外れているときに、本体の代わりに理由と解除の導線を出す |
| [`api-error-feedback`](./app-starter/api-error-feedback/README.md) | client-side の API 失敗を、文脈内の Alert または操作を止める Dialog として表示する |
| [`attachment`](./app-starter/attachment/README.md) | 選択済みのファイル 1 件を、種類・名前・進行状況・取り消し操作として表示する |
| [`auth-state-feedback`](./app-starter/auth-state-feedback/README.md) | サインインが必要・権限が足りない・見つからない状態と、そこから抜け出す導線を表示する |
| [`cursor-pagination`](./app-starter/cursor-pagination/README.md) | cursor 方式の一覧で前後のページへ移動する |
| [`feedback-state`](./app-starter/feedback-state/README.md) | loading / empty / error / success の表示状態を一貫して伝える |
| [`load-more`](./app-starter/load-more/README.md) | 読み進めて積み増す一覧の末尾で、続きの読み込みの状態を示す |
| [`file-upload`](./app-starter/file-upload/README.md) | 送信するファイルを選び、送る前に形式と大きさが要件に合っているかを知らせる |
| [`form-feedback`](./app-starter/form-feedback/README.md) | Server Action や native form の結果を、要約と次の行動として表示する |
| [`form-validation-summary`](./app-starter/form-validation-summary/README.md) | form 全体の検証エラーを一箇所に要約し、各入力欄への link を並べる |
| [`import-export`](./app-starter/import-export/README.md) | ファイル取り込みの結果（行単位エラー含む）と、書き出しの状態を表示する |
| [`navigation-guard`](./app-starter/navigation-guard/README.md) | 未保存のままアプリ内を移動しようとしたときに、確認してから遷移する |
| [`notification-center`](./app-starter/notification-center/README.md) | 永続する通知を確認する面。未読件数・一覧・既読・通知が無い状態 |
| [`saved-views`](./app-starter/saved-views/README.md) | 一覧の絞り込みや並べ替えを名前付きで残し、選び直せるようにする |
| [`unload-guard`](./app-starter/unload-guard/README.md) | 未保存のまま画面を離れようとしたときに、browser 標準の確認を出す |
| [`upload-preview`](./app-starter/upload-preview/README.md) | 選択中のファイルを一覧で確認し、差し替え・取り消し・再試行を行う |
