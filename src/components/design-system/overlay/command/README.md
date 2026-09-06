# Command

## 用途

入力した語で候補を絞り込み、キーボードだけで目的の項目へ到達できる検索可能な一覧を表示します。画面内に面として置くことも、画面を覆う modal として開くこともできます。

## 役割と公開 component

| Component | 役割 |
| --- | --- |
| `Command` | 検索語と選択中の候補を管理する client-side root です。`label` が検索入力のアクセシブルな名前になります。 |
| `CommandDialog` | `Command` を `Dialog` の中に置き、modal として開きます。開閉は呼び出し元が制御します。 |
| `CommandInput` | 候補を絞り込む検索入力です。`role="combobox"` を持ちます。 |
| `CommandList` | 絞り込まれた候補を並べる `role="listbox"` の領域です。高さの上限を超えるとここだけがスクロールします。 |
| `CommandEmpty` | 一致する候補が無いときだけ表示される領域です。表示の切り替えは自動で行われます。`CommandList` の外、その兄弟として置きます。 |
| `CommandGroup` | 候補を意味のあるまとまりへ分けます。`heading` が group のラベルになります。 |
| `CommandItem` | 選択できる候補の一件です。`role="option"` を持ち、決定時は `onSelect` を呼びます。 |
| `CommandSeparator` | group と group の間に引く区切り線です。支援技術からは隠れます。 |
| `CommandShortcut` | 候補の右端へ添えるキーボード操作の補足表示です。キー入力は購読しません。 |

## 利用ケース

- 一覧・設定・遷移先など、数が多く階層も異なる操作を、画面を離れずに検索して選ぶ場合
- 補助導線としての command palette を置き、主導線のナビゲーションは別に保つ場合
- 候補検索を伴う選択 UI を組む場合。静的で少数の選択肢には `select-native` を優先します

## 責務境界

SSR first の選定では、入力に応じた絞り込みとキーボード操作が本質のため client island です。hydration が必要で、Server Component からは直接 render できません。候補そのものに client runtime が要らない場合は、Server Component で組み立てた要素を `children` として渡します。

候補の取得、並び順、決定時の遷移や実行は持ちません。いずれも呼び出し元が `onSelect` で扱います。`CommandDialog` は開閉状態も持たず、`open` / `onOpenChange` で呼び出し元が制御します。キーボード shortcut で開く導線を作る場合も、キー入力の購読は feature 側に置きます。

サーバー側で検索する場合は `shouldFilter={false}` を指定し、候補の絞り込みと並び順を呼び出し元が担います。

### 既定の絞り込みは順序を保った部分列一致

文字が連続していなくても、入力した順に現れれば一致します。読みの正規化は行いません。

| 入力 | 「一覧を開く」 | 理由 |
| --- | :---: | --- |
| `一覧` | 一致 | 連続一致 |
| `一く` | 一致 | 順序を保った部分列 |
| `覧開` | 一致 | 同上 |
| `開一` | 不一致 | 順序が逆 |
| `いちらん` | 不一致 | 読みは正規化しない |
| `ICHIRAN` | 不一致 | 同上 |

かな入力やローマ字でも引かせたい場合は、`CommandItem` の `keywords` に読みを渡します。`keywords={["いちらん"]}` を与えると `いちらん` で一致します。日本語の候補を扱うときは、`keywords` を与えるかどうかを呼び出し元が必ず決めます。

### アクセシブルな名前は `Command` の `label` で与える

`Command` の `label` は**必ず指定します**。`CommandInput` へ `aria-label` を渡してもアクセシブルな名前にはなりません。検索入力は常に `aria-labelledby` で内部の隠し label を参照しており、その参照が `aria-label` より優先されるためです。`label` を省くと参照先が空のまま残り、名前を持たない入力になります。`CommandDialog` は `title` を内側の `Command` の `label` へも渡すため、この指定は不要です。

`CommandList` のアクセシブルな名前は `label` で決まり、既定を「候補」にしています。実装の既定は英語のため、この component が日本語で上書きしています。

### 生成物から直した点

`CommandDialog` は、生成物では `DialogHeader` を `DialogContent` の**外**に置いていました。title が dialog の中に無いと `aria-labelledby` が成立せず、dialog がアクセシブルな名前を失います。`DialogContent` の中へ移しています。

`CommandSeparator` は `role="separator"` を固定で持ちますが、`listbox` が子に許すのは `option` と `group` だけです。区切りが読み上げの対象として残ると ARIA として不正な入れ子になり、a11y 自動検査が critical として検出します。要素は残したまま `aria-hidden` で支援技術から隠しています。group の見出しが読み上げ順での区切りをすでに伝えるため、伝わる情報は減りません。

vendor は現在 cmdk と、`Dialog` を通じた Radix ですが、公開 API に vendor 名は含めません。アイコンは `components` の [`icon.ts`](../../../icon.ts) から取ります。

## Storybook とテスト

Storybook は面として画面内に置く構成、一致する候補が無い場合、`shouldFilter={false}` で絞り込みを呼び出し元が担う場合、modal として開く場合を確認します。

テストは combobox と listbox の関連付け、`label` がアクセシブルな名前になること、`CommandInput` の `aria-label` では名前にならないこと、listbox の名前が日本語であること、入力による絞り込み、空の案内の出し分け、`shouldFilter={false}` の挙動、group の見出しによるラベル付け、`disabled` な候補が選択されないこと、`onSelect`、下キーでの選択移動、a11y 自動検査を確認します。`CommandDialog` は開くまで描画しないこと、title と説明の関連付け、title が内側の検索入力の名前にもなること、`showCloseButton` の切り替え、Escape での閉じ、a11y 自動検査を確認します。

jsdom には候補の寸法計測と表示位置の追従に使う `ResizeObserver` と `scrollIntoView` が無いため、テスト側で stub しています。実装からその依存を取り除く方向では対処しません。
