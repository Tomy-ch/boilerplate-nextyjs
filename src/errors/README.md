---
imports-allowed: []
forbidden: [http-vocabulary, external-dependencies]
test-requirement: unit
---

# errors

全層から参照できる、protocol-agnostic なアプリケーション共通エラーのカーネルです。Go の `internal/apperror` と同じく、分類・原因・表示メタ情報を分離します。

## 公開 API

- `ErrorKind` / `createAppError()` — 原因を `cause` に残す分類済みエラー
- `findAppError()` / `isAppError()` — cause chain 内の分類の判定
- `ErrorMeta` / `createErrorMeta()` — code・利用者向け文言・requestId・公開可能な詳細識別子
- `withErrorMeta()` / `withErrorDetails()` / `errorMetaFrom()` — cause chain を保つメタ情報ラッパー。外側のメタ情報が優先
- `resolveErrorMeta()` — 分類カタログと外側メタ情報から code・文言・詳細を解決
- `redactMessage()` — 明示指定した秘匿値を wrap 前に置換

## エラー分類

`ErrorKind` が分類語彙の唯一の定義であり、呼出し側は `ErrorKind.INVALID_ARGUMENT` のような名前付き定数を使います。分類は protocol-agnostic であり、HTTP status への変換は adapters 境界が担当します。

| `ErrorKind` | 意味 / 使い所 |
| --- | --- |
| `INVALID_ARGUMENT` | 構文上は正しいが意味が不正な引数 |
| `UNAUTHENTICATED` | 認証失敗・未ログイン |
| `PERMISSION_DENIED` | 権限不足 |
| `NOT_FOUND` | 対象が存在しない |
| `CONFLICT` | ユニーク制約違反・同時更新衝突など |
| `VALIDATION` | ドメインまたはユースケースの検証失敗 |
| `UNSUPPORTED_MEDIA_TYPE` | サポートしない入力形式 |
| `PAYLOAD_TOO_LARGE` | 許容サイズを超えた入力 |
| `TOO_MANY_REQUESTS` | 流量制限・外部依存のスロットリング |
| `CANCELED` | 呼出し側による処理の中断 |
| `INTERNAL` | 想定外の内部エラー |
| `UNIMPLEMENTED` | 未実装または非サポートの機能 |
| `UNAVAILABLE` | 外部依存障害などの一時的な利用不可 |

## 利用例

```ts
const cause = new Error(redactMessage(`token=${token}`, [token]));
const classified = createAppError(ErrorKind.UNAUTHENTICATED, { cause });
const error = withErrorDetails(classified, ["accessToken"]);

const meta = resolveErrorMeta(error);
```

`requestId` はログ相関と、利用者からの連絡の突き合わせに使うため、共通エラー画面で表示できます。`details` は wire に出して安全な識別子だけを指定します。画面の表示名は、業務フィールドを知る feature / form 側で変換します。入力値・token・password・理由文は渡しません。

## boilerplate 導入時の変更点

本 boilerplate はバックエンドエラーの追加情報として `requestId` と `details` を採用します。

- `requestId` — ログ相関と連絡の突き合わせに使う識別子。画面にはリクエスト ID として表示可能
- `details` — 不正フィールドなど、公開して安全な識別子の配列。feature / form が表示名へ変換

これは本 boilerplate の既定であり、すべてのバックエンド契約に共通するものではありません。導入先が `traceId` / `correlationId`、`fieldErrors` のオブジェクト配列、または別のエラー形式を採用する場合は、adapter の応答変換と `ErrorMeta` を契約に合わせて変更してください。`errors` カーネルへ transport 固有の処理は追加しません。

## 境界

- transport の status とレスポンス形式は持たない
- 生の transport 応答からの分類は `adapters` 境界で一度だけ行う
- 未分類エラーを `internal` に正規化する判断も境界の責務
- ログレベルとログ出力は `logging` と境界の責務。errors 自身は出力しない

## 関連する ADR

- [0021](../../docs/adr/0021-frontend-responsibility.md) — 層の責務と import 境界。分類を transport から切り離す線
- [0029](../../docs/adr/0029-type-design-discipline.md) — 分類を判別可能な値として持つ型設計
- [0080](../../docs/adr/0080-error-handling.md) — バックエンドエラーの正規化と、画面側（`error.tsx` / `not-found.tsx`）との責務分担
