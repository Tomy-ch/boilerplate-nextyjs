# UI コンポーネント方針(採用)

UI コンポーネント基盤として **shadcn/ui**(Radix primitives + Tailwind の copy-in 方式)+ **@tabler/icons-react**(アイコン)+ shadcn 系の複雑入力部品(日付ピッカー等)を **boilerplate 本体に採用**する。置き場は `components` カーネル([0021](0021-frontend-responsibility.md))。

## Status

Accepted

- バッテリー採用への転換(2026-07-14・v1)

（採番はブロック帯で確定(2026-07-14・0001〜0155。トピック順ブロック帯(10 番台=主題ブロック))([0140](0140-documentation-operations.md))。0.0.x の ADR は living document として本文を直接上書きし、改定履歴を積まない。当初は exclusion(本体非同梱)として記録していたが、v1 =「一般的な Next.js アプリケーション基盤」方針([master-plan §1.2](../plan/master-plan.md))への転換に伴い、採用へ反転した。日付 2026-07-14）

## 背景

当初 AGENTS.md の `[TODO]`(BACKLOG B2)は shadcn/ui の採否・アイコンライブラリ・form コンポーネント・Headless UI 系の扱いを未決とし、本 ADR はこれらを「用途依存ゆえ本体に同梱しない」exclusion として記録していた。

その後、boilerplate の性格を「用途未定の最小表示層」から **「一般的な Next.js アプリケーション基盤(v1)」** へ転換する方針が確定した([master-plan §1.2](../plan/master-plan.md))。UI コンポーネント・アイコン・複雑入力部品は、一般的なアプリ基盤に **汎用・常用** で必要な要素であり、v1 で採用対象とする(判定 = 汎用/常用 → v1)。

## 決定: shadcn/ui + @tabler/icons-react + 複雑入力を採用(v1)

- **UI コンポーネント = shadcn/ui**(Radix UI primitives + Tailwind、**copy-in** 方式)。生成コンポーネントは `components` カーネル([0021](0021-frontend-responsibility.md):横断 UI = デザインシステム的な純 UI)に配置する
- **アイコン = @tabler/icons-react**。供給元を名指しできるのは [`src/components/icon.ts`](../../src/components/icon.ts) 1 ファイルだけで、feature も `components` の各部品もそこを参照する。締め出しは `eslint.config.ts` の `no-restricted-imports` が持つ。採る理由は語彙の広さで、outline だけで 5,000 種を超える。**アイコンが足りないことを理由に 2 つ目のセットを採らせない**ことがこの選択の目的である
- **アイコンの公開面は名前付き再輸出に限る**。名前から component を引く表を置くと、その表がセット全体への静的な参照になり、使っていないアイコンまで束へ乗る。再輸出なら呼び出し側が import したものだけが残り、量は `pnpm bundle-budget` の予算([0101](0101-performance-budget.md))が受ける
- **公開名は供給元の綴りではなく、この面の語彙**。供給元が別の名前で同じ字面を配っていても公開名は変えない。差し替えたときに呼び出し側が動かないことが、閉じ込めの目的そのものである
- **複雑入力(日付ピッカー等)= shadcn 系部品**(`react-day-picker` などを Radix/Tailwind でラップした shadcn レシピ)。`components` に配置する。既定は控えめ(Medium)= 必要時に使う位置づけ
- boilerplate 本体の UI は、これら採用部品に加えて **Tailwind ユーティリティ**([0050](0050-styling-strategy.md))と feature 内 UI([0021](0021-frontend-responsibility.md))で構成する
- **variant 定義 = `class-variance-authority`(cva)**。shadcn/ui の公式コンポーネントが cva を使った状態で配布されるため採用する(採らなければ配布物を毎回書き換えることになる)。置き場・使い方の規約は [0050](0050-styling-strategy.md) が持つ
- **リッチテキスト(TipTap)は v1 採用**。エディタ本体と表示側 sanitizer の a11y 契約・seam は [0053](0053-ui-component-interaction-seam.md) が所有し、本 ADR は `components` カーネルへの配置と exact-pin 要件のみを持つ
- **v1 スコープの線引き**: v1 が抱えるのは上記の汎用 UI 基盤 + リッチテキストまで。これを超える局所的な UI 要件(DnD = dnd-kit 等は [0053](0053-ui-component-interaction-seam.md))は v2 で順次同梱、それを超える要件は **fork 先で追加**する

### 部品を得るために上流を増やさない

