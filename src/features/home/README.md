---
imports-allowed: [model, components, adapters, capabilities, stores, errors, logging, observability]
forbidden: [features] # 相手の facade/ と、画面まるごとの story は例外
test-requirement: feature
---

# home

トップの画面スライスです。売れ筋ランキング・新着商品・カテゴリ導線を並べます。

## 受け入れるもの

- 3 系統の取得の編成と、系統ごとの成否の扱い（要求ごとに取る 2 系統と、待たずに配れる 1 系統）
- この画面専用の表示（節ごとの帯・商品の teaser・待機表示・節単位の失敗表示）

## 受け入れないもの

- 他 feature の内部への依存（一覧の URL は `products` の `facade/` から取る）
- 汎用に使える表示（`Card` / `Badge` / `MediaImage` / `Alert` は `components` から取る）
- パーソナライズ（誰に対しても同じ内容を出す画面です）

## Route と契約

| Route | 仕様書 | 認証 |
| --- | --- | --- |
| `/` | [`screen`](../../../docs/spec/route/shop/page.screen.md) / [`function`](../../../docs/spec/route/shop/page.function.md) | 不要 |

外枠の約束は [`(shop)` の layout](../../../docs/spec/route/shop/layout.function.md) が持ちます。

使う operationId。

| operationId | 用途 |
| --- | --- |
| `GetProductsRankingQuantity` | 売れ筋の節 |
| `GetProducts` | 新着の節。並び替えだけを指定する |
| `GetProductCategories` | 分類から一覧へ入る導線 |

## 状態とデザイン参照

| 画面 | 状態 | story |
| --- | --- | --- |
| トップ | success | `Page/Home/Default` |
| | empty（どの系統も中身が無い） | `Page/Home/Empty` |
| | loading | `Features/Home/Skeleton/Default` |
| | 1 系統だけ落ちた | `Page/Home/RankingFailed` |
| | 取りに行った系統が全部落ちた | `Page/Home/AllFailed` |
| | 落ちた節の中身 | `Features/Home/SectionFailure/Default` |

**error という 1 つの状態を持ちません。** 要求ごとに取る 2 系統は個別に待つので、失敗は系統ごとに立ち、
落ちた節だけがその表示へ替わります。両方落ちた場合も画面は出ます（節が 2 つとも失敗表示に
なるだけで、route の `error` 境界へは行きません）。分類の節はこの扱いの外です（「運用」節）。

## 構成

画面が 1 つしかないため、画面を挟まず直下へ置きます。

| ファイル | 役割 |
| --- | --- |
| `page-content.tsx` | 要求ごとに取る 2 系統の並行取得と組み立て。系統ごとの失敗を値へ落とし、記録もここで行う |
| `categories-content.tsx` | 分類の取得。静的な殻の側に居るので、`Suspense` の外に置かれる |
| `view.tsx` | 要求ごとに取る節を積むだけの表示。成否の組み合わせを取得なしで確かめられる |
| `ui/new-arrivals/` | 新着商品の節。一覧への導線を見出しの隣に持つ |
| `ui/ranking-list/` | 売れ筋ランキングの節。順位付きの行で並べる |
| `ui/category-links/` | 分類から一覧へ入る導線の節 |
| `ui/product-teaser/` | トップに並べる商品 1 件。一覧のカードとは密度が違う |
| `ui/section-failure/` | 1 つの節だけが落ちたときの表示 |
| `ui/sample-notice/` | サンプルであることの断り書き。見出しより前、取得の外に出す |
| `ui/skeleton/` | 待機表示 |

## 依存カーネル

| カーネル | 用途 |
| --- | --- |
| `adapters` | 取得と表示モデルへの変換。分類の寿命は取得の口が持つ |
| `model` | 表示モデル（`Product`）と画像の型 |
| `components` | 節を組む器（カード・バッジ・待機表示・案内） |
| `errors` | 落ちた系統に出す文言を、分類から引く |
| `logging` | 落ちた系統の記録。画面は出し続けるため、記録が唯一の痕跡になる |
| `observability` | 描画を span に載せる |

他 feature の `facade/` も引きます —— 一覧の URL（`products`）と、利用規約への行き先
（`site-info`）。**内部は見ません**。

## Action 戻り値契約

なし。トップに操作がありません。

## テスト観点

- [ ] 1 系統が落ちても、残りの系統が出る
- [ ] 中身が空の節が描かれない
- [ ] 断り書きが取得を待たず、見出しより前に出る
- [ ] 分類の節が待機表示を挟まず、`Suspense` の外に置かれている
- [ ] 一覧への導線が `products` の `facade/` から組まれている（キーを写していない）

## 運用

- **要求ごとに取る 2 系統は `Promise.allSettled` で取ります**。`all` は最初の失敗で待機を打ち切るため、
  成功した系統の結果が手元にあっても使えません。1 つ落ちても残りは出す、が部分エラーの扱いです
- **分類だけは待機の外に居ます**。取得がキャッシュを持つので
  （[product-masters](../../adapters/server/api/product-masters.ts)）、要求を待たずに静的な殻へ入り、
  最初の HTML から辿れます。**この節の失敗は値へ落としません** —— 殻は組み立て時に作られてそのまま
  配られるため、失敗を表示へ変えるとその事実が次の再検証まで全員へ配られます。読めなければ組み立てを
  落とし、配り始めたあとで読めなくなっても最後に読めた殻が出続けます（取り直しが背後で起きる形にして
  あるためで、成立の条件は `next.config.ts` の `masters` profile が `expire` を持たないことです）
- **節ごとの再取得は置きません**。押せる操作を出すなら画面全体の再取得になります。節単位の
  部分再取得はその節を client island へ倒して初めて成立するもので、並べるだけの画面が負う
  複雑さではありません
- **一覧の URL は自分で組みません**。パスと絞り込みのキーは `products` の
  `facade/list-url/` が持ちます。キーの綴りを写すと、一覧が契約に合わせて変えたときにこちら
  だけが古いままになり、絞り込まれない一覧へ飛びます
- **中身が空の節は描きません**。「該当がありません」はトップでは利用者が取れる行動を持たない
  告知で、場所を取るだけです。空を伝える必要があるのは、利用者が条件を指定した画面です
- **サンプルである断り書きを最初に出します**。実在しそうな商品名と企業名を並べている以上、書かないと
  実在の取引と取り違えられます。伝えるのはサンプルであること・掲載物が実在しないこと・購入と決済が
  機能しないことの 3 つで、取得を待たず、見出しより前に置きます
- **利用規約への導線を同じ断り書きに置きます**。閲覧した時点で同意とみなす以上、同意の対象へ
  最初に届く必要があり、フッターまで下りないと辿れない位置では成立しません
- **段組みはコンテナクエリで決めます**（[`docs/rules.md`](../../../docs/rules.md) #73）

## 関連する ADR

- [0021](../../../docs/adr/0021-frontend-responsibility.md) — 層の責務と import 境界。他 feature へは `facade/` 越しにだけ触る
- [0027](../../../docs/adr/0027-directory-structure.md) — 物理配置と co-location。画面が 1 つなら画面ディレクトリを挟まない
- [0080](../../../docs/adr/0080-error-handling.md) — エラーの扱い。片方が落ちても残りを配る部分エラー
