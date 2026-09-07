# i18n 戦略(exclusion)

国際化(i18n)ライブラリ・ロケール解決・翻訳キー設計を **boilerplate 本体に同梱しない** ことを意図的な除外(exclusion)として記録し、fork 先が採用する場合の App Router 上の seam のみ示す。

## Status

Accepted (exclusion; v2 に局所採用を予定)

## 背景

i18n は**必要ロケール・翻訳運用が用途に強く依存**するため、boilerplate 本体で一律に決めると fork 先の選択を狭める。単一ロケールで動く本体には seam をコードとして置く設置面が存在しないので、本 ADR が記すのは**採用時の拡張点の座標**である。

## 決定: boilerplate 本体に同梱しない(fork 先判断)

- **i18n ライブラリ(next-intl 等)・ロケール解決・翻訳キー体系を boilerplate 本体に同梱しない**。用途依存のため fork 先で必要になった時点で判断する
- 導出根拠: [0011](0011-no-docker.md) の「用途未定の表示層」ロール —— 用途依存の判断を本体で先取りしない
- **本体側の採用は v2 に予定し、局所ライブラリ(next-intl)を下記 seam に置く形を採る。** その場合も本体は seam を保持し、ライブラリは [0010](0010-standards-and-non-lockin.md)(vendor-independent 正当化 / adapters・カーネル境界の裏で差替可能 / vendor 直参照を feature・component に散らさない)と [0004](0004-library-management.md)(exact pin / `pnpm audit`)の枠内で置く
- **fork 先が i18n を採用する場合の seam**(参考): App Router のロケール解決は **`proxy.ts`(ロケール検出・リダイレクト。[0043](0043-middleware-policy.md))** と **route セグメント(`[locale]`。[0040](0040-routing-rendering-strategy.md) / [0028](0028-naming-convention.md))** で行うのが Next.js 慣行。導入時も [0021](0021-frontend-responsibility.md)(カーネル配置・命名規律)・[0004](0004-library-management.md)(exact pin / audit)の枠内で行う
- 単一ロケールでも初日から要る**日付・数値のフォーマットと日付演算は本 ADR の射程外**であり、[0120](0120-locale-aware-formatting.md) が所有する。既定 locale の単一 seam(0120 §4)が、採用時にアクティブ locale を上記 seam から受け取る差し替え点になる

## exclusion の扱い

- 本 ADR は「意図的にやらない」判断の記録である([0140](0140-documentation-operations.md) タクソノミー: exclusion = ADR)。fork 先が導入する分にはこの exclusion は障害にならない

## 関連 ADR

- [0011-no-docker.md](0011-no-docker.md) — 用途未定の表示層ロール(fork 先判断の根拠)
- [0043-middleware-policy.md](0043-middleware-policy.md) / [0040-routing-rendering-strategy.md](0040-routing-rendering-strategy.md) — ロケール解決の seam(採用時)
- [0120-locale-aware-formatting.md](0120-locale-aware-formatting.md) — `Intl` フォーマット・`date-fns` 演算の所有 / 既定 locale の seam
- [0130-pwa-strategy.md](0130-pwa-strategy.md) — 用途依存を exclusion 記録する同型の判断
