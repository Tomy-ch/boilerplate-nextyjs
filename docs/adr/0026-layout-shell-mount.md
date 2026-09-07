# layout の横断 UI / Provider mount(app シェル合成)

`<Toaster/>`・グローバル nav / footer・各 Provider(テーマ / capabilities / ポリシー)を **root layout に mount する経路**を定める。[0025](0025-app-layer-elements.md) の `app/route-segment` は import 先が `features` のみで、[0022](0022-capabilities-kernel.md) の Provider mount 例外は `capabilities` 限定であるため、それだけでは横断 UI シェルと Provider を layout に置けない。

本 ADR は **layout の mount 例外を一般化**し、`layout` と `page` を区別してこれを解く(新カーネルは要らない)。

## Status

Accepted

## 背景

トーストの queue 状態と `<Toaster/>` UI は「UI 状態(業務状態でない)」なので `components` に置ける([0022](0022-capabilities-kernel.md) の「UI 密着は component」原則)。しかしその `<Toaster/>` やレイアウトシェル(nav / footer)・各 Provider を **root `layout.tsx` に mount する経路**は、`app → features のみ`のマトリクスと capabilities 限定の mount 例外の下では存在しない。

## 決定: layout の mount 例外を一般化 + layout / page を区別

`app/route-segment`([0025](0025-app-layer-elements.md))のうち **`layout.tsx`(特に root)** は、横断 UI シェルと Provider を **薄く mount** してよい:

- 横断 UI シェル(nav / footer / `<Toaster/>`)を **`components`** から
- Provider を `components` / `capabilities`([0022](0022-capabilities-kernel.md))/ ポリシー seam([0031](0031-policy-state-supply.md))から

制約 = **配置のみ**。`<ThemeProvider><Toaster/>{children}</ThemeProvider>` の**配置は薄い mount(可)**、layout で hook を呼びデータを組むのは**ロジック(不可 = feature の仕事)**。

- **`page.tsx` は `features` のみ**(不変)
- 根拠: root layout は「どの feature にも属さない **app シェル**(html / body・グローバル Provider・nav / footer / toaster)の合成点」であり、`page.tsx`(= 画面 = 1 feature)と性質が違う
- **root layout は画面本体(`children`)を、自分が描く 1 要素で包む。** hydration は `<Suspense>` 境界ごとに分かれて進み、先に hydrate された島の effect が、まだ hydrate されていない側の DOM を React の外から書き換えると(focus の閉じ込めや背面の inert 化を行うライブラリはこれをする)、後から来た React が食い違いとして報告する。書き換えの相手を root layout が描く要素にしておけば、その要素は境界の外にあって最初の commit で hydrate されるため、島がいつ動いても相手は既に hydrate 済みである。「相手の側から hydrate されたと言わせる」形は採らない —— 書き換える主体がライブラリのとき、その合図を出す口が無い。時計(`setTimeout` / `requestAnimationFrame` 等)で待つ形も採らない(外れる理由の実測は [docs/design/rendering.md](../design/rendering.md))

### 横断 UI 状態の帰属(mount と対で確定)

- **トースト queue** → `components`(UI 状態・Provider + `useToast()`)。feature は `features → components`(既存許可)で `useToast().show()` を呼ぶ
- **テーマ** → `capabilities` / `components` の Provider

### route group は shell の単位であり、client 状態の境界でもある

route group を分けると器が分かれる。**その境界を跨ぐ遷移は、共有していない layout を unmount する**
(client-side transition が保つのは shared layout だけである)。したがってその layout へ mount した
Provider が持つ状態は、境界の向こうへ持ち越されない。Cache Components([0041](0041-cache-components-decision.md))
が遷移後も前の route の木を保つことがあるのは router 側の最適化であって、状態が境界を跨いで残る保証
ではない。設計はそれに依存しない。

**これは欠陥ではなく、route group をジャーニーの単位として使うことの裏返しである。** あるジャーニー
の内側でしか意味を持たない状態は、そのジャーニーを離れた時点で失われてよい。器を分ける理由は
**見せたい姿の違いでも、描く時点の違いでもよい**([0040](0040-routing-rendering-strategy.md))——
どちらで分けても、境界がジャーニーの境界になることは変わらない。

