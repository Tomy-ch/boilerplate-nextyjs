---
imports-allowed: [model, components, adapters, capabilities, stores, errors, logging, observability]
forbidden: [features] # 相方の facade/ と、画面まるごとの story は例外
test-requirement: feature
coverage-exclusions:
  - "src/features/purchases/__mocks__/**"
---

# purchases

成立した購入を後から読むための画面スライスです。一覧（`/purchases`）と 1 件の詳細（`/purchases/[code]`）を持ちます。

## 受け入れるもの

- 購入履歴の取得の編成と、増分取得（無限スクロール）の状態
- 期間の絞り込みを URL の条件として読み書きすること
- この画面専用の表示（履歴の行・期間の入力欄・控え・内訳・明細）

## 受け入れないもの

- 他 feature の内部への依存（商品一覧の URL は `products` の `facade/` から取る）
- 購入を作ること（`checkout` の領分）
- 金額の計算（小計・税・送料・合計はバックエンドが決めた値）

## Route と契約

| Route | 仕様書 | 認証 |
| --- | --- | --- |
| `/purchases` | [`screen`](../../../docs/spec/route/shop/purchases/page.screen.md) / [`function`](../../../docs/spec/route/shop/purchases/page.function.md) | 必要 |
| `/purchases/[code]` | [`screen`](<../../../docs/spec/route/shop/purchases/[code]/page.screen.md>) / [`function`](<../../../docs/spec/route/shop/purchases/[code]/page.function.md>) | 必要 |

使う operationId。

| operationId | 用途 |
| --- | --- |
| `GetPurchases` | 履歴。先頭ページはサーバ側、続きは `/api/purchases` 経由 |
| `GetPurchasesDetail` | 1 件の詳細 |
| `PatchPurchasesCancel` | 取り消し |
| `PatchPurchasesPay` | 支払い |
| `GetExchangeRates` | 参考換算額。読めなくても詳細は出す |

**発送と配達（`PatchPurchasesShip` / `PatchPurchasesDeliver`）はここが呼びません。** 売り手側の
遷移で、`admin` が持ちます。

## 状態とデザイン参照

| 画面 | 状態 | story |
| --- | --- | --- |
| 履歴 | success | `Page/Purchases/History/Default` |
| | empty（購入が 1 件も無い） | `Page/Purchases/History/NoPurchases` |
| | empty（その期間に無い） | `Page/Purchases/History/NoResultInPeriod` |
| | loading | `Features/Purchases/History/Skeleton/Default` |
| | 続きを読んでいる | `Page/Purchases/History/LoadingMore` |
| | 続きの取得に失敗 | `Page/Purchases/History/LoadMoreFailed` |
| | 末尾まで読んだ | `Page/Purchases/History/ReachedEnd` |
| 詳細 | success | `Page/Purchases/Detail/Default` |
| | 支払い済み / 配達済み | `Page/Purchases/Detail/{Paid,Delivered}` |
| | 参考換算額が読めなかった | `Page/Purchases/Detail/WithoutReference` |

**空の状態を 2 つに分けています。**「まだ買っていない」と「その期間に無い」は利用者が次に取る
行動が違います。**詳細は loading を持ちません** —— 理由は「設計」にあります。error は route の
`error` 境界、見つからない場合は `not-found` が受けます。

## 構成

画面（`history` / `detail`）ごとに掘り、その中を性質で分けます。
どちらの画面にも属さないものは画面を挟まず直下へ置きます。

