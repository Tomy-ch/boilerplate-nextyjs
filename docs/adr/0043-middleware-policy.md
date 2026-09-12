# Middleware（Proxy）方針

Next.js 16 で **Middleware から Proxy へリネームされた `proxy.ts`** の **責務範囲 / runtime 方針 / 認証 hook の置き場 / 配信停止の前捌き** を定める。

## Status

Accepted

## 背景

本リポジトリは **Next.js 16** を採用しており、**Middleware は Next.js 16 で「Proxy」にリネーム**された(ファイル規約 = `proxy.ts`。`middleware.ts` は deprecated。移行 codemod `middleware-to-proxy` あり)。実装前に `node_modules/next/dist/docs/` を確認した結果、以下を前提とする(AGENTS.md「Canonical Documentation」):

- `proxy.ts` はリクエスト完了前にサーバで走り、rewrite / redirect / ヘッダ・cookie 変更 / 直接応答ができる
- **Next.js 公式は「Proxy は last resort。他に手段がなければ使う」**と明示。**セッション管理・完全な認可には使わず**、`optimistic checks`(権限ベースのリダイレクト等)に限る
- **遅いデータ取得に使わない**(`fetch` の cache オプションは Proxy 内で無効)。最適化時は CDN に配置されるため、共有モジュール・グローバルに依存しない
- **既定 runtime は Node.js**(proxy.md「Runtime」節)。`runtime` セグメント設定オプションは Proxy ファイルでは**使用不可**(設定するとエラー)。つまり runtime をコード側で選択する枠はなく、実際の実行環境はデプロイ先(adapter)に依存する(旧 Middleware の「Edge 既定」は Proxy には当てはまらない)
- **1 プロジェクト 1 `proxy.ts`**(ロジックはモジュールへ分割して import 可)

## 決定

### 1. `proxy.ts` = 薄い境界(thin・last resort)

- **`proxy.ts` は薄い境界に限る**。用途は rewrite / redirect / ヘッダ・cookie 操作 / optimistic な権限リダイレクト。**業務ロジック・重い処理・データ取得を書かない**([0011](0011-no-docker.md) thin proxy / [0070](0070-backend-role-separation.md) と一貫。Next.js 公式の「last resort」ガイダンスとも一致)
- **まず `proxy.ts` 以外で解けないか**を検討する(単純リダイレクトは `next.config.ts` の `redirects`、認可は各境界での検査)。Proxy は代替がない場合の最終手段
- ファイルは **`src/proxy.ts`**(`src/app/` と同階層)。これは 11 カーネルの**外側**の起動 / 境界エントリであり(`instrumentation.ts` と同類として [0021](0021-frontend-responsibility.md) の起動 / ビルド境界の例外に準ずる)、`app`(route / page)ではない

### 2. Runtime 方針(Node.js 既定・Edge 互換維持)

- **Next.js 16 の Proxy は既定で Node.js runtime** であり、`runtime` セグメント設定は Proxy ファイルでは使用できない(設定するとエラー)。runtime はコードで選択する対象ではなく、実際の実行環境はデプロイ先(adapter)に依存する。本リポジトリは特定のデプロイ先・runtime 前提を強制しない([0011](0011-no-docker.md))
- ただし Proxy は最適化されたデプロイでは **CDN(Edge 相当)に配置され得る**ため、`proxy.ts` のコードは **Edge Runtime 互換(Node API・共有グローバル非依存)を保つ**ことを既定とする。config を参照する場合は **Node API 非依存の config スライス**を使う([0030](0030-environment-variable-management.md))。config は import 境界に従い、Proxy でも [0030](0030-environment-variable-management.md) の client/server 分割・不変 Config を守る

### 3. 認証 hook の置き場 = 用途依存

- **認証・セッションの具体モデルは用途依存**([0070](0070-backend-role-separation.md)。Next.js 公式も「Proxy をセッション管理・認可に使うな」と明示)。本リポジトリは `proxy.ts` に特定の認証実装を組み込まない
- 認証を導入する場合、`proxy.ts` で行ってよいのは **optimistic なリダイレクト**(未ログインらしきリクエストのリダイレクト等)までとし、**確定的な認可はデータ境界(`adapters` / Route Handler / Server Action)** で行う([0070](0070-backend-role-separation.md) / [0071](0071-bff-api-integration.md))

