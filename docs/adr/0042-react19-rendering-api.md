# React 19 レンダリング API 規約

React 19 のレンダリング関連 API —— **ref as prop(`forwardRef` 廃止方向)/ `use()` / `useEffect` 抑制 / React Compiler の採否** —— の使用規約を定める。本 ADR は [0040](0040-routing-rendering-strategy.md) が定めた **App Router のレンダリング機構・RSC / Client 境界の置き方** の上で、コンポーネント内部で **React そのものをどう書くか** を確定する。

## Status

Accepted

## 背景

[0040](0040-routing-rendering-strategy.md) は「Server / Client 境界を **どこに置くか**(WHERE)」を定めるルーティング ADR であり、「境界の内側で React API を **どう書くか**(HOW)」は射程外である。本 ADR がその HOW を持つ。

本リポジトリは **React 19.2 / Next.js 16** を採用しており([0011](0011-no-docker.md) / App Router de facto の帰結)、この領域は AI エージェントの訓練データと乖離が大きい([AGENTS.md](../../AGENTS.md)「This is NOT the Next.js you know」)。規約が無いと、新旧パターン(`forwardRef` / 手書き `memo` / `useCallback` と、ref as prop / React Compiler)が実装者ごとに混在する。本 ADR はレンダリング関連 React API の使用規約を成文化する。

裏取り元(実装前確認・[0010](0010-standards-and-non-lockin.md) §1 の「乗る」先): `node_modules/react`(v19.2.4)/ `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/reactCompiler.md` / 同 `01-getting-started/06-fetching-data.md`(`use()` の Promise / Context 解決例)。

### 射程宣言(0040 と重複しない)

本 ADR は **レンダリング関連の React API に限る**。以下は本 ADR の射程外であり、既存 ADR が所有する(局所推論の起点を分けるための明示分界):

| 関心 | 所有 ADR | 本 ADR との分界 |
| --- | --- | --- |
| RSC / Client 境界を **どこに置くか**・`"use client"` の押し下げ | [0040](0040-routing-rendering-strategy.md) | 本 ADR は境界の内側の **API の書き方** のみ |
| `use()` を使った **データ取得の編成・キャッシュ・重複排除** | [0071](0071-bff-api-integration.md) | 本 ADR は `use()` を **レンダリングのプリミティブ** としてどう書くかのみ |
| `<Suspense>` / `loading.tsx` の **境界配置・粒度** | [0080](0080-error-handling.md) §4 | 本 ADR は `use()` が Suspense を前提にする **不変条件** のみ |
| 横断的な reactive client hook(runtime 能力)の **家** | [0022](0022-capabilities-kernel.md) | 本 ADR は `useEffect` の **書き方の抑制方針** のみ |

## 決定

### 1. ref as prop を採用し、新規コードで `forwardRef` を使わない

- React 19 では ref を **通常の prop** として関数コンポーネントで受け取れる。新規コンポーネントはこれを用い、**`forwardRef` を新規に書かない**。
- **vendor-independent 正当性材料**([0010](0010-standards-and-non-lockin.md) §2): `forwardRef` は wrapper による余分な間接層を生み、型(`ForwardRefRenderFunction` 等)を複雑化させる。ref as prop は素の関数シグネチャで済み、props と ref の型付けが一様になる。これは React の権威を抜いても成立する API 設計上の単純化根拠であり、「React が deprecate したから」に留まらない。React 19 は `forwardRef` を deprecation 方向に置いており([0010](0010-standards-and-non-lockin.md) §1 の「デファクトに乗る」= React 規約への準拠)、乗ることは車輪の再発明の回避でもある。

### 2. `use()` を条件付きの読取プリミティブとして許容する

- `use()` を **Promise / Context の読取**に用いてよい。`useContext` に代えて `use()` で Context を読むことを許容する(`use()` は条件分岐・早期 return の内側でも呼べる —— Hook のトップレベル制約を受けない読取であるため)。
- **正道**: Server Component で開始した fetch の Promise を Client Component へ **props で渡し**、`<Suspense>` 境界の下で `use()` により解決する(`fetching-data.md` の文書化パターン。0040「`"use client"` は葉へ押し下げ」と整合し、fetch 自体は server に留めつつ待機のみ client へ寄せる)。
- **委譲**: `use()` を **どのデータで使うか / キャッシュ・再検証・重複排除をどう設計するか** は [0071](0071-bff-api-integration.md)、`<Suspense>` 境界の **配置・粒度** は [0080](0080-error-handling.md) §4 が所有する。本 ADR は「`use()` は Suspense / error boundary を前提とする」という **不変条件** のみを敷く(裸の `use()` を境界なしで置かない)。

