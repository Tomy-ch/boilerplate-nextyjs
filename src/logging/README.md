---
imports-allowed: []
forbidden: [business-logic, direct-config-access]
test-requirement: unit
---

# logging

構造化ログを提供するカーネルです。設定値と observability は import せず、起動境界から注入されます。

## 受け入れるもの

- context に基づく logger、`trace_id` の付与、構造化ログ、redaction

## 受け入れないもの

- 業務ロジック、config の直接参照

## 構成

- `logger.ts` はアプリケーションが依存する `Logger`、追加フィールド、trace 抽出器、出力 sink の契約だけを定義する。
- `logger.ts` は伏せる項目の名前（`authorization` / `cookie` / `password` / `token`）も持つ。**ログと span の双方がこの 1 つの表を見る** —— [0081](../../docs/adr/0081-observability-logging.md) §3 が両方へ同じ redaction を求めており、表が 2 つに割れると片方だけが緩む。span 側で掛けるのは `adapters/server/telemetry` の中継である。
- `pino.server.ts` は Pino による JSON stdout 出力を実装する。上の表に当たるフィールドを、大文字小文字を区別せず `[REDACTED]` に置換する。
- `logging.server.ts` は起動境界から注入された設定で、プロセス内 singleton を一度だけ初期化する。アプリケーションの server 側コードは `getLogger()` を使い、Pino を直接 import しない。

ログ呼出し時に注入済みの trace 抽出器が有効な span を返すと、`trace_id` と `span_id` を構造化フィールドへ自動付与する。同じ正規化済みレコードは、必要なら注入済み sink にも渡す。OTLP Logs への送出はこの sink を observability 側が実装し、logging から observability への依存は作らない。

## 実行機序

`src/instrumentation.ts` が Node.js サーバー起動時に `initializeLogger()` を呼ぶ。ここで stdout 用 Pino logger が必ず初期化され、`OBS_LOGS_EXPORTER=otlp` のときだけ OTLP sink も注入される。リクエストごとの再初期化は行わない。

## 運用

- 出力先や有効化の設定は注入で受け取る
- ログに secret や個人情報を残さない
- テンプレートから作った側でフィールド名や redaction 対象を増やす場合は、Pino の `redact` と sink へ渡す前の正規化を同時に更新する

## 関連する ADR

- [0021](../../docs/adr/0021-frontend-responsibility.md) — config を import せず起動境界から注入を受ける層の線
- [0081](../../docs/adr/0081-observability-logging.md) — 構造化ログ・redaction・OTLP へ寄せるベンダ中立の方針
