---
imports-allowed: [model, components, adapters, capabilities, stores, errors, logging, observability]
forbidden: [features] # 画面まるごとの story は例外 (ADR 0021)
test-requirement: feature
coverage-exclusions:
  - "src/features/admin/analytics/analytics.fixture.ts"
  - "src/features/admin/products/products.fixture.ts"
  - "src/features/admin/products/list/list.fixture.ts"
  - "src/features/admin/users/users.fixture.ts"
---

# admin

商品や利用者を管理する側の画面スライスです。

利用者向けのスライスと同じ対象を扱っても、**部品は共有しません**。買う側は 1 件を眺めて選び、
管理側は同じ属性を件どうしで見比べます。見せ方の要求が違うものを 1 つの部品にまとめると、
どちらかの都合がもう一方へ漏れます。

## 受け入れるもの

- 管理操作のための取得の編成（一覧の位置と検索語の解釈、ページ送りの URL の組み立て）
- この画面専用の表示（商品の表・検索欄・待機表示）

## 受け入れないもの

- 他 feature への直接依存
- 汎用に使える表示（`StaticDataTable` / `Badge` / `CursorPagination` などは `components` から取る）
- 認可の判定そのもの（役割の宣言は `model/authz`、確定認可は route の layout が持つ）

## Route と契約

**認証はすべて「役割: admin」**です。二段で守る仕組みは「認可」に書いてあります。外枠の約束は
[`admin` の layout](../../../docs/spec/route/admin/layout.function.md) が持ちます。

| Route | 仕様書 |
| --- | --- |
| `/admin` | [`screen`](../../../docs/spec/route/admin/page.screen.md) / [`function`](../../../docs/spec/route/admin/page.function.md) |
| `/admin/analytics` | [`screen`](../../../docs/spec/route/admin/analytics/page.screen.md) / [`function`](../../../docs/spec/route/admin/analytics/page.function.md) |
| `/admin/products` | [`screen`](../../../docs/spec/route/admin/products/page.screen.md) / [`function`](../../../docs/spec/route/admin/products/page.function.md) |
| `/admin/products/new` | [`screen`](../../../docs/spec/route/admin/products/new/page.screen.md) / [`function`](../../../docs/spec/route/admin/products/new/page.function.md) |
| `/admin/products/[id]/edit` | [`screen`](<../../../docs/spec/route/admin/products/[id]/edit/page.screen.md>) / [`function`](<../../../docs/spec/route/admin/products/[id]/edit/page.function.md>) |
| `/admin/products/[id]/stock` | [`screen`](<../../../docs/spec/route/admin/products/[id]/stock/page.screen.md>) / [`function`](<../../../docs/spec/route/admin/products/[id]/stock/page.function.md>) |
| `/admin/shipments` | [`screen`](../../../docs/spec/route/admin/shipments/page.screen.md) / [`function`](../../../docs/spec/route/admin/shipments/page.function.md) |
| `/admin/users` | [`screen`](../../../docs/spec/route/admin/users/page.screen.md) / [`function`](../../../docs/spec/route/admin/users/page.function.md) |

**`/admin/shipments` の契約・状態・Action は [shipments/README.md](shipments/README.md) が持ちます。**
route の地図はここが持ちますが、その画面の中身は自分の README を持つ側の担当です。以下の表に
発送の行が無いのはそのためです。

この slice の画面が通す operationId。**変更する側はこの feature が呼びません** —— Server Action が
app 層にあるためで、理由は「Action 戻り値契約」に書いてあります。

| operationId | 用途 | 呼ぶ側 |
| --- | --- | --- |
| `GetDashboardSummary` | 入口と集計の数値 | feature |
| `GetProductsRankingQuantity` | 売れ筋の表 | feature |
| `GetProducts` | 商品の一覧 | feature |
| `GetProductsDetail` | 編集・在庫補充が読む 1 件 | feature |
| `GetProductCategories` / `GetProductStatuses` | 絞り込みとフォームの候補 | feature |
| `GetUsers` | 利用者の一覧 | feature |
| `PostProductsImages` | 画像の送信 | app 層の Action |
| `PostProducts` / `PatchProductsDetail` | 商品の作成・編集 | app 層の Action |
| `PatchProductsStock` | 在庫の増減 | app 層の Action |
| `DeleteUsersDetail` | 利用者の退会 | app 層の Action |

## 状態とデザイン参照

