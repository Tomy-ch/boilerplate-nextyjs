# 直接依存の目録

`package.json` の `dependencies` / `devDependencies` に在る直接依存を、**それぞれが担う単一の
責務**で束ねた生きた目録である。ADR とは違い、この一覧は `package.json` が動くたびに書き換わる
ことを前提にした参照であって、不変の記録ではない。

- **依存を採るときの判断基準**（単一責務 × 単一 upstream / 二次判定 / exact pin / 更新サイクル）は
  決定であり、[0004](../adr/0004-library-management.md) が持つ
- **2 つの上流のあいだに立つ bridge / instrumentation** は、その基準の境界のある例外として
  [0004](../adr/0004-library-management.md) の例外パスを通す。本書では節を分けて載せる
- 個々の領域で **なぜこのライブラリか** は、その領域の ADR が持つ。表の「担うこと」にある
  ADR 番号がその入口である

> この目録は `package.json` と同期を保つ。**版は書かない** —— 書いた瞬間にスナップショットに
> なり、正は常に `package.json` である。読むのは責務の束ね方と、どの ADR がその領域を持つかで
> ある。

## 濃淡 —— どこまで深く統合しているか

ライブラリは「入っているかどうか」ではなく、**本体にどこまで深く組み込まれているか**で読む。
段は 3 つである。

| 段 | 意味 |
| --- | --- |
| **Full** | 常用する。深く統合され、参照実装まで本体に同梱する |
| **Medium** | 統合はするが、既定では控えめに置く。必要になった側が使い始める |
| **Thin** | seam と配線と最小のデモだけを持つ。実際に使うかどうかは用途で決まる |

**段はパッケージではなく機能に付く**。観測性は 16 のパッケージで 1 つの段を持ち、リッチテキストは
20 で 1 つの段を持つ。逆に dev 側の道具には段が無い —— 走るか走らないかしかない。だから本書は
段を列に持たない。埋まらない列は嘘になる。各機能の段は、その領域の ADR が seam の形として
述べている。

## 実行時依存（`dependencies`）