| ファイル | 役割 |
| --- | --- |
| `facade/paths/` | この feature が持つ 2 つのルート。マイページ（`account`）の導線が参照する |
| `facade/receipt/` | 購入の控え（注文番号・注文日時・状況）。**購入完了も同じ形で出す** |
| `facade/lines/` | 結合済みの明細。**購入完了も同じ形で出す** |
| `facade/amount-summary/` | 請求額の内訳と円の参考換算額。**購入完了も同じ形で出す** |
| `facade/status-emphasis/` | ステータスの名称から badge の見た目を選ぶ。3 つに束ねる |
| `purchases.fixture.ts` | story とテストが使う固定の購入 |
| `facade/purchase.fixture.ts` | `facade/` の 3 つと、それを借りる `checkout` が読む固定値 |
| `actions.ts` | 状態を進める送信。契約の遷移を呼び、競合だけ言い分ける |
| `__mocks__/actions.ts` | カタログでの Server Action の差し替え |
| `form-names.ts` | 送信が持つ項目の名前 |
| `form-state.ts` | 送信の結果の器と、状況で拒まれたときの文言 |
| `history/query.ts` | 画面が受け取る素の条件と、ページ送りの寸法（件数・カーソルのキー） |
| `history/period.ts` | 期間の条件。URL のキーと組み立て、利用者への言い換え |
| `history/read-period.ts` | URL を読む側。組む側と分けてある（[`rules.md`](../../../docs/rules.md) #76） |
| `history/period-draft.ts` | 組み立て中の期間。入力欄が経由する途中の姿と、確定できるかの判定 |
| `history/page-content.tsx` | 条件の解釈と、画面と待機の境界の組み立て |
| `history/results.tsx` | 先頭ページの取得。期間が変わったときに取り直す範囲 |
| `history/use-infinite-purchases.ts` | 2 ページ目以降の取得と末尾到達の検知 |
| `history/view.tsx` | 一覧の画面。絞り込みと一覧本体を組む |
| `history/ui/infinite-list/` | 読み進められる一覧。取得と見た目をつなぐ |
| `history/filter-draft.tsx` | 組み立て中の期間の供給。幅で 2 か所に現れる入力欄を 1 つに保つ |
| `history/ui/period-fields/` | 期間の入力欄。区分と、その区分が使う入力欄。確定は持たない |
| `history/ui/period-bar/` | 帯の中に常設する絞り込み。一覧が隣に見えている幅で使う |
| `history/ui/period-sheet/` | 帯を常設できない幅の絞り込み。下端に固定した操作から overlay を開く |
| `history/ui/purchase-row/` | 履歴の 1 行。行そのものが詳細への行き先 |
| `history/ui/purchase-list/` | 読み進めた一覧の見た目。続きの状態は `LoadMore` が持つ |
| `history/ui/empty/` | 並べるものが無いときの表示 |
| `history/ui/skeleton/` | 一覧の待機表示 |
| `detail/page-content.tsx` | 1 件の取得。`not-found` の分類もここで受ける |
| `detail/view.tsx` | 詳細の画面。パンくずと `facade` の 3 つの塊を組む |
| `detail/available-transitions.ts` | ステータスごとにできること。バックエンドの遷移規則を写したもの |
| `detail/ui/transitions/` | その購入にいまできる操作と、成立の知らせ |
| `detail/ui/transitions/presentation.ts` | 遷移ごとの言葉と見た目。開く操作と確定する操作で分ける |
| `detail/ui/transition-button/` | 状態を 1 つ進める操作。確認を開き、通らなかったことをその中で伝える |

## 依存カーネル

| カーネル | 用途 |
| --- | --- |
| `adapters` | 履歴・詳細・参考換算額の取得と、状態を進める送信 |
| `model` | 表示モデル（`Purchase` / ステータス）、期間の型、`ActionState` |
| `components` | 面を組む器（カード・バッジ・入力欄・続きの読み込み・印刷の操作） |
| `capabilities` | 末尾到達の検知（`use-on-visible`） |
| `errors` | 遷移が通らなかったときの分類を文言へ写す |
| `observability` | 描画を span に載せる |

商品一覧の URL は `products` の `facade/` から取ります（キーを写しません）。

## Action 戻り値契約

| Action | 置き場 | 戻り値 | 成功後 | 失敗時 |
| --- | --- | --- | --- | --- |
| `cancelPurchaseAction` | `actions.ts` | `PurchaseTransitionState` | `revalidatePath` | 確認を開いたまま、その中で伝える |
| `payPurchaseAction` | `actions.ts` | `PurchaseTransitionState` | 同上 | 同上 |

**競合（409）だけ言い分けます。** ほかの誰か・別のタブが先に進めた状態で押した場合で、押した人が
取れる行動（画面を読み直す）が他の失敗と違います。

## テスト観点

- [ ] 期間の絞り込みがクエリでサーバへ渡る（取得済みのページを絞らない）
- [ ] 必須の欠けた期間の URL が全期間へ倒れ、400 にならない
- [ ] いまできない遷移の操作が現れない
- [ ] 遷移が通らなかったことが、開いたままの確認の中に出る
- [ ] 知らないステータスの業務キーが進行中へ倒れ、一覧が読める

## 設計

- **絞り込みは必ずクエリでサーバへ渡します。** 取得済みのページに日付の条件を掛けると、条件に合う
  古い購入が落ちた一覧になります。読み込んであるのは新しいほうから数ページぶんでしかないためです
- **区分ごとの必須が欠けた条件は作れません。** 効いている条件は判別可能 union で持ち、入力欄が経由する
  途中の姿は別の型（`period-draft.ts`）に分けています
- **読めない条件は全期間へ倒します。** URL は利用者が直接編集できるので、必須の欠けた URL も届きます。
  そのまま契約へ渡すと一覧そのものが 400 になり、画面に何も出せません
- **ステータスの色は 3 つに束ねます。** 進行中 / 望ましい終端 / 取り消しで、これはバックエンドの
  状態遷移が持つ区別（終端かどうか、取り消しかどうか）そのものです。色は文言の補強でしかなく、
  badge は必ず名称を文字で持ちます
