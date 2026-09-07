# Carousel

## 用途

同じ種類の内容が複数あるとき、限られた横幅の中で一枚ずつ、または数枚ずつ順に閲覧できるようにします。

## 役割と公開 component

| Component | 役割 |
| --- | --- |
| `Carousel` | 順に閲覧する集合であることを支援技術へ伝える外枠です。名前を必ず与えます。 |
| `CarouselContent` | slide を並べ、横方向のスクロールと slide 先頭への吸着を担う領域です。keyboard で到達できます。 |
| `CarouselItem` | 一枚ぶんの内容です。全体のどこかを名前で示し、`flex-basis` で送り幅を決めます。 |
| `CarouselPrevious` | slide の左端に重なる、一つ前へ送る操作です。置いた slide から見た一つ前を指します。client island です。 |
| `CarouselNext` | slide の右端に重なる、一つ次へ送る操作です。置いた slide から見た一つ次を指します。client island です。 |
| `CarouselNav` | 任意の slide へ移動する link を並べる領域です。何の送りかを名前で示します。 |
| `CarouselLink` | 一枚の slide を指す link です。移動先の `id` を `#` 付きで受け取ります。client island です。 |
| `CarouselThumbnails` | 表示中の slide に追従する送り先の一覧です。`CarouselNav` に現在地の追従を足したもので、client island です。 |

## 利用ケース

- 一つの対象に複数の画像があり、横に並べきれない場合
- 補足的な内容の並びを、主導線の高さを増やさずに見せたい場合
- 同型のカードを、画面幅に応じて一枚送り・複数枚送りへ切り替えたい場合

一覧すべてを見せることに意味がある場合は使いません。carousel は視界の外に置いた内容が読まれない前提の表示であり、見落とされて困る内容を入れると欠落します。

## 責務境界

SSR first の選定では `○` に当たります。送りは CSS Scroll Snap と browser 標準のスクロールで成り立つため、`Carousel` / `CarouselContent` / `CarouselItem` / `CarouselNav` は `"use client"`・React state・browser API を持ちません。slide の中身も Server Component のまま出力され、client 境界を渡りません。

### 送り操作だけを client island にする

client island は `CarouselPrevious` / `CarouselNext` / `CarouselLink` と、`CarouselLink` を束ねて現在地に追従させる `CarouselThumbnails` の 4 つです。markup は `href` を持つ link のままなので hydration 前でも押せば送れますが、fragment 遷移は carousel を画面内へ引き寄せるためにページごとスクロールさせ、履歴も 1 件積みます。hydration 後は既定動作を止めて `CarouselContent` だけを横へ送るため、ページも履歴も URL も動きません。

修飾キーを伴う押下と、行き先の slide が存在しない場合は browser の既定動作に任せます。

touch のスワイプと trackpad の横スクロールは、browser のスクロールとして最初から効きます。pointer だけで送る手段が要る場合は、slide の左右端へ `CarouselPrevious` / `CarouselNext` を重ねます。この二つは置いた slide の中でだけ押せるため、現在位置を追わずに行き先が決まります。行き先のない端では要素ごと置きません。押しミスを防ぐため、当たり判定は見た目の円より一回り広く、円の半径ぶんだけ外周へ透明な領域を足しています。この領域は slide の内容に重なるので、slide の中に link や button を置く場合は円の周囲を空けてください。重なった操作は押せなくなります。内容を隠しすぎないよう面と枠は半透明で置き、hover と focus で不透明にします。薄めるのは面と枠だけで記号は透かしません。背後に来る画像は選べないため、記号まで薄めると絵柄しだいで contrast が落ちるためです。touch には hover がなく半透明のまま操作するので、面はこれ以上薄くしません。slide ごとに繰り返されるので、枚数が多く `CarouselNav` で keyboard からの送り先を用意している場合は `tabIndex={-1}` を渡して tab 順から外します。

**自動送り・JS による drag・無限ループは持ちません。** 再生 timer や pointer の追跡を要し、送りの機構を client へ出すという切り分けを超えます。catalog が client island の条件として挙げる四つのうち、現時点で必要なのは現在位置の同期表示だけです。

### 表示中の slide に一覧を追従させる

`CarouselThumbnails` は `CarouselNav` を内側に組み、そこへ現在地の追従を足したものです。送り先の一覧としての構造と、押して送る動作は `CarouselNav` / `CarouselLink` のままで、この component が足すのは「いまどれが表示されているか」だけです。

