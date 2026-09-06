# MessageScroller

## 用途

末尾に追加され続ける一覧の scroll 位置を扱います。末尾にいる間は新着へ追従し、利用者が上へ動かしたら追従をやめて過去を読める状態を保ち、末尾へ戻す操作を出します。

## 役割と公開 component

| Component | 役割 |
| --- | --- |
| `MessageScroller` | 状態を持つ root です。`autoFollow` で追従の有無を、`scrollEdgeThreshold` で末尾とみなす範囲を決めます。 |
| `MessageScrollerViewport` | 実際にスクロールする枠です。`region` として公開し、keyboard で到達できます。 |
| `MessageScrollerContent` | 一覧の中身を縦に並べる領域です。`log` として、追加された分だけを読み上げます。 |
| `MessageScrollerButton` | 末尾へ戻す操作です。末尾にいる間は render しません。 |

`MessageScroller` は `data-at-end` に末尾にいるかどうかを出します。

## 利用ケース

- 追記され続けるやり取りを表示し、読んでいる途中に新着が来ても位置を奪わない場合
- 過去を読み返している間だけ「最新へ戻る」導線を出す場合
- 追従が不要で、末尾を初期位置にするだけでよい場合（`autoFollow={false}`）

局所スクロールだけが必要で追従が要らない場合は、client runtime を持たない `ScrollArea` を使います。1 件ぶんの表示は持たないため、`Message` や `Bubble` を子として組みます。

## 責務境界

client island です。scroll 位置の観測と要素の寸法変化の検出に browser API を使うため hydration が必要で、Server Component から直接 render できません。SSR first の選定では、追従そのものが client でしか成立しないため native の対になる実装を置いていません。

一覧の中身・取得・並び順・件数の上限は持ちません。新着の検出も持たず、内容の寸法が変わったことだけを見ます。

高さを持たないため、`max-h-*` や `h-*` を `className` で与えます。与えない場合は内容が伸びるだけでスクロールしません。

追従を外す条件は「利用者が上へ動かしたこと」だけです。内容が増えて末尾から離れた状態も見かけ上は同じですが、それを条件にすると新着のたびに追従が止まります。

`MessageScrollerViewport` のアクセシブルな名前は呼び出し元が必ず与えます。名前がないと landmark にならず、focus したときに何の領域へ入ったのか判りません。

`MessageScrollerButton` は末尾にいる間 render しません。見えないまま focus だけ残ると、keyboard 利用者が行き先の判らない操作へ到達します。

`MessageScrollerContent` の `log` は追加だけを通知します。既存項目の書き換えや削除は読み上げられないため、内容を差し替える用途には使いません。

registry の `message-scroller` は `@shadcn/react` を前提とするため copy-in せず、この 4 つを自前で実装しています。上流が持つ項目単位の可視判定、scroll anchor、先頭への追加時の位置保持、仮想化のための描画制御は持ちません。

vendor 依存はありません。アイコンは `components` の [`icon.ts`](../../../icon.ts)、操作に `Button` を使います。

## Storybook とテスト

Storybook は初期表示で末尾を映すこと、末尾にいる間の追従、上へ動かしたときに追従が外れて操作が現れること、`autoFollow` を切った場合、内容が枠に収まりスクロールできない場合、操作へ文言を与える場合を確認します。追従と位置の保持は実際に動かさないと判らないため、発言を追加するボタンを添えています。

テストは `region` と `log` の意味論、初期表示で末尾を映すこと、末尾にいる間は操作を出さないこと、上へ動かすと操作が現れること、操作で末尾へ戻ること、末尾にいる間は内容が増えても追従すること、追従を外した後は位置を保つこと、末尾へ届かない下方向の移動では追従を戻さないこと、自分で末尾まで戻すと追従も戻ること、`autoFollow` を切った場合、viewport を持たない構成、`ref` の引き渡し、`MessageScroller` の外で使ったときの通知、a11y 自動検査を確認します。jsdom は layout を持たないため、scroll 量と `ResizeObserver` はテスト側で代替しています。
