# Resizable

## 用途

隣り合う表示領域の境界を掴んで動かし、どちらをどれだけ見るかを利用者が決められるようにします。

## 役割と公開 component

| Component | 役割 |
| --- | --- |
| `ResizablePanelGroup` | 配分を分け合う pane の集合です。向きと全体の大きさを決めます。 |
| `ResizablePanel` | pane の一つです。`defaultSize` / `minSize` / `maxSize` で大きさの範囲を決め、`collapsible` で畳めるようにします。 |
| `ResizableHandle` | 隣り合う pane の境界です。`separator` として公開され、ドラッグでも矢印キーでも動かせます。 |

## 利用ケース

- dialog の中で画像を引き伸ばして見たい場合のように、見たい割合が人と場面で変わる場合
- 一覧と詳細を並べ、どちらを広く使うかを利用者に委ねたい場合

## 責務境界

**常用する部品ではありません。** 表示領域の配分は本来デザインが決めるものです。利用者に決めさせるのは、どちらをどれだけ見たいかが人と場面で変わる場合に限られます。当てがあるのは dialog の中で画像を引き伸ばして見る、といった限られた場面です。一覧と詳細を並べたいだけなら、固定幅の layout か画面遷移で足りるかを先に検討してください。

**単一の要素をリサイズできればよい場合は使いません。** CSS の `resize` と `overflow` だけで成立し、client runtime も外部 package も要りません。この component が要るのは、**複数の pane が総量を分け合う**場合です。

SSR first の選定では `○` に当たります。配分の保持と境界の操作に hydration が必要な client island で、Server Component からは直接 render できません。pane の中身は Server Component のまま `children` として渡せます。

**配分を保存しません。** 再訪時に前回の配分へ戻す必要がある場合は、`onLayoutChange` で受け取った値を呼び出し元が保存し、`defaultLayout` として渡します。保存先の選択はこの component の責務ではありません。

**中身のスクロールを持ちません。** 収まらない内容は溢れた分が切られます。送って読ませる必要があるものは、pane の中へ [`ScrollArea`](../scroll-area/README.md) を置きます。pane 自体をスクロールさせないのは、そこへ keyboard の focus を与える手段が無く、送れない領域ができるためです。

`ResizablePanelGroup` には `className` で高さを与えます。与えないと内容の高さのままになり、境界を動かせる幅が生まれません。

`ResizableHandle` には `aria-label` で何と何の境界かを示します。省略すると「表示領域の区切り」になるため、境界が複数あるときは必ず与えます。同じ名前が並ぶと、どれを操作しているのか判りません。`role` と `tabIndex` は vendor が決めるため渡せません。

`withHandle` を指定すると掴む場所の標識を中央へ置きます。境界は 1px しかなく、標識が無いと動かせることに気付けません。標識そのものは装飾で、操作は境界全体が受けます。

境界の実装は `react-resizable-panels` です。

## Storybook とテスト

Storybook は既定の横並び、縦積み、標識を置かない場合、畳める pane、三つ以上の pane、動かせない境界を確認します。

テストは pane の集合と中身を並べること、境界を `separator` として公開し keyboard で到達できること、名前を省略したときの既定の名前、`orientation` が境界の向きを決めること、`withHandle` のときだけ標識を置き標識を読み上げないこと、`disabled` の表し方、`className` で大きさを与えられること、a11y 自動検査を確認します。
