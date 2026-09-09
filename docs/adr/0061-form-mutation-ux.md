# フォーム送信フローの canonical 機構(`<form action>` + `useActionState` + `useFormStatus`)

変更系フローの **送信メカニクス**を 1 本に定める。`<form action={serverAction}>` + `useActionState`(結果 state)+ `useFormStatus`(pending)を canonical な送信フローの既定形とし、戻り値契約 `ActionState<T>` を「入力検証 UX / 結果通知 UX が共通に依拠する器」として敷く。[0060](0060-state-management.md) は form state に react-hook-form + zod を採用するが、rhf はクライアント入力検証を担い、**送信そのものは本 ADR の Server Actions 機構に合流させる**(送信機構は 1 本)。標準([0010](0010-standards-and-non-lockin.md))に乗る送信メカニクスの土台を提供する。

## Status

Accepted

## 背景

[0060](0060-state-management.md) は form state に **react-hook-form + zod を採用**し、[0052](0052-ui-component-policy.md) は UI / form 部品(shadcn 系)を採用しているが、rhf が担うのは**クライアントの入力状態・検証**であって「**サーバへどう送信し、結果を返すか**」という送信メカニクスは別レイヤである。boilerplate で最頻出の UI であるフォームが、送信の骨格すら規約なしでは feature ごとに発明され(`onSubmit` 内での手 fetch / rhf の `handleSubmit` から独自 POST 等に分岐)、[0062](0062-form-input-validation.md) の入力検証も [0063](0063-mutation-result-notification.md) の結果通知も、乗る先の器がなければ統一できない。

送信メカニクスは入力検証・結果通知の**共通の土台**である。両者は戻り値契約(`ActionState`)を入力に選ぶため、まず「送ってから結果が返るまでの骨格」を 1 本に固定する必要がある。本 ADR はその骨格のみを担い、送信前の入力検証 UX は [0062](0062-form-input-validation.md)、送信後の結果通知 UX は [0063](0063-mutation-result-notification.md) が担う。rhf との関係は「rhf = クライアント入力検証 / 送信 = 本 ADR の `<form action>` + Server Action」に切り分け、送信機構を二重化しない。

[0010](0010-standards-and-non-lockin.md) の標準準拠に従い、送信フローは React 19 / App Router のデファクト(`<form action>` + `useActionState` + `useFormStatus`)に乗り、標準に乗る決定として vendor-independent な正当性材料を本体に添える。

## 決定

### 1. 送信フローの canonical 形(デファクトに乗る)

- `<form action={serverAction}>` + `useActionState`(結果 state)+ `useFormStatus`(pending)を送信フローの**既定形**とする。Server Action は feature 内 `actions.ts` に置き、編成のみを行う([0021](0021-frontend-responsibility.md) / [0040](0040-routing-rendering-strategy.md))。`"use client"` は入力を扱う葉へ押し下げる([0040](0040-routing-rendering-strategy.md))
- **vendor-independent 正当性材料**([0010](0010-standards-and-non-lockin.md) §2):progressive enhancement(JS 無効でも `<form>` が送信される)/ PRG(Post-Redirect-Get は web-platform の確立パターン)/ pending・結果 state の一元化。運用テスト =「React / Next.js を正当化から抜いても、サーバ往復する form は『標準 HTTP form + 進捗表示 + 結果表示』として成立するか?」→ Yes。ゆえにデファクトに乗っても縛られていない

### 2. 戻り値契約 `ActionState<T>`(入力検証・通知が共通に依拠する器)

- 戻り値契約 `ActionState<T>`(フィールドエラー / フォームエラー / 成功値)は `model` が所有する**表示結果型**([0021](0021-frontend-responsibility.md)。実体は [`src/model/action-state.ts`](../../src/model/action-state.ts))であり、[0080](0080-error-handling.md) の sentinel を Server Action 境界越しにシリアライズして client へ渡す器である
- **Server Action ごとに戻り値形状を発明せず、共通の `ActionState<T>` 契約に従う**。入力検証([0062](0062-form-input-validation.md))が返すフィールドエラー、結果通知([0063](0063-mutation-result-notification.md))が選ぶ通知手段は、いずれもこの契約を入力に選ぶ

### 3. pending 表示

- pending 表示は `useFormStatus`(submit 中の disabled / スピナー)を既定とし、送信フローの一部として要求する
- 二重送信防止(submit disabled + 冪等キー)・楽観的更新(`useOptimistic`)の規約は [docs/rules.md](../rules.md) が持ち、[0071](0071-bff-api-integration.md) の POST 冪等性と表裏をなす。本 ADR は pending の要求までに留める

## 禁止事項

- ❌ Server Action ごとに戻り値形状を発明すること(`ActionState<T>` 契約に従い、[0062](0062-form-input-validation.md) の入力検証・[0063](0063-mutation-result-notification.md) の共通通知を可能にする)
- ❌ 送信フローを `<form action>` + `useActionState` 以外の自前機構で発明すること(標準デファクトに乗る = [0010](0010-standards-and-non-lockin.md))
- ❌ react-hook-form 等の form state ライブラリで**送信機構そのものを置換して二重化**すること(rhf はクライアント入力検証に用い、送信は本 ADR の `<form action>` + Server Action に合流させる。[0060](0060-state-management.md) の rhf 採用と整合)
- ❌ pending 表示を伴わない送信(`useFormStatus` を既定として要求する)

## 補足

- 本 ADR・[0062](0062-form-input-validation.md)・[0063](0063-mutation-result-notification.md) の 3 本は「フォームを送って結果が返るまで」の 1 UX を構成するが、主題(メカニクス / 入力検証 / 結果通知)が異なるため per-subject に分けている
- 日常強制の細則(pending スピナーの表示閾値等)は [docs/rules.md](../rules.md) が持つ

## 関連 ADR

- [0062-form-input-validation.md](0062-form-input-validation.md) — 送信前の入力検証 UX(`ActionState` のフィールドエラーを供給)
- [0063-mutation-result-notification.md](0063-mutation-result-notification.md) — 変更結果の通知 UX(`ActionState` を入力に通知手段を選ぶ)
- [0060-state-management.md](0060-state-management.md) — form state = react-hook-form + zod 採用。rhf = クライアント入力検証 / 送信は本 ADR の Server Actions 機構に合流
- [0052-ui-component-policy.md](0052-ui-component-policy.md) — UI / form 部品(shadcn 系)採用。本 ADR は送信メカニクスを担い、UI 部品と対で機能する
- [0071-bff-api-integration.md](0071-bff-api-integration.md) — Server Action / POST 冪等性(pending・二重送信の連動)
- [0080-error-handling.md](0080-error-handling.md) — errors sentinel(`ActionState` が運ぶエラーの供給元)
- [0021-frontend-responsibility.md](0021-frontend-responsibility.md) — `model`(`ActionState` 所有)/ `actions.ts` 編成
- [0040-routing-rendering-strategy.md](0040-routing-rendering-strategy.md) — Server Actions / `actions.ts` 配置 / `"use client"` 押し下げ
- [0010-standards-and-non-lockin.md](0010-standards-and-non-lockin.md) — 標準準拠・非ロックイン(送信フローがデファクトに乗る正当化の土台)
