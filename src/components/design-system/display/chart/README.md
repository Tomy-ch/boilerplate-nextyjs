# Chart

## 用途

集計値の推移や内訳を、系列ごとの色と形で表示します。数値カードや表では見えない傾向や比較を補います。

## 役割と公開 component

| Component / 型 | 役割 |
| --- | --- |
| `ChartContainer` | 系列定義と描画領域を配下へ与える client-side root です。色を CSS 変数として配ります。 |
| `ChartTooltip` | hover 位置の系列値を表示する tooltip です。中身は `content` へ渡します。 |
| `ChartTooltipContent` | tooltip の中身です。系列名・色の印・値を並べます。 |
| `ChartLegend` | 系列名と色の対応を示す凡例です。中身は `content` へ渡します。 |
| `ChartLegendContent` | 凡例の中身です。系列の印と表示名を並べます。 |
| `ChartStyle` | 系列色を CSS 変数として配る `style` 要素です。`ChartContainer` が内部で描画します。 |
| `ChartConfig` | 系列ごとの表示名・色・アイコンの定義です。 |

`CHART_INDICATOR` / `ChartIndicator` と `CHART_THEME_SELECTORS` / `ChartTheme` を `chart.definition.ts` で公開します。`indicator` に指定できる値の owner はこの定義であり、`"dashed"` などの文字列を利用側で直接書きません。

## 利用ケース

- 期間ごとの件数推移を折れ線や棒で示す場合
- 複数系列の大小を並べて比較する場合

## 責務境界

recharts が描画に DOM の実寸を必要とするため hydration が必要な client island です。Server Component からは直接 render できません。

データの取得・集計・並べ替えは持ちません。描画に必要な形へ整えた配列を呼び出し元が渡します。軸の刻みや書式も持たないため、日時や金額の整形は `model/` の formatter を通した値を渡します。

`config` の各 key は data の系列名と一致させます。色は `--color-<key>` の CSS 変数として配下へ配られるので、recharts 側では `var(--color-<key>)` で参照します。

`ChartStyle` は `dangerouslySetInnerHTML` で stylesheet を書き出します。系列色を CSS 変数として配下へ配る手段が他に無いためで、`config` の色は開発者が書く定数であることを前提にしています。**利用者入力や API 応答を色として渡しません。**

### chart を唯一の伝達手段にしない

chart は形と色で情報を伝えるため、それだけでは読み取れない利用者がいます。同じ内容へ到達できる数値表や要約を必ず併置します。`WithDataTable` の story がその構成です。

`ChartTooltipContent` は pointer を合わせている間だけ現れるため、touch 環境と keyboard 利用者には到達できません。tooltip でしか読めない情報を置きません。

## 使わない場合

0 から始まる 1 系列の帯とその軸だけを描くなら、この部品を採らず要素と CSS で描きます。座標系・凡例・tooltip・アニメーションのどれも使わないのに、画面を開いた人が recharts の読み込みと評価を払うことになります。採るのは、系列を重ねる・値の位置を軸に対して読ませる・pointer で系列値を引く、といった作図の一式が要るときです。

## Storybook とテスト

Storybook は複数系列の棒グラフ、折れ線、tooltip の印を破線にする場合、同じ内容の数値表を併置する構成を確認します。

テストは `ChartContainer` の `data-chart` 付与と `id` の反映、`ChartStyle` の CSS 変数出力と配色モードごとの振り分け、色を持つ系列が無い場合、`ChartTooltipContent` の開閉・表示名と値・桁区切り・`hideLabel` / `labelFormatter` / `formatter` / `hideIndicator` / `indicator` の各分岐・`nameKey` / `labelKey` による定義解決・値が無い系列・`type` が `none` の系列、`ChartLegendContent` の表示名・`verticalAlign`・アイコンの出し分け、`ChartContainer` の外で使った場合の例外、a11y 自動検査を確認します。

jsdom は要素の寸法を常に 0 と報告し `ResizeObserver` も持たないため、recharts が children を描画しません。テスト側で実寸を返す `ResizeObserver` と `getBoundingClientRect` を stub しています。実装からその依存を取り除く方向では対処しません。