| 画面 | 状態 | story |
| --- | --- | --- |
| 入口 | success | `Page/Admin/Dashboard/Default` |
| | empty（購入が無い） | `Page/Admin/Dashboard/NoPurchases` |
| | loading | `Features/Admin/Skeleton/{Default,Mobile}` |
| 集計 | 期間を選んだ | `Page/Admin/Analytics/RangeSelected` |
| | 両端が逆 | `Page/Admin/Analytics/RangeReversed` |
| | 売れ筋が空 | `Page/Admin/Analytics/NoRanking` |
| | loading（下だけ取り直している間） | `Page/Admin/Analytics/SummaryPending` |
| 商品一覧 | success（廃番の行を含む） | `Page/Admin/Products/List/Default` |
| | empty | `Page/Admin/Products/List/Empty` |
| | 絞り込み・検索・ページ送り | `Page/Admin/Products/List/{MultipleFiltered,Searched,MiddlePage,LastPage}` |
| | loading | `Features/Admin/Products/List/Skeleton/Default` |
| 商品作成 | 入力・確認・拒否 | `Page/Admin/Products/Create/{Default,Confirm,Rejected}` |
| | loading | `Features/Admin/Products/New/Skeleton/Default` |
| 商品編集 | 拒否 / 版の食い違い | `Page/Admin/Products/Edit/{Rejected,Conflicted}` |
| | loading | `Features/Admin/Products/Edit/Skeleton/Default` |
| 在庫補充 | 補充 / 引き落とし / 在庫切れ | `Page/Admin/Products/Stock/{Replenishing,Deducting,OutOfStock}` |
| | 量が読めない / 版の食い違い / 取り直せない | `Page/Admin/Products/Stock/{RejectedQuantity,Conflicted,Unavailable}` |
| | loading | `Features/Admin/Products/Stock/Skeleton/Default` |
| 利用者 | success / empty | `Page/Admin/Users/{Default,Empty}` |
| | 退会の確認・成立・競合 | `Page/Admin/Users/{WithdrawConfirm,Withdrawn,WithdrawConflicted}` |
| | loading | `Features/Admin/Users/Skeleton/Default` |
| 配下の全画面 | error | `Features/Admin/ErrorState/{Default,WithDigest}` |

**loading と error は画面の合成からは届きません。**待機表示は `Suspense` の fallback、失敗表示は
`/admin` の error 境界が描くもので、どちらも取得が成立した後の画面を撮る E2E の画面比較には
現れません。VRT へ載せる経路は story しか無いため、部品そのものを story にしてあります。

上の表は画面の状態と story の対応です。部品そのものが表せる状態（帯ごとの幅・契約上の最大長・
送信中・拒まれた結果）は各部品の story（`Features/Admin/**`）が持ちます。

## 構成

画面ごとに掘り、その中を性質で分けます（[0027](../../../docs/adr/0027-directory-structure.md)）。

**商品は 4 つの画面（一覧・作成・編集・在庫補充）を持つため、画面の軸で割ってあります。**複数の画面が
共有するものは、どの画面のものでもないので 1 段上（`products/` 直下と `products/ui/`）が所有します。
利用者は画面を 1 つしか持たないため、軸を挟まず `users/` の直下に置きます。

