# UI コンポーネント方針(採用)

UI コンポーネント基盤として **shadcn/ui**(Radix primitives + Tailwind の copy-in 方式)+ **@tabler/icons-react**(アイコン)+ shadcn 系の複雑入力部品(日付ピッカー等)を **本リポジトリに採用**する。置き場は `components` カーネル([0021](0021-frontend-responsibility.md))。

## Status

Accepted

## 背景

本リポジトリは「一般的な Next.js アプリケーション基盤」である。UI コンポーネント・アイコン・複雑入力部品は、一般的なアプリ基盤に **汎用・常用** で必要な要素であり、用途依存として委ねる対象ではない。したがって本体に採用し、shadcn/ui の採否・アイコンライブラリ・form コンポーネント・Headless UI 系の扱いをここで確定する。

## 決定: shadcn/ui + @tabler/icons-react + 複雑入力を採用

- **UI コンポーネント = shadcn/ui**(Radix UI primitives + Tailwind、**copy-in** 方式)。生成コンポーネントは `components` カーネル([0021](0021-frontend-responsibility.md):横断 UI = デザインシステム的な純 UI)に配置する
- **アイコン = @tabler/icons-react**。供給元を名指しできるのは [`src/components/icon.ts`](../../src/components/icon.ts) 1 ファイルだけで、feature も `components` の各部品もそこを参照する。締め出しは `eslint.config.ts` の `no-restricted-imports` が持つ。採る理由は語彙の広さで、outline だけで 5,000 種を超える。**アイコンが足りないことを理由に 2 つ目のセットを採らせない**ことがこの選択の目的である
- **アイコンの公開面は名前付き再輸出に限る**。名前から component を引く表を置くと、その表がセット全体への静的な参照になり、使っていないアイコンまで束へ乗る。再輸出なら呼び出し側が import したものだけが残り、量は `pnpm bundle-budget` の予算([0101](0101-performance-budget.md))が受ける
- **公開名は供給元の綴りではなく、この面の語彙**。供給元が別の名前で同じ字面を配っていても公開名は変えない。差し替えたときに呼び出し側が動かないことが、閉じ込めの目的そのものである
- **複雑入力(日付ピッカー等)= shadcn 系部品**(`react-day-picker` などを Radix/Tailwind でラップした shadcn レシピ)。`components` に配置する。既定は控えめ(Medium)= 必要時に使う位置づけ
- 本リポジトリの UI は、これら採用部品に加えて **Tailwind ユーティリティ**([0050](0050-styling-strategy.md))と feature 内 UI([0021](0021-frontend-responsibility.md))で構成する。**utility で足りる配置(stack / inline / grid)は component で包まない。** `<Stack gap={4}>` と `<div className="flex flex-col gap-4">` の間に抽象の利得は無く、包んでも Tailwind の表現力は増えない。増えるのは「utility と component のどちらで書くか」を利用側が毎回迷う面だけである。骨格を utility だけで組む合成例はカタログ([0054](0054-ui-catalog-storybook.md))が示す
- **variant 定義 = `class-variance-authority`(cva)**。shadcn/ui の公式コンポーネントが cva を使った状態で配布されるため採用する(採らなければ配布物を毎回書き換えることになる)。置き場・使い方の規約は [0050](0050-styling-strategy.md) が持つ。**`tailwind-variants` は採らない** —— variant / slots / responsive / merge を束ねて責務を 1 語で言えず([0004](0004-library-management.md) の一次判定)、cva と責務が重なる
- **リッチテキスト(TipTap)を採用する**。エディタ本体と表示側 sanitizer の a11y 契約・seam は [0053](0053-ui-component-interaction-seam.md) が所有し、本 ADR は `components` カーネルへの配置と exact-pin 要件のみを持つ
- **本体スコープの線引き**: 本体が抱えるのは上記の汎用 UI 基盤 + リッチテキストまで。これを超える局所的な UI 要件(並べ替え等のライブラリを要する DnD = dnd-kit 等)は本体に同梱せず、[0053](0053-ui-component-interaction-seam.md) が seam と a11y 契約を持つ。それらは **必要時に追加**する