### 4. 検証の割り(関数本体 = unit / matcher の選別 = e2e)

- **`proxy()` の本体は `unit`**。分岐・redirect 先・`returnUrl` の組み立ては、関数として呼べば行使できる([0090](0090-testing-strategy.md))
- **`export const config` の `matcher` の選び足りなさは `e2e` が負う**。`matcher` は Next.js が経路を選ぶ前に読む宣言であり、`proxy()` を直接呼ぶ経路を通らない。守るべき接頭辞が選別から漏れれば前捌きごと素通しになり、それは経路を開けば応答に出る
- **選び過ぎは、どのテストも観測できない**。除外している接頭辞を選別へ含めても、`proxy()` はその経路に役割を要求せずそのまま通すため、応答は変わらない。現れるのは静的資産 1 件ごとの費用としてだけである。ここを守るのは宣言の読み合わせであり、テストではない

### 5. 配信の停止は `proxy.ts` の前捌きで行い、停止画面の応答は 200 とする

- 配信を止めているあいだ、読み取り(GET / HEAD)は停止画面へ **rewrite で差し替え**、それ以外の要求は proxy 自身が **503** で断る。URL は動かさない —— 復帰後に同じ URL を開けば元の画面へ戻る。停止の判定は認可より先に置く。止めるのは全ルートに対する 1 つの判断であり、経路によって見え方が変わってはならない
- **停止画面を描く応答は 200 である。** rewrite に載せた status は読まれない。これは「503 が要らない」という判断ではなく、**表示層で 503 を返す手段が無い**ということである。proxy が本体ごと HTML を組み立てれば 503 を返せるが、その画面はデザインシステムに乗らない —— 状態のために画面を捨てない。止めていることを機械へ伝えたい配備では、**配信面(CDN / ロードバランサ)が前に立つ**([0011](0011-no-docker.md) の役割分担)。そこで止めれば Next.js まで届かないため、この機構と競合しない
- **`Retry-After` は付けない**(返せる場合でも)。終了の予定を供給する口が無く、根拠の無い値を載せることになる

## 禁止事項

- ❌ `proxy.ts` に業務ロジック・重い処理・データ取得を書くこと(薄い境界。last resort)
- ❌ `proxy.ts` をセッション管理・確定的な認可の主機構にすること(optimistic チェックのみ。認可はデータ境界)
- ❌ deprecated な `middleware.ts` を新規に作ること(Next.js 16 は `proxy.ts`)
- ❌ Proxy で共有モジュール・グローバル状態・Node API に依存すること(CDN 配置され得る。Edge 互換を保つ)
- ❌ `proxy.ts` に `runtime` セグメント設定を書くこと(Next.js 16 の Proxy では使用不可・エラーになる)
- ❌ 特定の認証実装・デプロイ先 runtime 前提を本リポジトリで強制すること(認証は用途依存。runtime はデプロイ先依存)
- ❌ 停止画面のために proxy が本体の HTML を組み立てること、および根拠の無い `Retry-After` を付けること(§5)

## 関連 ADR

- [0070-backend-role-separation.md](0070-backend-role-separation.md) — thin proxy / 認証は用途依存 / 確定的認可はデータ境界
- [0079-auth-frontend-seam.md](0079-auth-frontend-seam.md) — 前捌きは防御線ではない(確定認可の側が持つ)
- [0040-routing-rendering-strategy.md](0040-routing-rendering-strategy.md) — App Router / driving adapter 原則
- [0030-environment-variable-management.md](0030-environment-variable-management.md) — Edge 用 Node API 非依存 config スライス(本 ADR との交点)
- [0021-frontend-responsibility.md](0021-frontend-responsibility.md) — 起動 / 境界エントリ(11 カーネル外)としての `proxy.ts`
- [0011-no-docker.md](0011-no-docker.md) — 配信面(CDN / ロードバランサ)との役割分担(停止を機械へ伝える側)
- [0121-i18n-strategy.md](0121-i18n-strategy.md) — ロケール検出の seam(採用時、Proxy を使う場合)