| ファイル | 役割 |
| --- | --- |
| `paths.ts` | 管理画面のパス。画面どうしの導線と、利用者向けの器からの入口が引く |
| `analytics/period.ts` | 集計の URL 契約（期間の区分と両端の日付）とキーの呼び名。指定が成立しているかの判断も持つ |
| `analytics/read-period.ts` | URL を読む側。組む側と分けてある（[`rules.md`](../../../docs/rules.md) #76） |
| `analytics/period-window.ts` | 選ばれた期間が対象にしている暦日。契約が返さないので同じ規則を辿る |
| `count.ts` | 件数の locale 対応整形。2 つ目の feature が要る段で `model` へ上げる |
| `summary-cards.ts` | 合成済みの集計を数値カードの並びへ写す。母集団の断りを値に添える |
| `analytics/ranking-rows.ts` | 売れ筋の表に並べる 1 行。順位は契約が返した並びの位置 |
| `dashboard/page-content.tsx` | 入口（今日）の取得と組み立て |
| `analytics/page-content.tsx` | 集計の URL 解釈と、取り直す範囲の区切り。取得は持たない |
| `analytics/summary-section.tsx` | 期間が変わったときに取り直す区画。期間が決まっていないときの案内も持つ |
| `analytics/ranking-section.tsx` | 期間の選択に従わない区画。別の待機に置く |
| `dashboard/view.tsx` | 入口の画面。数値カードと内訳、期間指定への導線 |
| `analytics/view.tsx` | 集計の画面。期間の選択の下へ、取り直す区画を slot で受ける |
| `ui/stat-cards/` | 数値カードの並び。注記を値と同じ枠に置く |
| `ui/status-bars/` | 横棒の描画そのもの。作図の一式を持ち込まず、要素と CSS だけで描く |
| `ui/status-breakdown/` | 横棒と数値表の併置。合計は出さない |
| `analytics/ui/period-switch/` | 集計対象期間の選び直し。日付の要らない 2 つは link |
| `analytics/ui/period-caption/` | いま出ている数がどの暦日の話かを添える |
| `analytics/ui/range-dialog/` | 期間の両端を overlay で選ぶ。中身は native の GET フォーム |
| `analytics/ui/ranking-table/` | 売れ筋の表。期間の選択には従わず、商品名は商品の面へ出る |
| `ui/skeleton/` | 集計の待機表示 |
| `products/field-limits.ts` | 契約が課す上限と、受け付ける画像の形式 |
| `products/product-rules.ts` | 入力 1 項目の判定と文言。送る側と受ける側の両方が通る |
| `products/form-state.ts` | 商品のフォームの結果の型と、送信先の型。版の食い違いの文言もここが持つ |
| `products/parse-product-form.ts` | 送られてきた内容の読み取り。入力欄の名前もここだけが持つ |
| `products/form-sections.ts` | フォームが持つ段とその並び。確認は作る画面にしかないので含めない |
| `products/master-option.ts` | マスタをフォームで選べる候補へ直す。送る値は識別子 |
| `products/use-product-values.ts` | 入力の値・触れた印・段ごとの妥当性 |
| `products/use-product-images.ts` | 選んだ画像の一覧と、送信・並び替え |
| `products/use-image-rejection.ts` | 送る前に弾かれたファイルの文言 |
| `products/use-action-result-freshness.ts` | 直前の送信の結果を、いま出してよいか |
| `products/use-product-form.ts` | 作成と編集が共有する状態の組み立て。送信の結果の鮮度も持つ |
| `products/form-names.ts` | 入力欄の `name`。送る側と読む側が同じ綴りを見る |
| `products/validation-summary.ts` | 項目ごとの誤りを、要約が並べる形へ写す |
| `products/image-rejection.ts` | 弾かれたファイルの言い方と、大きさの整形 |
| `products/ui/text-field/` `products/ui/select-field/` | 入力 1 項目。値は呼び出し元が持つ |
| `products/ui/basics-section/` `description-section/` `images-section/` `publish-section/` `confirm-section/` | 作成と編集が共有する段の中身。自分が段であることは知らない |
| ↳ `description-editor.tsx` / `confirm-details.tsx` | 重い部品を**いつ読むか**と、**何を描くか**の分かれ目。器へ読み込みの都合を混ぜないため分けてある |
| `products/ui/submit-button/` `products/ui/form-feedback/` | 送信の操作と、送信の結果 |
| `products/list/query.ts` | 一覧の URL 契約（絞り込みとページ送りの位置）とキーの呼び名。通ってきた道もここが持つ |
| `products/list/page-size.ts` | 1 ページに並べる件数 |
| `products/list/filter-option.ts` | 絞り込みで選べる候補の形と、マスタからの写し |
| `products/list/active-filters.ts` | いま効いている条件を、解除先付きの一覧へ写す |
| `products/list/row.ts` | 表に並べる 1 行の形。商品とマスタを突き合わせて状態の見た目を決め、廃番はラベルより先に出す |
| `products/list/status-tone.ts` | 状態のコードと見た目の対応。契約が返さない意味づけをこの画面が持つ |
| `products/list/page-content.tsx` | URL の解釈と画面の組み立て。取り直す範囲をここで区切る |
| `products/list/results.tsx` | 1 ページ分の取得と、表・ページ送りの組み立て |
| `products/list/view.tsx` | 検索欄・絞り込み・効いている条件・作成への導線。一覧本体は受け取る |
| `products/list/ui/table/` | 商品の表。行ごとの操作は menu へ畳む |
| `products/list/ui/keyword-field/` | 商品名で探す入力欄。打鍵では検索せず、確定の操作で飛ばす |
| `products/list/ui/filter-control/` | 分類・状態の選択欄そのもの。選ばれた値をどう扱うかは持たない |
| `products/list/ui/filter-select/` | 選んだ時点で反映する絞り込み。広い段で使う |
| `products/list/ui/filter-sheet/` | 狭い段の絞り込み。下端の操作から開き、overlay の中でまとめて確定する |
| `products/list/ui/skeleton/` | 表の待機表示 |
| `products/new/page-content.tsx` `products/new/view.tsx` | 作成。段階に分けて進み、最後に確認を置く |
| `products/new/ui/skeleton/` | フォームの待機表示。段階の進捗を先頭に持つ |
| `products/edit/page-content.tsx` `products/edit/view.tsx` | 編集。観点を切り替えて直す。版を持ち回る |
| `products/edit/ui/skeleton/` | フォームの待機表示。観点の切り替えを先頭に持つ |
| `products/stock/stock-direction.ts` | 在庫を動かす向きと、契約が受け取る符号付きの増減量への畳み方 |
| `products/stock/stock-quantity.ts` | 動かせる量として読めるかの規則。送信を読む側と見込みを出す側が同じものを見る |
| `products/stock/form-state.ts` | 在庫のフォームの結果の型と、送信先の型 |
| `products/stock/form-names.ts` | 在庫のフォームの `name`。送る側と読む側が同じ綴りを見る |
| `products/stock/parse-stock-form.ts` | 送られてきた向きと量の読み取り |
| `products/stock/page-content.tsx` `products/stock/view.tsx` | 在庫補充。フォームの器は結果だけを見る |
| `products/stock/breadcrumb-content.tsx` | 在庫補充の現在地までの階層。商品名のために取得する |
| `products/stock/ui/current-stock/` | いま判っている在庫と、その鮮度・取り直す導線 |
| `products/stock/ui/amount-fields/` | 向きと量。打っている途中の値を持ち、見込みを添える |
| `products/stock/ui/projection/` | 送信後の見込み。参考値であることと、負のときの断り |
| `products/stock/ui/skeleton/` | フォームの待機表示 |
| `users/query.ts` | 利用者一覧の URL 契約（範囲とページ番号）とキーの呼び名。上限は呼び出し側から受け取る |
| `users/page-size.ts` | 1 ページに並べる件数 |
| `users/page-content.tsx` | URL の解釈と画面の組み立て。取り直す範囲をここで区切る |
| `users/page-window.ts` | ページ送りに並べる番号の選び方。離れた範囲を省略の印へ畳む |
| `users/row.ts` | 表に並べる 1 行の形。姓名を並べ、退会済みかを真偽値へ落とす |
| `users/form-state.ts` `users/form-names.ts` | 退会の結果の型・送信先の型と、送信の `name` |
| `users/results.tsx` | 1 ページ分の取得と、一覧・ページ送りの組み立て |
| `users/view.tsx` | 絞り込み。一覧本体は受け取る |
| `users/ui/withdrawable-list/` | 行・確認・結果を繋ぐ層。どれが同じ相手の話かをここだけが知る |
| `users/ui/table/` | 利用者の表。退会済みの行には操作を出さない |
| `users/ui/scope-select/` | 対象の範囲の選び直し。選んだ時点で移る |
| `users/ui/withdraw-dialog/` | 退会の確認。不可逆であることと、後始末が同時に終わらないことを書く |
| `users/ui/withdraw-feedback/` | 退会の結果。確認が閉じても残る場所 |
| `users/ui/submit-button/` | 退会の送信。`useFormStatus` を読むため form の子で切り出す |
| `users/ui/skeleton/` | 表の待機表示 |
| `ui/error-state/` | 取得に失敗したときの表示。`/admin` の error 境界が使う。境界は 1 枚なので画面を名指ししない |
| `shipments/` | 発送の画面。**自分の README を持つ**（[README](shipments/README.md)） |