### 3. `useEffect` を外部システム同期に限定する(抑制)

- `useEffect` は **React 外の外部システムとの同期**(subscription / 非 React DOM 操作 / ブラウザ API 購読)に限って用いる。
- **禁止方向**: props / state から導出できる **派生値** を effect + state で同期しない(render 中の計算、または event handler で求める)。React 公式「You Might Not Need an Effect」の方針に乗る。**vendor-independent 根拠**: 派生値の effect 同期は余分な再レンダリングと同期ズレのバグ源であり、これは React の版に依らない状態管理上の一般原則である。
- **昇格**: 複数 feature から使う reactive な横断 client hook(runtime 能力)へ育つ `useEffect` は、feature 内に留めず **`capabilities` カーネル**([0022](0022-capabilities-kernel.md))へ昇格させる([0021](0021-frontend-responsibility.md) 昇格ルール)。effect は client 実行であり、RSC 既定([0040](0040-routing-rendering-strategy.md))の葉への押し下げと整合する。

### 4. React Compiler は基盤の必須機能にしない(annotation で opt-in する性能最適化手段)

- **本体は React Compiler を前提にしない。** Compiler が無くても通常の React / Next.js 実装がそのまま成立する状態を保つ。Compiler を使わない component を劣った実装として扱わない。
- **全体適用(full-auto / infer)は採らない。** 採るのは `compilationMode: "annotation"` と `"use memo"` による opt-in である。この設定は常設し、`babel-plugin-react-compiler` を exact pin の開発依存として持つ([0004](0004-library-management.md))。`"use no memo"` は escape hatch であって、恒常運用の前提には置かない。
- **`"use memo"` は実装詳細ではなく performance annotation** である。「この component / hook について Compiler による最適化を許可する」という明示の宣言であり、**1 つの client state の変化が広い部分木へ及ぶ経路**に対して付ける。撒くのではなく、その経路を構成する component を数えて付ける。
- **経路は購読で決まり、画面上の位置では決まらない。** state の変化が届くのは、その供給を購読している component と、そこから props で作り直される子孫だけである。**供給の祖先は届かない**(子から親へは伝わらない)し、**`children` として受け取った部分木も届かない**(同じ要素の参照がそのまま渡るので React が素通りする)。**子が持つ state も届かない** —— overlay の開閉のように状態が子の内側にあるなら、その JSX を組んだ親は開閉のたびに再実行されない。したがって「同じ帯に並んでいる」「その操作の画面に居る」は印の根拠にならない。数える前に、その component が何を `use()` しているかを見ること。
- **Compiler-ready は全体で維持し、Compiler execution だけを opt-in にする。** Rules of React への適合と `eslint-plugin-react-hooks` の Compiler 由来ルールは、Compiler の利用有無に関わらず維持する。これらは Compiler のための検査ではなく、effect で state を導出する形・描画中の副作用・ref の扱いといった**通常実装のバグを止める検査**だからである([0002](0002-formatter-linter.md))。
- **手書きの `memo` / `useMemo` / `useCallback` を一律に Compiler へ置き換えない。** 既存のメモ化を機械的に削除しない。
- **予防的なメモ化そのものは禁じない。** 起こりうる費用を先に潰すことは止めない。禁じるのは [0020](0020-adopted-architecture.md) 設計原則 6 の**責務を超えた手当て**と、**意味を持たないメモ化**である。
  - **その下の層が握るもの** —— メモ化した値はそのまま下へ渡る。その値が妥当かを確かめるのは受け取る側(feature / `adapters` / 契約 / バックエンド)であって、渡す側で先回りしない
  - **同一性に依存する先が無い** —— その値が依存配列にも、メモ化された子にも渡らない(素の DOM 属性へ渡すだけの handler など)
  - **再描画が起きても費用が問題にならない** —— エッジケースのさらにエッジケースだけを捕まえるもの