### 部品を得るために上流を増やさない

registry は、本リポジトリが採るものとは別の headless 上流を前提とする item を配ることがある。**この場合その item は copy-in しない。**同一責務に 2 つ目の上流を抱える判断になり、1 部品のために同規模の下地を丸ごと引き受けることになるためである([0010](0010-standards-and-non-lockin.md) 非ロックイン)。Base UI を前提とする item がこれに当たり、**`@base-ui/react` は採らない**。registry に item が無い UI 概念も同じ扱いとする。取り得る道は 2 つで、いずれも `components` の公開 API を変えない。

- **既に持つ部品の合成で組む**
- **合成で届かない場合は、必要な機構だけを抽出して自前で実装する**

CLI が案内する代替 item が、既に持つ部品と責務を重ねることもある。その場合も copy-in せず、足りない機能だけを既存の部品へ取り込む(vendor は増やさない)。

上流を増やす判断へ倒せるのは、**複数の部品が同じ上流を要求し始めたとき**か、**自前合成では満たせない要件が実使用面で確定したとき**である。この 2 つは別々に処理せず、**「今の上流をそちらへ置き換えるか」という 1 つの移行判断**としてまとめて評価する。**併存は選ばない** —— 依存表面が純増し、同じ責務の部品が 2 系統に割れる。

供給網の弱さは、この判断の論拠にならない。それは移行判断の論拠であって、併存の論拠にはならないためである。

### variant は排他の見た目にだけ使う

`variant` / `size` が表すのは**同時に成り立たない見た目**である。状態の有無・構造の差し替え・振る舞いの切り替えを variant で表さない。真偽値の props が増える形になったら、それは合成([0053](0053-ui-component-interaction-seam.md) の slot)か部品の分割([0021](0021-frontend-responsibility.md))へ直す合図である。

### 部品の層と置き場所は README が正

`components` の 4 層(`design-system` / `patterns` / `shell` / `app-starter`)の受け持ちと、目的別ディレクトリの割り方は [`src/components/README.md`](../../src/components/README.md) が所有する。層は「誰が書き換えるか」、目的は「何のための部品か」で軸が違う。

### 上流は参照実装であり、追従先ではない

shadcn/ui から取り込んだ実装は**参照実装**として持つ。取り込む理由は、Next.js 上での最適化と機構の一般化を済ませた形をそのまま出発点にできることであり、上流の版に追従し続けるためではない。取り込んだ後の所有者はこのリポジトリで、改変してよい。

**これは重複の許可ではない。** 重複を 2 箇所目で統合する規律([0021](0021-frontend-responsibility.md))は `components` の内側にも等しく効く。

### 台帳と上流追従

**`components` 配下の部品は 1 つ残らず台帳([`src/components/shadcn-manifest.yaml`](../../src/components/shadcn-manifest.yaml))に名指しで載せ、上流との関係を `kind` で持つ。** copy-in した部品だけを記録する形は採らない —— 「台帳に無い」が自前実装なのか記録漏れなのかを区別できず、記録漏れが見過ごされる。上流を持つ行は取り込んだ時点の上流 commit を持つ。上流を参照実装として所有する(前節)以上、後で上流の差分を読むための base がこちら側に要るためである。**取り込みの入口は `pnpm add:ui` に限り、shadcn CLI を直接叩かない。** 台帳へ載せる操作が CLI の外にあるため、直接叩いた部品は台帳に載らない。台帳の項目の意味と取り込み手順は層 README が持ち、本 ADR は再掲しない。強制: `pnpm check:ui`(台帳と実配置の突合。記録の無い部品・実体を失った行・置き場の不一致で落ちる)。CLI の直接実行そのものは機械で止めていないが、その結果は同じ検査が「記録の無い部品」として落とす。

