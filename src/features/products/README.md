---
imports-allowed: [model, components, adapters, capabilities, stores, errors, logging, observability]
forbidden: [features] # 画面まるごとの story は例外
test-requirement: feature
---

# products

商品を探して眺めるための画面スライスです。

## 受け入れるもの

- 商品一覧の取得の編成（取得条件の解釈、画像 URL の解決、ページ送り）
- この画面専用の表示（一覧・カード・待機表示・失敗表示・検索欄・1 件の詳細）

## 受け入れないもの

- 他 feature への直接依存
- 汎用に使える表示（`Card` / `Badge` / `MediaImage` などは `components` から取る）
- 業務ロジック（在庫や価格の決定はバックエンドの領分）

## Route と契約

| Route | 仕様書 | 認証 |
| --- | --- | --- |
| `/products` | [`screen`](../../../docs/spec/route/shop/products/page.screen.md) / [`function`](../../../docs/spec/route/shop/products/page.function.md) | 不要 |
| `/products/[id]` | [`screen`](<../../../docs/spec/route/shop/products/[id]/page.screen.md>) / [`function`](<../../../docs/spec/route/shop/products/[id]/page.function.md>) | 不要 |

使う operationId。

| operationId | 用途 |
| --- | --- |
| `GetProducts` | 条件に一致する一覧。初回はサーバ側、続きは `/api/products` 経由 |
| `GetProductsCount` | 条件に一致する総件数。一覧と同じ条件を渡す |
| `GetProductsDetail` | 1 件の詳細 |
| `GetProductCategories` | 絞り込みの選択肢。条件では変わらない |

## 状態とデザイン参照

| 画面 | 状態 | story |
| --- | --- | --- |
| 一覧 | success | `Page/Products/List/Default` |
| | empty | `Page/Products/List/Empty` |
| | loading | `Features/Products/List/Skeleton/Default` |
| | error | `Features/Products/List/ErrorState/Default` |
| | 続きを読んでいる | `Page/Products/List/LoadingMore` |
| | 続きの取得に失敗 | `Page/Products/List/LoadMoreFailed` |
| | 末尾まで読んだ | `Page/Products/List/ReachedEnd` |
| 詳細 | success | `Page/Products/Detail/Default` |
| | 在庫が無い | `Page/Products/Detail/OutOfStock` |
| | 画像が無い | `Page/Products/Detail/NoImage` |

error の面を出すのは route の境界（`error.tsx`）で、上の story はその境界が置く中身です。一覧と
詳細は同じ表示を使い、詳細の「見つからない」だけが `not-found.tsx` の別の面になります。

## 構成

画面（`list` / `detail`）ごとに掘り、その中を性質で分けます。どの画面にも属さず feature 全体が
所有するものは、同じ決まりで画面を挟まず直下へ置きます。

