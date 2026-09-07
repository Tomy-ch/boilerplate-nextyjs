# HoverCard

## 用途

hover または keyboard focus に応じて、trigger の近くへ短い補足情報を表示します。

## 役割と公開 component

| Component | 役割 |
| --- | --- |
| `HoverCard` | 開閉状態と hover / focus の interaction を管理する client-side root です。 |
| `HoverCardTrigger` | HoverCard を開く trigger です。link や button を使う場合は `asChild` で合成します。 |
| `HoverCardContent` | Portal に表示する補足内容です。位置は `align` と `sideOffset` で調整できます。 |

## 利用ケース

link や名称へ短い補足を付ける場合に使います。操作や判断に不可欠な情報は HoverCard だけに置かず、常時表示または明示的な導線も用意します。

## 責務境界

Portal と interaction のため hydration が必要な client island です。補足文、取得、業務判断、モバイルでの代替導線は持ちません。touch device で内容が必要な場合の表示方法は feature が決めます。

## Storybook とテスト

Storybook は hover による表示と開いた状態を、テストは trigger・Portal content・a11y を確認します。