registry は、本リポジトリが採るものとは別の headless 上流を前提とする item を配ることがある。**この場合その item は copy-in しない。**同一責務に 2 つ目の上流を抱える判断になり、1 部品のために同規模の下地を丸ごと引き受けることになるためである([0010](0010-standards-and-non-lockin.md) 非ロックイン)。registry に item が無い UI 概念も同じ扱いとする。取り得る道は 2 つで、いずれも `components` の公開 API を変えない。

- **既に持つ部品の合成で組む**
- **合成で届かない場合は、必要な機構だけを抽出して自前で実装する**

上流を増やす判断へ倒せるのは、**複数の部品が同じ上流を要求し始めたとき**か、**自前合成では満たせない要件が実使用面で確定したとき**である。この 2 つは別々に処理せず、**「今の上流をそちらへ置き換えるか」という 1 つの移行判断**としてまとめて評価する。**併存は選ばない** —— 依存表面が純増し、同じ責務の部品が 2 系統に割れる。

供給網の弱さは、この判断の論拠にならない。それは移行判断の論拠であって、併存の論拠にはならないためである。

### variant は排他の見た目にだけ使う

`variant` / `size` が表すのは**同時に成り立たない見た目**である。状態の有無・構造の差し替え・振る舞いの切り替えを variant で表さない。真偽値の props が増える形になったら、それは合成([0053](0053-ui-component-interaction-seam.md) の slot)か部品の分割([0021](0021-frontend-responsibility.md))へ直す合図である。

### 部品の層と置き場所は README が正

`components` の 4 層(`design-system` / `patterns` / `shell` / `app-starter`)の受け持ちと、目的別ディレクトリの割り方は [`src/components/README.md`](../../src/components/README.md) が所有する。層は「誰が書き換えるか」、目的は「何のための部品か」で軸が違う。

### 上流は参照実装であり、追従先ではない

shadcn/ui から取り込んだ実装は**参照実装**として持つ。取り込む理由は、Next.js 上での最適化と機構の一般化を済ませた形をそのまま出発点にできることであり、上流の版に追従し続けるためではない。取り込んだ後の所有者はこのリポジトリで、改変してよい。

**これは重複の許可ではない。** 重複を 2 箇所目で統合する規律([0021](0021-frontend-responsibility.md))は `components` の内側にも等しく効く。

### 振る舞いと見た目を分けるのは、振る舞いが 2 箇所目で要るときだけ

振る舞いだけを hook や headless な部品へ出すのは、**同じ振る舞いを別の見た目で使う必要が実際に生じたとき**に限る。先回りして分けると、1 つの部品が 2 ファイルに割れるだけで、読む側は両方を追うことになる。

## 0010 準拠(vendor-independent 正当性 + 非ロックイン)

本採用は [0010](0010-standards-and-non-lockin.md) の 2 原則(標準に乗る / 選択主体は設計者)を満たす。

**§1 標準・デファクトへの準拠**:

- Radix UI primitives は **WAI-ARIA Authoring Practices**(業界標準のアクセシビリティパターン)を実装した headless primitive であり、独自発明ではなく標準に乗っている
- @tabler/icons-react は 24px グリッド・`currentColor`・stroke という SVG アイコンの一般的な構成に乗っており、独自の描画機構を持たない。React component として配られるため、束ね方も他の SVG アイコンセットと同じである

**§2 vendor-independent 正当性材料**(「そのベンダーを正当化から抜いても成立するか?」):

- **shadcn/ui は copy-in(コードを本体に取り込む)方式**であり、npm 依存としての**バージョンロックが構造的に存在しない**。取り込んだ後は自リポジトリのコードであり、shadcn という配布元が消えても、更新を止めても、任意に改変しても成立する(可搬性 = 十分)。これは「shadcn だから」ではなく「**Radix の WAI-ARIA 準拠 primitive + Tailwind の組み合わせを、自コードとして所有できる**」という独立根拠で選んでいる(正当性材料 = 十分)
- アイコンセットは他の SVG アイコン(Heroicons / Phosphor 等)へ差し替え可能であり、参照は `src/components/icon.ts` 1 ファイルに閉じる。差し替えはこのファイルの右辺だけで完結し、呼び出し側の綴りは動かない
- 運用テスト(0010 §2): 「shadcn / Tabler を正当化から抜いても、Radix primitive + Tailwind + SVG アイコンで純 UI を組む、というパターンは正当か?」→ Yes。乗っても縛られていない