- **ステータスは業務キーで引きます。** 契約はステータスに業務キー（`code`）と名称の両方を載せ、
  分岐に使うものとして業務キーを定義しています。名称は利用者へ見せる文言で、backend 側の都合で
  書き換わります。知らない業務キーは進行中へ倒すので、マスタが増えても色が付かないだけで一覧は
  読めます
- **条件が 1 つなので `FilterBar` を使いません。** あの組は条件が複数あることを前提に、効いている条件を
  chip で並べてまとめて解除する導線を持ちます。期間ひとつなら入力欄そのものが効いている条件の表示に
  なり、chip はその写しにしかなりません。overlay の中にあって入力欄が見えない幅では、開く操作の文言に
  効いている期間を出します
- **overlay の確定では閉じません。** 閉じるのは確定した期間が一覧へ届いたときです。閉じる操作と遷移を
  同時に撃つと、overlay が戻る操作のために積んだ履歴を戻す動きが、まだ届いていない遷移を打ち消します
  （[`use-overlay-history`](../../components/design-system/overlay/use-overlay-history.ts)）。確定も
  全期間へ戻す操作も、履歴を積まずに差し替えます。期間が変わらないときは届くものが無いので、その場で
  閉じます
- **購入の表示は `facade` が持ちます。** 控え・明細・内訳は購入完了（`checkout`）も同じものを出します。
  同じ購入が画面によって違う見え方になると、控えとして突き合わせられません。`components` へ上げられない
  のは、いずれも題材の語彙（注文・購入）を持ち、コア残留の検査に弾かれるためです
- **できない操作は出しません。** 押せないボタンは「いつか押せる」と読めてしまいます。何ができるかは
  業務キーから引き、その表はこの画面が持ちます。バックエンドが持つ状態遷移の規則を写したものなので、
  カーネルへは上げません。管理側の操作が同じ判定を必要としたときに、そこで初めて共有先を決めます。
  並べる順もこの表が持ち、進む操作が先に来ます
- **通らなかったことは確認の中で伝えます。** 送信しても確認は開いたままなので、外へ出すと利用者が
  見ていない場所に文言が出ます。逆に成立の知らせは操作が並ぶ段が持ちます。進んだ購入では操作ごと
  確認が消えるためです
- **詳細は待機の状態を持ちません。** 購入は見つからないことがあり、その route に `loading.tsx` は
  置けません。取得の待ちは route が丸ごと引き受けるので、
  この画面に skeleton はありません。一覧のほうは Suspense の境界を持つので `history/ui/skeleton/` があります
- **増分取得の部品は商品一覧と共有です。** 続きの読み込みの状態は
  [`LoadMore`](../../components/app-starter/load-more/README.md)、目印が見えたことを知るのは
  [`use-on-visible`](../../capabilities/use-on-visible.ts) が持ちます。積み上げの状態機械だけが
  feature に残るのは、読み進めた位置を URL へ書き戻すかどうかも、積み直す契機も画面ごとに違うためです

## 関連する ADR

- [0021](../../../docs/adr/0021-frontend-responsibility.md) — 層の責務と import 境界。貸すものを `facade/` に出し、他 feature の内部は見ない
- [0026](../../../docs/adr/0026-layout-shell-mount.md) — 殻と Provider の据え付け。画面ごとには置かない横断 UI の位置
- [0027](../../../docs/adr/0027-directory-structure.md) — 物理配置と co-location。画面ごとに掘り、その中を性質で分ける
- [0029](../../../docs/adr/0029-type-design-discipline.md) — 判別可能 union と境界での parse。効いている条件と入力途中の姿を分ける
- [0051](../../../docs/adr/0051-styling-system.md) — デザイントークンと帯ごとの出し分け
- [0053](../../../docs/adr/0053-ui-component-interaction-seam.md) — 操作の a11y 継ぎ目。確認・シート・紙面の継ぎ目
- [0054](../../../docs/adr/0054-ui-catalog-storybook.md) — カタログの方針。Server Action の差し替え
- [0070](../../../docs/adr/0070-backend-role-separation.md) — バックエンドとの責務線。金額と状態遷移の規則を画面で決めない
- [0073](../../../docs/adr/0073-pagination-fetch-boundary.md) — ページ送り / 増分取得の境界。続きをどこから読むか
- [0079](../../../docs/adr/0079-auth-frontend-seam.md) — 認証の前面の継ぎ目。他人の購入へ届く経路を画面が持たない
- [0080](../../../docs/adr/0080-error-handling.md) — エラーの扱い。`error` / `not-found` の受け持ちと待機の置き場
- [0100](../../../docs/adr/0100-accessibility-target.md) — アクセシビリティの目標水準。色だけで区別させない
- [0120](../../../docs/adr/0120-locale-aware-formatting.md) — 日付・数値の書式
