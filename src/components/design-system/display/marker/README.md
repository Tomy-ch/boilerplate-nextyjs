# Marker

## 用途

本文より一段控えた一行の注釈・区切りラベルを置きます。時系列の区切り、一覧の末尾を示すラベル、最終更新のようなメタ情報を、本文の情報量を増やさずに添えます。

## 役割と公開 component

| Component | 役割 |
| --- | --- |
| `Marker` | 一行の注釈を囲む表示要素です。`variant` で周囲の内容との区切り方を選び、`asChild` で別の要素へ合成できます。 |
| `MarkerIcon` | 先頭へ置く装飾アイコンです。`aria-hidden` を持ち、支援技術へは読み上げられません。 |
| `MarkerContent` | Marker が伝える本文です。`separator` では水平線に挟まれて中央に置かれます。 |

`MARKER_VARIANT` と `MarkerVariant` を `marker.definition.ts` で公開します。`variant` に指定できる値の owner はこの定義であり、`"separator"` などの文字列を利用側で直接書きません。

| variant | 見え方 |
| --- | --- |
| `default` | 区切り線を持たず、内容の流れに沿って一行を置きます。 |
| `separator` | 内容の左右へ水平線を伸ばし、区切りの見出しとして中央に置きます。 |
| `border` | 下に罫線を引き、直後の内容の始まりを示します。 |

## 利用ケース

- 時系列に並ぶ内容へ「ここまで表示しました」のような区切りを挟む場合
- 一覧やカードの下に、最終更新のような補助的なメタ情報を一行だけ添える場合
- 罫線でひとまとまりの始まりを示し、その見出しに小さなラベルを置く場合

利用者の注意を引くべき通知には使いません。API 失敗や操作不能理由のように読み落とされては困る内容は `role="alert"` の意味論を持つ `Alert` を使います。ラベルを伴わない装飾だけの水平線には `Separator` を使います。

## 責務境界

SSR first の選定では `◎` に当たります。hydration を必要としない表示専用の Server Component であり、client island を持ちません。

文言、表示するかどうかの判断、日時や数値の整形は持ちません。いずれも呼び出し元が決めます。日時や金額の整形は `model/` の formatter の責務であり、この component は整形済みの文字列を受け取ります。

`Marker` 自身は `role` を持ちません。`separator` は水平線を CSS の擬似要素で描く見た目だけの表現であり、`role="separator"` の意味論とは無関係です。区切りとしての意味を支援技術へ伝える必要がある場合は、呼び出し元が見出し要素を子に置くか `asChild` で合成します。

`MarkerIcon` は `aria-hidden` を持つため、アイコンだけで意味を伝えることはできません。意味は必ず `MarkerContent` のテキストに書きます。

vendor は現在 Radix の `Slot`（`asChild` の合成）と `class-variance-authority` です。

## Storybook とテスト

Storybook は既定の注釈行、アイコンを添える場合、`separator` / `border` の二つの区切りを前後の内容と並べた文脈、本文に link を含む場合、一行に収まらない注釈の折り返し、`asChild` で見出し要素へ合成する場合を確認します。区切り線の見え方と中央寄せは実描画でしか判断できないため、`separator` の水平線と折り返しは Storybook 側の確認範囲です。

テストは既定が `div` であること、`variant` を `data-variant` として公開すること、アイコンが支援技術から隠れること、既定では `separator` / `alert` のいずれの role も持たないこと、`asChild` で見出しへ合成できること、本文の link が操作可能な要素として残ること、a11y 自動検査を確認します。
