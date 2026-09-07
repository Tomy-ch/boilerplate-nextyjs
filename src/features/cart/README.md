---
imports-allowed: [model, components, adapters, capabilities, stores, errors, logging, observability]
forbidden: [features] # 画面まるごとの story は例外
test-requirement: feature
coverage-exclusions:
  - "src/features/cart/__mocks__/**"
  - "src/features/cart/cart.fixture.ts"
  - "src/features/cart/facade/add-to-cart/__mocks__/**"
---

# cart

選んだ商品を持ち回り、いつでも見られるようにする画面スライスです。

## 受け入れるもの

- カートの取得と変更の編成（取得は Server Component、変更は Server Action）
- カートの表示（PC で脇に出す領域、タブレットとスマホで被せる領域、header の入口と点数、全画面、明細 1 行の操作）
- 明細に立った事情の言い方（買えない / 値が変わった）

## 受け入れないもの

- カートの中身そのもの（バックエンドが持ちます）
- 買えるか・値が変わったか・数量の上限の判定（業務ロジックであり、バックエンドの領分です）
- 商品の取得・商品詳細の表示（`products` の領分。feature 間で直接参照しません）

## Route と契約

| Route | 仕様書 | 認証 |
| --- | --- | --- |
| `/cart` | [`screen`](../../../docs/spec/route/shop/cart/page.screen.md) / [`function`](../../../docs/spec/route/shop/cart/page.function.md) | 不要（ゲストのまま使える） |

**この slice は route 以外の場所にも出ます。** header の入口・脇の領域・被せる領域は
`(shop)/layout.tsx` が mount するもので、外枠の約束は
[`(shop)` の layout](../../../docs/spec/route/shop/layout.function.md) が持ちます。

使う operationId。

| operationId | 用途 |
| --- | --- |
| `GetCartsMe` | カートの取得。明細ごとの再評価つきで届く |
| `PutCartsMeItem` | 数量の設定。加算ではないため二重送信で結果が変わらない |
| `DeleteCartsMeItem` | 明細 1 行の削除 |
| `DeleteCartsMe` | 全消し |

`PostCartsMeMerge`（ゲストのカートの引き継ぎ）はこの slice が呼びません。**ログインの往復の中で
起きる**もので、呼ぶのは `/api/auth/callback` です。

## 状態とデザイン参照

| 画面 | 状態 | story |
| --- | --- | --- |
| カート | success | `Page/Cart/PC` |
| | empty | `Page/Cart/Empty` |
| | 事情の立った明細がある | `Page/Cart/WithIssues` |
| | 買える明細が 1 つも無い | `Page/Cart/WithoutPurchasable` |
| 脇の領域 | 中身あり / 空 / 閉じている | `Features/Cart/Panel/{WithLines,Empty,Closed}` |
| header の入口 | 帯ごとの姿 | `Features/Cart/HeaderAction/{PC,Tablet,Mobile}` |
| 待機表示 | loading | `Features/Cart/Skeleton` |

**loading は画面に 1 つだけです。**置き方は「運用」の 1 つめ。**error も画面としては持たず**、操作の失敗は
その操作の隣に出ます（`ui/action-error/`）。取得の失敗は route の `error` 境界
（`src/app/(shop)/cart/error.tsx`）が受けます。

## 構成

画面が 1 つなので画面ディレクトリを省き、表示だけを `ui/` に分けています。

