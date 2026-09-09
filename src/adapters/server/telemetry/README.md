---
imports-allowed: [model, errors, logging, config, observability]
forbidden: [components, capabilities, stores, business-logic]
test-requirement: unit
---

# telemetry

ブラウザから中継されたシグナルを検証し、signal へ載せる受け側です。

## 親と違う点

**検証の要求が親と違います。** `adapters` の宣言は `integration` ですが、それが掛かるのは外部との
往復を持つモジュールです（[README](../../README.md) の「運用」）。

**判定は「そのモジュールが外へ出るか」で行い、ディレクトリの位置では決めません。**

| モジュール | 検証 | 理由 |
| --- | --- | --- |
| [`browser-telemetry.ts`](browser-telemetry.ts) | `unit` | 報告を検証し、metric とログへ渡す |
| [`browser-traces.ts`](browser-traces.ts) | `integration` | OTLP を collector へ中継する |

## 受け入れるもの

- 中継が受け取った本体の検証と、signal への受け渡し

## 受け入れないもの

- 業務ロジック、送信面の組み立て（`client/telemetry/` が持つ）

## 関連する ADR

この区画のコードが依存する決定です。**コメントからは ADR を直接指さず、この節を辿ります**
（[docs/rules.md](../../../../docs/rules.md)「コメントと文書」）。層全体の一覧は
[親の README](../../README.md) が持ちます。

- [0081](../../../../docs/adr/0081-observability-logging.md) — OTLP への載せ方と、構造化ログの規則
- [0082](../../../../docs/adr/0082-client-observability.md) — ブラウザ発の Web Vitals と例外を、どの signal へ写すか
- [0077](../../../../docs/adr/0077-bff-abuse-protection-boundary.md) — 認証を要求しない受け口が自分で確かめること
