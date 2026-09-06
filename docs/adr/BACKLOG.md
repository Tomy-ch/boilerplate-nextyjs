# ADR Backlog

本プロジェクトの ADR 全体像と、各 ADR の **選定済み / 実装済み** の進捗を、**カテゴリ別** に追跡する。

`README.md` は Accepted な ADR の公式インデックス、本ファイルは「全カテゴリの全 ADR の状態を一元で見るボード」と役割を分ける。

## 運用ルール

- ADR は **カテゴリ (Tier) で分類** する。Tier 番号はステータスではなく、領域 + 大まかな依存順を表す。Accepted になっても Tier 間の移動はしない
  - 例外: 低い Tier 番号が、領域として優先度の高いものを並べる目的の場合、ツール層 (Tier 1) を「道具」として使う依存が逆向きに発生し得る。具体的には Tier 0 (Git運用) の G1 / G2 が Tier 1 (ツールチェーン) の T1〜T4 に依存している。Tier 番号は完全な依存トポロジーではなく、運用・領域上の優先度を表す指標として読む
- 各項目は **選定済み / 実装済み** の 2 軸でステータスを追跡する (詳細は凡例を参照)
- 依存関係を踏まえた順で着手する (依存マップ参照)
- 新しい意思決定領域に気付いたら、該当 Tier への追加 → 内容合意 → ADR 化 のフローを踏む。ADR ファイルへの直接追加から始めない
- 枠 ID (`G1` / `T1` / `A1` 等) は本 BACKLOG 内の識別子。Tier ごとに letter prefix を割り当てる:
  - **G** = Git運用 (Tier 0)
  - **T** = Tooling / ビルド・依存 (Tier 1)
  - **R** = Role / 配送 (Tier 2)
  - **A** = Architecture (Tier 3)
  - **B** = 実装方針 (Tier 4)
  - **C** = Compat / 機能・互換 (Tier 5)
  - **D** = Docs / ドキュメント (Tier 6)
