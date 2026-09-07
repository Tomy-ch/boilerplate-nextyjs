# スタイリング体系(デザイントークン・レスポンシブ・モーション・印刷)

[0050](0050-styling-strategy.md) が定めた **Tailwind 主軸 + CSS Modules 限定許可(styled-components / emotion は非採用)/ token = CSS 変数 / global と local の境界 / ダークモード = token 切替 + `prefers-color-scheme` 追従** という「器」を受けて、本 ADR はその中身 —— **デザイントークン体系(命名層とスケール)/ ブレークポイント・コンテナクエリ / モーション方針 / 印刷** —— を具体化する。0050 が「design token は CSS 変数」という枠のみを定めたのに対し、本 ADR は「その CSS 変数をどう構造化し、レスポンシブ・モーション・印刷という表現軸にどう展開するか」を定める。

[0010](0010-standards-and-non-lockin.md) の 2 原則(標準準拠 / 非ロックイン)に従い、ここで下す決定はいずれも **Tailwind を正当化から抜いても成立する CSS 標準・業界パターン**に乗る。boilerplate が固定するのは体系の「形」であって、具体的なパレット値・スケール刻み・モーションの見た目は fork 先の嗜好に委ねる。

## Status

Accepted

## 背景

0050 は Tailwind v4 採用・`cn()` 置き場・design token = CSS 変数・ダークモード = token 切替を確定するが、**token の中身(命名層 semantic vs raw / spacing・typography・radius・shadow のスケール / `@theme` との対応)は器のみで空白**である。同様に **ブレークポイント体系**・**モーション方針**・**印刷/PDF** も 0050 の射程外にある。本 ADR はこの 4 項目を 1 本に束ねる。

`src/app/globals.css` は **2 層構造**(`:root` に生の色変数 → `@theme inline` で Tailwind の色トークンへ別名付け → `prefers-color-scheme: dark` で生変数を再束縛)を持ち、本 ADR はこれを一般化する。命名層を決めずに書き始めると、0050 が採用したダークモード(semantic な意味で色を参照し、テーマ切替を token 差し替えに閉じる)が破綻するため、体系の確定は feature 実装に先行して効く。

## 決定

### 1. デザイントークン体系 = 2 層(primitive / semantic)