| ファイル | 役割 |
| --- | --- |
| `page-content.tsx` | カートの取得と組み立て |
| `view.tsx` | 全画面の表示。明細と集計を左右に分ける |
| `actions.ts` | 数量の設定・明細の削除・全消しの Server Action |
| `__mocks__/actions.ts` | カタログでの Server Action の差し替え |
| `checkout.ts` | 購入手続きへ進めるかの判定 |
| `line-order.ts` | 明細を描く順。覚えている並びと、いま居る明細を突き合わせる |
| `parse-cart-form.ts` | 送信された内容から商品と数量を取り出す |
| `removal-memory.tsx` | 取り除いた明細と、画面が見せていた並びの記憶 |
| `use-dock-visibility.ts` | 画面の下から出す器を、出すかどうかの判断 |
| `paths.ts` | この feature が指す行き先（カート・購入手続き） |
| `shell-cart.ts` | 外枠に出すカートの取得。読めなくても投げない |
| `ui/shell-slots/` | 外枠の header と脇に出すカート。取得を穴の内側に閉じる |
| `ui/skeleton/` | カートの待機表示。実物と同じ段組みで、1 画面に収まる数の枠を出す |
| `cart.fixture.ts` | story とテストが読む固定のカート |
| `facade/add-to-cart/` | 商品をカートへ入れる操作。**他の feature が使う口** |
| `facade/add-to-cart/__mocks__/` | 同じ口のカタログでの差し替え |
| `facade/line-issues/` | 明細に立った事情の表示。**購入確認も同じ強さと言い方で出すための口** |
| `ui/contents/` | カートの中身（小計・導線・明細）。器を持たず、置き場所は呼び出し元が決める |
| `ui/panel/` | 中身を脇に出す領域。空か閉じていれば描画しない。PC だけ |
| `ui/header-action/` | header に置く入口。帯でどちらの姿を出すかを決める |
| `ui/header-toggle/` | 脇に常設できる幅の入口。脇の領域を開け閉めする |
| `ui/header-drawer/` | 脇に常設できない幅の入口と中身。本文へ被せる |
| `ui/count/` | header に出す点数 |
| `ui/line-list/` | 明細を並べ、取り除いた行があった場所に取り消しを差し込む器 |
| `ui/line-row/` | 明細 1 行。脇の領域と全画面の両方が使う |
| `ui/checkout-link/` | 購入手続きへ進む操作。進めないときは押せない |
| `ui/summary-card/` | 小計と注記と先へ進む導線。器を持たない |
| `ui/subtotal/` | 小計の表示 |
| `ui/dock-handle/` | 画面の下から出す器のつまみ |
| `ui/summary-dock/` | 集計を画面の下から出す引き出し。脇に領域を置けない幅だけ |
| `ui/removal-notice/` | 取り除いた明細を戻す案内の表示 |
| `ui/quantity-stepper/` | 明細 1 行の数量増減 |
| `ui/match-stock-button/` | 在庫が足りない明細を、いま買える数へ合わせる |
| `ui/remove-button/` | 明細 1 行の削除 |
| `ui/clear-button/` | カートを空にする。確認を挟む |
| `ui/action-error/` | 操作が失敗したことを、その操作の隣に出す |

## 依存カーネル

| カーネル | 用途 |
| --- | --- |
| `adapters` | カートの取得と変更、代表画像の表示 URL への解決 |
| `model` | 表示モデル（`Cart` / `Product`）、事情を一文へ写す `cart/issue-notice`、`ActionState` |
| `components` | 面を組む器（drawer・scroll 領域・確認ダイアログ・画像） |
| `capabilities` | 帯の判定（`use-media-query`）と、引き出しを出す向き（`use-scroll-direction`） |
| `stores` | 中身を開いているかどうか。**開く操作が別の feature にあるため client 横断になる** |
| `logging` | 外枠のカートが読めなかったときの記録。投げずに記録だけ残す |
| `observability` | 描画を span に載せる |

## Action 戻り値契約

| Action | 置き場 | 戻り値 | 成功後 | 失敗時 |
| --- | --- | --- | --- | --- |
| `setCartItemQuantityAction` | `actions.ts` | `CartActionState` | `revalidatePath` | その操作の隣に出す |
| `removeCartItemAction` | `actions.ts` | `CartActionState` | 同上。取り消しの案内を消えた行の場所へ | 同上 |
| `clearCartAction` | `actions.ts` | `CartActionState` | 同上 | 同上 |
| `addToCartAction` | `facade/add-to-cart/` | `ActionState<void>` | 同上。中身を開く | 同上 |

**`addToCartAction` だけ置き場が違います。** 呼ぶのは他の feature で、区画は feature の内部を
参照できないため（`architecture.ts` の `features-facade`）、Action も区画の中に置きます。

**どれも冪等キーを持ちません。** 数量は加算ではなく設定で、削除も全消しも 2 度届いて結果が
変わりません。

## テスト観点

- [ ] 数量が加算ではなく設定として送られる
- [ ] 取り消しの案内が、消えた行が居た場所に出る（番号ではなく見せていた並びで解決する）
- [ ] 続けて取り除いた分だけ案内が並び、先の案内が置き換わらない
- [ ] 買える明細が 1 つも無いとき、購入手続きへの導線が押せない
- [ ] 外枠のカートが読めなくても、カートと無関係な画面が落ちない

## 運用