- **計測は「書いてよいかの条件」ではない。** 意味があるかを言えないときの決め手である。逆に、意味があると言えるものを書くのに計測は要らない。
- **理由は成熟度ではなく blast radius**: Compiler は stable であり、実装も React 本体である。問題は品質ではなく**壊れ方が fail-fast でない**ことにある。[0030](0030-environment-variable-management.md) §8 の taint は違反時に throw し、[0041](0041-cache-components-decision.md) の Cache Components は前提を満たさなければ build が落ちる。Compiler は落ちない —— build 時に component を自動変換してメモ化を導入するため、**値の参照同一性・effect の依存・購読・第三者ライブラリとの相互作用**に、fail-fast でない静かな挙動差分が出うる。lint / E2E / VRT / a11y の網は持っているが、それを**全体自動適用を正当化する根拠にはしない**。
- **コストの及ぶ範囲は適用範囲に一致させる**: full-auto は共有 chunk +16.4 KB gzip・各 route の初期 JS +4〜15 KB を全 route へ乗せる。`annotation` は共有 chunk を増やさず、印を付けた component が乗る route だけが増える —— 同梱サンプルの実測で、供給の購読者 13 個を付けた `/products` が +2.4 KB、印を 1 つも持たない他の route は増分 0(`pnpm bundle-budget <現行の .next> <比較先の .next>`)。
- **利益は TBT ではなく INP に出る。** JS の増加は TBT(実行時間)を悪化させる側であり、Compiler が縮めるのは再描画で、これは実ユーザーの操作からしか観測できない。したがって**測れているコストを払って、まだ測れていない利益を全 route へ先行適用することはしない**。
- **採用条件は「stable 化」ではない**(既に stable である)。**再描画が集中する経路であると言えること**、および**払う費用がその route に収まっていることを実測で示せること**が条件である。
- **効果の実測を印の条件にしない。** Compiler が縮めるのは event の processing(handler の中で React が同期に行う仕事)であり、体感を決める interaction latency のうち presentation(style / layout / paint)は縮めない。同梱サンプルの実測では、CPU を 4 倍に絞っても processing は全操作で中央値 0〜4 ms・最悪 94 ms(8 倍絞り)で、**同一 build を 2 度測った差(+12〜+63%)のほうが Compiler の差より大きい**(測り方: build 済みのアプリを実ブラウザで操作し、`event` と `long-animation-frame` の `PerformanceObserver` を CPU 絞りのもとで反復して読む。`processingEnd - processingStart` が Compiler の縮める部分で、`duration` の残りは縮まない)。ここで「効果が測れないから付けない」と決めると、本リポジトリが配るのは題材の画面が軽いという事情であって、fork 先の画面の話ではなくなる。**本リポジトリが持つのは機構と、印を置く場所の実例**であり、自分の画面で釣り合うかは fork 先が RUM([0082](0082-client-observability.md))の INP で決め直す。

### 4-1. 性能改善の順序(Compiler はその一手段)

性能問題は、原因を特定してから手段を選ぶ。Compiler は選択肢の 1 つであって、既定の入口ではない。

```text
性能問題を検出
  ↓
原因分析
  ↓
適切な改善策を選択
  ├─ Server Component 化
  ├─ client JS 削減
  ├─ component / state 境界の見直し
  ├─ データ取得 / キャッシュの見直し
  ├─ 手動メモ化
  └─ React Compiler の opt-in
```

**SSR-First との関係を取り違えない。**

```text
SSR-First       → client で実行する必要そのものを減らす
React Compiler  → client で実行する必要が残った箇所に対する最適化候補
```

Compiler を SSR-First の前提や標準挙動には置かない。Compiler を使うためにアーキテクチャを歪めない。

## 禁止事項

