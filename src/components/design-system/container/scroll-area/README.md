# ScrollArea

## 用途

内容の一部だけを局所的にスクロールさせ、周囲の内容を視界に留めたまま長い一覧や明細を読めるようにします。

## 役割と公開 component

| Component | 役割 |
| --- | --- |
| `ScrollArea` | `overflow` と keyboard 到達性・領域の意味論をまとめた scroll 領域です。方向を `orientation` で選び、大きさは `className` で与えます。 |

## 利用ケース

- 明細のように、見出しや操作を画面に残したまま一覧だけを送りたい場合
- 選択肢の多い絞り込みパネルのように、操作可能な項目が縦に伸びる領域を一定の高さに収めたい場合
- 折り返さない内容を横方向へ送りたい場合

画面全体のスクロールで足りる場合は使いません。局所スクロールは、周囲の内容が視界に留まることに意味がある場合にだけ選びます。

## 責務境界

SSR first の選定では `◎` に当たります。`overflow` と browser 標準の scrollbar だけで成り立つため、`"use client"`・React state・browser API を持ちません。

領域の大きさは持ちません。`max-h-*` や `max-w-*` を `className` で与えます。与えない場合は内容が伸びるだけでスクロールしません。内容の取得、件数の制御、末尾検知による追加読み込みも持ちません。

スクロールできる領域は keyboard だけで操作する利用者も到達できる必要があるため、`tabIndex` を `0` にしています。要素は `section` で、`aria-label` か `aria-labelledby` を与えると `region` として公開されます。**アクセシブルな名前は必ず与えます**。名前がないと `section` は landmark にならず、focus したときに何の領域へ入ったのか判りません。

内容が focus 可能な要素だけで構成される場合は `tabIndex={-1}` を渡して外します。子を辿れば browser が自動でスクロールするため、領域自体の tab stop は増えるだけになります。逆に読み取り専用の内容で外すと、keyboard だけではスクロールできなくなります。判定は内容を知る呼び出し元が行い、既定は安全側の `0` にしています。

既定ではスクロールを親へ連鎖させません（`overscroll-contain`）。領域の端まで送ったあとに続けて画面全体が動くと、どちらを操作しているのか判らなくなるためです。これは背面へ重なる面や、周囲から切り離して読ませる領域を想定した既定です。

本文の流れに置く領域は例外で、`className` に `overscroll-auto` を渡して連鎖させます（[`Table`](../../display/table/README.md) がそうしています）。本文の途中で端を止めると、その領域に指を置いているあいだページ全体が動かなくなるためです。判断の基準は、端まで送ったあとに続けて動くべきものが、下層の面か、同じ本文かです。

scrollbar は browser と OS が描画するため、見た目は環境で異なります。**統一した scrollbar を描く client island は用意していません。** catalog が client island の条件として挙げるのは custom scrollbar だけで、現時点でそれを要求する画面がないためです。要件が確定した時点で `scroll-area-client` として追加し、このディレクトリを `scroll-area-native` へ改名します。

## Storybook とテスト

Storybook は縦方向、横方向、両方向、内容が収まる場合、見出しを `aria-labelledby` で名前にする場合を確認します。

テストは `region` role として公開されること、keyboard 到達可能であること、`aria-label` と `aria-labelledby` の双方でアクセシブルな名前を与えられること、`tabIndex={-1}` で領域自体の tab stop を外せること、`orientation` による方向の切り替え、スクロールを親へ連鎖させないこと、`className` で大きさを与えられること、a11y 自動検査を確認します。