| ファイル | 役割 |
| --- | --- |
| `list/page-content.tsx` | 取得条件の解釈と画面の組み立て。条件で変わらないものだけを取得する |
| `list/results.tsx` | 条件に一致する一覧と件数の取得。待機表示の境界がここに掛かる |
| `facade/list-url/` | 一覧の URL 契約（パス・絞り込みのキー・URL の組み立て）。他の feature も引く |
| `list/query.ts` | 素の `searchParams` の均し、件数、選択肢の型 |
| `list/page-size.ts` | 1 度に読み込む件数。条件の解釈から切り離し、client へ zod を持ち込ませない |
| `list/price-range.ts` | 価格の目盛りと、URL の下限・上限との写し |
| `list/stock-availability.ts` | 在庫の有無と、URL の在庫数の条件との写し |
| `list/filter-draft.tsx` | 組み立て中の条件を持ち、画面で 1 つに保つ |
| `list/use-filtered-count.ts` | 確定していない条件で一致する件数を数える |
| `list/use-infinite-products.ts` | 末尾到達で続きを読む。読み進めた件数を URL へ書き戻す |
| `list/view.tsx` | 一覧の表示。条件で取り直す範囲をここで区切る |
| `list/active-filters.ts` | いま効いている条件を、解除先付きの一覧へ写す |
| `list/ui/grid/` | 商品を並べる。取得も読み進めも持たず、空のときの案内もここが持つ |
| `list/ui/card/` | 1 件の見た目。カード全体が詳細への導線になる |
| `list/ui/contact-button/` | 在庫の無い商品について問い合わせる入口。受け口はまだ無い |
| `list/ui/keyword-field/` | キーワードの入力欄。打鍵では検索せず、確定の操作で飛ばす |
| `list/ui/sort-select/` | 並び替え。幅によらず選んだ時点で反映する |
| `list/ui/price-field/` | 価格の入力欄。セレクトボックスとレンジスライダーが同じ目盛りを動く |
| `list/ui/category-field/` | 分類の入力欄。複数選べる。上限は契約が決めるため受け取る |
| `list/ui/stock-field/` | 在庫状況の入力欄。3 つの状態から 1 つ選ぶ |
| `list/ui/filter-fields/` | 入力欄の並び。入力欄と URL のキーの対応をここだけが知る |
| `list/ui/sticky-region/` | 読み進めたときに上端を取り合う帯と脇の領域の居場所 |
| `list/ui/filter-sidebar/` | 脇に常設する絞り込み。選んだ時点で反映する。landmark は持たない |
| `list/ui/filter-sheet/` | 脇に領域を持てない幅の絞り込み。overlay の中でまとめて確定する |
| `list/ui/infinite-list/` | 読み進められる一覧。取得と見た目をつなぐ |
| `list/ui/load-more-list/` | 読み進めた一覧の見た目。件数を告知し、続きの状態は `LoadMore` が持つ |
| `list/ui/skeleton/` | 待機表示 |
| `list/ui/error-state/` | 取得に失敗したときの表示 |
| `facade/detail-url/` | 商品詳細の経路。正規 URL とサイトマップが同じ綴りを名乗るための 1 か所 |
| `detail/page-content.tsx` | 1 件の取得と組み立て。`not-found` の分類もここで受ける。構造化データもここで置く |
| `detail/metadata.ts` | 商品ごとの題・要約・正規 URL。見つからなければ `noindex` を名乗る。page の `generateMetadata` が薄く呼ぶ |
| `detail/structured-data.ts` | 商品を schema.org の `Product` へ写す。markup を持つ説明は載せない |
| `detail/view.tsx` | 1 件の詳細の表示。骨格と値の表示を持ち、画像の面は下へ渡す |
| `detail/ui/gallery/` | 画像を送りながら見る面。枚数によらず carousel に載せ、拡大は実画像だけに出す |

## 依存カーネル

| カーネル | 用途 |
| --- | --- |
| `adapters` | 一覧・件数・詳細・分類の取得と、表示モデルへの変換。画像 URL の解決も含む |
| `model` | 業務型（`Product` など）と、条件の型 |
| `components` | 汎用の表示（`Card` / `Badge` / `MediaImage` / 入力欄の素） |
| `capabilities` | 末尾到達の検知（`use-on-visible`）と、上端の取り合いに使う scroll の向き |
| `errors` | 正規化済みの失敗を、画面が出す文言へ写す |
| `logging` | 取得の失敗の記録 |
| `observability` | 描画を span に載せる |

## Action 戻り値契約

なし。カートへ入れる操作は `cart` が持ち、この feature は
[`cart/facade/add-to-cart/`](../cart/facade/add-to-cart/) を置くだけです。

## テスト観点

- [ ] 条件が URL に載り、共有・戻る操作・再読み込みのいずれでも同じ結果になる
- [ ] 契約に照らして写せなかった条件が、黙って落ちずに画面へ出る
- [ ] 幅によって絞り込みの確定の仕方が変わる（脇では即時、overlay ではまとめて）
- [ ] 読み進めた件数が URL へ書き戻り、契約の上限までは復元される
- [ ] 分類の選択が上限に達したとき、未選択が `disabled` ではなく `aria-disabled` になる
- [ ] 見つからない商品の metadata が `noindex` を名乗り、正規 URL を持たない
- [ ] 要約と構造化データが商品説明の markup を含まない

## 運用

- **`components` へ上げないものの線引き**: 業務型（`Product`）と遷移先に依存する表示はここに置きます。
  在庫の見せ方はバックエンドの状態遷移に依存するため、`components` が供給できるのは `Badge` の
  variant までです
- **画像が無い商品には代替画像を置きます**。どの画像を代わりに置くかは対象の性質で決まるため、パスは
  この feature が持ち、`MediaImage` の `fallbackSrc` へ渡します
- **取得は page ではなくこの中で行います**。待機表示の境界を実際にデータを待つ部分の近くへ置くためで、
  page 全体を 1 つの待機表示で覆うと検索欄まで消えて操作できなくなります