- **待機表示は画面に 1 つだけ置きます。** 見出しは殻に残し、中身だけを穴へ落とします。外枠
  （`app/(shop)/layout.tsx`）も同じカートを読みますが、取得は 1 リクエストの中で memo 化されるため
  （`adapters/server/api/cart.ts`）往復は増えません。**同時に届くものをさらに別々の `<Suspense>`
  境界へ割ると、画面が二度継ぎ足されて読み始めた位置が動きます**。
  明細の行数は取得するまで決まらないので、枠は 1 画面に収まる数に留め、実際より入っているようには
  見せません（`ui/skeleton`）

- **中身はバックエンドが持ちます**。取得は Server Component が行い、client の器へ props で渡します。
  写しを `stores` に置くと鮮度の管理が client 側にも生まれます
- **変更は `<form action>` + Server Action です**。数量は加算ではなく設定で、同じ要求が 2 度
  届いても結果が変わらないため二重送信を防ぐ鍵を要しません
- **買えるか・値が変わったかの判定を持ちません**。取得のたびにバックエンドが明細ごとに再評価し、
  結果が `issues` として届きます。この feature が決めるのは言い方と見せ方だけです
- **小計もバックエンドが返します**。合算の対象は事情の無い明細だけで、値が変わっただけの明細も外れます。
  行ごとの小計は出しません。出すには単価と数量を掛けることになり、金額の計算がフロントへ戻ります
- **サムネイルは装飾として出します**。代替テキストを空にし、詳細への導線も名前だけに持たせます。
  同じ商品名を隣の文字が持っているためで、画像にも名前や導線を与えると、読み上げで同じ名前が二度続き、
  同じ行き先の導線が 1 行に 2 つ並びます。画像を持たない明細は代替画像へ倒します。**明細ごとに商品を
  引き直しません** —— 契約が明細に代表画像のオブジェクトキーを載せており、表示 URL への解決は
  `adapters` が済ませます（設定を読めるのがそこまでであるため）
- **商品状態は出しません**。契約が返す明細に無く、出すには明細の数だけ商品を引くことになります
- **数量を 1 から減らす操作はありません**。数量 0 は契約の範囲外で、行を無くすのは削除の操作です。
  1 つの操作に 2 つの意味を持たせません
- **カートを空にする操作だけ確認を挟みます**。1 行の削除は取り消しを出すことで代え、全消しは戻すのに
  入れ直す商品を思い出す必要があるため確認を挟みます。押し間違いの代償が行数に比例するからです
- **取り消しの記憶は行の外に置きます**。取り除いた行はその瞬間に消えるため、行の中に持つと案内ごと
  居なくなります。置き場所は `(shop)/layout.tsx` で、最後の 1 件を取り除いてカートが空の姿へ変わっても
  残ります。出すかどうかは「その商品がまだカートに居るか」から導き、操作の側から取り下げの合図を
  受け取りません
- **取り消しは消えた行と同じ場所に出します**。押した場所と案内の出る場所がずれると、どの行が消えたのかを
  利用者が目で辿り直すことになります
- **場所は番号ではなく、画面が見せていた並びで持ちます**。番号はほかの行が増減するたびに指す先が変わり、
  続けて取り除くとずれます。**並びはサーバが持たない情報**であり、サーバの応答から直前の姿を組み立て直す
  のではなく、見せていた側がそのまま覚えます
- **続けて取り除いた場合は、その数だけ並びます**。先の案内を後の削除で置き換えると、戻す手段が先の
  1 件だけ失われます。同じ商品を取り除き直した場合は、数量が変わっているため古い記録を捨てます
- **集計は幅で置き場所が変わります**。脇に置ける幅では本文の横に貼り付け、置けない幅では画面の下から
  出す引き出しにします。引き出しは下へ読み進めるあいだだけ出し、つまみでいつでも開けます。中身は
  `ui/summary-card/` に 1 つだけ持ち、器の違いは呼び出し元が吸収します
- **mount は `(shop)/layout.tsx`** です。どの画面から追加しても同じ場所に出る必要があるため、
  画面ごとには置きません
- **中身の置き場所は帯で変えます**。PC では脇に出し、タブレットとスマホでは本文へ被せます
  （[`docs/rules.md`](../../../docs/rules.md) #71）。本文の下へ積むと内側の
  スクロールが外側のスクロールを奪い、本文へ戻れなくなるためです。中身は `ui/contents/` に 1 つだけ
  持ち、置き場所の違いは器の側で吸収します
- **開くかどうかは `stores` が持ちます**。カートへ入れた直後は開いた状態にする必要があり、その操作は
  別の feature にあるためです。器の側に開閉を持つと、追加しても何も起きない帯ができます