**`feature` の宣言が掛かるのは、画面の単位で組み上げたものです**。`page-content.tsx` / `view.tsx` /
`*-section.tsx` が対象で、部品が揃って初めて成立する振る舞いを負います
（[0090](../../../docs/adr/0090-testing-strategy.md)）。**`ui/` の単一部品は `component` の形**——
その部品 1 つの描画契約と、[0091](../../../docs/adr/0091-test-verification-methods.md) が要求する
a11y の自動検査——で、**画面を跨ぐ純関数（`count.ts` / `summary-cards.ts` / `paths.ts` /
`analytics/period.ts` など）は `unit` の形**——描画を持たず、戻り値と分岐を直接照合する——で
確かめます。合成を持たないものへ合成のテストを課しても、確かめる相手が無いためです。

## 依存カーネル

| カーネル | 用途 |
| --- | --- |
| `adapters` | 集計・商品・購入・利用者の取得と、画像 URL の解決 |
| `model` | 表示モデル（`Product` / `Purchase` / `Dashboard`）、ページ送り、期間、`ActionState` |
| `components` | 面を組む器（表・ページ送り・ファイル送信・離脱の警告・入力の要約） |
| `errors` | 取得と送信の失敗を、画面が出す文言へ写す |
| `observability` | 描画を span に載せる |

