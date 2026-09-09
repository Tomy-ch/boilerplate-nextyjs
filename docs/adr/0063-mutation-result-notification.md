# 変更結果の通知 UX(インライン / トースト / redirect・live region)

変更系操作の**結果通知 UX** を 1 本に定める。操作結果を **インライン / トースト / redirect + メッセージ** のどれで出すかを「**フォーム文脈に留まるか離れるか**」で使い分ける規約と、非同期の状態変化を支援技術へ伝える **live region a11y**(目標水準の権威は [0100](0100-accessibility-target.md))を定める。送信メカニクス([0061](0061-form-mutation-ux.md))の `ActionState` 契約を入力に通知手段を選ぶ層である。

## Status

Accepted

## 背景

[0052](0052-ui-component-policy.md) は UI / form 部品(shadcn 系)を採用しているが、部品が手元にあっても「**操作結果をどの手段(インライン / トースト / redirect)で出すか**」という規約は別途要る。これが空白のままだと、成功 / 失敗の通知手段が feature ごとにばらつき、実装者にも利用者にも一貫した UX が失われる。

結果通知の隣接領域は [0080](0080-error-handling.md)(エラー正規化)/ [0052](0052-ui-component-policy.md)(UI)/ [0100](0100-accessibility-target.md)(a11y)に分かれる。結果通知は送信メカニクス([0061](0061-form-mutation-ux.md))が返す `ActionState` を入力に、「フォーム文脈に留まる結果か離れる結果か」で手段を選ぶ層である。本 ADR はその使い分けの規約と live region a11y 要件を敷き、a11y の目標水準は [0100](0100-accessibility-target.md) に委ねる。

## 決定

### 1. 通知手段の使い分け(フォーム文脈に留まるか離れるか)

通知手段は戻り値契約(`ActionState`。[0061](0061-form-mutation-ux.md))と「**フォーム文脈に留まるか離れるか**」で選ぶ:

| 手段 | 用途 | 供給元 |
| --- | --- | --- |
| **インライン**(フィールド / フォーム近傍) | 入力検証エラー・フォーム固有のエラー。フォーム文脈に留まる結果の既定 | `ActionState` の fieldErrors / formError(正規化済み sentinel。[0080](0080-error-handling.md)) |
| **トースト** | フォーム文脈を離れた ephemeral な操作結果(遷移を伴わない保存成功等) | `ActionState` の成功値 |
| **redirect + メッセージ** | 成功後に別画面へ遷移する結果(PRG) | Server Action の `redirect()` + 再検証([0071](0071-bff-api-integration.md) `revalidateTag` / `revalidatePath`) |

- インラインに出す入力検証エラーの供給・検証タイミングは [0062](0062-form-input-validation.md) が管轄する。本 ADR はそれを**どの手段で表示するか**の使い分けを持つ
- **インラインは、全体の要約と欄ごとの文言の両方を出す。** 項目が多いフォームでは、欄のそばの文言だけでは「どこがいくつ」誤っているのかを辿れない。要約は全体像と導線を、欄の文言はその場での指摘を担う。分岐条件は「直すべきものが入力の中に在るか」であり、送信そのものの失敗(通信・権限)は入力の中に直すものが無いため、要約ではなくフォーム全体の feedback として出す
- **出し分けは失敗の種類で行い、文言では行わない。** `ActionState` は「何が起きたか」(機械向けの分類)と「何を言うか」(人間向けの文言)を別に持つ。画面が失敗の種類で出し分ける(衝突なら読み込み直す導線を添える、等)とき、文言そのものを合図にすると、文言へ動的な要素を足した瞬間に出し分けが黙って壊れる。両者は変更の理由が違う

### 2. トースト UI の帰属

- **トースト UI の帰属**:トースト / 通知部品は **`components` カーネル**に置いて用いる([0052](0052-ui-component-policy.md) の部品方針 / [0021](0021-frontend-responsibility.md)「`components` はトースト等の UI 状態を持てる」で帰属確定済み)。vendor 直参照は `components` カーネルに閉じ込める([0052](0052-ui-component-policy.md) の非ロックイン境界)
- 本 ADR はトースト *コンポーネント* を再帰属させず、**使い分けの規約**と下記 a11y 要件を持つ

### 3. a11y(live region・権威は [0100](0100-accessibility-target.md))

- トースト・非同期の状態変化は視覚のみでは支援技術に伝わらないため、**live region(`role="status"` / `role="alert"` / `aria-live`)で通知する**。インラインエラーはフィールドと `aria-describedby` / `aria-invalid` で関連付ける
- a11y の**目標水準・検査タイミングの権威は [0100](0100-accessibility-target.md)**(WCAG 2.x AA / biome a11y 静的検査 + 実装 PR 時の手動チェック)。本 ADR は「**通知 UI は live region を伴う**」ことを結果通知 UX の必須要件として敷くに留め、水準を再定義しない(二重管理回避)

## 禁止事項

- ❌ 通知手段(インライン / トースト / redirect)の使い分けを feature ごとにばらつかせること
- ❌ 通知の出し分けを文言の一致で行うこと(分類で行う。文言は人間向け)
- ❌ トースト等の非同期通知を live region なしで出すこと(支援技術に伝わらない = [0100](0100-accessibility-target.md) 違反)
- ❌ トースト UI を `components` 以外へ置く / shadcn 以外の UI コンポーネントライブラリを並行導入して代替すること([0021](0021-frontend-responsibility.md) 帰属 / [0052](0052-ui-component-policy.md) の shadcn 採用・並行同梱禁止)

## 補足

- 日常強制の細則(トースト表示秒数・文言トーン等)は [docs/rules.md](../rules.md) が持つ

## 関連 ADR

- [0061-form-mutation-ux.md](0061-form-mutation-ux.md) — 送信メカニクス(本 ADR が入力に選ぶ `ActionState` 契約の供給元)
- [0062-form-input-validation.md](0062-form-input-validation.md) — 入力検証 UX(インラインに出すフィールドエラーの供給元)
- [0080-error-handling.md](0080-error-handling.md) — errors sentinel / 境界正規化(`ActionState` が運ぶエラーの供給元)
- [0052-ui-component-policy.md](0052-ui-component-policy.md) — UI / form 部品(shadcn 系)採用。トースト / 通知部品は `components` で用いる
- [0100-accessibility-target.md](0100-accessibility-target.md) — a11y 目標水準の権威(live region 要件自体は本 ADR が規定)
- [0071-bff-api-integration.md](0071-bff-api-integration.md) — Server Action / 再検証(redirect 通知・ミューテーション後反映の連動)
- [0021-frontend-responsibility.md](0021-frontend-responsibility.md) — `components`(トースト UI 帰属)
