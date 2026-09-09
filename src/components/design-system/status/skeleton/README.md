# Skeleton

## 用途

読み込み中の最終コンテンツに近い形状を一時表示します。

## 役割と公開 component

| Component | 役割 |
| --- | --- |
| `Skeleton` | 装飾的な読み込み placeholder です。利用者への loading message は持たず、`aria-hidden` で隠します。 |

## 利用ケース

取得中の見出し、本文、画像、行の形状を示す場合に使います。近くに loading の意味を伝える文言または `FeedbackState` を置きます。

## 責務境界

Server Component として見た目だけを提供します。取得状態の判定、最終コンテンツ、loading message、表示時間は feature が管理します。`prefers-reduced-motion` 時は animation を停止します。

## Storybook とテスト

Storybook は代表的な placeholder の形状を、テストは装飾要素・motion 抑制 class・a11y を確認します。
