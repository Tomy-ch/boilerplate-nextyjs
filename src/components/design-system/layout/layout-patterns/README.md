# LayoutPatterns

## 用途

ページの骨格を Tailwind の utility だけで組むときの合成例を示します。**component を公開しません。** `.tsx` の export も `.css` も持たず、あるのは story と本書だけです。

## 役割と公開 component

| Component | 役割 |
| --- | --- |
| — | ありません。helper も含めて何も export しません。 |

`stack` / `inline` / `grid` を component として包む案は**採りません**。`<Stack gap={4}>` と `<div className="flex flex-col gap-4">` の間に抽象の利得が無く、包んでも Tailwind の表現力は増えないためです。増えるのは「utility と component のどちらで書くか」を利用側が毎回迷う面だけです。

この判断は、それが見える場所に無いと守られません。次に読む人は「stack が無いから作ろう」と考えます。そこで**説明だけを story として置き**、決定の置き場にしています。

## 利用ケース

- 新しいページを組むときに、縦積み・横並び・grid をどの class で書くかを確かめる
- breakpoint をまたぐ切り替えを、viewport と器のどちらで分岐させるか決める
- sticky な header / footer を [`ContentContainer`](../../../shell/content-container/README.md) とどう重ねるか確かめる

## 間隔の段

`gap-*` のうち、token が名前を与えているのは `0` / `1` / `2` / `4` / `6` / `8` です。この段は `var(--spacing-N)` を経由するため、[`tokens/primitives.json`](../../../../../tokens/primitives.json) の一箇所で値を変えられます。

それ以外の段（`1.5` / `3` / `10` など）も Tailwind の基底 `--spacing` の倍数として書けますが、`calc(var(--spacing) * N)` に展開されるため token の段とは別経路になります。

## viewport breakpoint と container query の使い分け

判断軸は ADR [0051](../../../../../docs/adr/0051-styling-system.md) §2 が、守る形は [`docs/rules.md`](../../../../../docs/rules.md) #73 / #74 が持ちます。

| 分岐の基準 | 使うところ |
| --- | --- |
| viewport breakpoint（`sm:` / `md:` / `lg:`） | ページの骨格、レイアウトシェル |
| container query（`@container` + `@md:`） | 置かれた場所で割り当て幅が変わる再利用 component |

再利用 component を viewport で書くと、同じ component を本文へ置いたときと狭い脇へ置いたときで指定が食い違います。分岐の根拠を「自分が置かれた器の幅」に寄せるほうが、局所だけを見て判断できます。

breakpoint は Tailwind の既定（`sm` / `md` / `lg` / `xl` / `2xl`）をそのまま使い、**mobile-first**（無印が狭い画面、`sm:` 以降で上書き加算）で書きます。幅は [`tokens/primitives.json`](../../../../../tokens/primitives.json) の `breakpoint` が持つので、ここには書きません。

## sticky の重ね方

**帯は全幅、中身は読み幅**にします。帯そのものを `ContentContainer` で包むと、背景と罫線まで読み幅で切れて画面の端に隙間が残ります。全幅の帯の内側へ `ContentContainer` を置けば、背景は端まで伸び、中身だけが本文と同じ縦線に乗ります。

```tsx
<div className="sticky top-0 z-10 border-b border-border bg-background">
  <ContentContainer>…</ContentContainer>
</div>
```

重なる以上、面は不透明にします。`z-10` は一覧の中の重なりより上、overlay（`z-50`）より下に置く値で、[`SelectionToolbar`](../../../patterns/selection-toolbar/README.md) の sticky と同じ段です。z-index の token 化は未着手のため、現状はこの実例に揃えます。

## 責務境界

**何も供給しません。** CSS 基盤である [`foundation/`](../../foundation/) の各項目が `.css` を持つのに対し、ここは純粋な説明です。そのため置き場も `foundation/` ではなく、`content-container` / `page-header` と並ぶ `layout/` にしています。

Tailwind 一般の使い方は網羅しません。それは Tailwind の文書が持ちます。ここが示すのは**このリポジトリが選んだ値と組み方**だけです。

sticky な header / footer を持つ外枠そのもの（`main` 要素・skip link・navigation）は `app-shell` の責務で、ここでは指定の形だけを示します。

## Storybook とテスト

story の title は `Layout/Layout` です。縦積みと間隔の段、折り返す横並び、等幅 grid と「内容幅と残り」の 2 列、viewport breakpoint による 1 → 2 → 3 カラム、container query による同じ切り替え、sticky header / footer、ページ 1 枚の組み立てを置いています。

公開 component を持たないため、title の先頭セグメントは置き場の `layout/` と同じ `Layout` です（[`components/README.md` §Storybook の表示規約](../../../README.md#storybook-の表示規約)）。

container query の story は枠の右下を掴んで幅を変えられます。窓の幅を変えずに切り替わることを確かめるためです。

**test はありません。** 公開する実装が無く、検証の対象になるのは合成例の見え方だけだからです。`foundation/` の CSS 基盤が story だけを持つのと同じ形です。
