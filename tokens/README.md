---
test-requirement: unit
---

# design tokens

`tokens/` は design token の SSOT です。

## テストの責務

frontmatter の `test-requirement: unit` が掛かるのは [`scripts/`](scripts/README.md) の書き出しである
（[0090](../docs/adr/0090-testing-strategy.md)）。JSON は SSOT のデータであって判定を持たない。

## 構成

- `primitives.json`: 色・余白・角丸・フォント・段の基礎値
- `themes/<系統>/<配色>.json`: primitive を参照する semantic token

W3C Design Tokens の `$type` / `$value` と alias（`{...}`）を使います。**コンポーネントは primitive を直接参照せず、生成される semantic token を使います。**

参照は値の一部としても書けます。`color-mix()` や `box-shadow` のように primitive を素材の 1 つとして組み立てる値があるためで、そこを素の色で書くと semantic 層から primitive への経路が切れ、テーマの差し替えがその宣言だけ効かなくなります。

## 切替の軸は 2 本

**配色**（`light` / `dark`）は文書全体の軸で、`:root` に出ます。**系統**（`user` / `admin`）は部分木の軸で、`[data-surface]` に出ます。

> 「面」は `bg-*` が塗る面を指す語として repo 全体で使うため、この軸は「系統」と呼びます。属性と
> ディレクトリの綴りは `surface` です。

| | 既定 | 既定以外が効く範囲 |
| --- | --- | --- |
| 配色 | `light` | OS の設定（`prefers-color-scheme`）と `:root[data-theme]` の二経路 |
| 系統 | `user` | `[data-surface="<系統>"]` を置いた部分木 |

生成物は系統 × 配色の 6 ブロックです。セレクタの詳細度は `[data-surface]` が `(0,1,0)`、`:root[data-theme]` が `(0,2,0)`、両方揃った範囲が `(0,3,0)` と積み上がるので、同じ木では**系統と配色の両方を指定した宣言が必ず勝ちます**。既定の系統を先に出すのも同じ理由で、**記述順が詳細度の同点を裁くため順序は生成物の意味の一部です**。

`color-scheme` は配色の軸の宣言なので `:root` 側にだけ出します。系統の側にも出すと同じ条件を二重に持つことになります。

### 属性を置く場所は、Portal を含む位置でなければならない

`Dialog` / `Popover` / `DropdownMenu` / `Sheet` / `Tooltip` / `ContextMenu` は Radix の Portal で
**`document.body` の直下へ出ます**。系統の属性を本文の内側の要素に置くと、これらの中身は属性の外へ
落ち、系統を切り替えても既定のまま描かれます。

属性は **Portal の出口を含む位置**（`body` 相当）に置くか、Portal の `container` を系統の内側へ
向けるかのどちらかが要ります。**部分木の途中に置くだけでは足りません。**

カタログ（`.storybook/preview.tsx`）は `body` に置いています。

### 系統を足す・消す

`themes/` の下にディレクトリを作れば系統が増えます。生成側は系統の名前を持ちません。テンプレートから作った側が `admin/` を丸ごと消せば、生成物は配色 1 軸の形に戻ります。

**すべての系統と配色が同じ token を宣言していなければ生成が落ちます。** 欠けた token は宣言が無いだけでは済まず、カスケードにより既定の系統や既定の配色の値をそのまま引き継ぐため、系統を切り替えたつもりの箇所だけが元の色のまま残ります。

## 面と文字で明度を分ける

`primary` / `emphasis` / `success` / `warning` / `destructive` / `info` は、light と dark で**別の明度の primitive を参照**します。ほかの semantic token のように 1 つの色を両配色で使い回しません。

理由は、これらが**面の色であると同時に文字の色でもある**ためです。`bg-destructive` の面には `destructive-foreground` が乗り、`text-destructive` は背景やその淡い面（`bg-destructive/10`）の上に文字として乗ります。1 つの中間的な明度で両方を満たすことはできません。

中間の明度を両配色で共有すると、面としては白文字が乗る一方、文字としては WCAG AA の 4.5:1 を割ります。配色ごとに地から離れる方向へ振り、対になる `*-foreground` を反転させることで、面と文字の双方が成立します。

**段は名前で揃えず、測って選んでください。** 色相が変われば同じ段でも輝度は変わるので、対応する段の番号を写しても同じ比にはなりません。実際に light の `success` は、`destructive` と同じ段では文字として AA を割ります。この repo では明度をコントラスト要件から導いているため段の番号は生成結果ですが、`themes/` を手で編集するときはこの落とし穴が戻ります。

