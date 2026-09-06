---
imports-allowed: [model, components, adapters, capabilities, stores, errors, logging, observability]
forbidden: [features] # 相手の facade/ と、画面まるごとの story は例外 (ADR 0021)
test-requirement: feature
coverage-exclusions:
  - "src/features/checkout/__mocks__/**"
  - "src/features/checkout/checkout.fixture.ts"
---

# checkout

カートの内容を確かめ、購入を確定し、成立を伝える画面スライスです。

## 受け入れるもの

- 確定前の確認（届け先・注文内容・小計）と、確定の送信（Server Action）の編成
- 成立した購入の取得と、控え・内訳の表示
- 表示通貨での参考換算額の読み取り（読めなくても購入を止めない）
- 確定 1 回ぶんを表す冪等キーの発行

## 借りているもの

購入の表示は自分で持ちません。控え・明細・請求額の内訳は
[`purchases/facade/`](../purchases/facade/) から借ります。**購入完了が見せているのは、購入詳細と
同じ購入**であり、画面ごとに別の見え方を持つと控えとして突き合わせられません。

金額と参考換算額の切り替えは
[`AmountWithReference`](../../components/design-system/display/amount-with-reference/README.md) です。
購入確認（カートの小計）と購入完了（購入の合計）の両方が使い、題材の語彙を持たないため
`components` にあります。

## 受け入れないもの

- カートの変更（数量・削除・全消しは `cart` の領分。この画面は戻る導線だけを持つ）
- 届け先の編集（登録情報は `account` の領分）
- 金額の計算（小計も税も送料も合計もバックエンドが決めます）
- 買えるか・値が変わったかの判定（同上。届いた事情を読むだけです）

## Route と契約

| Route | 仕様書 | 認証 |
| --- | --- | --- |
| `/checkout` | [`screen`](../../../docs/spec/route/shop/checkout/page.screen.md) / [`function`](../../../docs/spec/route/shop/checkout/page.function.md) | 必要 |
| `/checkout/complete` | [`screen`](../../../docs/spec/route/shop/checkout/complete/page.screen.md) / [`function`](../../../docs/spec/route/shop/checkout/complete/page.function.md) | 必要 |

使う operationId。

| operationId | 用途 |
| --- | --- |
| `GetCartsMe` | 確定前のカート。確定の直前にもう一度読み、明細を組み直す |
| `GetUsersMe` | 届け先。登録情報をそのまま使う |
| `GetExchangeRates` | 参考換算額。読めなくても購入を止めない |
| `PostPurchases` | 購入の確定。冪等キーを載せる |
| `GetPurchasesDetail` | 完了画面が取り直す購入 |
| `PutCartsMeItem` | 値の変更を承知したとき、その明細を今の数量で設定し直す |
| `DeleteCartsMeItem` | 成立の後、購入した明細をカートから取り除く |

## 状態とデザイン参照

| 画面 | 状態 | story |
| --- | --- | --- |
| 購入確認 | success | `Page/Checkout/Confirm/Default` |
| | empty（確定できる明細が無い） | `Page/Checkout/Confirm/Empty` |
| | 進めない（買える明細が無い） | `Page/Checkout/Confirm/Blocked` |
| | 外れる明細がある | `Page/Checkout/Confirm/WithExcludedLines` |
| | 参考換算額が読めなかった | `Page/Checkout/Confirm/WithoutReference` |
| | loading | `Features/Checkout/Confirm/Skeleton/PC` |
| | 値の変更を確かめる | `Features/Checkout/Confirm/PriceChangeConfirm/Default` |
| 購入完了 | success | `Page/Checkout/Complete/Default` |
| | 参考換算額が読めなかった | `Page/Checkout/Complete/WithoutReference` |

error は route の `error` 境界（`src/app/(shop)/checkout/error.tsx`）が受けます。完了画面で指し先が
読めない場合は `not-found.tsx` です。

## 構成

画面（`confirm` / `complete`）ごとに掘り、その中を性質で分けます（[0027](../../../docs/adr/0027-directory-structure.md)）。
どちらの画面にも属さないものは画面を挟まず直下へ置きます。

