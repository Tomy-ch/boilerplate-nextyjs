# ApiErrorFeedback

## 用途

client-side の API 失敗を、画面の責務に応じて Alert または Dialog で伝えます。SSR の `error.tsx` やページ単位のエラー表示を置き換えるものではありません。

## 役割と公開 component

| Component | 役割 |
| --- | --- |
| `ApiErrorAlert` | フォームや一覧など、文脈を保ったまま失敗を表示します。 |
| `ApiErrorDialog` | 操作の継続を止め、確認・再試行を促します。`open` は呼び出し側で管理します。 |
| `ApiError` | `client` / `server` / `network` の分類、表示メッセージ、リクエスト ID、再試行可否を表します。 |

## 利用ケース

- `client`: 入力内容や権限など、利用者の修正が必要な 4xx 相当の失敗です。`warning` で表示します。
- `server`: サービス側の 5xx 相当の失敗です。再試行できる場合は `retryable` と `onRetry` を渡します。
- `network`: 到達不能やタイムアウトです。`destructive` で表示し、操作を止める場合は Dialog、文脈内で済む場合は Alert を使います。

`retryAfter` は 429 などで API が返した再試行待ち時間（秒）を表示するために使います。カウントダウンや再試行可能になったかの判定は feature 側で管理します。`retryPending` は再試行中の二重送信を防ぐために渡します。`children` にはログインや詳細画面への遷移など、feature 固有の補助操作だけを合成します。

## 責務境界

両 component は browser の開閉・再試行操作を扱う Client Component です。Server Component からは `ApiError` のシリアライズ可能な値を props として渡し、`onRetry` や `onOpenChange` は client shell 側で接続します。

raw response の status 判定、業務固有の文言、再試行処理、request ID の取得は feature / adapter 側で行い、`ApiError` に正規化して渡します。component 自身は fetch や API client を持ちません。

## request ID の扱い

`requestId` はサーバーログと利用者からの連絡を結び付けるための、サーバー生成の不透明な識別子です。5xx など調査が必要な失敗でだけ渡し、画面にはリクエスト ID として表示します。token、個人情報、内部 URL などを request ID に含めてはいけません。4xx の入力エラーでは通常省略し、network error のようにサーバーへ到達していない場合は値が存在しないこともあります。

## Storybook とテスト

Storybook の `ClientError` / `ServerError` は文脈内 Alert、`BlockingDialog` は操作停止が必要な失敗を示します。test では Alert と Dialog の役割、再試行操作、アクセシブルな role を確認します。