**新しく同種の semantic token を足すときも、この形に揃えてください。** `text-*` と `bg-*` は同じ CSS 変数を引くため、変数の差し替えだけで面と文字を分離することはできません。

### 役割ごとに要求が違う

WCAG は**文字に 4.5:1、UI 部品と図形に 3:1** を求めます。token はどちらの役割で置かれるかで狙う比率が違います。

| 役割 | token | 目標 |
| --- | --- | --- |
| 文字にも置く | `foreground` `muted-foreground` `secondary` `success` `warning` `destructive` `info` | 4.5:1 |
| 面と図形にだけ置く | `primary` `emphasis` `input` `active` | 3:1 |

**`primary` と `emphasis` を文字に置かないでください。** この 2 つを文字の要求で縛ると、面としての明るさを失います（light では暗い青緑まで沈みます）。文字が要る場面には `secondary` 以下を使います。

### 測る地は 5 つ

いずれの token も、`background` / `card` / `popover` / `muted` / `accent` の**すべての上で**目標を満たします。地を背景だけで測ると、hover 中のメニュー項目に乗る `text-destructive` のように、淡い面の上に色文字が乗る組み合わせで割れます。`card` は半透明なので、背景の上に合成した色で測ります。

線は WCAG 1.4.11 の対象かどうかで要求が分かれます。詳細は [`src/components/README.md`](../src/components/README.md) の「境界を示す線」にあります。

## 光の層

光は色ではなく影の名前空間に置きます。色として出すと Tailwind が `bg-*` / `text-*` を作り、影の値を面や文字に当てられる utility が生えます。

| token | 名前空間 | 何を作るか |
| --- | --- | --- |
| `glow-inner` / `glow-primary` / `glow-outer` | `shadow` | 光源。3 層を重ねて「発光しているもの」に見せる |
| `glow-edge` | `shadow` | ぼやけた輪郭。外へのにじみと内側の照り返しを 1 token に収める |
| `glow` / `glow-strong` | `text-shadow` | 発光する文字 |

### 発光の可否と時機

**光ってよい色と、その強さは決まっています。持たない色には token がありません**（`shadow-glow-secondary` は存在しないので書けません）。

| 色 | 強さ | 時機 |
| --- | --- | --- |
| `primary` | 主 | 休止時から光ってよい |
| `info` / `success` | 控えめ | 休止時から光ってよい |
| `warning` / `destructive` | 主 | **アクション時のみ**（`hover:` / `focus-visible:`） |
| `secondary` / `emphasis` | — | 光らせない |

可否は **token の有無**が、時機は **使う場所**が担います。`warning` と `destructive` を休止時から光らせると、危険な操作が常時「いま押せる」と読めてしまいます。

**光を状態の唯一の手掛かりにしないでください。** forced-colors モードでは UA が `box-shadow` を `none` にするため、`shadow-glow-*` は完全に消えます。`Live` / `Running` / `Selected` は色か文言と併せて示します。

**輪郭のぼかしは focus の表示になりません。** `outline` はぼかせず、focus は `outline` である必要があります（[`src/components/README.md`](../src/components/README.md) の「focus 表示」）。ぼかしはその上に重ねる装飾です。

## card は背景の上に半透明で乗る

塗られた面ではなく「枠だけがそこにある」見え方にするため、`card` だけを半透明にしています。`popover` / dialog は任意の内容の上に重なり**合成先が定まらない**ので不透明のままです。

コントラストは `card` を背景の上に合成した色で測っています。`card` の不透明度を変えるときは、合成結果が変わるので測り直してください。

## 書体

書体は素性で primitive を持ち、役割は semantic が持ちます。

| semantic | user | admin |
| --- | --- | --- |
| `sans`（本文） | **OS 同梱の和文ゴシック**（`system-ui` → ヒラギノ → 游ゴシック → …） | 同左 |
| `brand`（銘） | Michroma | Michroma |
| `mono` | Geist Mono | Geist Mono |

**和文の Web フォントは読みません**（[0051](../docs/adr/0051-styling-system.md) §5）。和文の Web フォントは
`@font-face` の宣言が 100 を超える単位で CSS に載り、それが描画を止めます。全画面に効く本文でその費用を
払うのをやめ、Web フォントはラテン（銘と等幅）だけに残しています。

