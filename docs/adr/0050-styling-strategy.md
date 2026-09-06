# スタイリング戦略

Tailwind CSS を主軸に据えつつ、**CSS Modules をエスケープハッチとして限定許可し(styled-components / emotion は非採用)/ `cn()` ヘルパの置き場 / design token の管理 / global と local の境界** を定める。

## Status

Accepted

（採番はブロック帯で確定(2026-07-14・0001〜0155。トピック順ブロック帯(10 番台=主題ブロック))([0140](0140-documentation-operations.md))。本 ADR の内容自体はユーザ決定済み。日付 2026-07-12。0.0.x の ADR は living document として本文を直接上書きし、改定履歴を積まない）

バッテリー採用への転換(2026-07-14・v1): 「CSS Modules / styled-components / emotion を全て非採用」から「**CSS Modules のみエスケープハッチとして限定許可・他 2 者は引き続き非採用**」へ部分改訂([master-plan §1.2](../plan/master-plan.md))。

## 背景

`package.json` に `tailwindcss` / `@tailwindcss/postcss` があり、`postcss.config.mjs` と `src/app/globals.css` が存在するため **Tailwind v4 は事実上採用済み**だが、design token 管理・`cn()` ヘルパ・global vs local 境界・代替手段の非採用方針は未文書化だった。AGENTS.md の `[TODO] Styling Strategy` が敷いていた暫定運用(Tailwind ユーティリティ既定 / CSS Modules・styled-components 等を勝手に導入しない / `globals.css` に規則を積まずまずユーティリティで賄えるか確認)を、本 ADR が確定させる。

## 決定

### Tailwind CSS を主軸に、CSS Modules をエスケープハッチとして限定許可

- スタイリングは **Tailwind CSS(v4)のユーティリティクラスを既定(主軸)**とする
- **CSS Modules は、Tailwind ユーティリティでは記述しづらい複雑スタイル(高度な `:has()` / 複雑な擬似要素連鎖 / keyframes など)に限り、エスケープハッチとして限定許可**する。まず Tailwind で賄えるかを確認し、賄えない場合のみ CSS Modules を用いる
  - 採用理由(vendor-independent / [0010](0010-standards-and-non-lockin.md) §2): CSS Modules は **ビルド時にスコープ化される純 CSS で、ランタイム CSS-in-JS を持たない**。したがって RSC 既定([0040](0040-routing-rendering-strategy.md))と衝突せず、Server Component でもそのまま使える。加えて **Next.js / バンドラが標準機能として同梱**する(特定ライブラリへの依存が発生しない)ため、「ベンダーを正当化から抜いてもパターンが成立する」= 非ロックインの運用テストを満たす。プラットフォーム標準に乗る([0010](0010-standards-and-non-lockin.md) §1)選択であり、追加ライブラリ・追加ランタイムを伴わない
  - CSS Modules はプラットフォーム標準機能であり **追加依存を導入しない**ため exact-pin 対象は生じない。将来 `cn()` 実装等でライブラリを足す場合のみ [0004](0004-library-management.md)(exact pin + `pnpm audit`)に従う
- **styled-components / emotion 等のランタイム CSS-in-JS は引き続き非採用**とする
  - 非採用理由: これらは **ランタイムでスタイルを生成する CSS-in-JS** であり、Server Component 既定([0040](0040-routing-rendering-strategy.md))と衝突する(`"use client"` 強制・ランタイムコスト・SSR ハイドレーション複雑化)。CSS Modules の「ビルド時スコープ化・ランタイム無し」という利点を欠くため、エスケープハッチとしても採らない

### `cn()` ヘルパ

- クラス結合ヘルパ **`cn()` を採用**する。置き場は **`components` カーネル内**([0021](0021-frontend-responsibility.md) 命名規律により `utils/` 等の汎用置き場は作らない)
- 実装ライブラリは **`clsx` + `tailwind-merge`** とする([0052](0052-ui-component-policy.md) が shadcn の実 npm 依存として既に名指ししているものと同一)。責務が join / 衝突解決に 1 対 1 対応し、[0004](0004-library-management.md) の一次判定(単一責務 × 単一 upstream)を各々単独で通る。exact pin + `pnpm audit` は [0004](0004-library-management.md) に従う
- `tailwind-variants` は**採らない**。variant + slots + responsive + merge の束であり責務を 1 語で言えず、下記 `cva` とも責務が衝突する

### variant 定義 = `class-variance-authority`(cva)

- コンポーネントの variant 定義には **`cva` を採用**する。[0052](0052-ui-component-policy.md) が採る shadcn/ui の公式コンポーネントが cva を使った状態で配布されるため、採らなければ配布物を毎回書き換えることになる([0010](0010-standards-and-non-lockin.md)「独自に機構を発明しない」)
- 置き場は `cn()` と同じく **`components` カーネル内**。variant 定義を feature 側へ散らさない