- 枠 ID の letter prefix は上記 7 つで予約済み。**他の ID 体系はこれと衝突しない接頭辞を用いる** — [移植バックログ](#go-boilerplate-claude-資産-移植バックログ)のグループ ID が 2 文字の `GB-N` (`GB` = go-boilerplate) なのはこのため
- 公式の **ADR 番号** (`0001`-`9999`) はファイル化のタイミングで採番し、`ADR #` 列に記録する。BACKLOG 内の依存参照は枠 ID で行う
- **2 軸の意味**:
  - **選定済み**: ADR ファイルが書かれて Status = Accepted になっているか
  - **実装済み**: 方針を実行するための仕組み (config / artifact / コード) がリポジトリに存在するか
- **「やらない」と決めた事項は[撤回条件](#撤回条件-決定を見直すトリガ)へ記録する**。決定そのものは ADR が持ち、本ボードは「いつ考え直すか」だけを持つ

## 凡例

- ✅ 完了
- ⚠️ 部分実装 (de facto は揃っているが規約として未確定 / 一部のみ / 部分違反あり)
- ⬜ 未着手

---

## Tier 0: Git運用 / プロセス

ブランチ戦略 / コミット規約 / PR 運用 / リリース運用 / Git hook 等、開発プロセスを支えるルール。

| 枠 ID | ADR # | タイトル | 選定済み | 実装済み | 依存 | 内容要旨 |
| --- | --- | --- | --- | --- | --- | --- |
| **G1** | 0150 | git-workflow | ✅ | ✅ | T1, T4 | ブランチ戦略 / コミット規約 (Feat/Fix/...) / PR 運用 / リリース運用 (`make tag-*`) |
| **G2** | 0151 | git-hooks | ✅ | ✅ | T2, T4, G1 | pre-commit / pre-push を lefthook で運用 / 速い hook + 権威 CI の二重化 |

### Tier 0 の実装ギャップ

- なし (G2 は解消済: `.lefthook.yaml` + lefthook devDependency (exact pin) を導入。pre-commit = `pnpm lint:ci` + `pnpm md-lint` + `make actionlint` / commit-msg = `make commitlint` / pre-push = `pnpm typecheck` + `make secret-scan`)

---

## Tier 1: ビルド・依存・ツールチェーン

パッケージマネージャ / フォーマッタ / バージョンマネージャ / 依存方針 等、開発環境を構成する基盤ツール。

| 枠 ID | ADR # | タイトル | 選定済み | 実装済み | 依存 | 内容要旨 |
| --- | --- | --- | --- | --- | --- | --- |
| **T1** | 0001 | package-manager (pnpm) | ✅ | ✅ | — | パッケージマネージャに pnpm を採用 / lockfile commit 必須 / npm・yarn 禁止 |
| **T2** | 0002 | formatter-linter (biome) | ✅ | ✅ | T1 | biome 優先 / biome 非対応検査のみ ESLint 補完 (能力ベース・重複禁止・縮小方向) / フォーマッタは biome 単独 / Prettier 不採用 / VSCode 連携 / **tsconfig 追加フラグ 5 件 + `target` 引き上げ**(型で捕まえる検査は tsc 側) |
| **T3** | 0003 | version-manager (mise) | ✅ | ✅ | T1 | ツール・言語バージョンの SSOT に `mise.toml` を採用 / 配送層への mise 拡張禁止 |
| **T4** | 0004 | library-management | ✅ | ✅ | T1 | npm 依存の選定・固定・更新・監査メタ方針 / コア依存は exact pin / メジャー更新は別 PR / 一次判定 (単一責務 × 単一 upstream) + 例外パス + fork コスト上限 |
| **T5** | 0156 | ブラウザ実測ツール | ✅ | ⚠️ | T1, T3, B8 | 観測の 3 レーン(見る・触る / 測る / 掘る)と問い 1 つに道具 1 つ / CLI 前提・MCP 登録しない / 実ブラウザのプロファイルへ接続しない / 取得経路は Node パッケージ=pnpm・単体バイナリ=mise(`npm:` backend 不採用) / 基準画像とゲートには接続しない |

### Tier 1 の実装ギャップ

- **T2 (0002)**: 「biome 非対応検査は ESLint で補完」を採択し、A3 ([0021](0021-frontend-responsibility.md)) がプラグイン (`eslint-plugin-boundaries`)・層定義マッピング (依存マトリクス)・severity (error) を確定した。biome 側の設定に加えて ESLint も導入済みで、依存マトリクスは `architecture.ts` を正に `eslint.config.ts` が import し、層 README の frontmatter との突合は `check:architecture` が担う。いずれも `lint:ci` に直列で載る
- **T4 (0004)**: ギャップ解消済み。主要 dev ツールは `typescript` を含め exact pin で整合し、PR テンプレート (`.github/pull_request_template.md`) に「ライブラリ採用チェック」節を組み込んだ
- **T5 (0156)**: 道具は導入済み（`mise.toml` の `agent-browser` / devDependency の `chrome-devtools-mcp`）で、エージェントの許可は「末尾に自由な入力を残さない + フラグ等価の環境変数を固定」の形で担保済み。**未了は 2 点** —— 観測に使うブラウザをゲートと同じ chromium へ向ける環境変数の置き場が決まっておらず呼ぶ側で都度解決していること、「掘る」レーン（`chrome-devtools`）を実際の調査で通していないこと

---

## Tier 2: 配送・ロール定義

デプロイ先の前提 / アプリケーションの役割 / 同梱しないもの 等、リポジトリ全体のスコープを規定する判断。

| 枠 ID | ADR # | タイトル | 選定済み | 実装済み | 依存 | 内容要旨 |
| --- | --- | --- | --- | --- | --- | --- |
| **R1** | 0011 | no-docker (表示層ロール定義) | ✅ | ✅ | T1, T3, T4 | Next.js を「表示層」として定義 / アプリ本体 Docker 不採用 / dev 補助 docker-compose は例外 |

---

## Tier 3: アーキテクチャ基盤

採用アーキテクチャ / 責務分離 / ルーティング・レンダリング / ディレクトリ構造 / 命名規則 / 環境変数 等、コード構造の前提を作る決定。**A1 → A2 → A3 → A4 → A5 → A6 → A7** の依存順で着手する。

| 枠 ID | ADR # | タイトル | 選定済み | 実装済み | 依存 | 内容要旨 |
| --- | --- | --- | --- | --- | --- | --- |
| **A1** | 0020 | 採用アーキテクチャ | ✅ | ✅ | — | 全体パターンの宣言 (機能スライス × 表示層カーネル) / 設計原則 / 不採用パターン (onion 直訳 / Next.js 慣行ミニマル) |
| **A2** | 0070 | バックエンドとの役割分離 | ✅ | ⬜ | A1, R1 | Next.js = UI + 薄い BFF / `/api/*` = thin proxy(業務ロジック禁止)/ ドメインはバックエンド / 契約 SSOT = backend `openapi.gen.yaml` / 境界値所有(フロントが response 検証の最後の砦) |
| **A3** | 0021 | 責務分離方針 (フロント内) | ✅ | ✅ | A1 | `features` / `model` / `components` / `adapters` 等カーネルの責務 / 依存方向 / 境界違反禁止 / カーネル命名規律・受入基準 / ESLint boundaries による機械強制 (Enforcement) |
| **A4** | 0040 | ルーティング・レンダリング戦略 | ✅ | ⚠️ | A1, A2 | App Router 単独 / Server Components 既定 / `"use client"` は feature 葉へ / Server Actions = `actions.ts` / page = 薄い driving adapter / モード非強制(Next.js 16 caching は B3/B6 へ) |
| **A5** | 0027 | ディレクトリ構造 | ✅ | ✅ | A3, A4 | `src/` 配下の物理配置 / path alias (`@/*`) / co-location の方針 / 共有モジュール粒度 |
| **A6** | 0028 | 命名規則 | ✅ | ✅ | A5 | 優先順位 = Next.js > React > nextjs-boilerplate 自身・業界スタンダード / ファイル名 (全ソース kebab-case 統一) / 識別子 (component=Pascal / hook=useCamel / 型=Pascal / 定数=UPPER_SNAKE) / route segment (Next.js 小文字・`[slug]`・`(group)`・`_folder`) / 環境変数 (`{SUBSYSTEM}_{NAME}`・標準名〈`OTEL_*` 等〉は例外) / ADR ファイル (kebab・採番はブロック帯で確定〈0001〜0155〉) / テストファイルは B8 |
| **A7** | 0030 | 環境変数管理 | ✅ | ✅ | A5 | 全 ENV 検証 (ビルド時 + 起動時のみ) / 不変 Config (`#`+getter) / server・client 分割 / ESM singleton 配布 / `NEXT_PUBLIC_` 境界 / Secret 境界 |

### Tier 3 の de facto 状態

- **A1 / A3(ADR 0020 / 0021)**: `src/{app, features, model, components, adapters, capabilities, stores, config, errors, logging, observability}` の 11 カーネルと層別 README は実装済み。命名規律・カーネル受入基準・依存マトリクスは README に反映済みである。ESLint boundaries による機械強制は P3-2 で実装するため、A3 は ⚠️ とする。
- **A5 / A6 / A7(ADR 0027 / 0028 / 0030 として策定済み・実装未)**: 2026-07-12 に A1/A3 (0020/0021) に続けて成文化。
  - **A5 = [ADR 0027](0027-directory-structure.md)**: 物理レイアウト・`@/*` alias 追認・co-location (feature 内フラット共置 / テストは実装隣接・`__tests__` 集約否定 / スタイルは Tailwind 既定)・共有粒度 (per-file 基本 → 肥大時 per-folder)・物理作成タイミング (空ディレクトリ禁止)
  - **A6 = [ADR 0028](0028-naming-convention.md)**: 命名優先順位 = **Next.js 規約 > React 規約 > nextjs-boilerplate 自身の既存規約・業界スタンダード**(go-boilerplate は命名の権威に置かない)。ファイル名は**全ソース kebab-case 統一**(Next.js は特殊ファイル以外を unopinionated → 業界スタンダード/shadcn/FS 安全性/自リポ既存の小文字ファイル。従来型 React の PascalCase コンポーネントファイルは不採用)・特殊ファイル/route は Next.js 小文字規約(`[slug]`/`(group)`/`_folder`)・識別子は React 規約(component=PascalCase 等・`I` プレフィックス禁止)・環境変数 `{SUBSYSTEM}_{NAME}`・ADR ファイル `NNNN-kebab`(自リポ既存規約 `docs/adr/README.md`・採番方式はトピック順ブロック帯で確定〈2026-07-14・0001〜0155〉。`Dev-`/`Toolchain-` は数値列へ畳み込み)・テストファイル命名は B8 へ引き渡し。カーネル命名規律は 0021 が正
  - **A7 = [ADR 0030](0030-environment-variable-management.md)**: env/config の翻案方針 (全 ENV 検証 = ビルド時 + サーバ起動時のみ / `#` private + getter の不変 Config / server・client 分割 / `process.env` 直読は config モジュールのみ・biome `noProcessEnv` 強制 / 配布 = ESM シングルトン + import 境界 / 受け手 4 分類 / no-Docker のため embed → Next.js native `.env` + PaaS secret store)。討議経緯は docs/plan 統合(2026-07-18)で破棄(git 履歴参照)。決定は ADR [0030](0030-environment-variable-management.md) が正
  - A5 の物理ディレクトリ・層別 README と A6 の命名規則は実装済み。ESLint boundaries は P3-2、config の実装は P3-3 で着手する
- **A4(ADR 0040 として策定済み・実装 ⚠️)**: 2026-07-12 に [ADR 0040](0040-routing-rendering-strategy.md) として成文化(App Router 単独 / Server Components 既定 / `"use client"` は feature 葉へ押し下げ / Server Actions = feature 内 `actions.ts` / page = 薄い driving adapter / レンダリングモード非強制)。`src/app/` (layout.tsx + page.tsx + globals.css) は存在 = 実装 ⚠️。Next.js 16 の caching(`use cache` / PPR / Cache Components 有効化)は B3 / B6 へ委譲、`loading.tsx` / `error.tsx` 配置は B6 へ
- **A2(ADR 0070 として策定済み・実装未)**: 2026-07-13 に [ADR 0070](0070-backend-role-separation.md) として成文化(Next.js = UI + 薄い BFF / `/api/*` = thin proxy・業務ロジック禁止 / ドメインはバックエンド / 契約 SSOT = backend `openapi.gen.yaml`(go ADR 0012 消費者側)/ 境界値所有 = go ADR 0015 翻案・response 検証はフロントが最後の砦 / 認証・セッション具体は fork 先判断)。**Tier 3(A 系)はこれで全 ADR 化完了**

---

## Tier 4: 実装方針

UI / スタイリング / データ統合 / 状態管理 / エラー / 観測性 / テスト / CI / セキュリティ 等、アーキテクチャ基盤の上に乗る具体実装の方針。

| 枠 ID | ADR # | タイトル | 選定済み | 実装済み | 依存 | 内容要旨 |
| --- | --- | --- | --- | --- | --- | --- |
| **B1** | 0050 | スタイリング戦略 | ✅ | ✅ | A5 | Tailwind 主軸 / CSS Modules 限定許可(styled-components・emotion 非採用)/ design token = CSS 変数 / `cn()` = `clsx` + `tailwind-merge`(`components` カーネル内)/ variant 定義 = `cva` / global は `globals.css` 集約 |
| **B2** | 0052 | UI コンポーネント方針 | ✅ | ✅ | A5, B1 | **v1 バッテリー採用(2026-07-14 反転)**: shadcn/ui + lucide-react + 複雑入力 + リッチテキスト(TipTap)を採用(`components` カーネル・vendor 越し差替可能。0010 / 0004)/ variant 定義は `cva`。旧「非同梱」から反転 |
| **B3** | 0071 | BFF / API 統合 | ✅ | ✅ | A2, A4, A5 | API クライアント = `adapters` / fetch wrapper に go 0019 resilience を広く翻案(dual timeout / idempotent retry / retry budget / circuit breaker)/ 生 status を errors へ正規化 / response は adapters 境界で zod 検証 |
| **B4** | 0072 | 型生成 (API スキーマ) | ✅ | ✅ | A2, B3 | backend `openapi.gen.yaml` から **orval で zod + 型生成**(型 + runtime validation)/ `gen/` do-not-edit / gh 取込 + short SHA スタンプ / 型漏洩禁止(adapters 変換)/ drift ゲート |
| **B5** | 0060 | 状態管理 | ✅ | ✅ | A3, A5, B3 | Server state = Server Component fetch 既定 / Client state = local から / **v1 バッテリー採用(2026-07-14 反転)**: react-hook-form + zod / Zustand(横断 client 状態は `stores` カーネル 0023)/ **`nuqs` 等 searchParams ヘルパは v1 不採用**(標準形は scaffold 生成で担保)。旧「非同梱」から反転 |
| **B6** | 0080 | エラーハンドリング | ✅ | ✅ | A4, A5, B3 | errors カーネルの protocol-agnostic 分類・cause chain・redact・Meta を実装済み。adapters 境界での生 status 正規化(1 回)と App Router のエラー境界は後続 PR で実装する |
| **B7** | 0081 | 観測性 / ロギング | ✅ | ✅ | A2, A5, B3 | server-side logging/observability カーネル / 抽象ロガー(ctx-native・trace_id 自動注入)/ OTel vendor-neutral OTLP-only / signal 別 config gating / 公式 semconv のみ。ブラウザ→BFF 中継 seam で Web Vitals と client の未捕捉例外を集約 / **RUM SaaS は fork 先判断(exclusion)** |
| **B8** | 0090 | テスト戦略 | ✅ | ✅ | A3, A4, A5, A6 | Vitest + RTL + MSW + Playwright / go 準拠戦略(co-location・正常系異常系・table-driven 禁止)/ 100% ハードゲート / integration=HTTP 境界 mock / 二層実行(CI 厳格 / hook 高速)/ 命名は 0028 kebab。Playwright は story 単位の visual regression と、画面を通した E2E ジャーニー・画面単位の比較の双方に載る |
| **B9** | 0153 | CI 構成方針 | ✅ | ⚠️ | A7, B8 | 1 関心事=1 workflow(lint/typecheck/build/test/e2e)/ SHA ピン + concurrency + 最小 permissions / hooks mirror CI / upsert-pr-comment / matrix 非採用(単一 ubuntu・mise SSOT) |
| **B10** | 0110 | セキュリティ運用 | ✅ | ✅ | T4, B9 | Dependabot cooldown(patch5/minor7/major30・security 即時)/ gitleaks fail-closed / Trivy fs 二段(dev advisory・release strict)/ CodeQL js-ts / pnpm audit(severity high+ / 修正可能性で blocking。到達性フィルタは現行ツール非対応)/ SECURITY.md / **CSP 適合ゲート**(配信ヘッダと 0111 宣言の突合・fail-closed)/ **image-scan・cosign・SBOM は no-docker で exclusion** |

### Tier 4 の de facto 状態

- **B1(ADR 0050 として実装 ✅)**: 2026-07-12 に [ADR 0050](0050-styling-strategy.md) として成文化(2026-07-14・v1 でバッテリー採用へ部分改訂 = Tailwind 主軸 / CSS Modules 限定許可・styled-components・emotion 非採用 / `cn()` は `components` カーネル内 / design token = CSS 変数 / global は `globals.css` 集約)。`tokens/*.json` を SSOT とする CSS 生成・drift gate・`cn()` に加え、variant 定義の `cva` と design token の値が着地したため ✅ とする
- **B2(ADR 0052 として実装 ✅)**: shadcn/ui を取り込んだ `src/components/` の design-system / patterns / app-starter / shell、lucide-react のアイコン、Radix ベースの複雑入力、TipTap の `RichTextEditor` と sanitize 済み表示の `RichTextContent`、`cva` による variant 定義を実装済み。取り込みの台帳は `shadcn-manifest.yaml` が持ち、上流追従の drift 検出を CI へ載せている
- **B5(ADR 0060 — 2026-07-14 に v1 バッテリー採用へ反転・実装 ✅)**: B2 と同じく、当初(2026-07-12)は本体非同梱の exclusion だったが、**v1 = 一般的 Next.js アプリ基盤として必要ライブラリを採用**の方針転換で反転。0060 = react-hook-form + zod / Zustand(横断 client 状態は `stores` カーネル [0023](0023-stores-kernel.md))。Server state = RSC fetch 既定 / Client state = local から、は不変。ライブラリの導入と `stores` の実体化(同意状態 / 通知)は着地済み。詳細は [docs/plan/master-plan.md](../plan/master-plan.md) の採用ロードマップ節
- **B8(ADR 0090 として実装 ✅)**: Vitest + RTL + MSW + `vitest-axe` を導入し、co-location・正常系 / 異常系・table-driven 禁止の規約、`make test-cached` / `make test-full` の二層実行、100% coverage gate と CI の PR レポートを実装済み。Playwright は story 全数の visual regression(`make vrt`)に加えて、画面を通した E2E ジャーニー・ブラウザが報告する異常の見張り・帯ごとの出し分け・3 つの描画エンジン・画面単位の比較(`make e2e` / `e2e/`)も持つ。どちらも digest 固定した公式イメージ内で実行し、基準画像の置き場を共有する
- **B3 / B4(ADR 0071 / 0072・実装 ✅)**: 2026-07-13 に決定 4 バッチとして成文化。B3 = [ADR 0071](0071-bff-api-integration.md)(API クライアント = `adapters` / fetch wrapper に go ADR 0019 resilience を広く翻案 = dual timeout + idempotent retry + retry budget + circuit breaker / 生 status を errors へ正規化・詳細テーブルは B6 / response は adapters 境界で zod 検証 / SSRF guard は外部叩き時のみ)。B4 = [ADR 0072](0072-api-type-generation.md)(**型 + runtime validation を orval で zod 生成** — 決定 4 当初の openapi-typescript 型のみから、go 境界値所有哲学に合わせユーザが変更 / `gen/` do-not-edit / gh 取込 + short SHA スタンプ + マニフェスト / 型漏洩禁止 = adapters 変換 / drift ゲート)。取込 + 生成パイプラインは `scripts/openapi/`、生成物は `src/adapters/gen/`、drift ゲートは `gen-drift` が持つ
- **契約と実物の食い違いが 1 件見つかっている(B4)。** 実バックエンドへ繋いで `/mypage` を開くと、`/v1/users/me/purchases/summary` の応答が生成 schema と一致せず(`period` が無い)、`adapters` の境界検証が `internal` を投げて画面が落ちる。**契約を取り込み直して、どちらが古いのかを確かめる**のが次の作業である。
- **同じ downstream への client が分かれている(B3)。** `createHttpClient` は呼び出しごとに circuit breaker と retry budget を新しく作るため、同じ backend へ client を分けた数だけ劣化の判断が割れる([0071](0071-bff-api-integration.md) の per-downstream)。public 側は `adapters/server/api/public-client.ts` へ集約済みだが、**user-scoped 側は 7 モジュールがそれぞれ自前で組んでいる**。集約するなら「資格情報の取得口を渡す形」を 1 か所へ寄せることになり、[0112](0112-data-classification-cache-boundary.md) 決定 5 の `no-captured-bearer-token` と正面から交差するので、まとめて決める。
- **B6(ADR 0080・実装 ⚠️)**: `errors` カーネルに protocol-agnostic な13分類、cause chain、明示指定の redact、分類と code・文言・詳細識別子を分離する `Meta` を実装済み。分類は Go の `apperror` と同じく内層に保持し、外側の `Meta` を優先する。生 status の分類と未知エラーの `internal` 正規化は `adapters` の境界が 1 回だけ行い、`error.tsx` は区間ごと(`(shop)/products` / `cart` / `checkout` / `mypage` / `admin`)に、`global-error.tsx` と `not-found.tsx` は根に置いてある。ログレベルと出力は B7 が担う
- **B7(ADR 0081・実装 ⚠️)**: Node.js server 用に Pino の構造化 logger、trace/span ID の注入、秘匿フィールドの redaction、OTLP HTTP exporter、W3C trace context / baggage 伝播、`OBS_SERVICE_NAME` から供給する公式 `service.name`、HTTP request の trace、および signal 別の lazy 初期化を実装済み。`OBS_LOGS_EXPORTER=otlp` のときだけ Pino の正規化済みログを OTel Logs API へ渡す。local otel-lgtm で Tempo の trace と、同じ `trace_id` / `span_id` を持つ Loki の構造化ログを実送信確認済み。外向き `fetch` への trace context 注入は `APP_API_BASE_URL` と同じ origin に限り、外向き span からは URL の query を落とす。描画の計装は `OBS_RENDER_SPANS`(`none` / `screen` / `part`・既定 `screen`)で範囲を選び、`features` の最上位(`page-content` / `view`)と、`part` のときだけ feature が持つ部品(`ui/`)を span に載せる。注入は registered symbol 経由で渡す —— Next は起動境界と RSC を別のモジュールグラフとして組み、同じファイルが 1 プロセス内で 2 回インスタンス化されるため、モジュール変数では描画側へ届かない(`logging` の singleton が共有されていなかったのも同じ機序)。ブラウザ側は OTel の Web SDK で `fetch` すべて(BFF への取得に加え、router が画面遷移と先読みで出す RSC の要求)を span にし、その span を同一オリジンの BFF (`/api/telemetry/traces`) が OTLP のまま collector へ渡す —— ブラウザは自分の trace を始めず、root layout が配る `traceparent` を親に取るため、SSR からブラウザの取得、その先のバックエンドまでが 1 本の trace になる。計装は最初の描画の後に動的 import で読み、初期 JS への影響は +0.1 KB に留める。service 名は中継が上書きする(認証を要求しない口なので、ブラウザの名乗りを通すと任意の service へ書ける)。測定と例外は同じく BFF (`/api/telemetry`) が中継し、Web Vitals は指標ごとのヒストグラム(`browser.web_vital.*`)として、client の未捕捉例外は `exception.*` 属性を付けた構造化ログとして、画面を組んだ要求の trace へ紐づけて OTLP へ載せる —— 公式 semconv は web vitals へ event 名(`browser.web_vital`)しか与えていないが、event で出すと 1 レコードごとに中継の POST の span が付き、測定が起きていない要求と親子になるため metric を採る。中継の口は認証を要求しないので、content-type と本体サイズの最小防御を Route Handler が持つ([0077](0077-bff-abuse-protection-boundary.md) §2 が実装 PR へ保留していた分)。RUM SaaS は fork 先判断(exclusion)を維持する。
- **B9(ADR 0153・実装 ⚠️)**: [ADR 0153](0153-ci-configuration.md)(go workflows 翻案 / 1 関心事=1 workflow・SHA ピン・最小 permissions・hooks mirror / job は biome/tsc/next build/vitest/playwright / matrix 非採用)。lint / typecheck / build / test / smoke と生成物 drift・`uses:` の SHA ピン検査・ドキュメント配信の workflow、`upsert-pr-comment` 基盤を実装済み。visual regression(`vrt`)・画面を通した検証(`e2e`)・Core Web Vitals(`lighthouse`)・container image の digest ピン検査(`images-pin`)も追加済み。セキュリティ系 workflow(B10 側)も着地済み。**残る食い違いは required check の一覧で、`purge-verify` と `strip-verify` が載っていない** —— 0153 §5「CI Checks グループの job は全て必須」に対する差分はこの 2 つだけになった(`component-classes` と `shadcn-manifest` は登録済み)。`make required-check-lint` が見ているのは逆向き(登録済みの context が全 PR で報告されること)なので、この抜けは機械では鳴らない
- **B10(ADR 0110・実装 ✅)**: [ADR 0110](0110-security-operations.md)(go 0077 多層防御翻案 / Dependabot cooldown・gitleaks・Trivy 二段・CodeQL js-ts / **image-scan・cosign・SBOM は本リポ 0011 no-docker で exclusion**)
- **B10 の内訳**: ローカルは `mise.toml` + `make secret-scan` / `make trivy-fs`。**pre-push hook に載せるのは秘密スキャンだけ**で、脆弱性スキャンは意図的に接続していない([0110](0110-security-operations.md) 3.1 / 撤回条件 W1・W2)。CI 側は `codeql` / `gitleaks`(履歴全体の週次を含む)/ `dependency-scan`(Trivy 二段 + `pnpm audit` ゲート)/ `osv-scan` / `sast` / `bearer` / `dast` / `scorecard` と Dependabot cooldown、`SECURITY.md` が揃っている
- **CSP の適合検査は 0110 が想定した形では着地していない。** 配信ヘッダを宣言と突合するゲートではなく、**組み立ての単体検査 + 実ブラウザでの `securitypolicyviolation` の見張り**(`e2e/lib/test.ts` / `e2e/journeys/csp.spec.ts`)になった。ヘッダを読むだけの検査は `Report-Only` へ緩めても通るが、こちらは通らない([0111](0111-csp-security-headers.md) §5)

---

## Tier 5: 機能・互換 (任意 / 用途依存)

i18n / a11y / パフォーマンス予算 / ブラウザサポート 等、boilerplate として「あれば望ましいが用途次第」の判断。

| 枠 ID | ADR # | タイトル | 選定済み | 実装済み | 依存 | 内容要旨 |
| --- | --- | --- | --- | --- | --- | --- |
| **C1** | 0121 | i18n 戦略 | ✅ | ⬜ | A4, A5 | **exclusion**: i18n ライブラリ本体非同梱(fork 先判断)+ 採用時の App Router seam(proxy.ts/`[locale]`) |
| **C2** | 0100 | アクセシビリティ目標 | ✅ | ⚠️ | A5, B1 | WCAG 2.x AA 目標 / biome a11y ルール活用(`lint:ci`)/ 手動チェックは UI feature 実装 PR 時 |
| **C3** | 0101 | パフォーマンス予算 | ✅ | ✅ | B1, B9 | 指標=Core Web Vitals / 計測は `lighthouse`(画面ごとの LCP・CLS・TBT。保護ブランチへの push と日次)と `bundle-budget`(route ごとの client JS。PR ごと)/ 閾値は `performance-budget.yaml` / **CLS だけが "good" 境界そのもの。LCP と TBT は同じ条件で測った床から導く lab の線**で、用途で動く bundle size は fork 先 |
| **C4** | 0102 | ブラウザサポート行列 | ✅ | ⬜ | A4 | Next.js 既定 browserslist 追認 / polyfill は Next.js 委譲 / 切り捨て条件は fork 先 |
| **C5** | 0045 | フォント・画像 | ✅ | ✅ | A4, A5, B1 | `next/font` / `next/image` 既定 / `public/` は静的公開アセット / 動的 OG は `ImageResponse` / **backend 由来画像 = public storage 前提・自前配信レイヤなし**(`mediaUrl()` + `remotePatterns` のみ・blur 非採用) |
| **C6** | 0043 | Middleware 方針 | ✅ | ✅ | A4, B3 | **Next.js 16 で Middleware→Proxy(`proxy.ts`)** / thin・last resort / 既定 Node runtime(`runtime` 指定不可・Edge 互換維持)/ 認証は fork 先(optimistic のみ・確定認可はデータ境界) |
| **C7** | 0044 | SEO / メタデータ戦略 | ✅ | ✅ | A4, C5 | Metadata API 既定(`metadataBase`/`title.template`)/ `sitemap.ts`・`robots.ts` / `alternates.canonical` / JSON-LD 枠 / アイコン体系(0045 と責務分担)/ proxy matcher 除外 / 具体値は fork 先 |
| **C8** | 0130 | PWA 戦略 | ✅ | ⬜ | C7 | **exclusion**: Web App Manifest / Service Worker / オフライン本体非同梱(fork 先判断)+ 採用時の `manifest.*` seam |
| **C9** | 0131 | Cookie 同意 | ✅ | ✅ | A2, C6 | **v1 採用(exclusion から反転)**: 軽量 consent 機構(同意状態保持 / バナー / スクリプト読み込みゲート / 計測 cookie_id)と、**ゲートの裏のタグマネージャ**を同梱 / **CMP・IAB TCF は非同梱**(一部 exclusion)。計測製品そのものは容器の中身として fork が選ぶ / 状態供給は 0031 |

### Tier 5 の状態

- **C2(ADR 0100・実装 ⚠️)**: biome の a11y ルールを `lint:ci` で error として運用し、component のテストへ `vitest-axe` の自動検査を、Storybook へ `@storybook/addon-a11y` を組み込み済み。ADR が自動検査で拾えないと明記する手動チェック(キーボード操作・読み上げ・コントラストの実地確認)は UI feature 実装 PR で行うため ⚠️ に留める
- **C5(ADR 0045・実装 ✅)**: `next/font` による font 読み込み、`next/image` を CSS のみの skeleton + `aspect-ratio` で包む `MediaImage`、backend 由来画像の経路(`mediaUrl()` + `next.config.ts` の `remotePatterns`。ワイルドカードを使わず検証済み ENV から組み立てる)、`ImageResponse` による動的 OG まで着地済み
- **C3(ADR 0101・実装 ✅)**: 画面ごとの Core Web Vitals(`lighthouse` / `scripts/lighthouse/`)と route ごとの client JavaScript(`bundle-budget`)の 2 つを CI のハードゲートに載せ、閾値と試行回数は `performance-budget.yaml` が根拠付きで持つ。開く画面は `e2e/lib/screens.ts` の宣言をそのまま使い、一覧を持ち直さない。**Lighthouse は PR ではなく保護ブランチへの push と日次で回す** —— 計測が直列でしか成立せず費用が `画面数 × 試行回数` に張り付くため、網羅ではなく頻度を削る判断(0101 §2)
- **C1 / C4(exclusion・追認のため実装物を持たない)/ C6(実装 ✅)**: 2026-07-13 に成文化。用途依存の Tier 5 のため多くは exclusion / fork 先判断 / Next.js 組込み追認。C1=[0121](0121-i18n-strategy.md)(i18n exclusion)/ C2=[0100](0100-accessibility-target.md)(WCAG AA + biome a11y)/ C4=[0102](0102-browser-support.md)(Next.js 既定 browserslist 追認)/ C5=[0045](0045-fonts-and-images.md)(next/font・next/image)/ C6=[0043](0043-middleware-policy.md)(**Next.js 16 = proxy.ts**・thin・認証は fork 先)。go はバックエンドで C 系にほぼ対応物がなく(フロント固有)、AGENTS.md にも C 系 `[TODO]` はない(0152 掲載基準 = ブロック項目のみ)ため BACKLOG C 枠のみを根拠に成文化
- **C7 / C9(実装 ✅)・C8(exclusion)**: 2026-07-13 の敵対的レビューで、当初の C 列挙(C1〜C6)が**表示層 boilerplate の中心的関心事である SEO / メタデータ体系を取りこぼしていた**ことが判明し補完。C7=[0044](0044-seo-metadata-strategy.md)(Metadata API 既定 + `sitemap.ts`/`robots.ts` + canonical + JSON-LD 枠 + アイコン体系。0045 と責務分担)/ C8=[0130](0130-pwa-strategy.md)(PWA exclusion。沈黙だった線引きを明文化)/ C9=[0131](0131-cookie-consent.md)(Cookie 同意。**軽量機構 + スクリプトゲート + ゲートの裏のタグマネージャが v1 採用 / CMP・IAB TCF は非同梱**)。テーマ / ダークモードは新枠を立てず [0050](0050-styling-strategy.md)(B1)に「テーマ / ダークモード」節を追記(token 切替 + `prefers-color-scheme` 追従)。favicon / app icon の体系は C7(0044)がアイコン規約として吸収(0045 は静的 favicon の `public/` 配置のみ)

### 予算に対して残っている重さ (0101)

> client の zod は解消済み。生成物から定数だけを切り出し([0072](0072-api-type-generation.md))、client へ届くスキーマを `zod/mini` へ移した([0029](0029-type-design-discipline.md) §2)結果、client bundle の zod は **94 KB → 11 KB**、生成スキーマと `.describe()` の文言は 0 になった。再発は `scripts/client-schema-weight.gate.test.ts` が見る。

同梱サンプルの実測(gzip)。**ここに挙がるのは「測って分かっているが、まだ削っていない」ものだけ**で、削り方が決まっていないもの・順序が他に依存するものを置く。

- **全 route 共通の土台が 143 KB。** react-dom が 71 KB、Next.js の router が 29 KB を占める。フレームワークの費用であり、削る対象ではない
- **LCP と TBT の上限は、機械の速さを織り込んだぶんだけ緩い。** どちらも "good" 境界そのものではなく、床(`not-found`)+ 実行をまたぐ振れ + アプリへ割り当てる分で置いてある([0101](0101-performance-budget.md) 3)。振れの項が要るのは runner が実行ごと 3〜4.5 倍まで動くためで、**削れるのは「機械の速さを台ごとに割り戻す」機構が入ったとき**である。床は割った台すべてで測れているので、残るのは判定の側にそれを渡すことだけになる。field の値は RUM が別に持つ([0082](0082-client-observability.md))
- **`/checkout` の参考換算額が 1 描画で 3 回問い合わせられるのは、再試行である。** 描画 span を入れて採り直すと、3 本とも `checkout/confirm/page-content.tsx` の span の中にあり、応答は 3 本とも **503**(local の go 側で為替の供給元が未設定)。HTTP クライアントが `maxAttempts` まで再試行した結果であって、memo 化の失敗ではない。同じ trace で `getMyCart` / `getMyUser` は layout の取得と 1 回に畳まれており、`cache` は効いている。**供給元を立てた環境で 1 回に戻ることを確認する**のが残りの作業である
- **`next/dynamic` にした部品が、初回描画の直後に取得されている。** `wizard-form.tsx` は `<form action>` の送信で入力値を落とさないため全段を `hidden` で DOM に残し、`dynamic` はマウント時点で取得を始める。実測で、操作なしの初回読み込みで編集面(ProseMirror)と確認の段(sanitizer)のチャンクが取得されている。**最初に読む一式からは外れているので `bundle-budget` の数値は正しい**が、同じページを開いた人はそのバイトを払う。本当に遅らせるには「まだ到達していない段は中身を描かない」を器が持つ必要があり、入力欄を持つ段(値を残す必要がある)と読み取り専用の段(確認)で扱いを分けることになる
- **`/checkout` の `<Suspense>` が待つものの単位で切れていない。** 明細は外枠と同時に届くのに、profile と参考換算額を待つ同じ境界の中にある(0040 の境界の粒度)。CLS が 0.087〜0.112 と上下するのはこのため

### 機械的強制が文書に追いついていない箇所

- **`app` の element 分割は `route-handler` だけが機械で強制されている。** [0025](0025-app-layer-elements.md) は `app` を 4 element(`route-segment` / `route-handler` / `server-action` / `metadata`)に分け、それぞれ許可 import 先を定める。`architecture.ts` の `APP_ELEMENTS` はこのうち `route-handler` をファイル名で分類し、層の許可から UI 部品・横断状態・設定・feature の内側を削る。残る 2 element は `app` の粒度で検査され、`page.dev.tsx` が `server config` を直読する形が実在する。境界検査の要素はディレクトリに対応するため名前で分けるには層の許可を後から削るしかなく、**削る側の集合が ADR の表と実装で食い違っている**(表が `components` / `errors` / client 側 `config` を挙げていない)。表を実態へ合わせるのが先で、それまでは意味的監査(GB-1)と人のレビューが拾う。**`observability` も同じ穴を通る** —— [0021](0021-frontend-responsibility.md) が `route-segment` の計装 mount だけに許した口だが、`route.ts` 以外の element へは層の粒度で届く

---

## Tier 6: ドキュメント・メタ

ドキュメント運用 / portal / ライセンス 等、リポジトリ自体の運用に関する判断。

| 枠 ID | ADR # | タイトル | 選定済み | 実装済み | 依存 | 内容要旨 |
| --- | --- | --- | --- | --- | --- | --- |
| **D1** | 0140 | ドキュメント運用ポリシー | ✅ | ⬜ | — | canonical 言語 = EN 目標・移行は v1(0.0.x は日本語 living)/ タクソノミー4分類(decision・exclusion=ADR / rule=rules.md 新設 / inventory=BACKLOG)/ ADR 不可変性(0.0.x living→v1 immutable)/ per-package README |
| **D2** | 0141 | ポータル運用 | ✅ | ⚠️ | D1 | `docs/portal/manifest.yaml` = 構造制御のみ(curated manual)/ コード README 手動登録・`docs/*` 自動発見 / GitHub Pages 配信 |
| **D3** | 0142 | ライセンス選定 | ✅ | ✅ | — | MIT 採用根拠(最大許容・エコシステム標準・go 統一)/ OSS 寄与 = inbound=outbound・CLA なし / 同梱ライブラリ整合は 0004 / `private:true` は publish ガードで MIT と両立 |
| **D4** | 0152 | AGENTS.md 構成方針 | ✅ | ✅ | D1 | ファイル配置 / 本文言語 / 節構成 / Instruction Priority / `## [TODO]` セクション運用 |
| **D5** | 0154 | Claude スキル運用方針 (運用系) | ✅ | ✅ | D4, G1, G2, T3, T4 | 配置・命名・frontmatter / 本文構造 / カバー範囲 / 商用操作前ユーザ確認 |
| **D6** | 0155 | Claude スキル運用方針 (開発系) | ✅ | ⚠️ | D4, D1, A1 | 配置・命名・frontmatter は D5 共通 / カバー範囲 / subagent パターン / `new-env` の Next.js 再設計 |

### Tier 6 の de facto 状態

- **D1(ADR 0140 として策定済み・実装未)**: 2026-07-13 に決定 5 バッチとして成文化([ADR 0140](0140-documentation-operations.md))。canonical 言語 = **EN 目標・移行は v1**〈ユーザ決定・v1.0.0 未満は日本語 canonical のまま living〉/ タクソノミー4分類 / **`rules.md` 新設 + AGENTS.md rule 段階移行**〈0152 整合はユーザ承認要〉/ ADR 不可変性 = v1.0.0 未満 living→v1 immutable〈go モデル翻案〉/ per-package README。`rules.md` は新設済みで、EN canonical 化は v1 で行う
- **D2(ADR 0141・実装 ⚠️)**: `docs/portal/manifest.yaml` によるキュレーション、`scripts/portal/` の生成(判断は純粋関数・FS 入出力は CLI)、独立 workspace の `docs-viewer/`、GitHub Pages への配信 workflow を実装済み。`portal-manifest-sync` スキルも移植済みで、判定基準は `readme-review` を実行時に読む。**残るのは `github-pages` environment の deployment branch policy に配信元ブランチを許可すること**(リポジトリ設定のためユーザが実施)。許可が無い間、`docs-deploy` は step を 1 つも実行せずに落ちるため、配信の緑赤は `deploy-docs.yaml` の結果で見る
- **D3(ADR 0142 として策定済み)**: 2026-07-13 に成文化([ADR 0142](0142-license.md))。MIT 採用根拠(最大許容・エコシステム標準・go-boilerplate と統一・低儀式性)/ OSS 寄与 = **inbound=outbound・CLA なし**(DCO は必要時 `CONTRIBUTING.md`)/ 同梱ライブラリのライセンス整合は [0004](0004-library-management.md) 許可リストが担保 / `package.json` の `private:true` は npm publish ガードで MIT と別レイヤ・両立。**follow-up: `package.json` に `"license": "MIT"` 追加はルート設定保護のためユーザ指示待ち**
- **D6 ⚠️**: 開発系 5 件は A7 ([0030](0030-environment-variable-management.md)) の構造へ揃済。`new-env` は `src/config/` の目的別 config モジュールを対象とするが、`src/config/` の着地は A7 実装 PR (v1 計画 P3-3) のため、それまで実行不可 (スキル側がガードして停止する)

---

## 明示的に boilerplate では決めない (out of scope)

これらは boilerplate 単体では決めず、fork 先プロジェクトでの個別判断に委ねる。

- **認証 / セッション戦略** — fork 先の要件に依存 (Vercel / Auth.js / Clerk / 自前 BFF / SaaS IdP 等)
- **DB / 永続化** — R1 (0011) の表示層ロールの対象外
- **デプロイ先の具体実装** — R1 (0011) で「PaaS 主想定」と決めたのみ。CI/CD の具体的なデプロイステップは fork 先で扱う
- **ビジネスドメインモデル** — A2 で「ドメインはバックエンドが持つ」と決める前提

---

## 依存マップ (簡略)

```text
A1 (採用アーキテクチャ)
 ├─ A2 (バックエンドとの役割分離) ─ R1
 │   └─ B3 (BFF/API) ─ B4 (型生成)
 │       ├─ B5 (状態管理)
 │       ├─ B6 (エラー)
 │       └─ B7 (観測性)
 ├─ A3 (責務分離: フロント内)
 │   ├─ A5 (ディレクトリ)
 │   │   ├─ A6 (命名規則)
 │   │   ├─ A7 (環境変数)
 │   │   │   └─ B9 (CI) ─ B10 (セキュリティ; T4 拡張)
 │   │   ├─ B1 (スタイリング) ─ B2 (UI)
 │   │   └─ B8 (テスト)
 │   └─ (B5 etc は A3 にも依存)
 └─ A4 (Routing/Rendering)
     └─ (B3, B6, C1, C4, C5, C6, C7 が依存)
         └─ C7 (SEO/メタデータ) ─ C8 (PWA) / C9 (Cookie 同意; A2/C6 にも依存)

G1 (git-workflow) ─ G2 (git-hooks; T2/T4 にも依存)
T1 ─ T2/T3/T4 (Tier 1 内の従属)
R1 (Tier 2) ─ T1/T3/T4 に依存

D1 (ドキュメント運用) ─ D2 (ポータル)
D3 (ライセンス)
D4 (AGENTS.md) ─ D5 (スキル運用系) / D6 (スキル開発系)
```

---

## ステータスの遷移

各項目は所属 Tier を変えずに、選定済み・実装済み 2 軸の状態のみが遷移する。

| 段階 | 選定済み | 実装済み |
| --- | --- | --- |
| 未着手 | ⬜ | ⬜ |
| 部分実装 (ADR 未策定だが事実上動いている) | ⬜ | ⚠️ |
| ADR 策定済み・実装未着手 | ✅ | ⬜ |
| ADR 策定済み・実装部分 | ✅ | ⚠️ |
| 完了 | ✅ | ✅ |

「事実上動いているが ADR 未策定」(`⬜` 選定済み + `⚠️` 実装済み) の項目は、**de facto を ADR で追認するだけのコストが低い** ため、優先度を上げて着手すべきシグナル。

---

## 撤回条件 (決定を見直すトリガ)

**「やらない」と決めた事項の、再検討を開始する条件**を記録する。決定だけを残すと、なぜやらないのかは ADR に書かれても**いつなら考え直すのか**がどこにも残らず、前提が変わったことに誰も気づけない。

条件を満たしたら、その場で撤回するのではなく **ADR を読み直して判断し直す**。条件は「再検討の開始点」であって「自動的な結論」ではない。

| # | 決定 (現状) | 権威 | 撤回条件 |
| --- | --- | --- | --- |
| **W1** | 依存脆弱性スキャンを hook に接続しない | [0110](0110-security-operations.md) 3.1 / [0151](0151-git-hooks.md) | **原則としてこの決定は状態では動かない**。動かせるのは前提の変化だけ — (a) 脆弱性を「その場で当事者が解消できる」機構が入る (例: 上流 pin を跨いで安全に更新できる仕組み) / (b) 変更と独立に結果が変動する性質が消える。**検出件数が 0 になったこと・CI ゲートが揃ったことは条件にならない** |
| **W2** | `make trivy-fs` を exit code で落とさない | [0110](0110-security-operations.md) 3.1 | W1 と同じ。昇格ゲート (保護ブランチ宛 PR) 側は本条件の対象外で、そちらは最初からブロックする |
| **W3** | `mise.toml` の全エントリで backend を明示する | [0003](0003-version-manager.md) | (a) mise がレジストリのマッピング固定を宣言の外で保証する機構を持つ / (b) backend 明示が原因で fork 先の環境で解決できない事例が出る。**「記述が冗長」は条件にならない** — 一様適用をやめた時点で規約として機能しなくなる |
| **W4** | 履歴全体の秘密スキャンを hook に載せない | [0110](0110-security-operations.md) 2 | 走査時間がコミット数に比例しなくなる (差分走査やキャッシュが入る)。**現在の実測が速いことは条件にならない** — リポジトリの成長で必ず破れる |
| **W5** | `.gitleaks.toml` の `useDefault` 同伴 allowlist を受け入れる | [0110](0110-security-operations.md) 2 | (a) gitleaks が既定 allowlist の部分的な打ち消しを提供する / (b) 除外対象 (lockfile 等) に実際の秘密が入る事例が公表される |
| **W6** | `.trivyignore.yaml` の抑止エントリ | [0110](0110-security-operations.md) 3.4 | 各エントリの `expired_at`、または statement に書かれた条件が消えたとき。**期限切れは自動で報告に戻る**ため、この行は運用の明文化であって追跡対象ではない |
| **W7** | コミット件名の**内容**を規約化しない (空白のみの件名・意味を持たない文字列を機械検査しない。強制するのは prefix / 空でないこと / 句点なしの 3 点のみ) | [0150](0150-git-workflow.md) | commitlint が、**件名の形を正規表現で定義させずに**「空白のみ」を判定できる標準ルールを提供したとき。塞ぐ手段が `parserOpts` の `headerPattern` 自前定義しかなく、それが「日本語であること・長さ・体裁は機械強制しない」という同 ADR の指針と衝突することが、やらない理由そのもの。**「規約外の件名が実際に混入した」ことは条件にならない** |
| **W8** | pnpm のバージョンを `package.json` の `packageManager` フィールド + Corepack で宣言しない | [0003](0003-version-manager.md) | mise 側が `packageManager` を読んで自らのピンと突き合わせる(二重管理が起きない)機構を持ったとき。**「素の pnpm を叩いて事故が起きた」ことは条件にならない** — それは強制手段の不在ではなく実行経路の誤りで、`repo-ops` の該当項が受け持つ |
| **W9** | `make actionlint` に shellcheck 個別の PATH ガードを置かない | [0153](0153-ci-configuration.md) 1 / [0003](0003-version-manager.md) | actionlint と shellcheck の**供給経路が分かれたとき** — 片方が `mise.toml` の管理から外れる、または mise 以外の経路での導入を許容したとき。現状は同一の `[tools]` から同一の activate で PATH に載るため、先行する actionlint のガードが両方を覆っている。**「shellcheck が無い環境で検査範囲が縮んだ」ことは条件にならない** — それは PATH の問題であり、ガードではなく PATH で直す |
| **W10** | composite action (`.github/actions/**`) を actionlint の直接の走査対象に加えない | [0153](0153-ci-configuration.md) 1 | actionlint が action メタデータ (`action.yaml`) を workflow と区別して検査できるようになったとき。現状は composite action を渡すと workflow として解釈され `jobs` / `on` 欠落の syntax-check で必ず落ちる。action 内の `run:` のシェルは、全 action 定義を解析して shellcheck へ流す専用の検査 (`make actions-shellcheck`) が未参照の action も含めて担保するため、actionlint 側に残るのは **action メタデータのスキーマ検査** (`inputs` / `outputs` / `using` の妥当性) だけで、それは workflows 側の `uses:` 解決経由で参照済み action の入力整合として部分的に覆われている。**「composite action の中身が検査されていない」ことは条件にならない** — 検査は actionlint の外に置ける |
| **W11** | `upsert-pr-comment` にマスク対象値を渡して本文から置換する input を持たせない (規約 + `make actions-comment-secret-lint` の機械検査で守る) | [0153](0153-ci-configuration.md) 5 | 検査ログの生成そのものに secret を要するジョブが現れ、かつそのジョブを投稿ジョブから分離できない構造になったとき。または Actions のマスキングが `tee` したファイルのバイトにも及ぶようになったとき (その場合は input ではなく検査ごと不要になる)。**「lint が緑であり続けていること」は条件にならない** — 緑は規約が守られている証拠であって、機構が要らない理由ではない |
| **W12** | 強調の段を 1 つ(`emphasis`)だけ持ち、`strong` を持たない | [0051](0051-styling-system.md) §5 | 太さの 2 段目が**全ての対応環境で描き分けられる**ようになったとき — 実測(macOS / Chromium)では游ゴシックが 400 とそれ以外しか描き分けず、`system-ui` も 500 と 600 が同じになる。和文を OS 同梱の書体へ委ねている限りこれは変わらないため、**戻す前提は本文へ和文 Web フォントを置くこと**で、同梱サンプルの実測で CSS が 25 KB から 158 KB へ戻る。**「見出しをもっと強く見せたい」ことは条件にならない** — 階層は寸法と位置が担う |
| **W18** | 呼び出し側が自前で組み立てたコードフェンスを検査しない | [0153](0153-ci-configuration.md) 5 | `details-summary` を使わず本文へ自前でフェンスを組み立てるワークフローを置いた時点。現状は投稿ジョブの全件がアクション側の折り畳みを通るため、フェンス長の決定はアクション 1 箇所に閉じている。**その記法を持ち込む PR が検査も併せて持ち込むこと**が条件であり、置かれるまで検査を先に作らない (対象 0 件の検査は、守っている対象が無いまま緑を返し続ける) |
| **W13** | worktree をリポジトリ外へ出さない (`.claude/worktrees/` に置き、ツリーを走査する各ツールで個別に除外する) | [repo-ops](../../.claude/skills/repo-ops/SKILL.md) 6 | エージェントのツールが worktree の生成先を設定で受け取るようになったとき。現状は生成先が固定で、リポジトリ外に置く規約を敷いても人手で作った分にしか効かず、両流儀が併存して除外の要否が読めなくなる。**除外箇所が 5 つに増えて煩わしいことは条件にならない** — 煩わしさは同期漏れの検査で減らす話であり、実体の置き場所とは別 |
| **W14** | tag の moving / 不変の別をロックファイル形式に持たせない (コメント tag が bare な major 番号かどうかで判定し、moving の前進には承認を要求しない) | [0153](0153-ci-configuration.md) 3 | (a) bare な major 番号を**不変**の版として運用する上流を採用したとき / (b) `v6.1` のような bare 番号以外の moving tag を採用し、`ACTIONS_PIN_ALLOW_MOVED` の常用が定着したとき — 形からの宣言が上流と恒常的に食い違うなら、種別はキーからの導出ではなく明示保持へ移す。**「判定が素朴」「誤検知でロックファイルが更新されなかった」ことは条件にならない** — 誤検知は停止で済む向きであり、fail-closed が意図した挙動そのものである |
| **W15** | 外部スキル (graphify) を lint / CI / git hook / build のどのゲートにも接続しない | [0110](0110-security-operations.md) 1.1 / [0154](0154-claude-skills-operations.md) | (a) 本リポジトリでの価値が実測で確認され、かつ (b) グラフの鮮度をゲート内で保証する機構が入ったとき。現状のグラフは最後の `update` 時点のスナップショットで、未コミットの変更が映らないため、ゲートに載せると「古いグラフで緑」が成立する。**「導入済みだから」「上流が pre-1.0 を抜けたから」は条件にならない** — ゲートに繋がないことが pre-1.0 を採れる根拠そのものであり、成熟度が上がっても鮮度の問題は消えない |
| **W16** | 外部スキルの導入対象を Claude Code のみとする | [0154](0154-claude-skills-operations.md) | `.codex/` などの器が着地したとき (移植計画 IM-04)。器が無いプラットフォームへ入れても、着地したかを検証する先が無い。**「上流が対応している」「輸入元が入れている」は条件にならない** |
| **W17** | `pipx:graphifyy` に `[sql]` extra を付けない | [0003](0003-version-manager.md) / [0070](0070-backend-role-separation.md) | SQL ソースが追跡対象に入ったとき。表示層に DB を持たない現行のロール定義では通常発生しない。**「輸入元が付けているから」は条件にならない** — extra は依存面積、すなわち供給網上の露出そのものである |
| **W19** | Security グループの検査を、差分が届かない PR では降ろす (許可リストを使うのは依存スキャナだけ) | [0110](0110-security-operations.md) 3.3 / [0153](0153-ci-configuration.md) 2 | **週次スケジュールを外したとき、または Security の job を required check に登録したとき。**この絞りが成立している根拠は「降りた分が週次へ回ること」と「降りても PR が止まらないこと」の 2 つだけで、どちらが消えても書き漏らしが恒久の死角へ変わる。**「絞りのせいで検出が 1 週間遅れた」ことは条件にならない** — 遅れは絞りが意図した挙動そのものである |
| **W20** | 検査が緑のとき PR コメントを新規作成しない (既存コメントの更新は続ける) | [0153](0153-ci-configuration.md) 5 | 緑の実行が**その実行にしか無い情報**を本文で運ぶようになったとき — 現状 PASS のコメントが載せているのは判定だけで、それは check の色が既に述べている。計測値を運ぶもの (`bundle-budget` の route ごとの client JS、`lighthouse` の Core Web Vitals) はこの条件に最も近く、**そちらを戻すなら job ごとに戻す** (`status` は呼び出し側が渡すので、機構は既に job 単位で分かれている)。**「緑の PR にコメントが 1 つも付かないのが寂しい」ことは条件にならない** |
| **W21** | `eslint-plugin-security` の推奨プリセットを当てず、0 件を保てる 9 規則だけを有効にする | [0110](0110-security-operations.md) 3 / [0002](0002-formatter-linter.md) | 落とした 5 規則のいずれかが**形ではなく実体を見るようになったとき** — 例えば `detect-unsafe-regex` が星の高さではなく実際の後戻り計算量で判定するようになれば、`/^\d+(\.\d+)?$/` は鳴らなくなり 0 件を保てる。**「SAST の層が薄い」ことは条件にならない** — ReDoS と path traversal は Opengrep / CodeQL が引き続き担い、そちらは所見を code scanning へ送る層なので 0 件 baseline を要求されない |
| **W22** | SonarQube Cloud を required check に登録しない | [0110](0110-security-operations.md) 3 / [0153](0153-ci-configuration.md) 5 | **原則としてこの決定は動かない**。動かせるのは、この検査が外部アカウントを要さなくなったときだけである。**「このリポジトリでは常に緑だから」は条件にならない** — 登録が壊すのは fork 先であり、しかも壊れ方は「必須チェック待ちで全 PR が止まる」という、コードでは直せない形になる <!-- boilerplate-only:line --> |
| **W23** | Node / JS 特化の SAST (njsscan) を持たない | [0110](0110-security-operations.md) 3 | **`sast` のルール供給が Node / Express 固有のパターンを覆わなくなったとき。** 現状 opengrep が semgrep レジストリの `p/javascript` / `p/typescript` / `p/owasp-top-ten` を当てており、実測で njsscan の所見は 0 件だった。semgrep レジストリを離れる判断をした場合、置き換え先のルール集合が薄ければこの条件は満たされる —— njsscan が同梱するルールはライセンス変更前の semgrep-rules 由来で、レジストリを引かずに Node 向けの面を戻せる。**「層が 1 つ減ったこと」は条件にならない** — 減らしたのは重なっていた層である |
| **W24** | SAST のルールを semgrep レジストリ (`p/*`) から引かない (`opengrep/opengrep-rules` の commit を固定して読む) | [0110](0110-security-operations.md) 3 | (a) レジストリのルールが OSI 承認ライセンスへ戻ったとき / (b) `opengrep/opengrep-rules` が更新を止め、**CodeQL でも補えない面**が実測で見つかったとき。現状ルール数は 563 から 77 へ減っており、鮮度は CodeQL が補っている前提でこの判断が成立している。**「ルールが少ない」「上流の更新が鈍い」ことだけでは条件にならない** — 減ること自体は承知のうえで選んでおり、条件は「減った分がどこにも無い」と実測で言えることである |

| **W25** | i18n 本体(ライブラリ・ロケール解決・翻訳キー体系)を同梱しない | [0121](0121-i18n-strategy.md) | **本体が複数ロケールの文面を持つようになったとき** —— 同梱する画面のいずれかが `[locale]` セグメントか `proxy.ts` のロケール解決を実際に通るようになったときである。設置面の無い seam は腐り、採用時に必ず書き直される。**「fork 先に多言語の要望があること」は条件にならない** — 用途依存の判断は fork 先が持ち、本体が持つのは採用時の座標だけである |
| **W26** | PWA(Web App Manifest / Service Worker / オフラインキャッシュ / A2HS)を同梱しない | [0130](0130-pwa-strategy.md) | **オフラインで成立させたい画面が本体に現れたとき**、または Service Worker の登録と更新が Next.js の既定機構として設定だけで載るようになったとき。**「モバイルで使われること」は条件にならない** — 画面が online 前提で成立している限り、Service Worker は保守対象が増えるだけである |
| **W27** | DnD の seam を v1 で置かない | [0053](0053-ui-component-interaction-seam.md) | **並べ替え・移動が操作の本体になる画面を本体が持つようになったとき**。**「一覧があること」は条件にならない** — 並び順の変更が URL の変更と RSC 再取得で成立している間は、掴んで動かす面が存在しない |
| **W28** | 決済 SDK の mount seam を v1 でコードとして置かない | [0076](0076-payment-ui-seam.md) | **決済画面を本体が同梱するようになったとき**。PCI 境界(生カード情報をフロントに持たせない)は採否によらず不変なので、撤回の対象は mount seam の実体化だけである。**「EC のサンプルを持っていること」は条件にならない** — 現行の支払いは擬似決済で、PSP の SDK を載せる面が無い |
| **W29** | プロダクト分析の発火 IF / no-op sink を v1 で置かない | [0082](0082-client-observability.md) | **本体がタグへ値を渡すようになったとき**。そこで初めて「直書き vs 抽象を通す」が実在する問題になる([0082](0082-client-observability.md) §3)。**「ゲートの先にタグマネージャが在ること」は条件にならない** — 容器を読み込む口を同梱しても、本体には発火する呼び出しが 1 つも無い |
| **W30** | WebSocket / SSE の購読 seam を v1 でコードとして置かない | [0074](0074-runtime-communication-seam.md) | **サーバから押し出される更新を必要とする画面が本体に現れたとき**。**「バックエンドが SSE の口を持ったこと」は条件にならない** — 設置面は供給側の能力ではなく、消費する画面の実在で決まる |
| **W31** | 動的 feature flag の供給 seam を v1 でコードとして置かない | [0078](0078-dynamic-feature-flag-seam.md) | **再デプロイなしで切り替えたい対象が本体に実際に現れたとき**。再デプロイ単位で固定するフラグは [0030](0030-environment-variable-management.md) の env / 目的別 config が既に受け持つため、**その種のフラグが増えたことは条件にならない** — 凍結が正しい振る舞いであるものは、動的 flag の設置面ではない |
| **W32** | グローバルキーボードショートカットの実行機構を置かない | [0053](0053-ui-component-interaction-seam.md) §5 | **入力欄フォーカス時の誤発火を含む競合解決を、プラットフォームが標準機構として提供するようになったとき**。現状は登録機構を自前で持つ以外に手が無く、それが散在実装の事故を招くことが、やらない理由そのものである。**「操作を速くしたい」ことは条件にならない** — 表示側の `KeyboardShortcut` / `Kbd` は鍵の見せ方であって実行機構ではなく、この決定の対象外である |
| **W33** | Prettier を併用しない(フォーマッタは biome 単独) | [0002](0002-formatter-linter.md) | **biome の整形が、本リポジトリで実際に扱う言語のいずれかを覆わなくなったとき** — 対応言語が減る、または新たに扱う言語が biome の対象外であるとき。**「Prettier の方が plugin が豊富であること」は条件にならない** — 2 つのフォーマッタが同じファイルを触った時点で、どちらが正かを決める仕事が恒久的に増える |
| **W34** | Renovate を併用しない(依存更新は Dependabot に一本化) | [0110](0110-security-operations.md) 1 | **Dependabot が cooldown を落としたとき**、または本リポジトリが扱う ecosystem を Dependabot が覆わなくなったとき。cooldown は 0110 が敷いた検疫の実装そのもので、これを持たない更新機構への乗り換えは検疫の撤回を意味する。**「設定の自由度が高いこと」は条件にならない** |
| **W35** | GTM(タグマネージャ)を同梱しない | [0082](0082-client-observability.md) / [0131](0131-cookie-consent.md) | **本体がタグを実際に配信するようになったとき**。現状は同意ゲートの先に繋ぐものが無く、置いても「何も配信しないタグマネージャ」だけが残る。**「GTM がデファクトであること」は条件にならない** — デファクトかどうかは、配信するタグが実在するかとは無関係である |
| **W36** | CMP・IAB TCF 相当の同意管理を同梱しない(軽量機構のみ持つ) | [0131](0131-cookie-consent.md) | **本体が対象法域を 1 つに定めるようになったとき**。同意管理は法域とベンダー選定に強く依存し、本体で一律に決めると fork 先の要件を狭める。**「GDPR 対応が要ること」は条件にならない** — gate 述語の消費側は変えずに差し替えられる形が既にあり、差し替えるかは fork 先の判断である |
| **W37** | 観測性 / RUM の vendor SDK(Sentry / Datadog 等)を同梱しない | [0081](0081-observability-logging.md) 6 | **OTLP で表現できない観測面が実測で見つかったとき** — そのベンダーの SDK を通してしか取れない情報が、運用上どうしても要ると言えるとき。エラー通知・アラートは fork が向け先に選ぶ OTLP 互換バックエンド側で足りる。**「導入が速いこと」は条件にならない** — 速さは vendor 直参照の恒久コストと釣り合わない |
| **W38** | `nuqs` 等の searchParams 同期ヘルパを採らない | [0060](0060-state-management.md) | **URL と client 状態を同期させる層が無いと成立しない画面が現れたとき** — 一覧のフィルタ / sort / ページングが「URL 変更 → RSC 再取得」で成立しなくなったとき。**「フィルタの数が増えたこと」は条件にならない** — 数ではなく、同期層なしで成立するかどうかで決まる |
| **W39** | ファジングを持たない(OpenSSF Scorecard の `Fuzzing` は 0 のまま置く) | [0090](0090-testing-strategy.md) / [0110](0110-security-operations.md) 3 | **本体が、外から来たバイト列を自前で解く層を持つようになったとき**。いまの表現層が解くのは 契約から生成した型を通った値で、パーサそのものは持たない —— ファズする対象が無い。**「Scorecard の点が上がること」は条件にならない** — 点は対象の有無を測っていない |
| **W40** | OpenSSF Best Practices バッジを取得しない(`CII-Best-Practices` は 0 のまま置く) | [0142](0142-license.md) | **本リポジトリが、fork 元ではなく成果物そのものとして公開運用へ移るとき**。バッジは*このリポジトリの名前*に紐づく登録で、fork 先へは引き継がれない。boilerplate が取っても fork 先の姿勢は 1 ミリも変わらない。**「Scorecard の点が上がること」は条件にならない** |
| **W41** | Scorecard に PAT を渡さない(`Branch-Protection` の点は頭打ちのまま置く) | [0110](0110-security-operations.md) 3 | **Scorecard が既定の `GITHUB_TOKEN` で ruleset を読み切れるようになったとき**。満点に要るのは classic branch protection を読める長命の PAT で、点を上げるために 常設の資格情報を 1 つ増やすのは、この検査が測ろうとしている姿勢そのものに反する。保護の実体は [`.github/settings/branch-protection.json`](../../.github/settings/branch-protection.json) が宣言しており、**点が低いことと保護が無いことは別**である。**「点が赤いこと」は条件にならない** |
| **W42** | 回線の有無を読む hook(`useConnectivity`)を `capabilities` へ置かない | [0022](0022-capabilities-kernel.md) / [0020](0020-adopted-architecture.md) 設計原則 6 | **長寿命接続を持つ画面が本体に現れたとき** —— そこで初めて「回線が無い」と「接続が切れた」を区別して見せる必要が生まれる。**「送信の前にオフラインを知らせたい」ことは条件にならない** —— `navigator.onLine` は回線があってインターネットへ出られない状態を `true` と答えるため送信可否の判断に使えず、送れなかったことを伝える経路は [0063](0063-mutation-result-notification.md) が既に持っている |
| **W43** | Web Worker のオフロード seam を置かない | [0022](0022-capabilities-kernel.md) | **client 側に、主スレッドを塞ぐ処理が実際に現れたとき**。現状は `canvas` / `FileReader` / client 側パースのいずれも使っておらず、画像も Server Action 経由で送っている。**「重い画面がある」ことは条件にならない** —— 重さの出どころが取得か描画なら、Worker は何も速くしない |
| **W44** | 差分からパスを見る宣言(`scripts/deferred-checks/recommend.ts` の `CHECKS` と、待たずに回すと決める `scripts/e2e/trigger.ts` / `scripts/lighthouse/trigger.ts`)が実態から剥がれたことを検出するゲートを置かない | [0153](0153-ci-configuration.md) 2 | **宣言が、ADR かフレームワークの規約で位置の決まっていないパスを持つようになったとき。** 現在の全 10 規則は他所が位置を固定している —— story と `mocks/` の置き場は [0027](0027-directory-structure.md)、token の SSOT は [0051](0051-styling-system.md) 1、`.storybook/` の差し替え宣言は [0054](0054-ui-catalog-storybook.md)、`proxy.ts` は [0043](0043-middleware-policy.md)、`fonts.ts` は [0045](0045-fonts-and-images.md)、`e2e/` は Playwright の `testDir`、`layout.tsx` と `next.config.ts` は Next.js 自身。fork がそこを動かすことは規約を捨てることを意味するので、宣言だけが黙って古くなる形にならない。もう一方は **`deferred-checks` が required check かゲートに変わったとき** —— 現状は死んだ規則の代償がコメント 1 件の欠落だが、ゲートになれば「検査していないのに緑」へ化ける。**「fork で規則が死んだ事例が出た」「サンプル破棄で対象が減った」ことは条件にならない** —— どちらも状態であり、実測では破棄後も全 10 規則が対象を持つ。**待たずに回す側(`trigger.ts`)は代償が 1 段重い** —— 死んだ規則の代償はコメントの欠落ではなく、検査が回らないまま merge されることである。それでも同じ条件で足りるのは、挙げているパスの位置を Next.js と Playwright が固定しているためで、fork がそこを動かすなら規約ごと捨てることになる |
| **W45** | 観測ツールを MCP サーバとしてエージェントへ登録しない (CLI から呼ぶ) | [0156](0156-browser-observation-tooling.md) | **CLI に生成されない道具でしか答えられない問いが実測で現れたとき** — 待機と一括入力は CLI へ生成されないが、待機が要る観測は別レーンが担うため現状は成立している。登録する場合も置き場は利用者のホーム側で、リポジトリには残さない。**「MCP のほうが呼びやすい」ことは条件にならない** — 文脈の常時消費と、fork へエージェント構成が降ることが対価である |
| **W46** | 実ブラウザのログイン済みプロファイルへ接続しない | [0156](0156-browser-observation-tooling.md) | **観測対象が手元の開発サーバの外へ出たとき** — 現状の認証は開発時だけ有効なセッション発行の口で足りており、実ブラウザの権限を要する観測が無い。**「そのほうが手数が少ない」ことは条件にならない** — 接続した時点でそのプロファイルの全ウィンドウが観測側へ開く |
| **W47** | npm パッケージを `mise` の `npm:` backend で取らない (`pnpm` を経由する) | [0156](0156-browser-observation-tooling.md) / [0001](0001-package-manager.md) | **`pnpm` が冷却期間・lockfile・公開日時を返さないレジストリの拒否を提供しなくなったとき。** 取得にかかる負荷は両者で変わらず、選んでいるのは取得の安全性である。**「mise に寄せると SSOT が 1 つになる」ことは条件にならない** — バイナリと npm パッケージでは配布経路も検疫の手段も異なる |
| **W48** | 軽い画面を TBT で締めた行を `performance-budget.yaml` の `screens` に置かない(締める側は LCP だけで書く) | [0101](0101-performance-budget.md) 3 | **割った台ごとに測っている床(`floor`)が、報告だけでなく判定の補正に使われるようになったとき。** TBT は機械の速さがそのまま乗数として効き、器しか持たない画面ほどそれを素直に写すため、いま細い線を引くと遅い実行のたびに床が鳴り、床を見て判別するという役目そのものを失う。補正が入れば、締めた線は機械の速さから切り離される。**「軽い画面の退行を捕まえたい」ことは条件にならない** —— その目的は LCP を締める行が既に果たしており、TBT で二重に引く必要は無い |
| **W49** | 弧の反字体の揺れ(実測 ±3)を story の側で潰さない | [0091](0091-test-verification-methods.md) | **同じ入力の 2 回の撮影がバイトまで一致するようになったとき** —— ラスタライズが並列度に依存しなくなるか、比較が画素の色差ではなく形で判定できるようになったとき。実測では滑走子の円弧やバッジの丸みが 15 × 8 画素以内・最大の差 2 で動き、比較の下限(`threshold: 0.02`)の内側に収まる。**潰す先は弧そのもの**なので、story 側に打つ手が無いことがやらない理由である。守りは撮る側にあり、撮り直しを報告された集合に限ることで揺れが基準へ焼き付くのを止めている。**「撮り直しの差分に説明の付かない行が出た」ことは条件にならない** —— それは全数の撮り直しが起きたということで、そちらの経路を塞ぐ話である |
| **W50** | `AppShell` の header の高さを測らず、定数として押し付ける | [0026](0026-layout-shell-mount.md) | **header の高さが中身で変わる形になったとき** —— 導線が折り返す、行が可変になる等で「決められる量」でなくなったとき。それまでは押し付けている限り書き写した値と描画がずれず、測る形は SSR と初回描画のあいだ 0 を配るため、知り得る量を知るまで間違っている仕組みに置き換えることになる。**「同じ画面で帯の高さは測っているのに不揃いだ」ことは条件にならない** —— 帯は中身の量で折り返すので測る以外に知る方法が無く、種類の違う量である |
| **W51** | 版の宣言の同期検査(`sync-versions-check`)を持たない | [0003](0003-version-manager.md) / [0011](0011-no-docker.md) | **版の宣言が `mise.toml` の外にもう 1 箇所現れたとき。** 上流(go-boilerplate)がこれを持つのは Dockerfile とその README が `mise.toml` の pin を書き写しているためで、本リポジトリは Docker を持たず宣言が 1 箇所しか無い。workflow が版を名乗る唯一の面は `make actions-mise-pin-lint` が既に見ている。**「上流が持っているから」は条件にならない** —— 同期の検査は、同期すべき 2 つ目が在って初めて意味を持つ |
| **W52** | 生成物を bot が commit する仕組み(`auto-generate-docs`)を持たない。生成物の陳腐化は drift 検査で赤くする | [0072](0072-api-type-generation.md) / [0141](0141-portal-operations.md) | **生成物が、人の手で追随できない量や頻度になったとき。** 上流のそれは DB を立てて schema から docs を作り、`contents: write` で自動 PR を開く形で、本リポジトリの生成物(OpenAPI 由来の型・token・portal)はいずれも `gen-drift` / `tokens-drift` / `shadcn-drift` が**落とす**側で守っている。書き込む権限を持つ workflow を増やさずに済むこと自体が、この形を選ぶ理由でもある。**「生成物が増えたこと」は条件にならない** —— 増えても赤くして人が回せる限り、drift 検査の側で足りる |

新しく「やらない」を決めたら、**その場でここに撤回条件を書く**。条件を書けない「やらない」は、判断ではなく先送りである。

---

## go-boilerplate Claude 資産 移植バックログ

隣接する `go-boilerplate` リポジトリの `.claude/` 資産(スキル / エージェント)のうち、本リポジトリの ADR 設計思想に照らして移植価値があるものの追跡。**実装ブロッカー(未確定 ADR)が外れたタイミングで着手する移植作業**を、ブロック元の枠 ID に紐づける。`.claude/` は [AGENTS.md](../../AGENTS.md) の保護対象であり、移植の実施はその都度ユーザ指示のもとで行う(本節は計画の記録)。

本節は**枠 ID との紐づけと追跡ステータスの SSOT**。個々の移植作業の定義(輸入元 / 翻案メモ / 完了条件 / 依存)は [go-boilerplate 機構 輸入作業計画](../plan/go-boilerplate-import-plan.md) が持つ。

対象スナップショット(2026-07-28): `go-boilerplate` `.claude/`(スキル 35 / エージェント 19 / 共有スペック 5)、`.codex/`(エージェント 19 / スキル 34)。以下の分類は **go 側の資産名**で列挙し、35 スキル / 19 エージェントを漏れなく網羅する。

### 移植済 / 対象外

- **移植済(既存)**(スキル 10 / エージェント 2): canonicalize-doc / commit / impl-review / new-env / readme-review / release-notes / submit-pr / sync-readme / tool-map / tools-upgrade、agent: adversarial-reviewer / review-verifier
- **移植済(A: 技術非依存)**(スキル 3 / エージェント 4): full-verify(+prompts+run.sh)/ full-apply / manage-skill(上乗せ規約を [0140](0140-documentation-operations.md) の対訳ペアと [0154](0154-claude-skills-operations.md) / [0155](0155-claude-skills-development.md) の配置・命名規約へ差し替え)、agent: arch-verifier / impl-verifier / doc-reviewer / comment-reviewer(godoc→TSDoc/JSDoc、正を AGENTS.md+一般原則へ)
- **移植済(B: 変換)**(スキル 7): node-upgrade(← go-upgrade。mise.toml SSOT のみ伝播)、repo-ops(器のみ。Docker/sqlc 項目は ADR 0011 で不適用)、actions-pin(GB-6。Go 実装を TypeScript へ書き換え。`supply-chain-triage` 未移植のため triage への連鎖は「証拠を添えてユーザへ委ねる」に置換)、test-review(GB-5。Go の規約読み取りを [0090](0090-testing-strategy.md) / [0091](0091-test-verification-methods.md) と層 README の `test-requirement` の実行時読込へ差し替え)、scaffold-test(GB-5。ケースを対象の分岐から導き、対象は read-only。検証不能な分岐は skip せず切り出しの提案として返す)、scaffold-integration-test(GB-5。Echo + httptest を契約生成 MSW ハンドラへ翻案し、HTTP 境界のみへ限定)、portal-manifest-sync(D2。pair_drift preflight を落とし、N1 の除外先を godoc から Storybook + TSDoc へ、drift の機械検出を `portal:guides` / `portal:docs` の読み取りへ差し替え。判定基準は `readme-review` が SSOT)
- **対象外(D)**(スキル 2): `images-pin`([0011](0011-no-docker.md) no-docker)/ `scaffold-infra-db`(表示層に DB を持たない — [0070](0070-backend-role-separation.md))
- **本リポジトリ固有**: adr-scan(go 側に現存しない。走査を nextjs 化・枠 ID 体系へ分類 / PROVISIONAL)。上記の資産数には数えない
- **実行可能条件つき**: `new-env` は A7([0030](0030-environment-variable-management.md))の `src/config/` 構造へ再設計済。`src/config/` が着地したため実行可能
- **追随済**: `impl-review` は移植後に go 側 `impl-review` へ入った 4 機能(`test-gap` レンズ / `comment-reviewer` のライフサイクル組込 + 自動修正 / PR インラインコメント投稿 / モデル選択)へ追随済。`test-gap` のテストランナー有無ゲートは Vitest 導入により通過する
- **翻案済(`impl-review` / `adversarial-reviewer`)**: Step 1 の検出対象は [0027](0027-directory-structure.md) の物理レイアウト + [0021](0021-frontend-responsibility.md) の依存マトリクス(11 カーネル + 起動 / ビルド境界エントリ)、`architecture` レンズはマトリクス違反、`runtime-gap` レンズは RSC / Client 境界・生成成果物波及・`adapters` 境界挙動・キャッシュ再検証・`proxy.ts` matcher・CSP・Provider マウントへ差し替え済。Step 4 は **build 検証(常時)+ リクエスト検証(リクエスト時 seam に触れた時のみ)** の 2 段へ翻案し、バックエンド不在で塞がる経路は「到達不能」と明記させる。`verify-spec` / `scaffold-endpoint` への参照は削除(前者は GB-3 が採否未定、後者は GB-4 が翻案コスト最大で実体化未定)、網羅的レイヤ監査(GB-1)への言及のみ「本リポジトリに未実装」と明示した前方参照として残す

### 未着手(ADR 決定待ちなし)

ブロック元の枠がすべて Accepted で、**ADR の決定待ちによる停止は無い**。GB-6 が着地したため、`supply-chain-triage` を塞いでいた依存も外れている。残る着手順序は `supply-chain-triage` → `dep-vuln-upgrade` の資産間依存だけ。

| 資産 | 種別 | 依存 | 内容要旨 |
| --- | --- | --- | --- |
| `sync-ai` | スキル | — | `.claude/` ↔ `.codex/` の双方向同期(handoff スクリプト同梱) |
| `supply-chain-triage` | スキル | — | 検疫に掛かったアーティファクトを直接証拠でスコアリングする report-only スキル。移植までの間、`actions-pin` はステップバック先が無い事例を証拠付きでユーザへ提示して止まる |
| `dep-vuln-upgrade` | スキル | `supply-chain-triage` | CVE / GHSA を名指しした単発の依存更新 |

`.codex/`(エージェント 19 / スキル 34)は Codex 向けの並行資産で、上記の資産数には数えない。`.claude/` の完全なミラーではなく、現時点で `supply-chain-triage` が欠落し `arch-auditor-infra` の名が `arch-auditor-infrastructure` に振れている。基盤(`config.toml` / README)整備と全数ミラーは `sync-ai` と同時期に行う。

### 保留(C): ADR 決定待ちの移植計画

Go 側の本丸は **spec 駆動 scaffold + 層別監査体系**。今移植すると AGENTS.md「保留領域に独自の規約・パターンを持ち込まない」に抵触するため、該当枠が **Accepted** になってから着手する。

| グループ | 資産 | ブロック元 | 着手トリガー | 翻案メモ(流用可能な骨格) |
| --- | --- | --- | --- | --- |
| GB-1 層別アーキ監査 | `arch-check` + `arch-auditor-{domain,usecase,controller,infra,pkg}` | A1 / A3 / A5 | A3 Accepted + 層別 README が `src/**` に整備 | 層マッピングを差し替えるのみ。並列 fan-out + 「自層 README を正として実行時読込」構造は流用可。full-verify Pass1 との分担を明記 |
| GB-2 層別ドリフト検出 | `back-prop` + `drift-detector-{domain,usecase,controller,infra,pkg}` | A3 / A5 | GB-1 と同時期 | 検出カテゴリ A/B/C と read-only 原則は流用可。`sync-readme`(構造ドリフト)との分担を明記 |
| GB-3 spec 生成・検証 | `new-spec` / `new-spec-{domain,usecase}`、`verify-spec` + `spec-validator-{domain,usecase}`、`.claude/scaffold-spec/*`(5) | A1 / A3 | **採用**(v1 計画 P5-18)。**How は決着済み** —— 生成 scaffold は持たず、spec 先行も強制しない(翻案メモ) | **spec の置き場と 2 層構造は P5-5 で確定済み**(`docs/spec/route/**`。機能要件 / 画面要件の 2 層で、go の domain / usecase とは分け方が異なる)。**生成 scaffold は持たない。** spec は判断の散文であり機械可読な構造を持たない —— 生成器の入力にするには構造化データへ寄せることになり、spec の中心にある「やらない理由」が落ちる。加えて spec が書くのは**観測可能な契約であって機構ではない**ため、骨格を spec から導けない。`pnpm gen`(P4-6)の生成入力は `architecture.ts` + 層 README の 1 本に据え置く —— spec を第 2 の入力に足すと SSOT が二重化する。**spec は生成入力ではなく `new-feature` スキル(P7-3)の読み込み入力として扱う**。**輸入資産**: `new-spec` / `new-spec-{domain,usecase}` / `.claude/scaffold-spec/*` は生成 scaffold の資産のため**破棄**。`verify-spec` + `spec-validator-{domain,usecase}`(spec と実装の突合)は生成と独立なので**別枠で保留**する。**spec 先行は強制しない** —— [`playbook`](../playbook.md) の画面実装の順序が仕様書を工程 5（レビューで見た目が確定した後）に置いており、先に固めると見た目が変わるたびに書き直すことになる。**未確定は無い** |
| GB-4 onion scaffold | `scaffold-endpoint` / `scaffold-domain` / `scaffold-usecase` / `scaffold-controller` | A1 / A2 / A3 / A5(+B3 / B4) | A1/A3/A5 + B3(BFF/API)+ B4(型生成)確定後 | Go の onion + sqlc/OpenAPI 前提はほぼ載らない(表示層に DB 無し)。流用は chain 構造と「gen 由来マッピングを name-match 導出 → 不能なら halt/hand-off」の骨格のみ。**翻案コスト最大** |
| GB-5 テスト scaffold/review | **移植済(3 資産すべて)** — `scaffold-test` / `scaffold-integration-test` / `test-review` | B8 | 完了(P4-0) | 「テスト観点を README から実行時導出」+ 2 段レビュー構造は流用可。`test-review` は既移植ワーカーを再利用。full-apply/node-upgrade/repo-ops の `pnpm test` 条件分岐も併せて見直す |
| GB-7 型設計レビュー | agent: `type-design-reviewer` | A3 | A3 Accepted + `src/model/` の型設計規約(層別 README + `docs/rules.md`)確定 | 4 軸ルーブリックは言語非依存。Go の非公開フィールド + getter / `New()` 不変条件検査を TypeScript の型表現へ読み替えるのみ。`arch-auditor` 系の二値判定では拾えない「規約は満たすが弱い型」を程度で拾う |

**分類合計**: スキル = 移植済 17 + 対象外 2 + 未着手 4 + 保留(C) 12 = **35**。エージェント = 移植済 6 + 保留(C) 13 = **19**。

**推奨着手順序**(BACKLOG 依存順): A1 決定 → GB-4 翻案 / A3・A5 決定(層別 README 整備)→ GB-1・GB-2・GB-7 / B8 決定 → GB-5。各グループ着手時は該当枠が Accepted であることと Instruction Priority(ADR > BACKLOG > agent config)を再確認する。