**系統の差は配色・発光・余白・強調の段が持ちます。** 本文書体はその軸に含めません —— 費用が桁で違い、
面を分けても管理を開く人はやはり払うためです。

ラテンと等幅の実体は `next/font` が [`src/app/fonts.ts`](../src/app/fonts.ts) で読み、`--typeface-*` として
配ります。primitive の綴りを `--font-*` と分けているのは、生成する別名と同じ名前になると宣言が自分自身を
指すためです。

### 強調は 1 段だけ持つ

書体ごとに持っている太さが違うため、太さの数値を部品に書くと書体を替えたときに段が潰れます。

| semantic | user | admin |
| --- | --- | --- |
| `emphasis`（本文より強い） | 700 | 500 |

**段は 1 つだけです。** 本文（400）との差だけを持ち、それ以上の階層は作りません。

**1 段しか持たないのは、2 段目が多くの環境で出ないためです。** 同じ文字列を各段で描いてインクの量を
比べた実測（macOS / Chromium）:

| 書体 | 区別できる段 |
| --- | --- |
| ヒラギノ角ゴシック | 400 / 500 / 600 / 700 / 800 の**すべて** |
| 游ゴシック | **400 と、それ以外**（500・600・700・800 は同じ字面） |
| `system-ui` | 400 / 500=600 / 700 / 800 |

本文（400）との差はどの書体でも残りますが、その上をさらに分けても游ゴシックでは消えます。**部品が選び分けて
いるのに利用者には届かない区別**を体系に持たせないため、段を 1 つに畳んでいます。見出しと本文の差は寸法と
位置が作ります（[0051](../docs/adr/0051-styling-system.md) §5）。

部品は `font-emphasis` と書きます。**太さを直に指定しないでください** —— 書体が持っていない段を指定しても、丸められるだけで強調になりません。`eslint-rules/no-raw-font-weight` が機械で見ます（`font-normal` は「強調しない」の打ち消しなので対象外）。

**`brand` はラテンの字しか持ちません。** 和文を含みうる文字列に当てると、1 つの語の中で書体が変わります。用途はサイト名のような銘に限ります。

`font-family` は継承する値なので、変数を差し替えただけでは部分木に届きません。`globals.css` の `[data-surface]` が系統ごとの本文書体を当て直しています。

## 形

`radius` は直角に寄せてあります（`md` / `lg` で 2px）。丸みのある面は、光を主役にした体系の中では前に出すぎます。`tracking` は広い側だけを定義し（`wide` / `wider` / `widest`）、狭い側は Tailwind の既定に任せます。`blur` は `card` の背後をぼかす `panel` の 1 段だけです。

## いま効いている値を見る

Storybook の **`Tokens/Catalog`** に全件が出ます。名前はこの SSOT から生成された目録（`src/model/generated/design-token.ts`）が持ち、**値はカタログが実行時に CSS から読みます**。表へ値を書き写していないので、token を足しても替えても目録が古くなりません。

ツールバーの `Theme` と `Surface` を切り替えると、同じ token が何に解決されるかが入れ替わります。地に対するコントラスト比も添えてあるので、AA を満たしているかがその場で読めます。

## 生成と検査

```sh
pnpm gen:tokens
pnpm check:tokens
```

前者は `src/app/generated/tokens.css` と `src/model/generated/breakpoint.ts` を更新します。後者は更新せず、生成結果との差分があれば失敗します。**生成物を手編集してはいけません。**

`src/**/generated/**` は biome の formatter の対象外です（`biome.json` の override）。`color-mix()` を含む宣言や長い配列は 100 桁を超えて折り返されるため、対象に含めると formatter と `pnpm check:tokens` が互いの出力を上書きし合います。**生成物の綴りは生成側が決めます。**

`scripts/gen-tokens.test.ts` は `pnpm test` の実行対象に含まれ、カバレッジゲートにも載ります。生成結果そのものの回帰は `pnpm check:tokens` が CI で守ります。

## 小数を含む段

`--spacing-0.5` のように `.` を含む名前は、CSS のカスタムプロパティ名（ident）としてそのままでは不正です。生成側が `--spacing-0\.5` へエスケープし、Tailwind が出す参照も同じ綴りになります。ビルド済み CSS を文字列で検索するときは、この綴りを前提にしてください。
