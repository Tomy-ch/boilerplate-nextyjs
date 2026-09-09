---
imports-allowed: [model, errors, config]
forbidden: [adapters, components, capabilities, server-config, business-logic]
test-requirement: unit
---

# stores

複数 feature が共有する client 状態を置く client-only カーネルです。実装時の store は Zustand を用います。

## 受け入れるもの

- 選択状態、ウィザード、グローバル UI トグルなどの横断 client 状態

## 受け入れないもの

- server state、単一 feature の状態、UI マークアップ、secret、業務ロジック

## モジュール

| モジュール | 役割 |
| --- | --- |
| `consent-store.ts` | 任意の用途に cookie を使ってよいかという意思。選んだ結果を cookie へ残し、その場でツリーへ反映する |

<!-- sample:begin -->
同梱のサンプルが加えるもの:

| モジュール | 役割 |
| --- | --- |
| `cart-store.ts` | サンプル画面が共有する「カートを開いているか」という要求 |

<!-- sample:end -->
## 運用

- client-only の実装では `"use client"` を最小の境界に置く
- 単一 feature の状態は feature 内の local state に留める

## 関連する ADR

- [0021](../../docs/adr/0021-frontend-responsibility.md) — 層の責務と import 境界
- [0023](../../docs/adr/0023-stores-kernel.md) — このカーネルが受け持つ横断 client 状態と、server state の写しを置かない線
- [0031](../../docs/adr/0031-policy-state-supply.md) — 同意などポリシー状態の供給の形
- [0041](../../docs/adr/0041-cache-components-decision.md) — Cache Components の下での hydration。サーバとブラウザで同じ初期値を返す制約
- [0060](../../docs/adr/0060-state-management.md) — Zustand の採用と、server state をどこが持つか
