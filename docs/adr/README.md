# Architecture Decision Records (ADR)

このディレクトリには、本プロジェクトにおける重要な技術的意思決定を記録する。

## ルール

- 1ファイル = 1意思決定
- トピック順ブロック帯で採番する（10 番台 = 主題ブロック。例: `002x` アーキ / `004x` ルーティング / `007x` データ・BFF / `015x` プロセス）
- Status を必ず記載する（Accepted / Superseded など）

## 今後定義する ADR

未着手の意思決定領域は [BACKLOG.md](BACKLOG.md) に網羅・優先度付けで一覧化している。新規 ADR は BACKLOG での合意後に番号を付けて起票する。

## 一覧

- [0001-package-manager.md](0001-package-manager.md) - パッケージマネージャの選定（pnpm 採用 / lockfile commit / npm・yarn 禁止）
- [0002-formatter-linter.md](0002-formatter-linter.md) - フォーマッタ・リンタの選定（Biome 優先 + 隙間補完 ESLint）
- [0003-version-manager.md](0003-version-manager.md) - Node.js / pnpm のバージョンマネージャ選定（mise 採用）
- [0004-library-management.md](0004-library-management.md) - ライブラリ選定・運用方針（npm 依存のメタ方針 / exact pin / 監査）
- [0010-standards-and-non-lockin.md](0010-standards-and-non-lockin.md) - 標準準拠と非ロックイン（設計判断の恒久メタ軸 = デファクト seam に乗る / 非ロックイン判定）
- [0011-no-docker.md](0011-no-docker.md) - Docker を boilerplate に含めない方針（表示層 → アプリ基盤ロール定義）
- [0020-adopted-architecture.md](0020-adopted-architecture.md) - 採用アーキテクチャ（機能スライス × 表示層カーネル / 設計原則 / 不採用パターン）
- [0021-frontend-responsibility.md](0021-frontend-responsibility.md) - フロント内責務分離方針（カーネル責務 / 依存マトリクス / 命名規律 / Enforcement）
- [0022-capabilities-kernel.md](0022-capabilities-kernel.md) - `capabilities` カーネル（横断 client hook の家 / runtime 能力供給 / use client 固定）
- [0023-stores-kernel.md](0023-stores-kernel.md) - `stores` カーネル（横断 client 状態 = Zustand の家 / 昇格基準）
- [0024-adapters-server-client-split.md](0024-adapters-server-client-split.md) - adapters の server/client 分割（2 軸モデル / client 側外部接続境界 = 構造ブロッカー S1）
- [0025-app-layer-elements.md](0025-app-layer-elements.md) - app レイヤの element 構成（Route Handler / metadata / 3 element = S2）
- [0026-layout-shell-mount.md](0026-layout-shell-mount.md) - layout の横断 UI / Provider mount（app シェル合成 = S4）
- [0027-directory-structure.md](0027-directory-structure.md) - ディレクトリ構造（物理配置 / `@/*` alias / co-location / 共有粒度）
- [0028-naming-convention.md](0028-naming-convention.md) - 命名規則（ファイル名 / 識別子 / route セグメント / 環境変数 / ADR ファイル）
- [0029-type-design-discipline.md](0029-type-design-discipline.md) - 型設計の規律（判別可能 union / 境界での確定 / branded type / `satisfies`）
- [0030-environment-variable-management.md](0030-environment-variable-management.md) - 環境変数管理（目的別 config / server・client 分割 / `NEXT_PUBLIC_` 境界 / secret）
- [0031-policy-state-supply.md](0031-policy-state-supply.md) - ポリシー状態（consent / feature-flag）の供給方針（source adapter + no-op 既定 + stateless props = S3）
- [0040-routing-rendering-strategy.md](0040-routing-rendering-strategy.md) - ルーティング・レンダリング戦略（App Router / Server Components 既定 / Server Actions / route-as-modal）
- [0041-cache-components-decision.md](0041-cache-components-decision.md) - Cache Components（PPR）有効化判断
- [0042-react19-rendering-api.md](0042-react19-rendering-api.md) - React 19 レンダリング API 規約（`use()` 等の書き方）
- [0043-middleware-policy.md](0043-middleware-policy.md) - Middleware（Proxy）方針（Next.js 16 proxy.ts / thin・last resort / 認証は fork 先）
- [0044-seo-metadata-strategy.md](0044-seo-metadata-strategy.md) - SEO / メタデータ戦略（Metadata API / sitemap・robots / canonical / JSON-LD / アイコン体系）
- [0045-fonts-and-images.md](0045-fonts-and-images.md) - フォント・画像（next/font / next/image / public/ / 動的 OG）
- [0050-styling-strategy.md](0050-styling-strategy.md) - スタイリング戦略（Tailwind 主軸 + CSS Modules 限定許可 / `cn()` / design token = CSS 変数）
- [0051-styling-system.md](0051-styling-system.md) - スタイリング体系（デザイントークン / レスポンシブ / モーション = Framer Motion / 印刷）
- [0052-ui-component-policy.md](0052-ui-component-policy.md) - UI コンポーネント方針（shadcn/ui + Tabler アイコン採用）
- [0053-ui-component-interaction-seam.md](0053-ui-component-interaction-seam.md) - UI コンポーネント方針とインタラクション a11y seam
- [0054-ui-catalog-storybook.md](0054-ui-catalog-storybook.md) - UI カタログ（Storybook）方針
- [0060-state-management.md](0060-state-management.md) - 状態管理方針（Server state = fetch 既定 / Client = local 既定 / react-hook-form・Zustand 採用）
- [0061-form-mutation-ux.md](0061-form-mutation-ux.md) - フォーム送信フローの canonical 機構（`<form action>` + `useActionState` + `useFormStatus`）
- [0062-form-input-validation.md](0062-form-input-validation.md) - フォーム入力検証 UX（client 検証 / 生成 zod の再利用境界）
- [0063-mutation-result-notification.md](0063-mutation-result-notification.md) - 変更結果の通知 UX（インライン / トースト / redirect + live region）
- [0070-backend-role-separation.md](0070-backend-role-separation.md) - バックエンドとの役割分離（BFF = thin proxy / 契約 SSOT / 境界値所有）
- [0071-bff-api-integration.md](0071-bff-api-integration.md) - BFF / API 統合（adapters の fetch wrapper / resilience 翻案 / エラー正規化 / キャッシュ）
- [0072-api-type-generation.md](0072-api-type-generation.md) - 型生成（orval + zod 生成 / gh 取込 + short SHA / do-not-edit / drift ゲート）
- [0073-pagination-fetch-boundary.md](0073-pagination-fetch-boundary.md) - ページネーション・無限スクロールのデータ取得境界
- [0074-runtime-communication-seam.md](0074-runtime-communication-seam.md) - 双方向 / ストリーム通信 seam（WebSocket / SSE）
- [0075-file-upload-seam.md](0075-file-upload-seam.md) - ファイルアップロード seam（presigned 直 PUT 既定 / multipart proxy 例外）
- [0076-payment-ui-seam.md](0076-payment-ui-seam.md) - 決済 UI seam（mount seam と PCI 境界）
- [0077-bff-abuse-protection-boundary.md](0077-bff-abuse-protection-boundary.md) - BFF abuse 保護境界（infra / edge seam）
- [0078-dynamic-feature-flag-seam.md](0078-dynamic-feature-flag-seam.md) - 動的 feature flag・段階的配信 seam（A-B / 段階的公開）
- [0079-auth-frontend-seam.md](0079-auth-frontend-seam.md) - 認証のフロント側 seam
- [0080-error-handling.md](0080-error-handling.md) - エラーハンドリング（errors カーネル / sentinel 分類 / 境界正規化 / error.tsx 階層 / loading・Suspense）
- [0081-observability-logging.md](0081-observability-logging.md) - 観測性・ロギング（logging/observability カーネル / OTLP-only / signal gating / RUM は fork 先）
- [0082-client-observability.md](0082-client-observability.md) - クライアント観測性（Web Vitals RUM / client エラー収集 / プロダクト分析 seam）
- [0090-testing-strategy.md](0090-testing-strategy.md) - テスト戦略（Vitest + RTL + MSW + Playwright / go 準拠戦略 / 90% ゲート）
- [0091-test-verification-methods.md](0091-test-verification-methods.md) - テスト検証手段方針（async RSC テストの寄せ先 / a11y 自動テスト = axe 組込）
- [0100-accessibility-target.md](0100-accessibility-target.md) - アクセシビリティ目標（WCAG AA / biome a11y / 手動チェック）
- [0101-performance-budget.md](0101-performance-budget.md) - パフォーマンス予算（Core Web Vitals / 仕組みは定義・閾値は fork 先）
- [0102-browser-support.md](0102-browser-support.md) - ブラウザサポート行列（Next.js 既定 browserslist 追認 / 切り捨ては fork 先）
<!-- boilerplate-only:replace-begin -->
- [0110-security-operations.md](0110-security-operations.md) - セキュリティ運用（Dependabot cooldown / gitleaks / Trivy 二段 / CodeQL / image-scan は exclusion）
<!-- boilerplate-only:replace-with -->
<!-- = - [0110-security-operations.md](0110-security-operations.md) - セキュリティ運用（Dependabot cooldown / gitleaks / Trivy 二段 / Opengrep / image-scan は exclusion） -->
<!-- boilerplate-only:replace-end -->
- [0111-csp-security-headers.md](0111-csp-security-headers.md) - CSP・セキュリティヘッダ（実行時）
- [0112-data-classification-cache-boundary.md](0112-data-classification-cache-boundary.md) - データ分類とキャッシュ境界（PII / user-scoped / secret の置き場と段ごとの関所）
- [0120-locale-aware-formatting.md](0120-locale-aware-formatting.md) - ロケール対応フォーマット（日付・数値 + Intl / date-fns 日付演算）
- [0121-i18n-strategy.md](0121-i18n-strategy.md) - i18n 戦略（本体非同梱 = exclusion / 採用時の seam）
- [0130-pwa-strategy.md](0130-pwa-strategy.md) - PWA 戦略（Manifest / SW / オフライン本体非同梱 = exclusion）
- [0131-cookie-consent.md](0131-cookie-consent.md) - Cookie 同意（軽量 consent 機構 + スクリプトゲート + ゲートの裏のタグマネージャは同梱 / CMP・IAB TCF は非同梱。計測製品そのものは容器の中身として fork が選ぶ）
- [0140-documentation-operations.md](0140-documentation-operations.md) - ドキュメント運用ポリシー（EN canonical 方向・移行 v1 / タクソノミー / rules.md 新設 / ADR 不可変性）
- [0141-portal-operations.md](0141-portal-operations.md) - ポータル運用（manifest = 構造制御 / 登録基準 / GitHub Pages / 実装は Phase 3）
- [0142-license.md](0142-license.md) - ライセンス選定（MIT 採用根拠 / OSS 寄与 = inbound=outbound / 同梱ライブラリ整合 / private:true との関係）
- [0150-git-workflow.md](0150-git-workflow.md) - Git ブランチ・コミット運用方針
- [0151-git-hooks.md](0151-git-hooks.md) - Pre-commit / Pre-push hook 運用方針（lefthook 採用）
- [0152-agents-md-policy.md](0152-agents-md-policy.md) - AGENTS.md 運用方針
- [0153-ci-configuration.md](0153-ci-configuration.md) - CI 構成（job 分割 / SHA ピン / 最小 permissions / hooks mirror / matrix 非採用）
- [0154-claude-skills-operations.md](0154-claude-skills-operations.md) - Claude スキル運用方針（運用系）
- [0155-claude-skills-development.md](0155-claude-skills-development.md) - Claude スキル運用方針（開発系）
- [0156-browser-observation-tooling.md](0156-browser-observation-tooling.md) - ブラウザ実測ツール（3 レーンの分担 / CLI 前提・MCP 登録なし / 実プロファイル非接続 / 取得経路は pnpm と mise の使い分け）
