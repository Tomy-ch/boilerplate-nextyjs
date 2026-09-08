# Direction

## 用途

配下の component へ文字送りの向きを伝えます。向きに応じて開く方向や矢印キーの意味を変える component が、この Provider から向きを読みます。

## 役割と公開 component

| Component / 関数 | 役割 |
| --- | --- |
| `DirectionProvider` | 配下へ文字送りの向きを配る client-side Provider です。省略時は `ltr` になります。 |
| `useDirection` | 最も近い `DirectionProvider` が配る向きを読みます。Provider が無い場合は `ltr` を返します。 |

`DIRECTION` と `DirectionValue` を `direction.definition.ts` で公開します。`dir` に指定できる値の owner はこの定義であり、`"rtl"` などの文字列を利用側で直接書きません。

`dir` には別名の `direction` があります。生成物が両方を受ける形だったためそのまま残しており、両方が指定された場合は `direction` が勝ちます。

## 利用ケース

- 向きによって配置や矢印キーの意味が変わる component（`SelectClient`、`DropdownMenu`、`SliderClient` など）を、明示した向きの下で動かす場合
- 向きで挙動を変える component を自作し、`useDirection` で現在の向きを読む場合

## 責務境界

React context を配るため hydration が必要な client island です。Server Component からは直接 render できません。内容自体に client runtime が要らない場合は、Server Component で組み立てた要素を `children` として渡します。

**このリポジトリは既定を `ltr` に固定し、利用者が向きを切り替える機能を持ちません。** RTL の locale を提供する決定がされていないためです。`rtl` は Provider を差し替えたときに配下がどう変わるかを示すための値であり、向きを画面から切り替える UI が要るなら locale の決定が先になります。

`dir` は DOM 属性ではありません。この Provider は context を配るだけで、文字の折り返しや `text-align` のような CSS の挙動は変えません。それらを変える必要がある場合は、呼び出し元が `html` 要素の `dir` 属性を併せて設定します。

表示文言の出し分けはこの component の責務ではありません。向きと言語は別の関心であり、文言は feature 側が扱います。

vendor は現在 Radix です。

## Storybook とテスト

Storybook は省略時の既定、`ltr` を明示した場合、`rtl` を渡した場合を確認します。向きで配置と矢印キーの意味が変わる例として `DropdownMenu` を合成し、Provider を差し替えたときの違いを実描画で見られるようにしています。

テストは省略時に `ltr` を配ること、`dir` と別名 `direction` のそれぞれで向きが伝わること、両方あるときは `direction` が勝つこと、入れ子では内側が勝つこと、DOM の `dir` 属性を設定しないこと、Provider が無い場合に `useDirection` が `ltr` を返すこと、a11y 自動検査を確認します。

jsdom には Radix が位置計算に使う `ResizeObserver` と `scrollIntoView` が無いため、テスト側で stub しています。