**非ロックイン境界(adapters/カーネル境界)**:

- UI ライブラリへの依存は `components` カーネルに閉じ込める。feature / 各画面は `components` の公開 UI を参照し、Radix の import を feature 内に直接散らさない([0021](0021-frontend-responsibility.md) 昇格ルール:横断 UI → `components`)。これにより UI ライブラリの差し替えが `components` 内で完結する。アイコンの供給元はさらに狭く、`components` の内側でも `icon.ts` 以外から名指しできない

**exact-pin + audit**([0004](0004-library-management.md)):

- shadcn が引き込む実 npm 依存は **exact-pin** で追加(`pnpm add -E`)し、追加時に `pnpm audit` を実行する。メジャー更新は別 PR(0004)
- copy-in された shadcn コンポーネント本体はソースコードとして本体に取り込まれ、依存パッケージではない(pin 対象は上記の実依存のみ)
- **部品ごとの実依存は、copy-in の前に 0004 の様式で評価する。** registry item を取り込む判断は、その item が引く vendor を採る判断でもある。どの部品がどの vendor を引いたかという結果の一覧は本 ADR ではなく取り込みの記録が持つ

## 禁止事項

- ❌ Radix / react-day-picker を feature 内・各画面から直接 import すること(UI ライブラリ依存は `components` カーネルに閉じ込める。[0021](0021-frontend-responsibility.md) 昇格ルール)
- ❌ アイコンの供給元を `src/components/icon.ts` 以外から import すること(`components` の内側も含む)
- ❌ アイコンの公開面に、名前から component を引く表を置くこと(セット全体が束へ乗る)
- ❌ shadcn/ui 以外の UI コンポーネントライブラリ(MUI / Chakra / Ant Design 等、ランタイム同梱型)を並行採用すること([0050](0050-styling-strategy.md) の Tailwind 主軸 + CSS Modules 限定許可(ランタイム CSS-in-JS = styled-components / emotion は非採用)および copy-in 方針と衝突。必要なら ADR 改定)
- ❌ @tabler/icons-react 以外のアイコンライブラリを追加同梱すること(差し替えは可だが並行同梱はしない)
- ❌ 別の headless 上流を、registry item が要求するという理由だけで併存させること(合成か自前実装で組む。上流の追加は現行からの移行判断としてのみ扱う)
- ❌ 採用ライブラリを exact-pin / `pnpm audit` を経ずに追加すること([0004](0004-library-management.md))
- ❌ v1 スコープを超える局所的な UI 要件(高度な DnD 等)を本 ADR の範囲で本体へ持ち込むこと(v2 = [0053](0053-ui-component-interaction-seam.md) / それ以上は fork)
- ❌ リッチテキストの表示を sanitizer を通さずに行うこと(生の `dangerouslySetInnerHTML` は禁止。sanitizer port は [0053](0053-ui-component-interaction-seam.md))

## 関連 ADR

- [0010-standards-and-non-lockin.md](0010-standards-and-non-lockin.md) — 標準準拠 + 非ロックインの判断軸(本採用の正当化根拠)
- [0004-library-management.md](0004-library-management.md) — exact-pin / `pnpm audit` / メジャー更新は別 PR
- [0050-styling-strategy.md](0050-styling-strategy.md) — Tailwind 主軸 + CSS Modules 限定許可(styled-components / emotion は非採用。shadcn/ui のスタイル手段)
- [0051-styling-system.md](0051-styling-system.md) — デザイントークン体系 / レスポンシブ / モーション / 印刷(採用 UI が参照する semantic token の供給元。モーションライブラリの採用帰属も 0051 側)
- [0054-ui-catalog-storybook.md](0054-ui-catalog-storybook.md) — UI カタログ(採用部品の視覚的仕様の置き場)
- [0021-frontend-responsibility.md](0021-frontend-responsibility.md) — `components` カーネル(採用 UI の配置先)・昇格規律(vendor 依存の閉じ込め)
- [0011-no-docker.md](0011-no-docker.md) — 表示層ロール(v1 でアプリケーション基盤へ性格更新)
- [0060-state-management.md](0060-state-management.md)(B5)— form state(react-hook-form + zod)採用。form 部品と対で機能する
- [0053-ui-component-interaction-seam.md](0053-ui-component-interaction-seam.md) — リッチテキスト(TipTap。v1 採用)の a11y 契約 / sanitizer port、および DnD(dnd-kit)等 v2 採用の局所 UI
