---
imports-allowed: [model, components, adapters, capabilities, stores, errors, logging, observability]
forbidden: [features] # 相方の facade/ と、画面まるごとの story は例外
test-requirement: feature
---

# admin/shipments

支払いを終えてまだ発送していない注文を、まとめて発送してよい便ごとに扱う画面スライスです
（`/admin/shipments`）。

## 受け入れるもの

- 発送待ちの取得の編成と、便ごとの表示
- 発送の送信の組み立て（1 件ずつ / 便をまとめて）と、その結果の表示

## 受け入れないもの

- 便の分け方と並び順（契約が決める）
- 役割の確認（送信の受け口である app 層が持つ）
- 購入 1 件の詳細（本人向けの画面が持ち、管理側に 1 件を眺める面は無い）

## Route と契約

| Route | 仕様書 | 認証 |
| --- | --- | --- |
| `/admin/shipments` | [`screen`](../../../../docs/spec/route/admin/shipments/page.screen.md) / [`function`](../../../../docs/spec/route/admin/shipments/page.function.md) | 役割: admin |

親（[`admin`](../README.md)）の「認可」がこの画面にもそのまま掛かります。

使う operationId。

| operationId | 用途 | 呼ぶ側 |
| --- | --- | --- |
| `GetPurchasesShippable` | 発送待ちの便 | feature |
| `GetPurchases` | 発送済みの確認待ち | feature |
| `PatchPurchasesShip` | 発送。便をまとめても購入 1 件ずつ呼ぶ | app 層の Action |
| `PatchPurchasesDeliver` | 配達の確認 | app 層の Action |

## 状態とデザイン参照

| 画面 | 状態 | story |
| --- | --- | --- |
| 発送 | success | `Page/Admin/Shipments/Default` |
| | empty（どちらの区画も空） | `Page/Admin/Shipments/Empty` |
| | 発送待ちが無い | `Page/Admin/Shipments/ShippedOnly` |
| | loading | `Features/Admin/Shipments/Skeleton/Default` |
| 便 1 つ | 未発送 / 発送済み / 途中まで通った / 拒まれた | `Features/Admin/Shipments/DispatchGroupCard/{Default,Shipped,PartiallyShipped,Refused}` |

**途中まで通った送信に専用の story を置いてあります。** まとめて発送する画面の要は
「1 つの成否に畳まない」ことなので、その姿が実物として残っている必要があります。error は親が持つ
`Features/Admin/ErrorState` が受けます（[`admin`](../README.md) の「状態とデザイン参照」）。

## 構成

| ファイル | 役割 |
| --- | --- |
| `form-names.ts` | 送信が持つ項目の名前。発送する注文は繰り返して並べる |
| `form-state.ts` | 送信の結果の器（発送は通った件数と通らなかった件数、配達は確認した注文）と、拒まれたときの文言 |
| `shipments.fixture.ts` | story とテストが使う固定の便と、配達待ちの注文 |
| `page-content.tsx` | 待機の境界の組み立て |
| `results.tsx` | 発送待ちと発送済みの取得。見た目を持たない |
| `view.tsx` | 便を縦に積み、その下に発送済みを並べる |
| `ui/dispatch-group/` | 便 1 つ分。宛先・注文の並び・発送の操作・結果 |
| `ui/delivery-list/` | 発送済みの並び。配達を確認する操作と結果 |
| `ui/empty/` | どちらの区画も空のときの表示 |
| `ui/skeleton/` | 便の待機表示 |

## 依存カーネル

| カーネル | 用途 |
| --- | --- |
| `adapters` | 発送待ちと発送済みの取得 |
| `model` | 表示モデル（便・購入・ステータス）と `ActionState` |
| `components` | 面を組む器（カード・表・送信の操作） |
| `observability` | 描画を span に載せる |

## Action 戻り値契約

**Server Action は app 層にあります**（理由は親の「Action 戻り値契約」）。

| Action | 置き場 | 戻り値 | 成功後 | 失敗時 |
| --- | --- | --- | --- | --- |
| `shipPurchasesAction` | `src/app/admin/shipments/actions.ts` | `ShipmentState` | 1 件でも通れば一覧を取り直し、通った件数と競合で飛ばした件数を返す | 1 件も通らなければ競合として返す。競合以外はその場で打ち切り、分類だけを返す |
| `deliverPurchaseAction` | 同上 | `DeliveryState` | 一覧を取り直し、確認した注文を返す | 競合とそれ以外を言い分け、その操作の隣に出す |

**件数が載るのは成功したときだけです。** 打ち切った送信が返すのは分類で、そこまでに通った分は
返り値ではなく取り直した一覧に現れます。

## テスト観点

- [ ] まとめる操作が、同じ送信に注文を並べて送る形になっている
- [ ] 途中で打ち切られた送信でも、そこまでに通った発送が一覧へ反映される
- [ ] 1 件でも通ったら一覧が取り直される
- [ ] 配達の確認がまとめられない
- [ ] 便と便の中の順序を画面が並べ直さない

## 設計

- **配達の確認はまとめません。** 届いたかどうかは注文ごとに分かれるので、まとめて確認できる形に
  すると、確かめていないものまで確認済みにする経路ができます
- **並べ直しません。** 便の分け方も、便の中の順序も、便同士の順序も契約が決めています。画面が
  並べ直すと、「まとめて発送してよい単位」という契約の判断に画面の判断が重なります
- **まとめる操作は、同じ送信に注文を並べて送るだけです。** 契約の発送は購入 1 件ずつで、まとめて
  指示する口がありません。まとめる単位を送信の形の違いで表すと、受け取る側が 2 通りになります
- **途中まで通った送信を失敗にしません。** 便をまとめると途中で拒まれ得ます。1 つの成否に畳むと、
  通った分がそのまま見えなくなるので、通った件数と通らなかった件数を両方伝えます
- **1 件でも通ったら一覧を取り直させます。** 発送した注文は発送待ちではなくなるので、残したままに
  すると押せば必ず競合になる操作が並び続けます。途中で打ち切ったときも同じで、打ち切りの理由を
  伝えることと、そこまでに成立した発送を反映することは別の話です
- **確認を挟みません。** 発送は流れ作業で、一つずつ確認を挟むと確認を読まずに押す習慣を作ります。
  対象は押す前から画面に出ています
- **購入者は識別子のまま出します。** 契約が呼び名を載せません。便を見分けるのが目的なので識別子で
  足ります

## 関連する ADR

- [0021](../../../../docs/adr/0021-frontend-responsibility.md) — 層の責務と import 境界。他 feature へ貸すものを `facade/` に出す
- [0025](../../../../docs/adr/0025-app-layer-elements.md) — app 層の構成要素。送信の受け口が役割の確認を持つ
- [0040](../../../../docs/adr/0040-routing-rendering-strategy.md) — 描画戦略。取得と client 島の分界
- [0061](../../../../docs/adr/0061-form-mutation-ux.md) — `<form action>` + Server Action の正機構
- [0070](../../../../docs/adr/0070-backend-role-separation.md) — バックエンドとの責務線。便の分け方と並び順は契約が決める
- [0073](../../../../docs/adr/0073-pagination-fetch-boundary.md) — ページ送り / 増分取得の境界。一覧に送りを持たせる条件
