# アクセシビリティ目標

アクセシビリティの **目標水準(WCAG)/ 静的検査(biome a11y)/ 手動チェックのタイミング** を定める。

## Status

Accepted

## 背景

本リポジトリが満たす**最小の a11y 方針**(WCAG レベル・biome a11y ルールの活用・手動チェックのタイミング)を定める。厳格化は用途依存とし、ここでは定めない。

## 決定

### 1. 目標水準 = WCAG 2.x AA

- 本リポジトリが目指す水準は **WCAG 2.x レベル AA**(業界標準の既定水準)。要件に応じて AAA へ引き上げるのは妨げない

### 2. 静的検査 = biome の a11y ルール

- **biome の a11y ルール群を活用**する([0002](0002-formatter-linter.md)。biome は静的 a11y lint を担う)。完全版プロファイルの `lint:ci`([0002](0002-formatter-linter.md))で CI 強制する
- 実行時 DOM の ARIA 整合・コントラスト実測等の**自動検査**は [0091](0091-test-verification-methods.md) が採用した axe(`vitest-axe` / `@axe-core/playwright`)が担う(biome は静的 lint、axe は実行時 DOM 検査という役割分担)
- **UI カタログ上でも同じ実行時検査を効かせる**([0054](0054-ui-catalog-storybook.md))。test では jsdom が再現しない layout・focus・スクロールを伴う状態を、カタログ側の canvas が実ブラウザで持つためである。**カタログの story が違反ゼロであることを、その component を「完了」と呼ぶ条件に含める**
- 自動検査が「要確認」に倒す指摘のうち、**検査器が構造上判定できないと分かっているもの**は追いかけ直さない。判定できない理由と、代わりに何を test で固定したかを component の README に記す。違反(violation)と要確認(incomplete)を同じ扱いにすると、追えない指摘が恒常的に残って検査全体が読まれなくなる
- 手動チェックは、それらで機械化できない体験面(スクリーンリーダー体験等)に限定する

### 3. 手動チェックのタイミング

- キーボード操作 / フォーカス順序 / スクリーンリーダー確認は、**UI を伴う feature の実装 PR 時**に行う(自動化できない体験面の観点)。ARIA 整合・コントラスト実測等の機械化できる範囲は axe([0091](0091-test-verification-methods.md))/ E2E([0090](0090-testing-strategy.md) Playwright)で機械化する
- **`components` の部品は、feature を待たず部品単位で確認する。**`components` は業務文脈を持たないため、部品自身が表現する状態(variant / disabled / invalid / 開閉など)は feature が現れる前に確定している。ここで確認を後ろへ回すと、同じ部品を使う feature ごとに同じ確認を繰り返すことになる
- セマンティック HTML を既定とし、`components`([0021](0021-frontend-responsibility.md))の純 UI がアクセシブルであることを土台にする

## 禁止事項

- ❌ biome の a11y ルールを理由なく無効化すること([0002](0002-formatter-linter.md) の biome-ignore 濫用禁止)
- ❌ a11y を「後から対応」として feature 実装から切り離すこと(実装 PR 時に担保)

## 関連 ADR

- [0002-formatter-linter.md](0002-formatter-linter.md) — biome a11y ルール(静的検査の手段)
- [0021-frontend-responsibility.md](0021-frontend-responsibility.md) — `components` 純 UI(アクセシブルの土台)
- [0091-test-verification-methods.md](0091-test-verification-methods.md) — 実行時 a11y 自動検査 = axe(`vitest-axe` / `@axe-core/playwright`)の組込(本 ADR の自動検査手段)
- [0054-ui-catalog-storybook.md](0054-ui-catalog-storybook.md) — UI カタログ(部品単位で実ブラウザの a11y 検査を効かせる面)
- [0051-styling-system.md](0051-styling-system.md) — `prefers-reduced-motion` の尊重(WCAG SC 2.3.3 = AAA 相当。AA 目標とは独立に必須とする根拠水準は 0051 側が持つ)
- [0090-testing-strategy.md](0090-testing-strategy.md) — E2E(機械化できる a11y 確認)
- [0050-styling-strategy.md](0050-styling-strategy.md) — Tailwind(コントラスト等 design token と接続)
