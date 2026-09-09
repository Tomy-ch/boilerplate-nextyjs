# StaticData Sugar

## 用途

読み取り専用の列定義から、列幅・見出し・行・空表示を一貫して組み立てます。

## 役割と公開 component

| Component / 型 | 役割 |
| --- | --- |
| `StaticDataTable` | 列定義から読み取り専用 table を組み立てます。 |
| `StaticDataTableColumn<Row>` | header・幅・alignment・row の cell 表示を定義します。 |

## 利用ケース

Server で取得した一覧を、列幅と配置を保って表示する場合に使います。

## 責務境界

`Table` の低レベル構成は `design-system/display/table`、列定義の展開は `patterns/table` が担います。取得、URL、filter、行操作は feature の責務です。

## Storybook とテスト

Storybook は通常・空表示・pagination・検索 toolbar を示します。test は列幅・header・empty・toolbar・pagination・a11y を確認します。