- ❌ 新規コンポーネントで `forwardRef` を使うこと(ref as prop に乗る。決定 1)
- ❌ `use()` を `<Suspense>` / error boundary の外に裸で置くこと(決定 2 の不変条件)
- ❌ props / state から導出できる派生値を `useEffect` + `useState` で同期すること(render 中計算 or event handler。決定 3)
- ❌ `reactCompiler` を `compilationMode` の指定なしに設定し、全 component へ暗黙に適用すること(決定 4)
- ❌ 再描画が集中する経路であると言えないまま `"use memo"` を撒くこと、および費用の増分をその route で測らずに付けること(決定 4)
- ❌ `"use no memo"` を恒常的な運用の前提に置くこと(escape hatch に留める。決定 4)
- ❌ 既存の手書き `memo` / `useMemo` / `useCallback` を一律に削除して Compiler へ委ねること(決定 4)
- ❌ Compiler による性能上の利益を理由に、PII / キャッシュ / セキュリティ境界を緩めること([0112](0112-data-classification-cache-boundary.md) 不変条件 6)
- ❌ **責務を超えた手当て**、および**意味を持たないメモ化**を撒くこと —— 下の層が握るもの / 同一性に依存する先が無い / 再描画の費用が問題にならない([0020](0020-adopted-architecture.md) 設計原則 6・決定 4)
- ❌ 本 ADR で **RSC / Client 境界の置き方**(0040)・**データ取得のキャッシュ設計**(0071)・**Suspense 境界の配置**(0080)を再決定すること(射程外)

## 補足

- **decision と rule の分界**([0140](0140-documentation-operations.md) タクソノミー): 本 ADR は React Compiler の**採否**(decision)と各 API の**採用方針**(decision)を確定する。他方、日常強制される制約 —— 「`forwardRef` を書かない」「派生値を effect 同期しない」「意味を持たないメモ化を撒かない」 —— は **rule 分類**であり、[`docs/rules.md`](../rules.md) が Rationale 逆参照付きで持つ。本 ADR 本文には rule の芯(なぜ)のみを残す。
- **「手書き memo 禁止」という連動規約は発生しない**: 決定 4 が全体適用を採らないため、Compiler にメモ化を委ねることを前提にした手書き禁止規約は生じない。`compilationMode` の選択も決定 4 が `annotation` として持つ。
- **React Compiler は correctness / architecture / runtime の前提ではない**: 本体の実装・レビュー・テストは Compiler の有無に依存しない。opt-in された箇所は、E2E が退行していないことと、費用の増分がその route に収まっていることを確かめたうえで維持する。**VRT はこの確認に使えない** —— story の撮影は Storybook の build を撮り、そちらは `next.config.ts` を読まないので Compiler が走らない。撮っているのは常に印の無い側の描画であり、Compiler が変換した結果を通るのは `next build` を経る経路だけである。

## 関連 ADR

- [0040-routing-rendering-strategy.md](0040-routing-rendering-strategy.md) — App Router のレンダリング機構 / RSC・Client 境界の置き方(本 ADR の親。WHERE を所有、本 ADR は HOW を所有)
- [0020-adopted-architecture.md](0020-adopted-architecture.md) — 機能スライス × 表示層カーネル(`"use client"` 葉押し下げ・昇格の親原則)
- [0021-frontend-responsibility.md](0021-frontend-responsibility.md) — 昇格ルール(横断 client hook → `capabilities`)
- [0022-capabilities-kernel.md](0022-capabilities-kernel.md) — reactive な横断 client hook の家(`useEffect` 昇格先)
- [0071-bff-api-integration.md](0071-bff-api-integration.md) — `use()` を用いるデータ取得の編成・キャッシュ・重複排除(本 ADR から委譲)
- [0041-cache-components-decision.md](0041-cache-components-decision.md) — Cache Components の採否(前提を満たさなければ build が落ちる fail-fast 型の機構。決定 4 の blast radius の対比先)
- [0080-error-handling.md](0080-error-handling.md) — `<Suspense>` / `loading.tsx` 境界の配置・粒度(`use()` の前提)
- [0010-standards-and-non-lockin.md](0010-standards-and-non-lockin.md) — 標準準拠(React 規約に乗る)+ vendor-independent 正当性材料の必須化
- [0140-documentation-operations.md](0140-documentation-operations.md) — decision / rule タクソノミー(本 ADR = decision / 連動制約 = rule → rules.md)
- [0004-library-management.md](0004-library-management.md) — `babel-plugin-react-compiler` の exact pin + `pnpm audit` フロー
- [0101-performance-budget.md](0101-performance-budget.md) — 性能予算(Compiler の適用可否を判断する計測の側)
- [0082-client-observability.md](0082-client-observability.md) — INP を含む Web Vitals の RUM(効果測定の前提)