**drift の検査は二段に分け、required にするのは前段だけとする。** 台帳と実配置の不一致は通信を要さず、原因はレビュー中の変更にあるため、PR のゲートにする。上流の変化は通信を要し、原因はレビュー中の変更に無いため、定期実行で報告するに留め、**required check に登録しない** —— 著者に直せない理由で PR が止まり、報告が途切れうる job を必須に載せると PR が永久に待たれる([0153](0153-ci-configuration.md) §5)。上流が動いたときに何をするか(差分を読んで取り込むか、据え置くか)は人の判断であり、bot が書き換えない([0072](0072-api-type-generation.md) の drift 検査と同じ形)。強制: `.github/workflows/shadcn-drift.yaml` の job 分割(`shadcn-manifest` は PR で走り required、`upstream` は schedule のみ)/ required の登録は `.github/settings/branch-protection.json` / PR で走らない job を required に載せないことは `make actions-required-check-lint`([0153](0153-ci-configuration.md) §5)。

**`components` 配下に書かれた class は、実 CSS を build して出力と照合する。** Tailwind は知らない class に何も出力せず、何も失敗しない —— 面が透明になる、focus ring が出ない、選択状態が見えない、という欠陥が browser で見るまで現れない。copy-in は上流の theme が定義する token 前提の class を持ち込むため、これは取り込みのたびに起きうる常態であり、参照実装として改変する(前節)側の義務である。**出力が無いことと、書いてはいけないことは別とする** —— 意図して CSS を持たない class(animation plugin を採らないための装飾指定等)は検査側で理由付きで除外し、実装からは消さない。消すと生成物が持っていた情報が失われる。範囲は copy-in が着地する `components` 配下である。強制: `pnpm check:classes`(`component-classes` job。通信を要さず変更起因なので PR のゲート・required)。検査が見るのは class だけで、接頭辞の無い CSS 変数の混入には届かない —— そちらは取り込み時に人が見る(手順は層 README)。

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
- ❌ 本体スコープを超える局所的な UI 要件(ライブラリを要する DnD 等)を本 ADR の範囲で本体へ持ち込むこと(seam と契約は [0053](0053-ui-component-interaction-seam.md) / ライブラリは用途依存)
- ❌ リッチテキストの表示を sanitizer を通さずに行うこと(生の `dangerouslySetInnerHTML` は禁止。sanitizer port は [0053](0053-ui-component-interaction-seam.md))
- ❌ `components` 配下に台帳に無い部品を置くこと / shadcn CLI を直接叩いて取り込むこと(強制: `pnpm check:ui`)
- ❌ 上流追従の検査を required check に登録すること(著者に直せない理由で PR が止まる。[0153](0153-ci-configuration.md) §5)

## 関連 ADR

- [0010-standards-and-non-lockin.md](0010-standards-and-non-lockin.md) — 標準準拠 + 非ロックインの判断軸(本採用の正当化根拠)
- [0004-library-management.md](0004-library-management.md) — exact-pin / `pnpm audit` / メジャー更新は別 PR
- [0050-styling-strategy.md](0050-styling-strategy.md) — Tailwind 主軸 + CSS Modules 限定許可(styled-components / emotion は非採用。shadcn/ui のスタイル手段)
- [0051-styling-system.md](0051-styling-system.md) — デザイントークン体系 / レスポンシブ / モーション / 印刷(採用 UI が参照する semantic token の供給元。モーションライブラリの採用帰属も 0051 側)
- [0054-ui-catalog-storybook.md](0054-ui-catalog-storybook.md) — UI カタログ(採用部品の視覚的仕様の置き場)
- [0021-frontend-responsibility.md](0021-frontend-responsibility.md) — `components` カーネル(採用 UI の配置先)・昇格規律(vendor 依存の閉じ込め)
- [0011-no-docker.md](0011-no-docker.md) — 表示層ロール
- [0060-state-management.md](0060-state-management.md) — form state(react-hook-form + zod)採用。form 部品と対で機能する
- [0053-ui-component-interaction-seam.md](0053-ui-component-interaction-seam.md) — リッチテキスト(TipTap)の a11y 契約 / sanitizer port、および DnD(dnd-kit)等、本体に同梱しない局所 UI の seam
- [0153-ci-configuration.md](0153-ci-configuration.md) — required check の登録条件(上流追従の検査を必須に載せない根拠)
- [0072-api-type-generation.md](0072-api-type-generation.md) — 陳腐化した写しは drift 検査が赤くして人が回す(台帳の上流追従と同じ形)