| 領域 | パッケージ | 担うこと |
| --- | --- | --- |
| ランタイム基盤 | `next` | フレームワーク本体。App Router / build / server runtime（[0040](../adr/0040-routing-rendering-strategy.md)） |
| ランタイム基盤 | `react` / `react-dom` | UI ランタイムと DOM / server 描画（[0042](../adr/0042-react19-rendering-api.md)） |
| ランタイム基盤 | `server-only` | server 専用 module が client の束へ入ったら build を落とす番人。`*.server.ts` の先頭 import に置き、有無は `scripts/lib/server-only.ts` が検査する |
| 状態・フォーム・検証 | `zod` | 境界での parse とスキーマ（[0029](../adr/0029-type-design-discipline.md) / [0030](../adr/0030-environment-variable-management.md) / [0062](../adr/0062-form-input-validation.md)） |
| 状態・フォーム・検証 | `react-hook-form` | フォーム状態（[0060](../adr/0060-state-management.md) / [0062](../adr/0062-form-input-validation.md)） |
| 状態・フォーム・検証 | `zustand` | client 状態の store（[0023](../adr/0023-stores-kernel.md) / [0060](../adr/0060-state-management.md)） |
| スタイリング | `tailwind-merge` | Tailwind class の競合解決。`cn()` の中身（[0050](../adr/0050-styling-strategy.md)） |
| スタイリング | `clsx` | 条件付きの class 連結。`cn()` の中身 |
| スタイリング | `class-variance-authority` | variant から class への写像（[0050](../adr/0050-styling-strategy.md) / [0052](../adr/0052-ui-component-policy.md)） |
| UI 部品の下地 | `radix-ui` | headless な UI primitive。shadcn/ui の copy-in が要求する下地（[0052](../adr/0052-ui-component-policy.md)） |
| UI 部品の下地 | `cmdk` | command palette の下地 |
| UI 部品の下地 | `vaul` | drawer の下地 |
| UI 部品の下地 | `input-otp` | 区切り入力の下地 |
| UI 部品の下地 | `react-resizable-panels` | 分割 pane の下地 |
| UI 部品の下地 | `react-day-picker` | calendar の下地 |
| UI 部品の下地 | `recharts` | chart の下地 |
| UI 部品の下地 | `@tabler/icons-react` | アイコンの供給元。`src/components/icon.ts` に閉じる（[0052](../adr/0052-ui-component-policy.md)） |
| リッチテキスト | `@tiptap/core` / `@tiptap/react` / `@tiptap/pm` | エディタ本体・React binding・同梱 ProseMirror（[0052](../adr/0052-ui-component-policy.md) / [0053](../adr/0053-ui-component-interaction-seam.md)） |
| リッチテキスト | `@tiptap/extensions` / `@tiptap/extension-*`（13 本） | 使う書式を 1 つずつ有効化する extension。document / paragraph / text / heading / bold / italic / strike / code / link / list / blockquote / hard-break / horizontal-rule |
| リッチテキスト | `hast-util-from-html` | HTML を hast の木にするパーサ（[0053](../adr/0053-ui-component-interaction-seam.md)） |
| リッチテキスト | `hast-util-sanitize` | hast の木を allowlist で検査する |
| リッチテキスト | `hast-util-to-jsx-runtime` | 検査済みの木から直接 React 要素を組む。HTML 文字列を経由しない描画 |
| 日付 | `date-fns` | 日付演算（[0120](../adr/0120-locale-aware-formatting.md)）。書式化は `Intl` が担う |
| 設定 | `dotenv` | `env/.env.*` の読み込み（[0030](../adr/0030-environment-variable-management.md)） |
| 認証 seam | `jose` | session トークンの署名と検証（[0079](../adr/0079-auth-frontend-seam.md)） |
| 観測性（server） | `@opentelemetry/api` / `@opentelemetry/api-logs` | trace / metric / log の API（[0081](../adr/0081-observability-logging.md)） |
| 観測性（server） | `@opentelemetry/sdk-node` | Node SDK。exporter と instrumentation の組み立て |
| 観測性（server） | `@opentelemetry/sdk-logs` / `@opentelemetry/sdk-metrics` | log / metric の SDK |
| 観測性（server） | `@opentelemetry/exporter-{trace,metrics,logs}-otlp-http` | OTLP/HTTP の exporter |
| 観測性（server） | `@opentelemetry/core` / `@opentelemetry/resources` | context 伝播と Resource 属性の共通部品 |
| 観測性（server） | `@opentelemetry/semantic-conventions` | 属性名の標準定義 |
| 観測性（server） | `pino` | 構造化ログ（[0081](../adr/0081-observability-logging.md)） |
| 観測性（browser） | `@opentelemetry/sdk-trace-web` | ブラウザ側の tracer（[0082](../adr/0082-client-observability.md)） |
| 観測性（browser） | `@opentelemetry/otlp-transformer` | ブラウザの span を OTLP の形へ変換し、BFF 中継へ渡す |
| サードパーティ script | `@next/third-parties` | タグマネージャの埋め込み。同意ゲートの裏に置く（[0131](../adr/0131-cookie-consent.md) / [0082](../adr/0082-client-observability.md)） |

観測性の 2 グループは、安定版（`2.x`）と experimental（`0.x`）の 2 本の版の系列にまたがるが、
いずれも **単一** の上流（OpenTelemetry 自身）であり、2 つではない。例外扱いはしない。

## 開発時依存（`devDependencies`）