- token を **2 層**に分ける。この分離は [W3C Design Tokens](https://www.w3.org/community/design-tokens/) が標準化を進める業界パターンであり、CSS custom properties だけで成立する(**Tailwind を抜いても成立する** = 0010 §2 非ロックインの正当性材料)。
  - **primitive(生スケール)**: 意味を持たない生の値。色パレット(`--color-*` の raw ramp)・`--spacing-*`・`--text-*`(font-size / line-height)・`--font-weight-*`・`--radius-*`・`--shadow-*`。**Tailwind v4 の `@theme` に登録**し、ユーティリティを自動生成させる。
  - **semantic(意味別名)**: 用途を名指しした別名。接頭辞は `--semantic-color-*`(`background` / `foreground` / `muted` / `border` / `accent` 等)とし、primitive を `var()` で参照する。**参照面(コンポーネント)の既定は semantic 層**とする。接頭辞を分けるのは、生成した CSS に対する検出で primitive 直参照と semantic 参照を機械的に見分けるためである。
- **色は semantic 経由でのみ参照**する(0050「色をハードコードせず token 経由」の具体化)。primitive を直接コンポーネントに撒かない。
- **token の SSOT は `tokens/*.json`**([W3C Design Tokens](https://www.w3.org/community/design-tokens/) 形式・手書き)であり、デザインツールからの生成物ではない。`tokens/scripts/gen-tokens.ts` が primitive の `@theme` 登録と semantic 別名を含む CSS を生成し、`src/app/globals.css` がそれを import する。**生成物は編集しない**([0072](0072-api-type-generation.md) の生成物規律と同型)。CSS を直接書き換えると SSOT が二重化するため、token の追加・変更は必ず `tokens/*.json` に対して行う。
- **テーマ切替(ライト/ダーク等)は semantic 別名の再束縛だけで完結**させる。これが 0050 のダークモード決定を体系として成立させる要である。切替の経路は 2 つで、既定は OS 設定(`prefers-color-scheme`)、`data-theme` 属性が置かれている場合はそちらを優先する。**Tailwind の `dark:` variant も同じ 2 経路で発火させる**(`@custom-variant`)。片方だけを見る条件にすると、塗りの色だけが切り替わって `dark:` 付きの class が追従しない状態になる。
- **発光を状態の唯一の手掛かりにしない。** forced-colors モードでは UA が `box-shadow` を `none` にするため、影で作った発光は完全に消える。状態は色か文言と併せて示す。
- **既定以外の theme は `screen` メディアへ限定する。** 限定しないと dark の配色が印刷にも一致し、紙面が読めなくなる(§4)。
- **切替の軸は配色と系統の 2 本とする。** 配色(light / dark)は文書全体の軸で `:root` に出し、**系統**(利用者向け / 管理向け等)は部分木の軸で `[data-surface]` に出す。系統を分けるのは、同じ semantic token に対して置かれた場所ごとに別の値を当てる関心が、配色とは独立に立つためである。両者は直交するので、片方を選ぶともう片方が決まる形(4 通りを平置きする等)にはしない。
  - **系統は semantic 別名の再束縛だけで完結させる**(配色と同じ機構)。部品は自分がどの系統に置かれたかを知らない。系統ごとに別の部品を持つと、系統の数だけ同じ部品が増える。
  - **系統は `:root` ではなく部分木に置く。** App Router では入れ子の layout から `<html>` の属性を触れないため、経路として成立するのは部分木だけである。ただし **Portal の出口を含む位置でなければならない** —— overlay は `document.body` 直下へ出るため、本文の内側に置くと overlay だけ既定の系統で描かれる(経路の分担は [0050](0050-styling-strategy.md))。
  - **既定の系統は属性を置かない木に出す。** 詳細度は系統が `(0,1,0)`、配色が `(0,2,0)`、両方揃った範囲が `(0,3,0)` と積み上がり、同じ木では系統と配色の両方を指定した宣言が勝つ。
  - **`color-scheme` は配色の軸だけが宣言する。** 系統の側にも出すと同じ条件を二重に持ち、片方だけがずれる。
- **スケールの対象軸**: color / spacing / typography(size・line-height・weight・tracking)/ radius / shadow / text-shadow / blur。z-index スケールの token 化は本 ADR の 2 層モデルに乗る同型の関心だが、レイヤリング規約として `docs/rules.md` 側で扱う(本 ADR は「z も token 化する」土台のみ示す)。

### 2. レスポンシブ = viewport ブレークポイント(mobile-first)+ コンテナクエリ

- **Tailwind v4 の既定ブレークポイント**(`sm` / `md` / `lg` / `xl` / `2xl`)を追認する。**境界の値は design token が持ち、本 ADR は持たない** —— SSOT は `tokens/primitives.json` の `breakpoint` であり、そこから `@theme` の `--breakpoint-*` と `BREAKPOINT`(`src/model/generated/breakpoint.ts`)が生成される(§1 の生成物規律)。fork 先がカスタムスケールへ差し替える場合も token に対して行う(値の選択は fork 先の嗜好)。
- **mobile-first(min-width 基準)を明文化**する。これは Tailwind の既定挙動であると同時に CSS の一般作法であり、Tailwind 固有ではない(0010 §2)。無印がモバイル、`md:` 等で上書き加算していく。
- **段の呼び名を 3 つに固定する**: `md` 未満をモバイル、`md` 以上 `lg` 未満をタブレット、`lg` 以上を PC とする。境界は上の既定をそのまま使い、ここでは既定のどこに段の名前を割り当てるかだけを決める。
  - **`md` ではなく `lg` を PC の下限に置く**根拠は、タブレットの縦持ち幅が `md` 以上 `lg` 未満の帯に集中することと、Storybook の既定 viewport が tablet をその帯に置いていることの 2 点。`md` を PC の下限にすると、その帯の実機が「脇に領域を持てる幅」として扱われる。
  - **`lg` 未満は、本文の脇に幅を割けない帯である。** 幅を占める領域をこの帯から出すと、本文に残る幅がモバイルとほとんど変わらなくなり、本文側が先に破綻する。脇に常設できる帯とそうでない帯を分ける根拠はここにあり、そこから導かれる出し分け(常設か overlay か / 通常配置か下端固定か)は行動規約として [`docs/rules.md`](../rules.md) が持つ。
- **コンテナクエリ(`@container`)を採用**する。これは Tailwind v4 のコア機能(プラグイン不要)であり、実体は **CSS 標準の `@container` / `container-type`**(Tailwind を抜いても成立 = 0010 §2)。
  - **使い分け**: ページ骨格・レイアウトシェル([0026](0026-layout-shell-mount.md))は **viewport ブレークポイント**、feature スライス内の再利用コンポーネントは **コンテナクエリ既定**。理由 = 機能スライスのコンポーネントは再利用文脈で割り当て幅が変わるため、viewport より「自分が置かれた器の幅」で分岐する方が局所推論に合う([0020](0020-adopted-architecture.md) の局所性原則)。

### 3. モーション = CSS / View Transitions 既定 + 複雑モーションに Framer Motion + reduced-motion 尊重

- **既定手段(不変)**: モーションの既定手段は **CSS transition / animation** と **View Transitions API**(ブラウザ標準 / Next.js は experimental フラグ〈`experimental.viewTransition`〉+ React 実験的 API で対応)とする。いずれもブラウザ標準機構であり、特定ライブラリに縛られない(0010 §2)。単純な hover / focus / enter・状態遷移・ページ遷移アニメーションはまずこの標準手段で書く。
- **既定手段の上に animation plugin(ユーティリティ生成の `tw-animate-css` 等)を足さない。** 標準手段で足りる範囲に plugin を重ねると、同じ動きの語彙が 2 系統になる。その帰結として、**待機を動きで伝える手段を体系に持たない** —— 進捗が判らない待機(indeterminate)は進捗部品では表現せず、骨格表示(`Skeleton` / `Shimmer`)が担い、進捗部品は値の判っている進捗だけを引き受ける。
- **複雑モーションに Framer Motion(`motion` パッケージ)を採用**: 標準の CSS / View Transitions では表現が破綻する複雑ケース —— **exit アニメーション(`AnimatePresence`)/ layout アニメーション(FLIP)/ ジェスチャ(drag・pan)/ 複数要素のオーケストレーション(stagger)/ 物理ベース(spring)** —— に限り、Framer Motion(現行パッケージ名 `motion`)を用いる。
  - **0010 §1(標準・デファクトへの準拠)**: Framer Motion は React エコシステムにおける宣言的モーションのデファクトであり、命名優先順位(React 規約 > 業界スタンダード)に沿う選択である。
  - **0010 §2(vendor-independent 正当性材料)**: 採用根拠は「Framer が推奨するから」ではない。上記の複雑ケース(特に **exit アニメーション** = 要素がアンマウントされる前の退場遷移)は **CSS / View Transitions だけでは構造的に表現できない**(React のアンマウント制御と DOM 生存期間の噛み合わせが必要)。この「標準では届かない具体的欠落を、宣言的 API で埋める」という根拠は Framer という固有ベンダーを抜いても成立する(同種の代替 = React Spring / GSAP / Motion One 等の中から、宣言的・React 統合・a11y 配慮という独立根拠で Framer を 1 要因として選択した)。既定を標準手段に置き Framer を複雑ケースに限定する境界そのものが、非ロックインの運用テスト(「Framer を抜いても既定モーションは成立するか」= Yes)を満たす。
  - **置き場 = `components`**: Framer Motion(`motion.*` コンポーネント / `AnimatePresence` / `useAnimate` 等)への **vendor 直参照は `components` 層に閉じる**。feature スライス側に `motion` を直接撒かず、モーション付き UI は再利用可能なコンポーネントとして `components` にラップして提供する(0010 §2「adapters / カーネル境界の裏に置き差し替え可能に保つ」の具体化 = vendor 差し替え時の影響面を `components` に局所化)。
  - **依存管理**: `motion` は core dep として **exact-pin**(`pnpm add -E`)し、追加時に **`pnpm audit`** を実施する([0004](0004-library-management.md))。major 更新は別 PR で扱う。
  - **設置面が実在した時点で依存へ追加する**([0053](0053-ui-component-interaction-seam.md) の「設置面が無い拡張点を実体化しない」と同型)。既定手段で足りている間に先回りで入れると、使われないまま major 更新の追随コストだけが残る。
- **`prefers-reduced-motion` の尊重を必須**とする(Tailwind の `motion-reduce:` / `motion-safe:` variant、`@media (prefers-reduced-motion)`、または Framer Motion の `useReducedMotion` フックで実装)。reduced-motion の尊重は WCAG SC 2.3.3 Animation from Interactions(**Level AAA**)に対応する。AA には該当を直接義務付ける SC はないが、本プロジェクトはユーザ体験配慮として `prefers-reduced-motion` を尊重する。**この強制の根拠水準(AAA)は本 ADR で明記**し、本 ADR は「モーション実装時に reduced-motion 分岐を欠かさない」という体系側の帰結を持つ。Framer Motion を用いる場合も reduced-motion 尊重は同じく必須(退場・layout・spring も低減対象)。

### 4. 印刷 / PDF = print CSS(フロント拡張点)/ PDF 生成(backend 境界 seam)

- **境界判定(「別ドメインか?」)** により、印刷関心を 2 分する。
  - **print CSS = フロント領域の拡張点**。Tailwind の **`print:` variant / `@media print`**(CSS 標準)を、印刷体裁を与える**名前付きの拡張点**として定義する。0050 の global 集約に従い、print 用のグローバル調整が要る場合は `globals.css` に置く。
  - **PDF 生成 = backend ドメイン = 境界 seam で切る**。サーバサイド PDF レンダリング(Puppeteer / 帳票エンジン等)はバックエンド責務([0070](0070-backend-role-separation.md))であり、フロントは「印刷可能な HTML/CSS を提供する」ところまでを担い、その先は境界 seam として名前を付けて切る(表示層で PDF を生成しない)。
- **最小の print 実装を同梱する。** 紙面の余白・見出しと段落の分断抑止・表の見出し行の繰り返しという、出力対象によらず効く体裁だけを CSS 基盤として持つ。**何を紙に出すかは持たない** —— 出す / 出さないの指定は呼び出し元が class で与え、tag からは自動判定しない。`window.print()` の実行と PDF 生成もこの基盤の外である。
- **紙に出さないものを決める主体は 2 つに分かれる。** 器(shell)は自分の header・footer・skip link を紙に出さない —— いずれも画面を渡り歩くためのもので、紙の上では押せず場所を取るだけである。どの画面を印刷しても器の判断は同じなので器が決め、中身の何を落とすかは画面ごとに違うので画面が決める。
- **dark 配色を print へ持ち込まない。** 既定以外の theme を `screen` メディアへ限定することで担保する(§1)。限定しないと、暗い面に明るい文字という配色がそのまま紙面に出て読めなくなる。

### 5. 和文の本文書体 = OS 同梱の書体へ委ねる(Web フォントはラテンの銘と等幅に限る)

**和文の Web フォントは、ラテンの書体とは費用の桁が違う。** 字数が多いため実体は数 MB になり、配信は
`unicode-range` で 100 以上のスライスへ割られる。取得はブラウザが必要な分だけに絞るが、**`@font-face`
の宣言は全スライスぶんが CSS に載り、それは描画をブロックする**。同梱サンプルの実測で、`@font-face`
865 個 = 661 KB(gzip 233 KB)。同じ CSS に入っているアプリ本体の宣言は gzip 25 KB で、**重さの 9 割は
書体の宣言**だった。

`next/font` はこの CSS を**セルフホストへ引き取る**のが利点だが、和文ではその引き取りが上の代償を生む。
`subsets` で絞れるのは名前付きサブセット(latin / cyrillic 等)だけで、番号付きスライスには効かない
(`unicode-range` を指定する口を `next/font/google` は持たない)。

#### 取りうる手立てと、boilerplate での成否

| 手立て | 中身 | 本リポジトリでの成否 |
| --- | --- | --- |
| **① OS 同梱の書体へ委ねる** | 和文の Web フォントを使わず、ヒラギノ角ゴ / 游ゴシック / Noto Sans JP 等へ落とす | **採用**。転送も宣言も 0 |
| ② サブセット化してセルフホスト | 実際に使う字だけを抜いた実体を作る。数 MB → 数十 KB | **不可**。fork 先の文言が未知で「使う字」を確定できない。更新の多いサイトで効果が薄いのは一般に知られた限界でもある |
| ③ `unicode-range` の分割配信を維持 | Google Fonts の既定。ブラウザが必要なスライスだけ取る | **部分採用**。取得は絞れるが宣言が載る問題が残るため、載せてよい範囲を限る(下記) |
| ④ 用途を限る | ラテンの銘・等幅だけ Web フォント、和文は OS 同梱 | **採用**。①と組で使う |

#### この repository の決定

- **和文の Web フォントを読まない。** どの系統の本文も OS 同梱の書体へ委ねる。同梱サンプルの実測で、
  利用者向けの面は CSS 260 KB → 26 KB(gzip)・`@font-face` 865 → 10、管理面は 158 KB → 25 KB・493 → 10。
  LCP は、取得を持たない静的な画面で 5.52 → 2.94 秒、入力欄の多い管理面で 4.34 → 2.79 秒だった
- **銘(ラテン)と等幅は Web フォントのままとする。** ラテンはスライスが数個で、費用が桁で違う
- **本文書体を系統(`data-surface`)の軸に含めない**([0045](0045-fonts-and-images.md))。系統ごとに
  差し替える仕組み(`globals.css` の `[data-surface]`)は残すが、既定ではどちらも同じスタックを指す。
  **面を分けても費用は消えない** —— 管理の書体を管理の面だけで読んでも、管理を開く人はやはり
  宣言を読まされる。系統の差は配色・発光・余白・強調の段が担う
- **強調の段は 1 つに畳む。** 実測(macOS / Chromium、同じ文字列のインク量で比較)では、ヒラギノ角ゴシックは
  400/500/600/700/800 のすべてを描き分けるが、**游ゴシックは 400 とそれ以外しか区別せず**(500・600・700・800
  が同じ字面)、`system-ui` は 500 と 600 が同じになる。したがって本文(400)との差はどこでも残るが、**その上を
  さらに分けても多くの環境では消える**。部品が選び分けているのに利用者には届かない区別を体系に持たせない
  ため、`strong` を落として `emphasis` だけを持つ
- **見出しと本文の差は寸法と位置が作る。** 太さで階層をもう 1 段作らない。同梱サンプルでも、落とした
  `font-strong` の 37 箇所のうち 30 箇所は `text-lg` / `text-xl` と組で使われており、階層は既に寸法が
  担っていた(再検討の条件は [BACKLOG](BACKLOG.md) W12)
- fork 先が和文の Web フォントを本文へ戻すときは、②(文言が確定しているなら)か、③を系統ごとの面に
  限る形で行う。**どこへ足しても、その面を開く人はスライス全ぶんの宣言を読む**

### token は 3 層。部品固有の層はサンプルと同じ扱いで破棄できるようにする

- **primitive**(`tokens/primitives.json`) —— 生の値。部品から直接参照しない
- **semantic**(`tokens/themes/<系統>/<配色>.json`) —— primitive を指す別名。部品が参照するのはこの層
- **component** —— 1 つの部品でしか意味を持たない値。**semantic を参照して定義する**(primitive を直接参照しない)

semantic 層は系統と配色の組ごとに 1 枚を持ち、**すべての組が同じ token を宣言する**。欠けた token は宣言が無いだけでは済まず、カスケードにより隣の組の値を引き継ぐため、系統を切り替えたつもりの箇所だけが元のまま残る。この一致は生成時に強制する。

component 層を認めるのは、破棄の機構が入ったためである。**題材(サンプル)のために足した token は `sample` マーカーで囲み、破棄の対象に含める**。デザインシステムとして残す token と、サンプルサイトのために足した token を、同じ表の中で見分けられる状態にしておく。

**破棄できない形で題材の token を足さない。** マーカーの外に置いた時点で、それは fork 先が受け取る design system の一部になる。

### 幅で決めるものと、器で決めるもの

レスポンシブの判断軸を 2 つ持つ。**どちらを使うかは対象で決まる**ので、画面ごとに選ばない。

| 判断軸 | 使う対象 | 例 |
| --- | --- | --- |
| **帯(viewport)** | 画面の骨格。どこに何を置くか、出すか出さないか | 脇の領域の有無、段組みの向き、被せるか並べるか |
| **器の幅(container query)** | 部品の中身。同じ部品が広い場所にも狭い場所にも置かれるとき | カードの内部配置、行の折り返し |

対象で決まるとしたのは、同じ部品が本文にも脇の狭い領域にも並ぶためである。部品の中身を viewport で分けると、置かれた場所によらず同じ形になる。逆に骨格を器の幅へ従わせると、帯の定義(§2)と器の宣言で境界が二重になる。**この 2 つを行動規約の形で持つのは [`docs/rules.md`](../rules.md) である。**

器の幅で決める部品は、**親が `container-type` を持つことを前提にする**。その前提は story でも満たすこと(器を固定せずに撮った基準画像は実物と一致しない)。

## 禁止事項

- ❌ semantic 層を飛ばして primitive(生スケール)や色リテラルをコンポーネントに直接撒くこと(テーマ切替が token 差し替えに閉じなくなる。§1)
- ❌ 系統ごとに別の部品を持つこと、および部品に自分の置かれた系統を判定させること(系統は semantic 別名の再束縛だけで完結する。§1)
- ❌ 系統と配色を掛け合わせた組を平置きして 1 本の軸として扱うこと(直交する 2 軸を畳むと、片方を足すたびに組が掛け算で増える。§1)
- ❌ token 命名層(primitive / semantic)を無視した ad-hoc な CSS 変数を各所に増やすこと。新規 token は `@theme` の primitive か semantic 別名として定義する
- ❌ ブレークポイントの値(`rem` / `px`)を本 ADR 本文へ書くこと。段は名前(`sm` 〜 `2xl`)でだけ指し、値は design token を正とする(併記した時点で token を差し替えても ADR だけが取り残される。§2)
- ❌ レスポンシブの**日常 rule**(脇に常設する領域を出す帯・常時到達させる操作の置き場・帯と器の使い分けを実装でどう守るか 等)を本 ADR や ADR 本文へ書き込むこと(rule は `rules.md` へ。[0140](0140-documentation-operations.md))
- ❌ モーションを `prefers-reduced-motion` 分岐なしで実装すること(§3 / [0100](0100-accessibility-target.md))
- ❌ CSS transition / animation / View Transitions で足りる単純モーションに Framer Motion を持ち出すこと(既定は標準手段。Framer は exit / layout / gesture / orchestration / spring の複雑ケースに限る。§3)
- ❌ 既定手段の上に animation plugin を足すこと、および進捗部品で indeterminate を表現すること(待機は骨格表示が担う。§3)
- ❌ Framer Motion(`motion.*` / `AnimatePresence` 等)の vendor 直参照を feature スライスに散らすこと(vendor 参照は `components` 層に閉じ、差し替え可能に保つ。§3 / [0010](0010-standards-and-non-lockin.md))
- ❌ Framer Motion 以外の別モーションライブラリ(GSAP / React Spring 等)を勝手に併存させること(採用は Framer Motion に一本化。追加が必要なら ADR 改定でユーザ確定)
- ❌ 表示層で PDF をサーバ生成する実装を持ち込むこと(backend 境界 seam を越える。§4)
- ❌ 器の導線(header / footer / skip link)を紙に出すこと、および画面が落とす中身を器に判定させること(§4)

## 補足

- **Figma → CSS 変数 同期は本 ADR の射程外**。token の**体系(命名層・スケール軸)**のみを本 ADR が定め、デザインツールとの**同期方式**(Figma variables → CSS の生成/取り込み)は fork 先で確定するものとし、本 ADR の射程外とする。本 ADR で同期方式に踏み込むと後続決定と矛盾しうるため、意図的に体系のみへ限定した。
- **モーションライブラリ採用の帰属**は 0050 系(本 ADR)と [0052](0052-ui-component-policy.md)(UI ライブラリ)で射程が重なる。モーション手段(既定 = CSS / View Transitions、複雑ケース = Framer Motion)の**採用決定は本 ADR が所有**する。0052 が扱う UI コンポーネントライブラリ(shadcn/ui 等)とは関心が別のため、モーションは本 ADR 側で一元管理する。
- **`prefers-reduced-motion` 必須化の根拠水準**は本 ADR で明記する。reduced-motion 尊重は WCAG SC 2.3.3(**Level AAA**)に対応し、AA には直接の該当 SC がない —— したがって [0100](0100-accessibility-target.md)(a11y AA 目標)は motion 尊重を直接の義務としては持たない。本 ADR は AA 準拠とは独立に、ユーザ体験配慮として `prefers-reduced-motion` を必須とする立場を採り、その強制根拠水準(AAA)は本 ADR 側で明記して齟齬を残さない。
- **reduced-motion で「止める」と決めた表現は、止めた状態で何も伝わらなくならないことまでを含む。** 動きだけで進行中を示す表現(帯の流れ等)は、停止時に代替の手掛かり(骨格表示・待機文言)を併用する前提で設計する。
- 本 ADR は [0140](0140-documentation-operations.md) のタクソノミーにおいて **decision** 分類に属する(体系の決定であり、日常強制される rule = Tailwind クラス順序・帯ごとの出し分け等は [`docs/rules.md`](../rules.md) 側)。**value** はさらに別で、ブレークポイントの幅は `tokens/primitives.json` が持つ。3 者を同じ本文に同居させると、token を差し替えたときに ADR の記述だけが取り残される。

## 関連 ADR

- [0050-styling-strategy.md](0050-styling-strategy.md) — 本 ADR の親。Tailwind 主軸 + CSS Modules 限定許可(styled-components / emotion は非採用)/ token = CSS 変数 / ダークモード = token 切替という器を定める(本 ADR がその中身を具体化)
- [0010-standards-and-non-lockin.md](0010-standards-and-non-lockin.md) — 標準準拠 / 非ロックインのメタ判断軸(token 2 層・`@container`・View Transitions・`@media print` はいずれも Tailwind を抜いて成立する CSS 標準に乗る / Framer Motion 採用も §1 デファクト準拠 + §2 vendor-independent 正当性 + `components` 局所化で担保)
- [0004-library-management.md](0004-library-management.md) — ライブラリ方針(`motion` は exact-pin + `pnpm audit` / major 更新は別 PR。§3)
- [0100-accessibility-target.md](0100-accessibility-target.md) — a11y 目標(WCAG AA)。reduced-motion 尊重は WCAG SC 2.3.3(AAA)に対応し AA 直接義務ではないため、その根拠水準は本 ADR §3 側で明記(Framer Motion 使用時も同じく必須)
- [0052-ui-component-policy.md](0052-ui-component-policy.md) — UI コンポーネントライブラリの採用(shadcn/ui 等)。モーションライブラリの採用帰属は本 ADR 側に一元化(補足参照)
- [0045-fonts-and-images.md](0045-fonts-and-images.md) — `next/font` の読み方(§5 の和文本文書体の相方)
- [0020-adopted-architecture.md](0020-adopted-architecture.md) / [0026-layout-shell-mount.md](0026-layout-shell-mount.md) — 局所性原則 / レイアウトシェル(§2 の viewport vs コンテナクエリ使い分けの土台。§4 の器が紙に出さない判断の主体)
- [0070-backend-role-separation.md](0070-backend-role-separation.md) — PDF サーバ生成を切り出す backend 境界(§4)