| ファイル | 役割 |
| --- | --- |
| `actions.ts` | 購入確定の Server Action。編成と分類だけを持ち、通信は `adapters` が行う |
| `__mocks__/actions.ts` | カタログでの Server Action の差し替え（[0054](../../../docs/adr/0054-ui-catalog-storybook.md)） |
| `form-state.ts` | 確定の戻り値の型。`ActionState<T>` をこの画面の形で閉じる |
| `form-fields.ts` | 値の変更を承知した合図を載せるフォーム項目の名前 |
| `order.ts` | 購入に載せる明細の取り出しと、金額が変わった明細の判定 |
| `checkout.fixture.ts` | story とテストが読む固定のカートと購入 |
| `paths.ts` | 完了画面の場所と、そこへ載せる検索条件。あわせてこの画面から出る先 |
| `confirm/page-content.tsx` | カートと登録情報の並行取得、参考換算額の付与 |
| `confirm/view.tsx` | 購入確認の表示。内容と集計を左右に分ける |
| `confirm/ui/shipping-card/` | 届け先の確認と、登録情報へ変えに行く導線 |
| `confirm/ui/order-lines/` | 確定する内容の再掲と、カートへ戻る導線 |
| `confirm/ui/order-line-row/` | 再掲の 1 行。事情の表示は `cart` の [`facade/line-issues/`](../cart/facade/line-issues/) を借りる |
| `confirm/ui/order-summary/` | 小計・注記・確定の操作。器は呼び出し元が決める |
| `confirm/ui/place-order-form/` | 確定の送信。そのまま送る姿 |
| `confirm/ui/price-change-confirm/` | 金額が変わったときに確かめてから送る姿 |
| `confirm/ui/place-order-submit/` | 送信部と失敗の表示。2 つの姿が共有する |
| `confirm/ui/place-order-state/` | 確定の結果を 2 つの姿へ配る器。鍵ごとに鮮度を持つ |
| `confirm/ui/skeleton/` | 購入確認の待機表示 |
| `complete/page-content.tsx` | 成立した購入の取得。指し先が読めなければ `not-found` |
| `complete/purchase-code.ts` | 完了画面が見せる購入を検索条件から読む |
| `complete/view.tsx` | 購入完了の表示。控え・内訳・明細・次の導線 |

## 依存カーネル

| カーネル | 用途 |
| --- | --- |
| `adapters` | カート・登録情報・参考換算額の取得と、購入の確定 |
| `model` | 表示モデル（`Cart` / `Purchase` / `User`）、冪等キー、`ActionState` |
| `components` | 面を組む器（カード・確認ダイアログ・操作の帯・待機表示・金額の切り替え） |
| `errors` | 確定の失敗を、画面が出す分類へ写す |
| `logging` | 後始末（カートからの取り除き）が失敗したときの記録。完了は見せ続ける |
| `observability` | 描画を span に載せる |

他 feature の `facade/` も引きます —— 購入の表示（`purchases`）と、明細に立った事情の言い方
（`cart`）。借りている理由は「借りているもの」に書いてあります。

## Action 戻り値契約

| Action | 置き場 | 戻り値 | 成功後 | 失敗時 |
| --- | --- | --- | --- | --- |
| `placeOrderAction` | `actions.ts` | `PlaceOrderFormState` | 完了画面へ `redirect`。購入した明細をカートから取り除く | 分類を確定の操作の隣に出す |

冪等キーと、承知の合図が無い送信の扱いは「設計上の判断」に書いてあります。

## テスト観点

- [ ] 確定が、画面の見せていた内容ではなくその時点のカートから明細を組み直す
- [ ] 承知の合図が無い送信を Action が止める
- [ ] 後始末（カートからの取り除き）が失敗しても完了が出る
- [ ] 参考換算額が読めなくても確定できる
- [ ] 冪等キーが 1 回の画面の組み立てにつき 1 つになる

## 設計上の判断

**外すのは買えない明細だけです。** 値が変わっただけの明細は購入に載せます。外すと、利用者が買う
つもりだったものが黙って落ちるためです。ただし**金額が変わったことは確定の操作で確かめます** ——
「このまま購入に進んでよいか」を問い、承知した合図が載った送信だけを通します。合図が無い送信は
Server Action の側でも止まります（画面を経由しない呼び出しがあるため）。

**承知したことは、その明細を今の数量で設定し直して伝えます。** 設定は提示済みの価格を今の価格へ
置き直すため、次の取得では事情が消え、小計にも含まれます。小計は事情の無い明細だけの合算なので、
確かめる前の画面では値の変わった明細がそこに入っていません。そのことは注記で示します。

**確定の送信は、この時点のカートから明細を組み直します。** 画面が見せていた内容を送り返すと、
開いたまま放置されたあいだに在庫や価格が変わっていても、古い前提のまま確定できてしまいます。

**冪等キーは画面を組み立てるたびに 1 つだけ作ります。** 二重に押しても再読み込みで送り直しても
購入は 1 件のままで、買い直しの意思で画面を開き直したときは別の鍵になります。

**成立したら別の URL へ送ります。** 同じ画面で完了を見せると、再読み込みで完了が消え、戻る操作が
確定前の画面へ帰ります。完了画面は購入を取り直して描くため、共有しても再読み込みしても同じ
内容が出ます。

**購入した明細は、成立の後にフロントがカートから取り除きます。** 購入はカートを空にしません。
取り除けなかった場合も完了は見せます。購入は既に成立しており、後始末の失敗を理由に完了を
隠すと、購入できなかったように映るためです。

**参考換算額が読めなくても購入は続きます。** 請求されるのは基準通貨の金額で、換算額は読み手が
大きさを掴むための添え物です（[0080](../../../docs/adr/0080-error-handling.md) の部分エラー）。
