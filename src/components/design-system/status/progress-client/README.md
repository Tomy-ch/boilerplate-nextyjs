# ProgressClient

## 用途

browser 側で更新される進捗度を、値と最大値の関係として視覚的に示します。

## 役割と公開 component

| Component | 役割 |
| --- | --- |
| `ProgressClient` | 進捗部分を独立した要素として描画する client island の表示 primitive です。`value` と `max` を props として受け取り、進捗の割合だけを描画します。 |

外枠の見た目は `className`、進捗部分の見た目は `indicatorClassName` で上書きします。

## 利用ケース

- ファイル送信量のように、browser 側で計測した値を短い間隔で更新する場合
- 擬似要素による browser 間の見た目の差を避けたい場合

進捗が URL や Server 側で確定しているだけなら `ProgressNative` を使います。完了時期が不明な待機には使わず、骨格を見せるだけでよい場合は `Skeleton` を使います。

## 責務境界

SSR first の選定では `△` に当たります。既定は `ProgressNative` であり、値を browser 側で連続更新する要件が確定した場合にこちらを選びます。hydration が必要で、Server Component からは直接 render できません。値の保持と更新は呼び出し元の client island が持ち、この component は state も timer も購読も持ちません。取得、完了後の遷移、百分率の文言整形も持ちません。

`value` は必須です。進捗不明（indeterminate）は表現の対象外にしています。待機の表現は `Skeleton` / `Shimmer` が担うため、進捗部品は値の判っている進捗だけを引き受けます（[0051](../../../../../docs/adr/0051-styling-system.md)）。

`progressbar` role として公開され、値は `value` と `max` から百分率として読み上げられます。要素自体は名前を持たないため、`aria-label` か `aria-labelledby` で**アクセシブルな名前を必ず与えます**。`ProgressNative` と違い実体は `div` であり labelable 要素ではないため、**`label` の `htmlFor` では名前が付きません**。見出しテキストと関連付ける場合は、その要素の `id` を `aria-labelledby` から参照します。

進捗部分の幅は `value` と `max` の比から算出します。値が変わると幅の変化が CSS transition で補間され、`prefers-reduced-motion` 時は補間しません。更新間隔が既定の transition より短い場合は、`indicatorClassName` に `duration-*` と easing を渡して合わせます。

太さや幅は `className` で上書きします。既定は `h-2 w-full`、track は `bg-border`、進捗部分は `bg-foreground` で、`ProgressNative` と同じ組み合わせです。

vendor は現在 Radix ですが、公開 API に vendor 名は含めません。

## Storybook とテスト

Storybook は既定の表示、値が `0` の状態、`max` に達した完了状態、`max` を実単位にした場合、値を更新して補間を確認する場合、`aria-labelledby` で名前を与える場合、`className` で太さを変えた場合を確認します。

テストは `progressbar` role として公開されること、`aria-valuenow` / `aria-valuemax` が出ること、進捗部分の幅が `value` と `max` の比になること、値が `0` と `max` のときの端の扱い、呼び出し元の更新が表示へ反映されること、`aria-labelledby` によるアクセシブルな名前、`className` の上書き、a11y 自動検査を確認します。
