# デザインシステム

design token から feature の画面部品まで、見た目を決めるものが**どう積み上がり、どの層が何を決めて何を決めないか**を通しで説明する。判断そのものは [ADR 0050](../adr/0050-styling-strategy.md)〜[0055](../adr/0055-design-system-export.md) が持ち、日々の禁止は [`docs/rules.md`](../rules.md) の「UI 部品と操作」「レイアウトと帯」が持つ。ここが持つのは、それらを読むために要る前提と、**実装を開いて初めて判る経路と落とし穴**である。

`src/components/` の受け入れ範囲と目録は [`src/components/README.md`](../../src/components/README.md) が正であり、ここはそれを写さない。食い違う場合は ADR と層 README を優先する。

## 系統 —— 何が何の上に積まれているか

| 段 | 在り処 | 決めるもの | 決めないもの |
| --- | --- | --- | --- |
| **token** | [`tokens/`](../../tokens/README.md) → `src/app/generated/tokens.css` | 色・余白・角丸・書体・影・段の**値**と、配色（light / dark）× 系統（`user` / `admin`）ごとの引き当て | どの部品がどの token を使うか |
| **foundation** | `src/components/design-system/foundation/` | 部品を横断して効く CSS 基盤（scrollbar・組版・印刷・shimmer・scroll-fade）と、系統を Portal の出口へ届ける橋 | React component の公開（`surface` の橋を除き何も export しない） |
| **design-system の部品** | `src/components/design-system/<目的>/<部品>/` | 1 つの役割の中で閉じた見た目と操作。variant・size・a11y 契約 | 何を起こすか・何を出すか・どこに置かれるか（呼び出し元が渡す） |
| **patterns** | `src/components/patterns/` | 複数の役割を合成した形（項目の外枠、絞り込みの帯、表の列定義） | バックエンドの契約・mount 位置 |
| **shell / app-starter** | `src/components/shell/` / `src/components/app-starter/` | 置く位置と数が決まっている器 / 契約（HTTP status・送信結果・upload の段取り）を知る部品 | 業務の語彙（持った時点で `features` 行き） |
| **feature の ui** | `src/features/<name>/<screen>/ui/<part>/` | 題材の語彙を持つ組み立て。上の部品へ実データと Server Action を配線した形 | 見た目の体系（token を直に足さない。`components` の部品を並べる） |

上から下へ、**下の段は上の段を知らず、上の段は下の段を組み合わせるだけ**である。`components` が import してよい層は `model` と `errors` に限られ（`architecture.ts`）、逆に `features` は `components` を自由に引く。`cn()` を feature が使うのはこの向きに沿っており、実際に十数の feature ファイルが引いている。

**部品は自分がどの系統に置かれたかを知らない。** 系統の差は semantic token の引き直しだけで完結し（[0051](../adr/0051-styling-system.md) §1）、部品側の分岐も系統ごとの部品も存在しない。同じ理由で、部品は自分がどこに置かれるか（下端に固定か、脇に常設か）も知らない —— それは画面の判断で、[`docs/rules.md`](../rules.md)「UI 部品と操作」の末尾が禁じている。

## token —— 値の出所と、届く経路

SSOT は `tokens/primitives.json`（生の値）と `tokens/themes/<系統>/<配色>.json`（primitive を指す別名）の 2 層で、W3C Design Tokens の `$type` / `$value` と `{...}` の alias で書く。`pnpm gen:tokens`（`tokens/scripts/gen-tokens.ts`）が次の 3 つを生成し、`pnpm check:tokens` が生成物との差分で落とす。**生成物は編集しない。**

| 生成物 | 何が読むか |
| --- | --- |
| `src/app/generated/tokens.css` | `globals.css` が最初に import する。Tailwind と部品の全部 |
| `src/model/generated/breakpoint.ts` | JS から帯を判定する側（`BREAKPOINT`） |
| `src/model/generated/design-token.ts` | token の**名前**の目録。カタログの `Tokens/` がこれを元に値を実行時に読む |

### Tailwind へ届くまで

`tokens.css` は 3 つの区画から成る。

1. `@theme { --color-blue-590: … }` —— primitive を Tailwind の theme に登録する。ここから `bg-blue-590` のような utility が**生える**が、部品はそれを使わない
2. `@theme inline { --color-primary: var(--semantic-color-primary); }` —— semantic 名を Tailwind の色 token へ**別名付け**する。`bg-primary` / `text-primary` / `border-input` が生えるのはこの区画による
3. 系統 × 配色のブロック（`:root` / `[data-surface="admin"]` / それぞれの dark 版） —— `--semantic-color-*` の実体をここで束ねる