- **開いているかどうかは帯によらず同じ 1 つの要求です**。PC では脇の領域が出るか消えるか、それ未満では
  drawer が開くか閉じるかになるだけで、意味は「中身を見たい」の 1 つです。PC でも閉じられるようにして
  あるのは、脇の領域が本文から 280px 前後を持っていくためで、閉じられないと一度カートへ入れた利用者は
  本文を狭いまま読み続けることになります。開き直す入口は header にあります
- **他の feature へ出す口は `facade/` だけです**。商品側の「カートに追加」はカートへの変更であり、
  操作の持ち主はこの feature です。feature 同士は直接参照しないため、区画として公開しています。
  **区画は feature の内部を参照できない**ため（`architecture.ts` の `features-facade`。参照できると
  内部が面を素通りして外へ出ます）、この操作の Server Action は `actions.ts` ではなく区画の中に置きます
- **外枠に出すカートは読めなくても投げません**（`shell-cart.ts`）。外枠は配下のすべての画面に出るため、
  ここで投げるとカートと無関係な画面まで落ちます。同じ段の layout が投げた例外は子の `error` 境界では
  捕まりません
- **先へ進む導線は 2 本置きます**。主が「購入手続きへ」（U5 購入確認）、副が「カートを見る」（U4 カートページ）です。
  ドロワーを持つ実装の定型に合わせています。**副を落とさない**のは、U5 が認証の内側にあり、未ログインの利用者が
  カートの中身を全画面で確かめられる経路が U4 しか無いためです。この器は 280px 前後しかなく、明細が増えたときの
  数量変更と削除もここでは辛くなります
- **買える明細が 1 つも無いときは購入手続きへ進ませません**。進んだ先で「買えるものがない」と伝えるより、
  進めない理由を明細の隣で見せるほうが、利用者が次に取る行動に近い場所にあります

## 関連する ADR

- [0021](../../../docs/adr/0021-frontend-responsibility.md) — 層の責務と import 境界。他 feature へ貸す操作の口を `facade/` に出す
- [0023](../../../docs/adr/0023-stores-kernel.md) — client 状態カーネルの受入基準。写しを `stores` へ置かない線
- [0026](../../../docs/adr/0026-layout-shell-mount.md) — 殻と Provider の据え付け。どの画面からも同じ場所に出る mount
- [0027](../../../docs/adr/0027-directory-structure.md) — 物理配置と co-location。画面が 1 つなら画面ディレクトリを省く
- [0029](../../../docs/adr/0029-type-design-discipline.md) — 判別可能 union と境界での parse。送信内容の解き方
- [0040](../../../docs/adr/0040-routing-rendering-strategy.md) — 描画戦略。`<Suspense>` 境界を待つものの単位で置く
- [0041](../../../docs/adr/0041-cache-components-decision.md) — Cache Components（PPR）の可否。静的な殻を保つ条件
- [0053](../../../docs/adr/0053-ui-component-interaction-seam.md) — 操作の a11y 継ぎ目。引き出し・つまみ・取り消しの継ぎ目
- [0054](../../../docs/adr/0054-ui-catalog-storybook.md) — カタログの方針。Server Action の差し替え
- [0060](../../../docs/adr/0060-state-management.md) — 状態の置き場。server / client の線引き
- [0061](../../../docs/adr/0061-form-mutation-ux.md) — `<form action>` + Server Action の正機構
- [0063](../../../docs/adr/0063-mutation-result-notification.md) — 送信結果の伝え方。inline / toast / redirect の使い分け
- [0070](../../../docs/adr/0070-backend-role-separation.md) — バックエンドとの責務線。金額と可否の判定を画面で決めない
- [0079](../../../docs/adr/0079-auth-frontend-seam.md) — 認証の前面の継ぎ目。ゲストのカートの引き継ぎが起きる場所
- [0080](../../../docs/adr/0080-error-handling.md) — エラーの扱い。外枠で投げない、部分エラーで全体を落とさない
- [0091](../../../docs/adr/0091-test-verification-methods.md) — 検証の方法。async RSC の置き場
- [0100](../../../docs/adr/0100-accessibility-target.md) — アクセシビリティの目標水準
- [0101](../../../docs/adr/0101-performance-budget.md) — 性能予算。client の束に何を載せるか
- [0120](../../../docs/adr/0120-locale-aware-formatting.md) — 日付・数値の書式