`Carousel` の中に置きます。観測先は同じ carousel の最初の `CarouselContent` で、`IntersectionObserver` でもっとも見えている slide を選びます。現在地の `CarouselLink` には `aria-current="true"` が付き、文字色と枠で示されます。枠は border で描きます。要素の外側へ描く `ring` は、一覧が横スクロールする面であるため端の項目で切り取られ、輪の一部だけが線として残るためです。透明な枠を常に持たせてあるので、印が付いても大きさは変わりません。その link が一覧からはみ出している場合にだけ、**一覧だけ**を横へ送ります。ページのスクロール位置は動かしません。**追従して送るのは横方向だけです。** `className` で縦積みの一覧にした場合、現在地の印は移りますが一覧自体は動きません。

位置と余白は `className` で決めます。サムネイル同士の間隔は `CarouselThumbnails` の `gap-*`、main との間隔は `Carousel` の `gap-*`、main の上下左右どちらへ置くかは `Carousel` の `flex-*`（既定は `flex-col` で下）、サムネイルの大きさと内側の余白は `CarouselLink` の `w-*` / `p-*` が決めます。専用の props は持ちません。ただし観測先を同じ carousel から辿るため、**一覧は `Carousel` の中に置く**必要があります。

意味論は APG の tabbed carousel（`tablist` / `tab` / `tabpanel`）にしていません。あれは panel を出し分ける前提で、slide がすべて存在してスクロールで見せるこの形には合わないためです。ページ内 link の集合のまま `aria-current` で現在地を示します。

hydration 前は `defaultCurrentId` を指定した場合だけ印が付きます。追従が要らない一覧は `CarouselNav` のままで構いません。

内容の取得、枚数の制御、画像の URL 組み立ては持ちません。`CarouselItem` の中身は呼び出し元が組み立て、画像であれば `MediaImage` を合成します。

送り幅は `CarouselItem` の `flex-basis` が決めます。`CarouselContent` は幅を持たないため、外枠の幅は `Carousel` の `className` で与えます。`CarouselContent` が slide の間に隙間を空けるため、割り切った比率をそのまま与えると隙間のぶんだけ次の slide がはみ出します。複数枚をちょうど収めるには、比率から隙間の合計を按分して差し引いた値（2 枚なら `calc(50% - 0.5rem)`）を渡します。

`Carousel` は `role="region"` と `aria-roledescription="carousel"` を持ちます。`section` が region になるのは名前を持つときだけなので、役割は明示しています。`aria-label` か `aria-labelledby` を必ず与えます。名前のない landmark へ入っても、何の領域なのか判りません。`CarouselItem` は `role="group"` と `aria-roledescription="slide"` を持ち、`1 / 4` のような位置を `aria-label` で示します。視界に入る枚数が限られるため、名前がないと全体のどこを読んでいるのか判りません。

スクロールできる領域は keyboard だけで操作する利用者も到達できる必要があるため、`CarouselContent` の `tabIndex` を `0` にしています。slide の中身が focus 可能な要素だけで構成される場合は `tabIndex={-1}` を渡して外します。読み取り専用の内容では外しません。判定は内容を知る呼び出し元が行い、既定は安全側の `0` にしています。

スクロールは親へ連鎖させません。横送りの端に達したあと画面全体が動くと、どちらを操作しているのか判らなくなるためです。

`CarouselContent` に `scroll-behavior: smooth` を与えないでください。滑らかな送りを指定した領域では、Chromium が fragment 遷移でのスクロールを行いません。送り操作は hydration 前を fragment 遷移で凌ぐため、指定すると hydration が済むまで何も動かなくなります。

## Storybook とテスト

Storybook は一枚送り、slide を指す link を添える場合、左右端に前後の送りを重ねる場合、下に追従する一覧を並べる場合、その一覧の位置・余白・大きさを `className` で変えた場合、複数枚を並べたまま送る場合、画像以外の内容、送り領域の tab stop を外す場合を確認します。

テストは carousel として読み替える名前のある region を公開すること、slide を位置つきの `group` として公開すること、送り領域が keyboard で到達できスクロールを親へ連鎖させないこと、`tabIndex={-1}` で領域自体の tab stop を外せること、`flex-basis` で送り幅を変えられること、link を名前のある集合として公開すること、link が実在する slide を指すこと、左右端の送りが隣り合う slide を指し端では置かれないこと、その名前を言い換えられること、a11y 自動検査を確認します。

送り操作の client island は、押下が `CarouselContent` だけを横へ動かし fragment 遷移を起こさないこと、末尾まで送ったあとの戻る向き、修飾キーを伴う押下と行き先のない場合に既定動作へ任せること、呼び出し元の `onClick` を先に呼びそこで止められたら送らないことを別のテストで確認します。

追従する一覧は、`defaultCurrentId` の有無による hydration 前の印、観測対象が main の slide であること、もっとも見えている slide へ印が移ること、報告のない slide を見えていないものとして扱うこと、現在地の link が収まっているとき・左右へはみ出したときの一覧の送り、対応する link が無い場合、観測できる slide が無い場合、`Carousel` の外に置かれた場合を確認します。
