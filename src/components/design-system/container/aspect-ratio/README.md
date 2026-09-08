# AspectRatio

## 用途

子要素を指定した縦横比の枠へ収めます。

## 役割と公開 component

| Component | 役割 |
| --- | --- |
| `AspectRatio` | `ratio` で指定した縦横比の枠を作る SSR first の表示 primitive です。 |

## 利用ケース

動画の埋め込み枠、地図の差し込み、画像を伴わないプレースホルダなど、**任意の比率**を数値で指定したい場面に使います。

比率が `square` / `standard` / `wide` のいずれかで済み、`MediaImage` と枠を揃えたい場合は、`MEDIA_IMAGE_ASPECT_RATIO_CLASS` を直接 class として当てる方が軽くなります。この部品は数値指定が要る場合の受け皿です。

## 責務境界

比率の枠を作るだけで、内容の取得・読み込み状態・画像の最適化は持ちません。画像を表示する場合は `MediaImage` を使います。

`overflow-hidden` を伴うのは、CSS の `aspect-ratio` が内容の高さに負けて縦へ伸びるためです。枠より高い内容を入れたときに比率を優先し、はみ出しを切ります。

## 上流と実装が異なる理由

registry item は `aspect-ratio` ですが、Radix の実装は copy-in せず自前で実装しています（manifest の `kind` は `reimplemented`）。

Radix 版は `padding-bottom` による旧来の比率固定で、次の 2 点が本リポジトリの方針と噛み合いません。

1. **高さが決まった親の中で拘束を無視する。** 高さ 120px の親に 16:9 を入れると子が 225px になり、親を突き抜けます。CSS の `aspect-ratio` は高さが決まっていれば幅を逆算するため、この破綻が起きません
2. **`"use client"` を要求する。** CSS で完結する表示に hydration を持ち込むことになり、SSR first の選定方針に反します

上流版が優れる条件はありません。

公開 API の `ratio` は上流と揃えてあるため、shadcn/ui から来た利用者はそのまま使えます。

## Storybook とテスト

Storybook は 16:9 の枠、任意比率と既定の正方形、内容が枠より高い場合、高さが決まった親の中、`MediaImage` と枠を揃える場合を確認します。テストは指定比率が CSS の `aspect-ratio` になること、既定が正方形になること、溢れを切ること、client runtime なしで描画されること、`className` と `style` の拡張、a11y 自動検査を確認します。