### design token = CSS 変数

- design token は **CSS 変数**で管理する(Tailwind v4 の CSS-first 設定と整合)。token の定義は `globals.css`(またはそれが import する CSS)に集約する

### global と local の境界

- **グローバル CSS は `src/app/globals.css` に集約**する(既存踏襲)。まずユーティリティで賄えるかを確認し、`globals.css` に個別規則を積み増さない([0027](0027-directory-structure.md) co-location 方針)
- コンポーネント固有のスタイルはユーティリティクラスで各コンポーネントに co-location する。別ファイルの CSS は最小化する
- CSS Modules を用いる場合も **その対象コンポーネントに co-location**([0027](0027-directory-structure.md))し、`*.module.css` として局所化する。グローバルへ漏らさず、エスケープハッチの適用範囲を最小に留める

### テーマ / ダークモード

- テーマ(ライト / ダーク等)は **CSS 変数の design token(上記)を切り替える**方式を既定とする。色を各所にハードコードせず token 経由で参照することで、テーマ切替が token 差し替えに閉じる
- ダークモードは **`prefers-color-scheme`(OS 設定追従)を既定の土台**とし、Tailwind v4 の `dark` variant で表現する。ユーザ明示切替(トグル)を足す場合も、切替状態は最小の状態管理に留める(局所は local state、横断的に共有する場合は [0060](0060-state-management.md) が採用した `stores`(Zustand。家は [0023](0023-stores-kernel.md))に置く。Context 濫用は避ける)
- **具体的なカラーパレット・提供するテーマの種類・トグル UI の有無は用途依存**のため fork 先で決める。boilerplate 本体は「token 切替 + `prefers-color-scheme` 追従」という仕組みの枠を定める

## 禁止事項

- ❌ styled-components / emotion 等の**ランタイム CSS-in-JS** を導入すること([0040](0040-routing-rendering-strategy.md) RSC 既定と衝突)
- ❌ Tailwind ユーティリティで賄える規則を CSS Modules や `globals.css` へ逃がすこと(CSS Modules はあくまで賄えない複雑スタイルのエスケープハッチであり、既定は Tailwind)
- ❌ CSS Modules をグローバルスコープ(`:global` の濫用)で用い、co-location の局所性を崩すこと
- ❌ `cn()` を `components` 以外の汎用置き場(`utils/` / `lib/` 等)に置くこと([0021](0021-frontend-responsibility.md) 命名規律)
- ❌ ユーティリティで賄える規則を `globals.css` に積み増すこと

## 補足

- AGENTS.md の `[TODO] Styling Strategy` 節は本 ADR の Accepted に伴い削除済みで、スタイリングの正は本 ADR にある(CSS Modules はエスケープハッチとして限定許可 / ランタイム CSS-in-JS は非採用)

## 関連 ADR

- [0010-standards-and-non-lockin.md](0010-standards-and-non-lockin.md) — CSS Modules 採用の正当化軸(§1 プラットフォーム標準に乗る / §2 vendor-independent = 追加依存もランタイムも伴わない)
- [0040-routing-rendering-strategy.md](0040-routing-rendering-strategy.md) — RSC 既定。CSS Modules(ビルド時・ランタイム無し)を許容し、ランタイム CSS-in-JS(styled-components / emotion)を非採用とする根拠
- [0021-frontend-responsibility.md](0021-frontend-responsibility.md) — `cn()` の置き場(`components` カーネル / 汎用置き場禁止の命名規律)
- [0027-directory-structure.md](0027-directory-structure.md) — スタイルの co-location 方針(`globals.css` 集約 / ユーティリティ既定 / `*.module.css` の局所化)
- [0004-library-management.md](0004-library-management.md) — `cn()` 実装ライブラリ等の採用フロー(exact pin / audit)。CSS Modules 自体は標準機能のため追加 pin は生じない
- [0051-styling-system.md](0051-styling-system.md) — 本 ADR が定めた器の中身(デザイントークン体系 / レスポンシブ / モーション / 印刷)。token の SSOT と semantic 層の規律は 0051 側が持つ
- [0052-ui-component-policy.md](0052-ui-component-policy.md)(B2)— UI ライブラリ(shadcn/ui + Tabler アイコン)採用(本 ADR の Tailwind 主軸と接続)
- [0060-state-management.md](0060-state-management.md)(B5)— テーマ切替状態の置き場(local state 既定 / 横断状態は `stores`)
- [master-plan §1.2 採用ロードマップ](../plan/master-plan.md) — v1 バッテリー採用の全体像(CSS Modules のみ限定許可の確定)