したがって部品に書く `bg-primary` は `--color-primary` → `--semantic-color-primary` → primitive と 3 段で解決される。**接頭辞が分かれているのは機械で見分けるため**で、生成 CSS に `--color-blue-*` の直参照があればそれが primitive の漏れである。

### 切替の 2 軸と、それが効く場所

| 軸 | 値 | どこに出るか | 既定 |
| --- | --- | --- | --- |
| 配色 | `light` / `dark` | `:root`。OS の `prefers-color-scheme` と `:root[data-theme]` の**二経路** | `light`（属性なし） |
| 系統 | `user` / `admin` | `[data-surface]` を置いた**部分木** | `user`（属性なし） |

既定の系統・既定の配色は属性を持たないので、**何も書いていない木は必ず `user` × `light` になる**。既定以外の配色は `screen` に限定して出るため、印刷は常に既定の配色である。

`dark:` variant は `globals.css` の `@custom-variant dark` が**同じ二経路**で発火させている。自前の CSS に `@media (prefers-color-scheme: dark)` を書くと、`data-theme` で light を選んだ利用者に dark の宣言が当たる —— 経路を 1 つしか見ないことになる。

系統の属性を置く側は `shell/admin-shell` で、外枠へ `data-surface` を置き、隣に `SurfacePortalBridge` を置く。橋が要る理由は「[間違えやすいところ](#間違えやすいところ)」で扱う。

### 生成が落とすもの

`gen-tokens.ts` は、全系統が同じ配色を持つこと（`assertSameSchemes`）と、全系統 × 全配色が同じ token を宣言していること（`assertSameTokens`）を検査し、欠けていれば生成ごと落とす。欠けを許すとカスケードで隣の組の値が引き継がれ、**切り替えたつもりの箇所だけ元の色のまま残る**ためである。系統を足すのはディレクトリを作るだけで、生成側に系統の名前は無い。

## `cn()`・variant・CSS Modules

**`cn()`**（`src/components/cn.ts`）は `clsx` + `tailwind-merge` の 1 関数で、class の条件分岐と Tailwind utility の競合解決の唯一の入口である。`clsx` / `tailwind-merge` を利用側から直接 import しない。

**variant** は `class-variance-authority` で書き、`<部品>.definition.ts` に置く（`button.definition.ts` の `BUTTON_VARIANT` / `BUTTON_SIZE` がその形）。描画する `<部品>.tsx` は定義を import して使う。variant が表すのは**同時に成り立たない見た目**だけで、状態の有無や構造の差し替えを variant にしない（[0052](../adr/0052-ui-component-policy.md)）。真偽値の props が増え始めたら、slot（`children` / `asChild`）か部品の分割へ直す合図である。

**CSS Modules** は [0050](../adr/0050-styling-strategy.md) が限定許可しているが、**現在 `*.module.css` は 1 つも無い**。`src/` にある `.css` は `globals.css` と、`foundation/` の 5 つ（`scrollbar` / `typeset` / `shimmer` / `print` / `scroll-fade`）だけで、これらは module ではなく `globals.css` が import する**全域の基盤**である。「utility で書けないから CSS ファイルへ」と考えたとき、行き先は 2 つあり、意味が違う。

| 行き先 | 効く範囲 | 例 |
| --- | --- | --- |
| `foundation/<名前>/<名前>.css` + `globals.css` の `@import` | 全域。継承プロパティを `:root` へ一度置く形か、`.typeset` のような opt-in の class | scrollbar の見た目、組版の rhythm、印刷の体裁 |
| `<部品>/<部品>.module.css` | その部品だけ | まだ実例が無い |

## `src/components/` の区画

`components/` 直下は**誰が書き換えるか**で 4 つに割れ、`design-system` だけがさらに**何のための部品か**で割れる。2 つは別の軸で、台帳（`shadcn-manifest.yaml`）も `layer` と `as` を別のキーで持つ。

| 層 | 判定 | 割り方 |
| --- | --- | --- |
| `design-system` | 契約を知らず、読んでも役割が増えない | 目的別（`action` / `form` / `overlay` / `navigation` / `display` / `status` / `container` / `layout` / `rich-text` / `foundation`） |
| `patterns` | 契約は知らないが、複数の役割を合成する | 割らない |
| `shell` | どこに・いくつ置くかが部品側で決まっている | 割らない |
| `app-starter` | バックエンドの契約を知っている | 割らない |

判定は **契約 → mount 位置 → 役割の閉じ方** の順に当てる。依存は `app-starter・shell → patterns → design-system` の一方向で、`design-system` の内側は向きを問わない。

**`README.md` を持つディレクトリが component である。** `pnpm check:ui` はこれだけを目印に台帳と実体を突き合わせるので、`design-system/form/` のようなまとめるためのディレクトリには README を置かない。逆に `layout/layout-patterns` のように story と README しか持たない component は実在する —— 実装ファイルの有無は判定に使わない。

`as` の見出しは 13 種（`action` / `form` / `overlay` / `navigation` / `display` / `status` / `container` / `foundation` / `layout` / `feedback` / `rich-text` / `view-state` / `sugar`）で、`src/components/scripts/check-shadcn.ts` の `CATALOG_HEADING` が正である。**`feedback` / `view-state` / `sugar` はディレクトリとしては存在しない** —— `patterns` と `app-starter` の部品が目録と sidebar 上でだけ名乗る見出しで、ディレクトリは `layer` からしか導かれない。

### 新しい部品をどこへ置くか

1. **題材の語彙を持つか。** 持つなら `components` は消え、`features` の 3 段（[placement.md](placement.md)）へ行く
2. **契約を知るか。** HTTP status の意味付け・送信結果の解釈・upload の段取りを知るなら `app-starter`
3. **置く位置と数が決まっているか。** root layout に一度、`main` の内側、ページ先頭のように部品側で決まるなら `shell`
4. **役割が 1 つに閉じるか。** 閉じるなら `design-system/<目的>/`、複数を合成するなら `patterns`
5. 目的が 2 つに跨がるときは、**その部品が無いと成立しない側**を採る（`copy-button` は押す行為が主なので `action`、`selection-toolbar` は選択という面の状態に従属するので `container`）

置き場が決まったら、台帳へ `layer` / `as` / `directory` を書き、README・story・test を co-locate する。shadcn 由来なら `pnpm add:ui` がこの大半を代行する（次節）。自前なら `pnpm gen component <name> --as=<見出し> [--layer=<層>]` が README・実装・test・story の 4 つを出し、`shadcn-manifest.yaml` へ `kind: original` の行も足す。**生成直後のまま `pnpm check:ui` を通る。**

### 候補として名前だけがある部品

一般的な業務システム・toC システムで再利用性が高く、`app-starter` の完成度を上げると見込まれている横断パターンが 4 つある。**いずれもまだ実装は無く、先回りでは作らない。** 情報構造が決まらないと形を固定できないため、該当する画面を実際に組む中で必要性を判定する。作るときは、業務語彙・API 型・特定の業務状態を持たず、利用側から serializable な表示データと操作結果を受け取る形に限る。

| 候補 | 用途 | 構成要素 | 持たない責務 |
| --- | --- | --- | --- |
| `settings-shell` | 設定・アカウント領域 | 設定カテゴリの navigation、section header、設定項目の key-value / form 表示、保存状態 | 認証情報と設定値の意味（feature が所有）。`shell/app-shell` に従属する |
| `master-detail-layout` | 一覧と詳細の併置 | responsive な一覧 / 詳細 pane、選択状態の URL 同期、狭い帯での route / drawer 切替 | データ取得と選択対象の型（feature が所有）。`shell/app-shell` に従属する |
| `maintenance-state` | サービス運用状態 | メンテナンス、部分障害、rate limit、retry-after、復旧確認、status page への導線 | 障害判定と復旧時刻（運用層が所有）。`app-starter/api-error-feedback` / `feedback-state` との重複を先に判定する |
| `offline-recovery` | 通信断からの復帰 | offline 表示、再接続、再試行、送信保留、競合時の案内 | 同期方式と再送保証（`capabilities` / feature が所有）。**`components` 単独では完結しない** |

置き場は `patterns` か `shell` の候補と、`features` に残す責務を先に分けてから決める。primitive の追加ではなく「アプリを運用可能な状態まで組み立てる」ための部品として扱う。

## shadcn/ui の扱い

### 取り込み

`pnpm add:ui <item> --as=<見出し> [--layer=<層>] [-- <shadcn add のオプション>]` が唯一の入口である（`src/components/scripts/add-shadcn.ts`）。`pnpm exec shadcn add` を直接叩かない。ラッパーが代行するのは次で、どれも CLI 単体では起きない。

- `--as` を**先に**要求し、値が見出しに無ければ `shadcn add` を走らせる前に落とす
- CLI が `design-system/<item>.tsx` へ出す生成物を、層と見出しに応じた `<層>/<目的>/<item>/` へ移す
- 依存部品の生成物を整理する。既に取り込み済みなら重複を消して import を実体への相対パスへ向け直し、未取り込みなら名前を報告して残す
- `component-template.md` を `README.md` として写す。placeholder は同じ作業で具体化する
- 成功時に台帳（`shadcn-manifest.yaml`）へ `kind: copy-in` / `layer` / `as` / `directory` / `dependencies` / `source[].commit` を upsert する。`source` は registry の JSON が申告する上流ファイルのパスと commit で、後の 3-way merge の base になる
- CLI の `pnpm add` が workspace root への追加を拒んで**ファイルが 1 つも書かれないまま止まる**問題を、この 1 回に限って `npm_config_ignore_workspace_root_check` で通す

### 取り込んだ後

上流は**参照実装であって追従先ではない**（[0052](../adr/0052-ui-component-policy.md)）。所有者はこのリポジトリで、改変してよい。取り込み直後に必ず直すものは 4 つあり、いずれも放置すると browser で見るまで現れない。

| 直すもの | なぜ | 検出 |
| --- | --- | --- |
| import パス `@/components/design-system/<item>` | この配置に無い | typecheck |
| `lucide-react` の import | `components.json` の `iconLibrary` に Tabler の選択肢が無いため CLI は lucide で出す | package 解決の失敗と `pnpm lint:eslint` |
| `ring-ring` / `border-ring` / `outline-ring` の focus 指定 | このリポジトリの focus は `outline`。`ring` token を採らない | `pnpm check:classes` |
| `var(--primary)` 等の接頭辞なし CSS 変数 | `--semantic-color-*` にしか実体が無い。`color-mix()` の引数に入ると**宣言全体が破棄され面ごと消える** | class 検出には掛からない。README の `grep` を手で回す |

`pnpm check:classes` は `globals.css` を実際に build し、`src/components` の `.tsx` に書かれた class が出力に現れるかを selector の形で照合する。**「定義が無いから消す」はしない** —— `animate-in` / `fade-in-*` のように animation plugin を採らないため意図して CSS を持たないものは `check-classes.ts` の `KNOWN_WITHOUT_CSS` に理由付きで置き、実装からは消さない。

### 台帳の `kind` と drift

| `kind` | 意味 | 上流が動いたとき |
| --- | --- | --- |
| `copy-in` | registry から取り込み、追従対象として持つ | `要追従` として報告。3-way merge で取り込む |
| `reimplemented` | 上流に相当する item はあるが自前で実装し直した（`checkbox-native` など） | `参考` として報告。追従しない |
| `original` | 上流に相当する item が無い | 何もしない |
| `not-adopted` | 検討したうえで作らない。実体を持たず `reason` / `revisitWhen` が必須 | 何もしない |

`pnpm check:ui` は台帳の整合（`directory` と実体、記録の無いディレクトリ、実体を失った行、`kind` と `source` の噛み合い、`dependencies` と実際の import、`as` の妥当性）を通信なしで見て、問題が無ければ上流の最新と `source.commit` を突き合わせる。CI（`.github/workflows/shadcn-drift.yaml`）は前者を**全 PR で**、後者を週次でだけ回す —— 上流の drift はレビュー中の変更が原因ではないので、PR を落とす理由にしない。

上流の変更を取り込むときは、`source.commit` の原本を base にした `git merge-file` の 3-way merge を使う（手順は `src/components/scripts/README.md`）。`--overwrite` で取り込み直すと TSDoc・import・focus の修正が全部消える。

### Blocks は読むだけ

shadcn/ui の Blocks は完成したアプリ断片で、**`components` として copy-in しない**。読むのは layout・responsive な部品合成・story の実例で、そこから必要な範囲だけを、依存境界・ディレクトリ規約・実 API 接続・型の規約に合わせて再構成する。**規約に反する型指定は移植しない** —— `as React.CSSProperties` のような型アサーションは、このリポジトリでは ESLint が禁じており、Blocks の書き方をそのまま持ち込むと `lint:ci` で落ちる。

### 上流を増やさない

registry が別の headless 上流（Base UI 等）を前提にした item を配ることがある。その item は取り込まず、既に持つ部品の合成か、必要な機構だけの自前実装で組む。上流を増やせるのは「今の上流をそちらへ置き換えるか」という移行判断としてだけで、併存は選ばない（[0052](../adr/0052-ui-component-policy.md)）。

## アイコン —— vendor の封じ込め

供給元（`@tabler/icons-react`）を名指しできるのは [`src/components/icon.ts`](../../src/components/icon.ts) だけである。締め出しは `eslint.config.ts` の `no-restricted-imports`（`iconVendorImports`）が持ち、`icon.ts` 自身だけがその対象から外れている。`docs-viewer/` にも同じ締め出しが掛かる —— 供給元を名指しできる場所をワークスペースに 2 つ作らないためである。

`icon.ts` は**名前付き再輸出だけ**を持つ。

```ts
export { IconChevronRight as ChevronRightIcon, … } from "@tabler/icons-react";
```

- 公開名は**この面の語彙**（`ChevronRightIcon`）であって供給元の綴り（`IconChevronRight`）ではない。差し替えのとき右辺だけを書き換え、呼び出し側は動かない
- 名前から component を引く表（`{ "chevron-right": … }`）にしない。表はセット全体への静的な参照になり、使っていないアイコンまで束へ乗る。再輸出なら import したものだけが残る
- `IconComponent` 型は `ComponentType<ComponentProps<"svg">>` で、供給元の型を別名にしない。別名にすると供給元が足した props がこの面を通って漏れる
- 足りない名前は `icon.ts` へ 1 行足す。カタログの `Icons/`（`.storybook/icon.stories.tsx`）は `icon.ts` を名前空間 import して**実行時に全件を列挙する**ので、足せばそのまま出る。`icon.ts` は再輸出しか持たないためカバレッジの母数から外してある（`components/README.md` の frontmatter）

## 重なり順の帯

z-index は token 化されていない。Tailwind の段階値だけを使い（[`docs/rules.md`](../rules.md)「レイアウトと帯」）、**どの段階値がどの帯か**は [0051](../adr/0051-styling-system.md)「重なり順の帯」が持つ。ここでは、その帯が実装のどこに現れているかを対応させる。

| 帯 | 値 | 実装での現れ方 |
| --- | --- | --- |
| 本文の中の重なり | `z-10` | `layout-patterns` の sticky header の例、`patterns/selection-toolbar` の sticky、`patterns/table-view-options` の固定列 |
| 画面が自分で貼る帯 | `z-30` | feature 側の `ui/` に置く貼り付き（header 直下の帯、下端から出し入れする器）。**`components` の中には無い** |
| 画面の骨格 | `z-40` | `shell/app-shell` / `shell/admin-shell` の header、`patterns/action-bar` の `fixed` |
| overlay | `z-50` | `overlay/*` の全部、`navigation/menubar` / `navigation-menu` の面、`shell/toaster` の region、`shell/consent-banner`、`shell/pull-to-refresh`、`app-shell` の skip link（`focus:z-50`） |

**`z-20` は空けてある。** 帯の間に入れる値ではなく、帯が 4 つで足りているという宣言である。同じ帯の中で「こちらを上に」が要るなら DOM 順で解き、値を増やさない —— それが要る時点で帯の割り当てが違う。

**部品の内側の重なりは帯ではない。** `avatar` の重ね、`button-group` の focus で持ち上げる境界、`attachment` の面いっぱいに広げた trigger（`z-10`）とその上に出す操作（`z-20`）は、部品自身が作る stacking context の中で閉じている。値が帯と同じ `z-10` / `z-20` でも競合しないのは、部品の外へ効かないからである。

**下端に固定する `z-40` は safe area を取る。** `action-bar.definition.ts` の `pb-[max(--spacing(2),env(safe-area-inset-bottom))]` がその形で、`lg:` 以上では `lg:static lg:z-auto` で帯から抜ける。scroll 領域に貼り付けるだけの `z-10` は取らない。

## カタログ（Storybook）

Storybook は**部品の唯一の一覧**である（[0054](../adr/0054-ui-catalog-storybook.md)）。README が責務と設計意図を叙述し、story が視覚的仕様と状態を canvas で示す —— 同じことを両方に書かない。story は部品の隣に co-locate し、`.storybook/` に置くのは設定と、部品ではない目録（`Tokens/` / `Icons/`）だけである。

### sidebar と目録は同じ区画

story の `title` の先頭セグメントは台帳の `as` と一致させ、`pnpm check:ui` が突合する。feature は `Page/<feature>/<画面>` と `Features/<feature>/…` を使い、13 の見出しには入れない。並びは `.storybook/preview.tsx` の `storySort` が `Page` → `Features` → `Tokens` → `Icons` → 目録の順に固定している。

`Tokens/Catalog` は `src/model/generated/design-token.ts` の**名前**だけを持ち、**値は mount 時に CSS 変数を `getComputedStyle` で読む**。ツールバーの `Theme` / `Surface` を切り替えると同じ名前が別の値へ解決され、地に対するコントラスト比も添えて出る。表へ値を書き写していないので、token を足しても目録が古くならない。

### story を持てない部品の条件

原則は「story を持たない component を新規に作らない」で、例外は**ブラウザで描けない**か**描くものが無い**かのどちらかに限る。

| 部品 | story | なぜ |
| --- | --- | --- |
| `foundation/surface` | 持たない | `SurfacePortalBridge` は `null` を返す。系統ごとの見え方は `Tokens/*` が持つ |
| `patterns/table`（親） | 持たない | 列定義の展開結果は `static-data` / `editable-data` の story が示す。親は入れ子の置き場を決めるだけ |
| `foundation/*` の CSS 基盤 | **持つ**。test は持たない | 描画は browser と OS が担い jsdom で再現できない。story だけが確認手段 |
| `layout/layout-patterns` | **story だけ**を持つ | 何も export しない。合成例と決定の置き場 |
| feature の `page-content.tsx` | 持たない | 取得の実体を story が持てない。取得を持つ合成と見た目を持つ部品を分け、後者に story を持たせる |

### server の無い面で外部の口を差し替える

カタログに server は無いが、押すと壊れる操作を残さない。差し替えるのは**外部の口だけ**で、主題そのものは差し替えない。

- **Server Action** は `.storybook/preview.tsx` の `sb.mock(import("…/actions.ts"))` で、隣の `__mocks__/` へ差し替える。**パスは拡張子まで書く** —— 省くと解決に失敗し、宣言はあるのに 1 件も登録されないまま進む。既定の戻り値は成功で、失敗は story 側で `mocked()` を差し替える。送信中を撮る story は `~catalog/lib/pending-action` の解決しない送信先で留める
- **同一オリジンの `/api/*`** は `.storybook/msw/` が答える。story の中で `fetch` を差し替えない —— 差し替えると応答の検証や失敗の分岐を部品が通らなくなる
- 配色は `:root` の `data-theme`、系統は **`body`** の `data-surface` を decorator が置く。story の木だけを包むと Portal の中身が属性の外へ落ちる
- `ToastProvider` は decorator が全 story に被せる。story ごとに包む形にすると、包み忘れた story は Storybook のエラー画面を描き、それが基準画像として承認されうる

### a11y はカタログで全数

`axe` は visual regression と同じ digest 固定コンテナで story 全数に掛かる（[0091](../adr/0091-test-verification-methods.md) §2）。`addon-a11y` は手元の対話パネルであり、ゲートではない。component 層の `vitest-axe` とは見えるものが違う —— jsdom には色が無いので、コントラストの実測は story 層でしか出ない。

## 外部への書き出し

`pnpm design:bundle`（`scripts/design-bundle/`）は `tmp/design-bundle/` へ、`r/*.json`（shadcn registry 形式の部品ソース）・`catalog.md`（用途・責務境界・story 名の目録）・`tokens.css`（生成済み token）の 3 つを出す。送り先は script が知らず、Figma やファイルを読む assistant への配送手順は `design-export` skill が持つ（[0055](../adr/0055-design-system-export.md)）。

- `catalog.md` の用途と責務境界は各部品の README の `## 用途` / `## 責務境界` 節を、story 名は `storybook-static/index.json` を読む。**index が無ければ止まる** —— story 名を空のまま出すと「story を持たない部品」が実在するように見えるため、先に `pnpm build-storybook` が要る
- bundle は生成物で、commit しない。デザインツールの出力を repo へ書き戻す経路も無い。提案を実装するなら人が読んで決める通常の実装作業である
- **画面の設計を始める前に一度だけ回す。** 反映の目的はデザインの判断を補って画面を設計することにあり、設計を始めてからでは間に合わない。高忠実度の取り込みは全部品を 1 つずつ検証するため時間が掛かるので、他の作業と並行させず単独で回す。反映後にデザインシステムを変えたら、途中で繰り返さず、変更をまとめてから 1 回で反映し直す

## 基準画像との関係

story 単位の visual regression の機構（撮る・比べる・撮り直す・承認する）は [vrt.md](vrt.md) が持ち、ここでは繰り返さない。デザインシステムの側から効く条件だけを挙げる。

- **token を触ると全数が動く。** `tokens/` の 1 行が全 story に効くので、落ちた画面それぞれについて理由を言えるまで撮り直さない。混ざっている不具合ごと撮り直すと、それが次の正になる
- **器の幅で分岐する部品は、story でも `container-type` を持つ親に置く。** 器を固定せずに撮った基準画像は実物と一致しない
- **hover でだけ現れる面は `play` で focus まで進める。** 撮影は pointer を持たないので、hover に任せた面は一度も写らない。focus で同じ面が開くことは a11y 契約が要求しており、`play` はその経路を使う
- **見た目が時刻の関数になる story** は `vrt/lib/excluded-stories.ts` へ理由と撤去条件つきで宣言する。story を消す理由にはならない

## 間違えやすいところ

### `"use client"` の有無は層で決まらない

`design-system` の実装 85 ファイルのうち、`"use client"` を持つものと持たないものはほぼ半々である。層が Client かどうかを決めているのではなく、**部品ごとに native で足りるかどうか**が決めている。同じ概念に `<concept>-native` / `<concept>-client` の対があるのはそのためで、`select-native` は素の `select` を Server Component として描き、`select-client` は Radix の popup を client island で描く。**見た目が豊かに見える方を選ばない** —— 候補が静的で件数も固定なら native で、初期配置だけを理由に client へ寄せない（[`docs/rules.md`](../rules.md)「UI 部品と操作」）。

### `data-surface` を本文の内側に置くと、overlay だけ既定の系統で描かれる

`overlay/*` は Radix の Portal で `document.body` 直下へ出る。器の外枠に `data-surface="admin"` を置いても、開いた dialog の中身はその外に居るため `user` の色で描かれる。`shell/admin-shell` が外枠の属性と一緒に `SurfacePortalBridge` を置いているのはこのためで、橋は hydration 後に `body` へ同じ属性を載せ、外れるときに自分が置いた値だけを消す。**本文は server が描いた時点で正しい系統を持ち、overlay は操作で開くので hydration より前には存在しない** —— だから橋が effect でも間に合う。Portal の `container` を系統の内側へ向ける案は、overlay 部品 6 つに口を足して呼び出し側が毎回指定する形になるため採っていない。

### 解決しない CSS 変数は、class より静かに壊れる

shadcn 生成物の `var(--primary)` はこのリポジトリでは何にも解決しない。`bg-[var(--primary)]` なら面が透明になるだけだが、`color-mix(in oklch, var(--primary) 10%, transparent)` のように**関数の引数に入ると宣言全体が無効になり、面がまるごと出ない**。`pnpm check:classes` は class の有無しか見ないので、変数は取り込み時に `components/README.md`「CSS 変数の接頭辞」の `grep` を別に回す。

### `outline-none` を足すと focus ring が消える

focus 表示は `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active` で統一している。ここへ既定の outline を消すつもりで `outline-none` を併記すると、Tailwind v4 の `outline-none` が `--tw-outline-style: none` を立て、`focus-visible:outline-2` が出す `outline-style: var(--tw-outline-style)` を打ち消す。**focus ring が一切描かれなくなる**。既定を抑えたいなら `focus-visible` 側の指定だけで足りる。`ring` を focus に使わないのは、forced-colors で `box-shadow` が `none` になって消えるためで、`shadow-glow-primary` はその上に乗る装飾にすぎない。

### `primary` と `emphasis` を文字に置くと AA を割る

この 2 つは面と図形のための色で、地に対して 3:1 しか満たさない。`text-primary` をリンクや状態の文言に使うと 4.5:1 を割る。文字には `secondary` / `success` / `warning` / `destructive` / `info` を使う。アイコンは非テキストなので `primary` でよい。同じく `font-bold` のような太さの直指定は `eslint-rules/no-raw-font-weight` が落とす —— 段は `font-emphasis` の 1 つしか無く、和文を OS 同梱の書体に委ねている限り 2 段目は多くの環境で描き分けられない。

### `pnpm gen component` は置き場をオプションで受け取る

`--as=<見出し>` が必須で、`--layer` の既定は `design-system`。見出しの集合は台帳の検査側が持つ
ので、雛形が独自の一覧を抱えることはない。**位置引数で区画を渡す形は受け付けない** —— `patterns/` のように層だけでは見出しが決まらない置き場があるため。

出るのは README・実装・test・story の 4 つで、README は `component-template.md` の写しである
（目録を組む側がその節名を読むので、層 README の節構成では載らない）。台帳にも `kind: original`
の行が足される —— 上流を持たない部品はこの `kind` しか取れず、検査側は `original` に取り込み元の
宣言が**無い**ことを要求する。

### `pnpm exec shadcn add` を直接叩くと、何も書かれずに止まる

CLI は依存の `pnpm add` を `-w` なしで実行し、このリポジトリはワークスペースを持つため root への追加が拒まれる。依存のインストールはファイルの書き出しより先に走るので、**部品の種類によらずファイルが 1 つも書かれないまま終わる**。`pnpm add:ui` はこの 1 回だけ許可を立てている。`.npmrc` に書いて常時許可にすると、あらゆる `pnpm add` で root への誤追加が黙って通る。

### 目的別ディレクトリに README を置くと、それが部品として数えられる

`pnpm check:ui` は `README.md` を持つディレクトリを component とみなす。`design-system/overlay/README.md` のような案内を置いた瞬間に、台帳に無い component として落ちる。目的別ディレクトリが何を受け持つかは `components/README.md` の一覧が持ち、そこにしか書かない。

### `z-20` は帯の間ではない

帯は `z-10` / `z-30` / `z-40` / `z-50` の 4 つで、`z-20` は空けてある。「本文の重なりより上、画面の帯より下」が要ると感じたら、それはどちらかの帯の割り当てが違う。部品の内側で `z-10` / `z-20` を使うのはよいが、それは部品自身の stacking context の中の話で、帯とは無関係である。

### token を 1 つの系統・配色にだけ足すと、生成が落ちる

`tokens/themes/user/light.json` に token を足したら、`user/dark` / `admin/light` / `admin/dark` の 3 つにも同じ名前が要る。1 つでも欠けると `pnpm gen:tokens` が `assertSameTokens` で止まる。**止まるのは意図した挙動で、迂回しない** —— 欠けを通すとカスケードで隣の値が引き継がれ、切り替えたつもりの箇所だけ元の色のまま残る。`tokens.css` を手で直して通すと、今度は `pnpm check:tokens` が落とす。

### 小数の段は `--spacing-0\.5` と綴られる

CSS のカスタムプロパティ名に `.` は置けないため、生成側が `\.` へ逃がし、Tailwind の参照側も同じ綴りになる。build 済み CSS を文字列で検索するときにこの綴りを前提にしないと、存在する宣言を「無い」と判定する。

### 間隔の段は 2 経路ある

`gap-*` / `p-*` のうち、token が名前を与えている段（`0` / `1` / `2` / `4` / `6` / `8`）は `var(--spacing-N)` を経由し、`tokens/primitives.json` の 1 箇所で値を変えられる。それ以外の段（`1.5` / `3` / `10`）は Tailwind の基底 `--spacing` の倍数として `calc()` に展開され、token とは別経路である。**どちらを使うかの規約はまだ無く、現状は混在している**（`layout-patterns/README.md`）。

### story の説明は Docs ページにしか出ない

`parameters.docs.description.component` と story 直前の JSDoc は、Canvas には描かれない。`.storybook/preview.tsx` が `tags: ["autodocs"]` を付けているのは Docs ページを生やすためで、これを外すと書いた説明がどこにも出なくなる。overlay の story で `play` を書くときは、開く操作は `within(canvasElement)` から、開いた面は `within(document.body)` から引く —— canvas の内側で待つと、開いているのに見つからないまま timeout する。

### `design:bundle` は Storybook の build 無しには動かない

story 名を `storybook-static/index.json` から引くため、index が無いと止まる。これは「先に `pnpm build-storybook`」で解決し、index が古いだけの場合は build し直す。エラーの文言が「ファイルが無い」と「解釈できない」で分かれているのはそのためで、後者を前者と同じに扱うと、既にビルド済みの利用者が同じ所で止まり続ける。

## 関連する ADR

- [0050](../adr/0050-styling-strategy.md) — Tailwind 主軸 / CSS Modules の限定許可 / `cn()` の置き場 / 系統の属性を Portal の出口へ置く分担
- [0051](../adr/0051-styling-system.md) — token の 2 層と 2 軸 / 帯とコンテナクエリ / モーション / 印刷 / 重なり順の帯 / 和文書体
- [0052](../adr/0052-ui-component-policy.md) — shadcn/ui の copy-in / 上流を増やさない / variant は排他の見た目だけ / アイコンの封じ込め
- [0053](../adr/0053-ui-component-interaction-seam.md) — built-in 優先 / overlay の a11y 契約と履歴 / 部品が持つ状態と外から渡すもの / slot で受ける
- [0054](../adr/0054-ui-catalog-storybook.md) — Storybook を部品の唯一の一覧にする / server の無い面での差し替え / 1 部品 15 主題
- [0055](../adr/0055-design-system-export.md) — 書き出しの成果物は tool 非依存 / 依存の向きは repo → design の一本
- [0021](../adr/0021-frontend-responsibility.md) — `components` が `model` と `errors` だけを引く根拠 / 昇格ルール
- [0026](../adr/0026-layout-shell-mount.md) — `shell/` の器と Provider を root layout に mount する経路
- [0027](../adr/0027-directory-structure.md) — 実装・test・story・README の co-location
- [0091](../adr/0091-test-verification-methods.md) — story 全数の a11y 検査 / visual regression の採用
- [0100](../adr/0100-accessibility-target.md) — WCAG 2.x AA。token のコントラスト目標の出所
