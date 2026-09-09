# Alert

## 用途

注意、失敗、利用者が次に取る行動を文脈内で伝えます。

## 役割と公開 component

| Component | 役割 |
| --- | --- |
| `Alert` | `role="alert"` を持つ通知全体です。`variant` で通常・warning・destructive の見た目を選びます。 |
| `AlertTitle` | 通知内容を短く要約する見出しです。 |
| `AlertDescription` | 詳細、影響、次に取る行動を置く領域です。 |

## 利用ケース

保存できない理由、入力内容の確認依頼、処理結果の補足など、画面内で即時に伝える必要がある情報に使います。

## 責務境界

Server Component として表示だけを担います。状態判定、取得、再試行、dismiss、業務文言は feature が所有します。利用者の操作を必要とする失敗は、必要な link や Button を `AlertDescription` へ合成します。

## Storybook とテスト

Storybook は通常・warning・destructive・補助操作を、テストは `alert` の意味論・variant・a11y を確認します。warning は注意喚起、destructive は処理失敗に使い、薄い背景・見出し・アイコンを組み合わせて、色だけに依存せず意味を伝えます。