| 領域 | パッケージ | 担うこと |
| --- | --- | --- |
| 言語・型 | `typescript` | 型検査（`pnpm typecheck`）と、`scripts/` が構文木を読むための compiler API |
| 言語・型 | `@types/node` / `@types/react` / `@types/react-dom` / `@types/hast` | 型定義 |
| 言語・型 | `tsx` | `scripts/**` を TypeScript のまま実行する（[0159](../adr/0159-script-structure.md)） |
| 言語・型 | `jiti` | ESLint が `eslint.config.ts` を読むための loader |
| lint / format | `@biomejs/biome` | formatter と linter の本体（[0002](../adr/0002-formatter-linter.md)） |
| lint / format | `eslint` | biome が表現できない検査だけを載せる（[0002](../adr/0002-formatter-linter.md)） |
| lint / format | `eslint-plugin-boundaries` | 層境界の import 検査（[0021](../adr/0021-frontend-responsibility.md)） |
| lint / format | `eslint-plugin-react-hooks` | hooks の規則（render 中の ref 書き込み・effect 内の setState など） |
| lint / format | `eslint-plugin-security` | 編集時 SAST（[0110](../adr/0110-security-operations.md)） |
| lint / format | `knip` | 未使用の file / export / dependency の検出 |
| lint / format | `markdownlint-cli2` | Markdown の lint（[0153](../adr/0153-ci-configuration.md)） |
| スタイリングのビルド | `tailwindcss` | Tailwind v4 本体（[0050](../adr/0050-styling-strategy.md)） |
| スタイリングのビルド | `postcss` | CSS 変換のパイプライン。Next の CSS 処理が要求する |
| React Compiler | `babel-plugin-react-compiler` | `reactCompiler`（annotation mode）の実体（[0042](../adr/0042-react19-rendering-api.md)） |
| UI 部品の取り込み | `shadcn` | shadcn/ui の copy-in CLI（`pnpm add:ui`。[0052](../adr/0052-ui-component-policy.md)） |
| 単体テスト | `vitest` | テストランナー（[0090](../adr/0090-testing-strategy.md)） |
| 単体テスト | `vite` | Vitest と Storybook の基盤 bundler。portal の preview |
| 単体テスト | `@vitejs/plugin-react` | Vitest で tsx を変換する |
| 単体テスト | `jsdom` | DOM を要するテストの環境 |
| 単体テスト | `@testing-library/react` / `@testing-library/dom` | 描画とクエリ |
| 単体テスト | `@testing-library/user-event` | 利用者操作の再現 |
| 単体テスト | `@testing-library/jest-dom` | DOM 向けの matcher |
| モック / 契約 | `msw` | HTTP mock。test / Storybook / dev で共有（[0090](../adr/0090-testing-strategy.md)） |
| モック / 契約 | `orval` | OpenAPI から型・client・zod・mock を生成する（[0072](../adr/0072-api-type-generation.md)） |
| モック / 契約 | `@faker-js/faker` | 生成 mock が返す値の供給。seed を固定して安定させる |
| a11y 検査 | `axe-core` | a11y ルールエンジン（[0091](../adr/0091-test-verification-methods.md) / [0100](../adr/0100-accessibility-target.md)） |
| UI カタログ | `storybook` / `@storybook/addon-docs` | Storybook 本体と docs（[0054](../adr/0054-ui-catalog-storybook.md)） |
| E2E / VRT | `@playwright/test` | ブラウザ駆動の journey と画面比較（[0090](../adr/0090-testing-strategy.md) / [0091](../adr/0091-test-verification-methods.md)） |
| ブラウザ実測 | `lighthouse` | lab 計測。子プロセスとして起動する（[0101](../adr/0101-performance-budget.md) / [0156](../adr/0156-browser-observation-tooling.md)） |
| ブラウザ実測 | `chrome-devtools-mcp` | 「掘る」レーンの CLI（[0156](../adr/0156-browser-observation-tooling.md)） |
| git hooks / commit | `lefthook` | pre-commit / pre-push（[0151](../adr/0151-git-hooks.md)） |
| git hooks / commit | `@commitlint/cli` / `@commitlint/types` | commit subject の規約検査（[0150](../adr/0150-git-workflow.md)） |
| スクリプトの読み書き | `yaml` | YAML 設定（manifest / budget / portal）の読み書き |
| スクリプトの読み書き | `smol-toml` | TOML の抑止ファイルの読み込み（`scripts/suppression-expiry`。[0157](../adr/0157-inspection-declaration-discipline.md)） |
| スクリプトの読み書き | `linkedom` | mermaid の構文検査に要る DOM（`scripts/mermaid-lint`） |
| スクリプトの読み書き | `mermaid` | Markdown 内の mermaid 図の構文検査 |