- **条件で取り直す範囲を、条件で変わらないものから切り離します**。分類の一覧は絞り込みの入力欄そのもので、
  検索条件では変わりません。`page-content.tsx` が条件に依らないものだけを取得し、条件で変わる一覧と件数は
  `results.tsx` が持ちます。待機表示の境界と条件を鍵にした作り直しはそこにだけ掛かるため、絞り込んでも
  検索欄・条件の chip・入力欄は待機表示に落ちません
- **検索条件は URL に置きます**。結果を共有でき、戻る操作で前の条件に戻り、再読み込みでも同じ画面が
  出ます。client state に持つとそのどれも成立しません
- **カートへ入れる操作そのものは `cart` が持ちます**。カートへの変更であり、この feature は
  [`cart/facade/add-to-cart/`](../cart/facade/add-to-cart/) を置くだけです（feature 同士は直接
  参照しないため、口は区画として公開されています）
- **その操作は、脇の領域が無い帯で画面下端に固定します**（[`docs/rules.md`](../../../docs/rules.md)
  #72）。詳細は縦に長く、読み進めた位置から操作へ戻れなくなるためです。固定するかどうかは画面の
  組み立ての判断なので `detail/view.tsx` が持ち、操作の部品は自分がどこに置かれたかを知りません
- **カード全体を詳細への導線にしますが、link では包みません**。包むとカートへ入れる操作が link の
  内側に入り、操作の中に操作が居る形になります。商品名の link を疑似要素でカードいっぱいに広げ、
  操作は link より後ろに置いて `relative` で重なりの上へ出します。支援技術に見える遷移先が
  「カード全体の文言」ではなく商品名になるのも、この形を採る理由です
- **バックエンドが長さを決める値は 1 行に収まる前提を置きません**。分類名や状態名は上限の宣言が無く、
  `Badge` は既定で折り返さないため、折り返しを呼び出し側で許します
- **ページ送りは cursor 方式**です。番号付きのページ送りは作れません（総件数も任意ページへの飛び先も
  カーソルは持たないため）。一覧は増分取得で読み進める形を採っており、これは
  [0073](../../../docs/adr/0073-pagination-fetch-boundary.md) §2 が限定例外として認めた経路です。
  初回ページは Server Component が取得し、続きだけを `adapters/client` 経由で取ります
- **確定の操作は複数あっても、確定するものは 1 つです**。キーワードの入力欄と絞り込みの入力欄は
  画面の別の場所にあり、幅によって後者は脇にも overlay にも現れます。下書きをそれぞれが持つと、
  片方で確定したときにもう片方の入力途中が捨てられます（`filter-draft.tsx` が 1 つに保ちます）
- **キーワードは打鍵では検索しません**。検索語だけが先に効くと、絞り込みを組んでいる途中で一覧が
  入れ替わり、中途半端な条件の結果を見ることになります。空のまま送信できるのは、いま検索語が
  効いているとき（＝外す意味があるとき）だけです
- **絞り込みの反映は、一覧が見えているかどうかで変わります**。脇に常設できる幅では選んだ時点で反映し
  ます（結果が隣に出るため、確定を挟むと結果を見るのにもう 1 回押させることになります）。overlay の
  中は一覧が隠れるので、条件を組んでからまとめて確定し、**確定する前の該当件数をその操作へ添えます**
  （`use-filtered-count.ts`）。並び替えは幅によらず即時です（単一選択は選ぶことが確定と同じため）
- **読み進めるあいだ、画面の上端は 3 つで取り合います**（外枠の header・検索の帯・脇の絞り込み）。
  下へ読むあいだは帯が退いて絞り込みが header の直下に止まり、上へ戻ろうとすると帯が現れて絞り込みが
  その下へ下がります。帯の高さは効いている条件の数で変わるため、位置は書き写さず測った値から決めます
  （`ui/sticky-region/`）。**帯の退き方は貼り付きをやめることで表します** —— 位置をずらして隠すと、
  まだ本来の位置に居るときに見出しへ重なって上がります
- **価格の下限と上限は目盛りの上でだけ選べます**。セレクトボックスとレンジスライダーが同じ範囲を指す
  ため、連続値を許すと 2 つの操作面が同じ条件を別の粒度で表します。スライダーは滑らせている間は伝えず、
  指を離した時点だけを確定として扱います
- **在庫状況は、契約の在庫数の条件へ写して URL に載せます**。契約が持つのは数の下限と上限で、
  「在庫あり」という状態ではありません。利用者が選ぶのは有無なので、その橋渡しを
  `stock-availability.ts` が持ちます
