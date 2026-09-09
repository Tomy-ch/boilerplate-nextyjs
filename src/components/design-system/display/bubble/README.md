# Bubble

## 用途

発話や通知の 1 かたまりを吹き出しとして表示します。内容の幅に合わせて縮む面を与え、`Message` の中に置いたときは送信者の向きへ追従します。

## 役割と公開 component

| Component | 役割 |
| --- | --- |
| `BubbleGroup` | 続けて表示する吹き出しをひとまとまりとして縦に並べる領域です。間隔だけを持ち、role は持ちません。 |
| `Bubble` | 吹き出しの外枠です。`variant` で面の見せ方を、`align` で寄せる向きを選びます。 |
| `BubbleContent` | 吹き出しが伝える本文です。面の色と角丸はこの要素へ適用されます。`asChild` で button や link へ合成できます。 |
| `BubbleReactions` | 吹き出しの縁へ重ねて表示する反応の並びです。`side` と `align` で重ねる位置を選びます。 |

`BUBBLE_VARIANT` / `BUBBLE_ALIGN` / `BUBBLE_REACTIONS_SIDE` と対応する型を `bubble.definition.ts` で公開します。これらに指定できる値の owner はこの定義であり、`"ghost"` などの文字列を利用側で直接書きません。

| variant | 見え方 |
| --- | --- |
| `default` | 前景色の面に背景色の文字を置きます。既定値です。 |
| `secondary` | 一段控えた面を置きます。 |
| `muted` | 背景に近い面を置きます。 |
| `tinted` | `default` の色相を薄めた面を置きます。 |
| `outline` | 面を背景色にし、罫線で輪郭を示します。 |
| `ghost` | 面・余白・幅上限を持たず、本文だけを置きます。 |
| `destructive` | 失敗・取り消しの色で面を置きます。 |

| align | 見え方 |
| --- | --- |
| `start` | 領域の左端へ寄せます。既定値です。 |
| `end` | 領域の右端へ寄せます。 |

| side | 反応を重ねる縁 |
| --- | --- |
| `top` | 吹き出しの上端へ重ねます。 |
| `bottom` | 吹き出しの下端へ重ねます。既定値です。 |

## 利用ケース

- `Message` の本文として置き、送信者ごとに左右へ分かれた吹き出しを並べる場合
- 1 件の発話を `BubbleGroup` で複数の吹き出しへ分け、同じ面のまま続けて見せる場合
- `asChild` で button や link へ合成し、吹き出し自体を押せる操作にする場合
- 反応の件数や名前を `BubbleReactions` として吹き出しの縁へ重ねる場合

送信者・時刻・avatar を含む 1 件のメッセージの骨格は `Message` が担います。本文より一段控えた一行の注釈には `Marker` を、読み落とされては困る通知には `Alert` を使います。

## 責務境界

SSR first の選定では `◎` に当たります。hydration を必要としない表示専用の Server Component で、client island を持ちません。

反応の集計、押下による増減、誰が反応したかの一覧は持ちません。`asChild` で合成した操作の遷移先・実行内容・結果の通知も呼び出し元が持ちます。

`variant` は面の見た目だけを変え、意味論を持ちません。`destructive` を選んでも支援技術へは何も伝わらないため、失敗や取り消しといった意味は本文の文言で示します。同じ理由で、反応を絵文字だけで表さず、件数や反応の名前をテキストとして併記するか、操作にアクセシブルな名前を与えます。

`Bubble` は `Message` の中に置いた場合、親の `align` に追従して左右へ寄ります。`Message` の外で単独に使う場合だけ、この component の `align` で向きを指定します。

`ghost` だけは吹き出しの形そのものを持ちません。面・余白・角丸を外すことに加えて、他の variant が持つ幅上限 80% を解除し、同じメッセージ内の `MessageHeader` / `MessageFooter` の左右の余白も外して行頭を揃えます。短い発話を吹き出しに収めるのではなく、案内文や長い本文をそのまま読ませる状態です。控えめな面を持つ吹き出しが要る場合は `muted` / `secondary` / `outline` を使います。

`BubbleReactions` は吹き出しの縁へ絶対配置で重なります。この要素の高さぶんだけ周囲に余白が要る場合は呼び出し元が確保します。

focus の可視化は outline で行います。`asChild` で button や link へ合成した吹き出しは、`focus-visible` のとき前景色の outline を表示します。

vendor は Radix の `Slot`（`asChild` の合成）と `class-variance-authority` です。

## Storybook とテスト

Storybook は既定の吹き出し、面の見せ方 7 種、単独で使う場合の `align`、`Message` の中に置いた場合の左右の追従、`ghost` を置いたときに見出しの余白が外れること、`asChild` で button / link へ合成した押せる吹き出しと focus の見え方、`side` / `align` を変えた反応の重なり、`BubbleGroup` による連続表示、上限幅と連続文字列の折り返しを確認します。面の色、重なりの位置、focus outline はいずれも実描画でしか判断できないため、Storybook 側の確認範囲です。

テストは既定が `default` / `start` の `div` であること、`variant` と `align` を data 属性として公開すること、`variant` が支援技術へ何も伝えないこと、本文を複数置けること、`asChild` で button / link へ合成できること、`Message` の中でも読み上げ順のテキストが残ること、`BubbleGroup` が複数を含み role を持たないこと、反応の `side` / `align` と装飾絵文字の扱い・操作のアクセシブルな名前、a11y 自動検査を確認します。