## bridge / instrumentation の例外

以下は **独立にバージョニングされる 2 つの上流** のあいだに立つため「単一責務 × 単一 upstream」を
構造的に満たせず、[0004](../adr/0004-library-management.md) の例外パスで受容している。upstream の
数え方（`react` / `next` はランタイム基盤であり数えない）も同 ADR に従う。

実行時の bridge は本番の束に乗るため、例外の敷居が高い。

| パッケージ | 結合 | 担うこと |
| --- | --- | --- |
| `@hookform/resolvers` | react-hook-form × zod | スキーマをフォーム検証の resolver として繋ぐ |
| `@opentelemetry/instrumentation-http` | OpenTelemetry × Node `http` | server 側の受信・送信 HTTP に span を付ける |
| `@opentelemetry/instrumentation-undici` | OpenTelemetry × undici（Node の `fetch`） | server 側の `fetch` に span を付ける |
| `@opentelemetry/instrumentation-fetch` | OpenTelemetry × ブラウザの `fetch` | ブラウザ側の `fetch` に span を付け、context を伝播する |

ビルド時・開発時の bridge は本番の束に乗らないため、記載は fork コスト上限だけで足りる。

| パッケージ | 結合 | 担うこと |
| --- | --- | --- |
| `typescript-eslint` | ESLint × TypeScript | 型を解決した ESLint 規則と parser |
| `eslint-import-resolver-typescript` | ESLint の import resolver × TypeScript | 境界検査が import 先を実ファイルまで解決する |
| `@tailwindcss/postcss` | Tailwind × PostCSS | Tailwind を PostCSS のパイプラインに載せる |
| `@storybook/nextjs-vite` | Storybook × Vite | Storybook の framework 統合 |
| `@storybook/addon-a11y` | Storybook × axe | story ごとの a11y 検査 |
| `@axe-core/playwright` | axe × Playwright | E2E / VRT の画面に対する a11y 検査 |
| `vitest-axe` | axe × Vitest | 単体テストでの a11y 検査 |
| `@vitest/coverage-istanbul` | Vitest × istanbul | カバレッジ計測（[0090](../adr/0090-testing-strategy.md)） |

## 依存どうしの結び付き

単独では上げられず、**相手と同じ変更で動かす**依存がある。メジャー更新を別 PR に切る規則
（[0004](../adr/0004-library-management.md)）は、この結び付きを 1 つの PR に同載する形で守る。

| 組 | 結び付き |
| --- | --- |
| `tailwindcss` ↔ `tailwind-merge` | `tailwind-merge` は Tailwind のメジャーに連動する（v3 → 2.x / v4 → 3.x）。Tailwind のメジャー更新は両者を 1 つの PR に同載する |
| `@opentelemetry/*` | 安定版（`2.x`）と experimental（`0.x`）の 2 系列が互いの版を前提にする。片方だけ上げない |
| `@tiptap/*` | 同一版で揃える。extension とエディタ本体の版がずれると schema が食い違う |
| `storybook` / `@storybook/*` | 同一版で揃える |
| `vitest` / `@vitest/coverage-istanbul` | 同一版で揃える |
| `react` / `react-dom` / `@types/react` / `@types/react-dom` | ランタイムと DOM 描画と型定義の 4 つを同じメジャーに揃える |