**他 feature の `facade/` を引きません。**利用者向けの slice と同じ対象を扱っても部品を共有しない、
という冒頭の線引きがそのまま依存にも出ています。

## Action 戻り値契約

**この slice の Server Action は feature の下ではなく app 層にあります。**

| Action | 置き場 | 戻り値 | 成功後 | 失敗時 |
| --- | --- | --- | --- | --- |
| `uploadProductImageAction` | `src/app/admin/products/actions.ts` | `ProductImageUploadState` | 送信済みの鍵を返す | 弾かれた理由を選んだ面に出す |
| `createProductAction` | 同上 | `ProductFormState` | 一覧へ `redirect` | 項目ごとの誤りを段へ戻す |
| `updateProductAction` | 同上 | `ProductFormState` | 同上 | 同上。版の食い違いは言い分ける |
| `adjustProductStockAction` | 同上 | `StockFormState` | 同上 | 同上 |
| `withdrawUserAction` | `src/app/admin/users/actions.ts` | `WithdrawUserState` | **一覧は取り直させない** | 競合は言い分け、確認が閉じても残る場所に出す |

**退会だけ一覧を取り直させません。**後始末が結果整合で続くため、直後に取り直しても反映前の
一覧を見せるだけになります。何が起きたかは送信の結果が伝えます。

画面は Action を props で受け取るだけです。**`route` の器が Action を持つ形にしてあるのは、
`page.tsx` と同じ段に置いた `actions.ts` が route の入口と 1 対 1 に対応するため**で、判定と
組み立ては feature 側（`products/parse-product-form.ts` など）が持ちます。

## テスト観点

- [ ] 役割を持たない主体に、管理の面への導線が出ない
- [ ] 写せなかった条件が捨てられず、一覧の代わりにそのことが出る
- [ ] 版の食い違い（409）が、ほかの失敗と言い分けられる
- [ ] 退会済みの行に操作が出ない

層の割り当て（`feature` / `component` / `unit`）は「構成」の末尾にあります。

## 認可

この配下の画面はすべて `/admin` の下にあり、二段で守られます。

1. **前捌き** — `src/proxy.ts` が cookie の session だけを読み、役割が足りない要求を送り返す
2. **確定認可** — `src/app/admin/layout.tsx` が `verifySession()` を通し、役割を確かめる

どの経路に何の役割が要るかは [`src/model/authz.ts`](../../model/authz.ts) が持ちます。確定認可も、
利用者向けの器が admin への入口を出すかどうかも、同じ `isAdmin()` を引きます。判定が別々に書かれて
いると「入れないのに入口が出ている」状態を作れてしまいます（[0079](../../../docs/adr/0079-auth-frontend-seam.md)）。

**役割を持たない人には導線を出しません。** 押せる場所を作らないことが出し分けであり、押した先で
断る作りにすると、管理の面がある事実だけが誰にでも伝わります。

## 条件の検証と失敗

URL から読んだ条件は、**取得の口が持つ検証**（`adapters/server/api/products` の `parseProductQuery`）を
通してから渡します。画面側で数値化などの写しを作ると、契約を再生成しても写し方だけが古い範囲の
まま残ります（[0029](../../../docs/adr/0029-type-design-discipline.md)）。写せなかった条件は捨てず、
一覧の代わりにそのことを出します。

取得の失敗は `src/app/admin/error.tsx` が受けます。ここが無いと `global-error` まで抜け、脇の導線も
header も失われた素の画面になります（[0080](../../../docs/adr/0080-error-handling.md)）。

## 契約との関係で気を付けること

**未公開の商品を並べるのは `includeUnpublished` の指定です。** admin だけが `true` を通せ、未認証は
401、役割が足りなければ 403 になります。**母集団が変わると並び順の軸も変わる**ため、ページ送りの
鍵は同じ指定の中でだけ使えます（`products/list/results.tsx`）。

商品の「状態」は在庫・販売の状態（在庫あり・在庫切れ・廃盤など）で、**公開の可否とは別の軸**です。
公開の可否は `publishedAt` が持ち、状態マスタでの絞り込みが効くかどうかとは関係しません。

**廃番はマスタのラベルではなく、`discontinuedAt` が持つ事実です。** 廃番にする操作はマスタの状態を
書き換えないため、廃番の商品は `在庫あり` のようなラベルを保ったまま届きます。一覧の状態の欄は
ラベルより廃番を先に出します（`products/list/row.ts`）。マスタの `廃盤` は admin が手で付けられる
表示上のラベルで、別物です。

**在庫僅少の一覧（`GetProductsLowStock`）は契約にありますが、この slice は使っていません。**入口の
数値カードとは独立した後続の機能です。
