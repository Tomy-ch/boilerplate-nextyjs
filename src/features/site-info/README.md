---
imports-allowed: [model, components, adapters, capabilities, stores, errors, logging, observability]
forbidden: [features] # 画面まるごとの story は例外
test-requirement: feature
---

# site-info

このサイト自身について説明する画面スライスです。

## 受け入れるもの

- サイトの目的・構成・動かない範囲の説明
- 入力した情報の保存先の説明
- 閲覧の同意条件と免責
- この 3 画面のルート宣言

## 受け入れないもの

- 取得。どの画面も閲覧者によって内容が変わりません
- 他 feature への直接依存

## Route と契約

| Route | 仕様書 | 認証 |
| --- | --- | --- |
| `/about` | [`screen`](../../../docs/spec/route/site-info/about/page.screen.md) / [`function`](../../../docs/spec/route/site-info/about/page.function.md) | 不要 |
| `/privacy` | [`screen`](../../../docs/spec/route/site-info/privacy/page.screen.md) / [`function`](../../../docs/spec/route/site-info/privacy/page.function.md) | 不要 |
| `/terms` | [`screen`](../../../docs/spec/route/site-info/terms/page.screen.md) / [`function`](../../../docs/spec/route/site-info/terms/page.function.md) | 不要 |

**operationId は使いません。** 取得を持たないためで、契約が増えても変わりません。

## 状態とデザイン参照

| 画面 | 状態 | story |
| --- | --- | --- |
| 3 画面 | success | 画面まるごとの story は置いていない（下記） |
| フッターの導線 | 既定 | `Features/SiteInfo/RepositoryLinks/Default` |
| | 補足を開いた | `Features/SiteInfo/RepositoryLinks/WithHoverCard` |

**取得が無い画面は状態を 1 つしか持たないため、画面の story を置いていません。**置いても
`Default` 1 本になり、story が増えた分だけ VRT の実行時間だけが伸びます。3 画面の見た目は
E2E の画面比較が受け持ちます（`e2e/lib/screens.ts` に `about` / `privacy` / `terms` があります）。

## 構成

| ファイル | 役割 |
| --- | --- |
| `facade/paths/` | 2 つのルート。マイページ（別 feature）の導線が参照するため facade へ出す |
| `repositories.ts` | このサイトを構成しているリポジトリ。導線とカードが同じ表を読む |
| `about/view.tsx` | 何のためのサイトか・何で出来ているか・何が動かないか |
| `privacy/view.tsx` | 入力した情報がどこに残るかを、起動のしかたごとに説明する |
| `terms/view.tsx` | 閲覧の同意・セキュリティ上のリスク・サービスの提供条件・免責 |
| `ui/site-footer/` | 利用者向けの器が出すフッター。器が 2 つあるので中身はここが 1 つだけ持つ |
| `ui/repository-links/` | フッターへ置く 2 リポジトリへの導線。説明は補足として HoverCard に載せる |
| `ui/repository-cards/` | このサイトについて に置く、リポジトリ 2 つの説明 |
| `ui/repository-supplement/` | それぞれの目的とできることを畳んだ面 |

## 依存カーネル

| カーネル | 用途 |
| --- | --- |
| `components` | 文章を並べる器（見出し・カード・畳める面・HoverCard） |
| `observability` | 描画を span に載せる |

取得を持たないため `adapters` を引きません。`model` も持ちません —— 表示するのは自分が持つ
文面だけで、feature をまたいで共有する表示モデルがありません。

## Action 戻り値契約

なし。この 3 画面に操作がありません。

## テスト観点

- [ ] 免責が利用規約だけに出る（「このサイトについて」に写っていない）
- [ ] フッターの導線が、補足を読めなくても行き先の判る文言を持つ

## 運用

- **どちらも静的に描画します**。取得を持たず、内容が変わるのはコードを書き換えたときだけです
- **保護の対象にしません**。免責も保存先も、ログインする前・入力する前に読めなければ意味を
  持ちません
- **プライバシーの説明は一般的な体裁を採りません**。入力した情報がどこに残るかは、この
  boilerplate をどう起動しているか（自分の Go 側と繋ぐ / モックのまま / 公開サンプル）で
  3 通りに変わります。定型文にすると、利用者は自分がどれに当たるかを判断できません
- **偽名を求める警告を先頭に置きます**。3 通りの説明を読み終えてから書いても、既に入力した
  後です
- **トップの断り書きとは役割を分けます**。あちら（`features/home` の `SampleNotice`）は
  「実在の取引と取り違えられない」ことと利用規約への導線だけを担って短く保ち、詳しい説明は
  ここが持ちます
- **設計上の呼び名を利用者向けの文面に出しません**。層の分け方や責務の所在は、このサイトを
  触りに来た利用者の判断材料になりません。読みたい人はリポジトリへ行くので、フッターの導線で
  足ります
- **免責は利用規約だけが持ちます**。「このサイトについて」と 2 か所に置くと、片方だけ直した
  状態を作れます
- **リポジトリの説明を HoverCard にしか置きません**。常時出すとフッターが本文と同じ量の文字を
  持ちます。押した先が何かはボタンの文言だけで判るようにしてあるので、補足を読めなくても
  導線としては成立します

## 関連する ADR

- [0021](../../../docs/adr/0021-frontend-responsibility.md) — 層の責務と import 境界。他 feature へ貸すものを `facade/` に出す
- [0040](../../../docs/adr/0040-routing-rendering-strategy.md) — 描画戦略。取得を持たない面を静的に配る
- [0053](../../../docs/adr/0053-ui-component-interaction-seam.md) — 操作の a11y 継ぎ目。補足を読めなくても導線が成立する条件
