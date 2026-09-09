---
imports-allowed: [features, components, capabilities, stores, adapters, errors, logging, config, model, observability]
forbidden: [business-logic, direct-fetch]
---

# api

Route Handler だけを置く区画です。`app` の中にありますが、負う検証の観点だけが親と異なります。

## 親と違う点

**検証の要求はここが宣言しません。** Route Handler が確かめるのは描画ではなく **HTTP 境界の型と形**
（status・ヘッダ・本文）で、それは `api/` の下に置こうが外に置こうが変わりません。置き場ではなく
element が決めるものなので、宣言は `architecture.ts` の `APP_ELEMENTS` が `route.ts` / `route.dev.ts`
に対して持ちます（[0025](../../../docs/adr/0025-app-layer-elements.md) / [0090](../../../docs/adr/0090-testing-strategy.md)）。

ここに書くと、`api/` の外へ出た同じ element が親の `route` を継いでしまいます。

## 受け入れるもの

- バックエンドへの中継と、その入出力の検証
- 認証の往復のように、ブラウザから直接叩けない相手との通信

## 失敗の返し方

**応答の組み立てはここで持ちません。** 分類から status と文言を組むのは
[`adapters/server/http/error-response.ts`](../../adapters/server/http/error-response.ts)、認証を
要求しない口の最小の防御（型と大きさ）は
[`json-request.ts`](../../adapters/server/http/json-request.ts) が持ちます。口ごとに書くと、返す形が
口の数だけ分かれ、増えるたびに揃っているかを読んで確かめることになります。

## 受け入れないもの

- 業務ロジック（[0070](../../../docs/adr/0070-backend-role-separation.md)）
- 生の `fetch`（`adapters` を通す）
- 描画

## モジュール

| モジュール | 役割 |
| --- | --- |
| [`auth/`](auth) | 認証の往復。IdP との認可コード交換と session cookie の発行・破棄 |
| [`telemetry/`](telemetry) | ブラウザ発の報告（Web Vitals / 未捕捉例外）を受ける口。**認証を要求しないので、最小の防御をここが持つ**（[0077](../../../docs/adr/0077-bff-abuse-protection-boundary.md)） |
| [`telemetry/traces/`](telemetry/traces) | ブラウザが作った span を OTLP のまま collector へ渡す口。契約の出所が OTel 側なので、隣と口を分ける |

<!-- sample:begin -->
同梱のサンプルが加えるもの:

| モジュール | 役割 |
| --- | --- |
| `products/` | 一覧の増分取得を中継する BFF |
| `addresses/` | 郵便番号からの住所補完を中継する BFF。入力中の画面が叩く |
<!-- sample:end -->

## 関連する ADR

この区画のコードが依存する決定です。**コメントからは ADR を直接指さず、この節を辿ります**
（[docs/rules.md](../../../docs/rules.md)「コメントと文書」）。層全体の一覧は
[親の README](../README.md) が持ちます。

- [0025](../../../docs/adr/0025-app-layer-elements.md) — Route Handler が持てるもの（thin proxy と、その例外）
- [0071](../../../docs/adr/0071-bff-api-integration.md) — `/api/*` の範囲と、外部 API を `adapters` 経由で叩くこと
- [0070](../../../docs/adr/0070-backend-role-separation.md) — 業務ロジックを持たない責務の線
- [0073](../../../docs/adr/0073-pagination-fetch-boundary.md) — 増分取得をどの境界が受けるか
- [0077](../../../docs/adr/0077-bff-abuse-protection-boundary.md) — 認証を要求しない口の最小の防御
- [0079](../../../docs/adr/0079-auth-frontend-seam.md) — 認証の往復（認可コード交換 / session cookie の発行・破棄）
- [0080](../../../docs/adr/0080-error-handling.md) — 分類から status と文言への対応
- [0081](../../../docs/adr/0081-observability-logging.md) — ブラウザ発シグナルの中継と、ログに何を残すか
- [0090](../../../docs/adr/0090-testing-strategy.md) — Route Handler を `integration` として検証すること