- **見せたい姿が違う**とは、見せる相手と導線が違うことである。利用者向けと管理向けのように相手が
  違えば shell そのものを分け(`AppShell` / `AdminShell`)、1 枚の shell に分岐で抱えない。抱えると、
  どの画面でどの導線が出るかを shell を読まないと判断できなくなる
- **描く時点が違う**とは、配下を組み立て時に固めたいことである。固めるには、器がバックエンドにも
  cookie にも触れないところまで下がるしかない([0040](0040-routing-rendering-strategy.md))。器が
  request 時の取得を要るなら、固めたい画面をその器の外へ出す

したがって:

- ある group の `layout.tsx` へ mount してよいのは、**そのジャーニーの内側で閉じる状態**だけである
- 状態が境界を跨いで生き残る必要があるなら、**跨ぐこと自体が同じジャーニーの一部**である。その場合は
  2 つを親の route group でまとめ、親の `layout.tsx` へ Provider を置く。root layout へ上げるのは
  最後の手段で、1 つのジャーニーで閉じる状態をグローバルへ持ち上げることになる(下記「禁止事項」)
- **どちらを選んだかは、その器の仕様書に書く。** 失われることを受け入れたのか、跨ぐ必要があると
  判断したのかは成果物から読めない

### パンくずを置く画面(器ではなく画面が持つ)

パンくずは**器が全画面へ一律に置くものではない**。置くのは次の条件を満たす画面だけである。

- **global nav から 1 手で戻れない祖先を持つ**(= 階層が 2 段以上)

したがって根の画面、nav が直接指している画面、および**線形フロー**(入力 → 確認 → 完了のように段を順に進み、戻ることを想定しない流れ)には置かない。前 2 つは nav と同じ導線を二重に置くだけであり、線形フローでは「戻れる場所」を示すことが離脱の導線になる。段の進捗は `Stepper` が持つ。

- **到達経路が複数ある画面では、辿った経路ではなくサイト構造上の階層を示す**(一覧から入っても絞り込みから入っても、同じ `トップ > 一覧 > 1 件`)
- **置く主体は画面**である。器は口を持たない。どの階層を示すかは画面が持っている値(1 件の名前など)に依存し、器が知ると画面ごとの分岐を器が抱える

パンくずは WCAG の AA 要件ではない(SC 2.4.8 Location は AAA。[0100](0100-accessibility-target.md))。したがって上記は a11y 要件の充足ではなく、**情報構造を一貫させるための規約**である。

## 禁止事項

- ❌ `page.tsx` が横断 UI / Provider を直接 mount すること(mount 例外は `layout.tsx` 限定)
- ❌ `layout.tsx` で hook 呼び + データ配線を行うこと(mount = 配置のみ。合成は feature)
- ❌ 器(`AppShell`)がパンくずの口を持つこと、および階層が 1 段の画面へパンくずを置くこと
- ❌ 見せる相手が違う面を 1 枚の shell に分岐で抱えること(shell を分ける)
- ❌ 本来ローカルで足りる一時的な UI 状態(単発トーストの表示フラグ等)を、shell マウント層でグローバル状態として抱え込むこと。横断的に共有すべき UI 状態は [0060](0060-state-management.md) が採用した `stores`(Zustand)へ置く

## 関連 ADR

- [0025-app-layer-elements.md](0025-app-layer-elements.md) — `app/route-segment`(layout / page。本 ADR が layout の mount を細分)
- [0022-capabilities-kernel.md](0022-capabilities-kernel.md) — Provider mount 例外(本 ADR が capabilities 限定から一般化)
- [0021-frontend-responsibility.md](0021-frontend-responsibility.md) — 依存マトリクス(`app/route-segment` 行の layout mount 例外)
- [0031-policy-state-supply.md](0031-policy-state-supply.md) — ポリシー Provider(反応的供給時に layout mount)
- [0040-routing-rendering-strategy.md](0040-routing-rendering-strategy.md) — 描画モードは route 全体で決まる(器を分ける判断の相方)
- [0041-cache-components-decision.md](0041-cache-components-decision.md) — 遷移意味論の変更(状態の持ち越しを設計が当てにしない相手)
- [0050-styling-strategy.md](0050-styling-strategy.md) — テーマ / ダークモード(Provider mount 対象)
- [0080-error-handling.md](0080-error-handling.md) / [0052-ui-component-policy.md](0052-ui-component-policy.md) — トースト UI の帰属先
