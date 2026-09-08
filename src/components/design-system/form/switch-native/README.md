# SwitchNative

## 用途

設定の入り / 切りを、native form の値として切り替えます。

## 役割と公開 component

| Component / 型 | 役割 |
| --- | --- |
| `SwitchNative` | `input type="checkbox"` を switch の見た目で描く、SSR first の部品です。読み上げは checkbox のままです。 |
| `SWITCH_SIZE` | 表示サイズの定数です。このディレクトリが owner で、`SwitchClient` も同じ値を参照します。 |

## 利用ケース

通知の受け取り、公開 / 非公開など、設定を form として保存する場面に使います。

## SwitchClient との使い分け

| | 使う場面 |
| --- | --- |
| `SwitchNative` | form 送信と初期表示だけで足りる。browser JavaScript なしで動く |
| `SwitchClient` | 切り替えた結果を即座に画面へ反映する、楽観更新して失敗時に戻す、複数の switch を同期する |

既定は `SwitchNative` です。上の右列に当てはまる要件が確定したときだけ `SwitchClient` へ切り替えます。

## Toggle との使い分け

見た目が似ていても責務が違います。分かれ目は「**設定を変えるのか、今の見え方を変えるのか**」です。

| | `Switch` | `Toggle` |
| --- | --- | --- |
| 意味論 | `checkbox` / `switch` | `button` + `aria-pressed` |
| 表すもの | 設定の入り / 切り（通知を受け取る、公開する） | 表示の適用状態（今この見え方になっている） |
| 送信値 | **持つ**（form の値になる） | 持たない（操作ボタン） |
| 効き方 | 保存して永続する | その画面の見せ方を変える |
| 例 | 通知の受け取り、公開 / 非公開 | 表示密度、折り返しの有無 |

保存されて次に開いたときも残るなら `Switch`、その場の見え方だけなら [`Toggle`](../../action/toggle/README.md) です。排他や複数選択の切り替え群になる場合は `ToggleGroup` を使います。

## 意味論は checkbox

実体は `input type="checkbox"` で、`role="switch"` は与えていません。

`switch` role は `aria-checked` を必須としますが、uncontrolled な native input では利用者の操作で React が再 render されないため同期できません。実状態と食い違う `aria-checked` は、checkbox として読み上げるより有害です。biome の `useAriaPropsForRole` もこの不足を検出します。

支援技術へ「入り / 切り」として伝える必要がある場合は、状態と role を Radix が対応させる [`SwitchClient`](../switch-client/README.md) を使います。この部品が提供するのは **switch の見た目と native form の値**であり、読み上げは checkbox です。

`CheckboxNative` との違いも見た目だけです。form の複数選択や同意の確認には `CheckboxNative`、設定の有効化のように「入り / 切り」を視覚的に示したい場面にはこちらを使います。

## 責務境界

ラベルを持ちません。何の設定かは `Label` などで呼び出し元が関連付けます。保存のタイミング、切り替え結果の反映、失敗時の扱いも持ちません。

見た目の track と thumb は CSS だけで組んでおり、状態は `:checked` が持ちます。native の `size` 属性は text 入力の文字数を表すもので switch には意味がないため、表示サイズの props で置き換えています。

## Storybook とテスト

Storybook は基本状態、初期状態が入り、disabled、表示サイズ、native form の一部として送信する場合を確認します。テストは checkbox として読み上げられること、`role` と `aria-checked` を出さないこと、form の `name` / `value` を持つこと、クリックでの切り替え、disabled、`size` の data 属性、a11y 自動検査を確認します。
