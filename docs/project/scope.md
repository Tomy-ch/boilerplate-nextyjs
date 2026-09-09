# プロジェクトスコープ

このリポジトリが**どのようなチーム・システムに向けて設計されているか**と、**想定していない用途**を
述べる。根拠は各 ADR が持ち、ここは線だけを引く。

## 想定チーム

次を理解しているチームを想定する。

- Next.js 16 の App Router と React 19 —— Server Components を既定とし、`"use client"` を bundle の
  境界として扱う描画モデル（[0040](../adr/0040-routing-rendering-strategy.md) / [rendering.md](../design/rendering.md)）
- OpenAPI を契約とする API の**消費側**の開発 —— 契約から型と検証を生成し、手書きで写さない
  （[0070](../adr/0070-backend-role-separation.md) / [0072](../adr/0072-api-type-generation.md)）
- 機能スライスとカーネルによる責務分離と、それを機械で守る境界検査
  （[0020](../adr/0020-adopted-architecture.md) / [0021](../adr/0021-frontend-responsibility.md)）
- pnpm / mise / biome を軸にしたツールチェーン
  （[0001](../adr/0001-package-manager.md) / [0003](../adr/0003-version-manager.md) / [0002](../adr/0002-formatter-linter.md)）
- Tailwind とデザイントークン、shadcn/ui のコピーイン形態
  （[0050](../adr/0050-styling-strategy.md) / [0052](../adr/0052-ui-component-policy.md)）
- 基本的なセキュリティ境界 —— CSP、秘密の置き場、`NEXT_PUBLIC_` の外へ出るものの理解
  （[0111](../adr/0111-csp-security-headers.md) / [0030](../adr/0030-environment-variable-management.md)）

ADR を読んで自分のプロジェクトの判断として書き換えられるメンバーがいることを前提にする。同梱する
判断はどれも作った側で覆せる形で記録してあり、覆すときは ADR を上書きするか supersede する
（例: [0011](../adr/0011-no-docker.md) の自己ホスト化）。

## 想定する開発方式

AI コーディングエージェントと共に作業する前提で、エージェント契約（`AGENTS.md`）と作業手順のスキルを
同梱する（[0152](../adr/0152-agents-md-policy.md) / [0154](../adr/0154-claude-skills-operations.md) /
[0155](../adr/0155-claude-skills-development.md)）。手動での開発を妨げない。エージェント向けの手順は
スキルが持ち、人向けの手順は README と [playbook.md](../playbook.md) が持つ。

これはアプリケーションについては何も述べていない。ランタイム・ビルド・テスト・契約・CI はいずれも
AI 無しで成立する。

## 想定システム

- **表示層としての Next.js。** UI 描画と薄い BFF が責務で、ビジネスロジック・ドメインモデル・永続化は
  別リポジトリのバックエンドが持つ（[0011](../adr/0011-no-docker.md) / [0070](../adr/0070-backend-role-separation.md)）
- **契約の所有者が別にいるシステム。** 契約は OpenAPI で、バックエンドが所有し、こちらはその消費者に徹する
- **PaaS または静的 CDN へ配るシステム。** SSR / SSG / ISR のどれも取れるが、self-host のコンテナ配送は
  第一級のデプロイ先にしない（[0011](../adr/0011-no-docker.md)）
- **認証を外部の IdP に委ねるシステム。** 資格情報は検証せずに中継し、認証画面の意匠だけを所有する
  （[0079](../adr/0079-auth-frontend-seam.md)）
- **長期に保守される、画面の多いアプリケーション。** 層ごとの README・画面の仕様書・境界検査・100% の
  テストゲートは、画面が増えても置き場の判断がぶれないために在る
  （[0143](../adr/0143-spec-driven-development.md) / [0090](../adr/0090-testing-strategy.md)）

同梱するライブラリは「表示層に汎用・常用のもの」までで、用途に依存するもの（i18n / PWA / 決済 / 分析
等）は拡張点の座標だけを持つ（[0011](../adr/0011-no-docker.md)）。内訳は [out-of-scope.md](out-of-scope.md)。

## 想定していない用途

- **フルスタックの Next.js。** `src/` に DB 接続・ORM・業務ルールを持ちたいシステム。ロール境界の外で
  あり、拡張ではなく再評価になる（[0011](../adr/0011-no-docker.md)）
- **最小構成で始めたいプロジェクト。** `{app, components, hooks, lib}` で済ませたい規模には、層別
  README・境界検査・スキルという足回りが過剰に映る（[0020](../adr/0020-adopted-architecture.md) の不採用パターン）
- **粒度や別の語彙で UI を分類したいチーム。** Atomic Design / Feature-Sliced Design は責務の名前と
  二重になるため採らない（同上）
- **フロントで業務判断を持ちたいシステム。** 契約が返さない値を導出したり、サーバが区別しない失敗を
  画面で区別したりする設計は、この構成の上では規則の写しになる（[0070](../adr/0070-backend-role-separation.md)）

## アーキテクチャ前提

- **機能スライス × 表示層カーネル。** `features` を第一軸に、`app` / `components` / `model` /
  `adapters` / `capabilities` / `stores` / `config` / `errors` / `logging` / `observability` の横断
  カーネルを持つ（[0020](../adr/0020-adopted-architecture.md) / [0027](../adr/0027-directory-structure.md)）
- **依存は内向きのみ**で、ESLint の境界検査が CI で強制する（[0021](../adr/0021-frontend-responsibility.md)）
- **App Router 単独、Server Components 既定。** Server Action は feature の `actions.ts`、page は薄い
  driving adapter（[0040](../adr/0040-routing-rendering-strategy.md)）
- **他の層が握る問題を、こちらで予防的に手当てしない。** 上流由来の値を網羅的に無害化し直すのは
  設計目標に入れない。ただしセキュリティ上の懸念はこの原則の外にある
  （[0020](../adr/0020-adopted-architecture.md) 設計原則 6）
- **環境は stand-alone と cloud の 2 群。** `local` / `ci` は何も契約せずに全画面が動き、`dev` /
  `stg` / `prd` は作った側の IdP / API へ向く（[0011](../adr/0011-no-docker.md) 環境の定義）