- **供給の購読者には `"use memo"` を付けています**。この画面には、1 つの state の変化が購読者へ
  直に及ぶ供給が 2 つあります —— 組み立て中の条件
  （`filter-draft.tsx`。1 打鍵・1 チェックで動く）と、上端の取り合いの状態（`ui/sticky-region/`。scroll の
  向きと帯の高さで動く）です。印を付けるのは**その 2 つを購読する部品と、その子孫**に限ります。
  購読しない部品は、供給が何度動いても再描画されません —— 部分木は `children` として受け取った同じ
  要素のまま素通りするためで、`ui/sort-select/` と一覧本体がこれに当たります
- **続きを読む操作は失敗したときだけ出します**。読み進めている間は末尾に近づくだけで次が始まるため、
  同じことをする入口を並べても選ぶ手数が増えるだけです。失敗した後は末尾到達の検知がその場では二度と
  起きないので、そこでだけ操作が唯一の復帰口になります。keyboard の scroll も支援技術の読み進めも表示
  位置を動かすため、この形でも scroll 以外の手段は失われません
- **読み進めた件数を URL に書き戻します**。書き戻さないと、戻る操作も再読み込みも先頭の 1 ページだけの
  画面に戻り、読み進めた分がスクロール位置ごと失われます。契約が受け付ける件数の上限までが復元できる
  範囲で、それを超えて読み進めた分は戻りません
- **総件数は一覧の応答から取れません**。cursor ページネーションが返すのは次のカーソルの有無だけです。
  総数は専用の取得口（`GET /v1/products/count`）が返し、一覧と同じ条件を渡します。条件を渡さない口に
  すると、絞り込んだ後も絞り込む前の数が出て、一覧に並んでいる件数と食い違います
- **状態で絞り込む口は置きません**。契約も backend も `statusCodes` を受け付け、絞り込みは実際に
  効きます。置かないのは、状態マスタが在庫・販売の状態（在庫あり・予約受付中・廃盤・検討中など）で、
  売り手が対象を見つけるための語彙だからです。どれを買い手へ出すかを選ばずに全部並べると、選べるのに
  買い手にとって意味を持たない選択肢が混ざります。買い手が選ぶ軸のうち在庫の有無は
  `stock-availability.ts` が持ちます。**公開の可否は状態マスタではなく `publishedAt` の別軸**で、
  状態マスタでの絞り込みが効くかどうかとは関係しません
- **分類を一度に選べる数は契約が決めます**。上限に届くまでは何も出さず、達した時点で未選択の分類を
  `aria-disabled` にして、いくつまで選べるかを群の末尾に出します。残り数を常に出すと、多くの利用者が
  到達しない制約のために全員の視界を占めます。数は書き写さず `adapters` から受け取ります
- **分類と状態を指すのはマスタの `code` で、UUID ではありません**。契約が絞り込みで受け取るのは
  `categoryCodes` / `statusCodes` であり、UUID を取る `categoryId` / `statusId` は非推奨として
  残っているだけです。後継と同時に送ると 400 になるため、`adapters` が受け付ける口はコードの側
  だけに寄せています（`products.ts`）

## 関連する ADR

- [0021](../../../docs/adr/0021-frontend-responsibility.md) — 層の責務と import 境界。他 feature へ貸すものを `facade/` に出す
- [0026](../../../docs/adr/0026-layout-shell-mount.md) — 殻と Provider の据え付け。画面ごとには置かない横断 UI の位置
- [0027](../../../docs/adr/0027-directory-structure.md) — 物理配置と co-location。画面ごとに掘り、その中を性質で分ける
- [0042](../../../docs/adr/0042-react19-rendering-api.md) — React 19 の描画 API 規約。`"use memo"` を付ける範囲
- [0044](../../../docs/adr/0044-seo-metadata-strategy.md) — metadata の方針。検索エンジンへ何を名乗るかの持ち場
- [0051](../../../docs/adr/0051-styling-system.md) — デザイントークンと帯ごとの出し分け
- [0073](../../../docs/adr/0073-pagination-fetch-boundary.md) — ページ送り / 増分取得の境界。cursor 方式と client 取得の限定例外
- [0080](../../../docs/adr/0080-error-handling.md) — エラーの扱い。`error` / `not-found` の受け持ち
- [0101](../../../docs/adr/0101-performance-budget.md) — 性能予算。client の束に何を載せるか
