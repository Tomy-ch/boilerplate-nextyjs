---
imports-allowed: [model, errors, logging, config, observability]
forbidden: [components, capabilities, stores, business-logic]
test-requirement: unit
---

# http

`server/` の要求境界が共有する、応答と本体の扱いです。

## 親と違う点

**検証の要求が親と違います。** `adapters` の宣言は `integration` ですが、それが掛かるのは**外部との
往復を持つモジュール**です（[README](../../README.md) の「運用」）。ここに置くものは要求と応答の間で
値を写すだけで、`fetch` も注入された `fetchImpl` も持ちません。境界を持たないものへ境界のテストを
課しても、確かめる相手が居ません。

**判定は「そのモジュールが外へ出るか」で行い、ディレクトリの位置では決めません。** 外へ出るものが
ここへ増えたら、そのモジュールだけが `integration` に戻ります。

| モジュール | 検証 | 理由 |
| --- | --- | --- |
| [`data-scope.ts`](data-scope.ts) | `unit` | 取得の口の分類と、キャッシュ・資格情報ヘッダの関門 |
| [`error-status.ts`](error-status.ts) | `unit` | 分類から status への表 |
| [`error-response.ts`](error-response.ts) | `unit` | 分類から応答を組む |
| [`json-request.ts`](json-request.ts) | `unit` | 受け取った要求の型と大きさを見る |
| [`request.ts`](request.ts) | `integration` | 外部 API を叩く |
| [`retry-policy.ts`](retry-policy.ts) | `unit` | status から再試行の可否を決める |
| [`search-params.ts`](search-params.ts) | `unit` | クエリを素の値へ写す |

## 受け入れるもの

- `server/` の要求境界が共有する、応答と本体の規則

## 受け入れないもの

- 業務ロジック、特定の口に固有の契約

## 関連する ADR

この区画のコードが依存する決定です。**コメントからは ADR を直接指さず、この節を辿ります**
（[docs/rules.md](../../../../docs/rules.md)「コメントと文書」）。層全体の一覧は
[親の README](../../README.md) が持ちます。

- [0080](../../../../docs/adr/0080-error-handling.md) — 失敗の分類と status の対応表、応答に出す文言
- [0071](../../../../docs/adr/0071-bff-api-integration.md) — fetch wrapper の責務と、timeout / retry / breaker の値
- [0112](../../../../docs/adr/0112-data-classification-cache-boundary.md) — 取得の口の分類（`public` / `user-scoped`）と、キャッシュ・資格情報の関所
- [0079](../../../../docs/adr/0079-auth-frontend-seam.md) — 資格情報を組むのは要求境界だけであること
- [0077](../../../../docs/adr/0077-bff-abuse-protection-boundary.md) — 認証を要求しない口の最小の防御（型と大きさ）
- [0075](../../../../docs/adr/0075-file-upload-seam.md) — 本体がバイト列になる要求の扱い
- [0090](../../../../docs/adr/0090-testing-strategy.md) — 層別の検証責務（`integration` が掛かる範囲）
