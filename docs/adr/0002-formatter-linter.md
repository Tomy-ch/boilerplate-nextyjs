# フォーマッタ・リンタ管理方針

本プロジェクトでは、JavaScript / TypeScript / JSON / CSS のフォーマッタ兼リンタとして **Biome** を主軸に採用する。

原則は「**biome 優先、biome で対応できない検査のみ ESLint で補完する**」。フォーマットおよび biome が表現できる lint 検査はすべて biome が担い、biome で表現できない検査（層境界の import 検査等）に限り、ESLint を補完として利用する。フォーマッタは biome 単独であり、Prettier は採用しない。

本ドキュメントでは、Biome の採用理由、ESLint 補完利用の条件、および利用方針・運用ルールを定義する。

## Status

Accepted

## 採用理由

### 1. 単一ツールへの集約（原則）

従来必要だった以下を Biome 一つで賄える。

- ESLint 系の Linter
- Prettier 系の Formatter
- import の並べ替え (organize imports)

これにより：

- 設定ファイルとプラグイン数の削減
- ツール間の責務重複・競合の解消
- 学習・運用コストの低減

ただし「単一ツール」は目的ではなく手段である。層境界の import 検査（「import する側の層」を文脈に取る depguard / boundaries 型の検査）のように、**biome が現時点で表現できず、かつ本 boilerplate の構造安全性の核となる検査**まで放棄はしない。この隙間に限り ESLint で補完する（後述「ESLint による補完」）。

### 2. パフォーマンス

- Rust 実装による高速な lint / format
- 大規模ディレクトリのスキャンや CI 上での実行時間を抑制
- Pre-commit / 保存時の整形でも体感ラグが小さい

### 3. Next.js / React ドメインへの最適化

Biome は `next` / `react` の lint ドメインルールを内蔵しており、以下を標準で検出できる。

- `noNextAsyncClientComponent`
- `noNestedComponentDefinitions`
- その他 React Hooks 関連の代表的ルール

### 4. 設定の見通しの良さ

- `biome.json` **1 枚**に lint / format / assist / overrides を集約する（下記「設定を分けない」）
- VCS 連携 (`.gitignore` 尊重) も設定ファイル内で完結

## TypeScript コンパイラによる検査（`tsconfig.json`）

型で捕まえられる誤りは lint ではなく **`tsc` に持たせる**。能力ベースの役割分担（後述）はツール間だけでなく「型 vs lint」にも同じ形で適用し、重複させない。

`strict: true` に加えて次を有効にする。

| フラグ | 採否 | 理由 |
| --- | --- | --- |
| `noUncheckedIndexedAccess` | 採用 | 配列 / インデックス参照の `undefined` を型で捕まえる |
| `erasableSyntaxOnly` | 採用 | `enum` / `namespace` を型消去可能な構文のみに制限し、実行時の値を生む TS 独自構文を禁止する |
| `verbatimModuleSyntax` | 採用 | `import type` の規律を型側で強制する |
| `noImplicitOverride` | 採用 | 低摩擦で継承時の取り違えを防ぐ |
| `noPropertyAccessFromIndexSignature` | 採用 | index signature へのドット参照を禁止。流入口（[0030](0030-environment-variable-management.md) の `process.env` / searchParams）は既に塞がれている。**費用は biome の `complexity/useLiteralKeys` との衝突に現れる**（下記） |
| `exactOptionalPropertyTypes` | **見送り** | React props との摩擦が高い。残る穴（「未指定」と「明示的 `undefined`」を型で区別できない）は下記の実行時機構で埋める |
| `noUnusedLocals` / `noUnusedParameters` | **入れない** | biome が `correctness/noUnusedVariables` / `noUnusedFunctionParameters` で error として捕捉する（同じ検査を 2 つ持つと食い違う） |

- **`useLiteralKeys` は、角括弧を型が要求する区画で外す**。`noPropertyAccessFromIndexSignature` は index signature へドットで触ることを禁じ、biome の `complexity/useLiteralKeys` は逆に角括弧を禁じる。**型を見ない biome には、index signature と宣言された属性の区別が付かない**ため、両方を有効にすると素の object を読む区画（`mocks/references.ts` / `scripts/` / `tokens/` と、検査系の `e2e/` / `vrt/` / `baseline/lib/`）で必ず衝突する。`overrides` でその区画だけ規則を外す —— コードの側を直すと、型が要求する書き方を型が禁じる書き方へ変えることになる。**撤去条件**: 同オプションを外すか、biome が型を見るようになったとき
- **`target` は `ES2022`**。[0102](0102-browser-support.md) が追認する Next.js の既定 browserslist（Chrome 111 / Edge 111 / Firefox 111 / Safari 16.4）のすべてが実装している最も新しい ECMAScript 版（ES2023 の配列複製系 `toSorted` 等は Firefox 111 に無い）。`tsc` は `noEmit` であり配布物の構文はビルド（SWC）が browserslist から決めるため、この値が定めるのは型検査の前提だけである
- **`exactOptionalPropertyTypes` 見送りの穴を埋める機構**: `JSON.stringify` は値が `undefined` のキーを落とすため、`{name: undefined}` と `{}` はワイヤ上で同一になる。危険が残るのは直列化より手前のローカル組み立てだけなので、**`adapters` に PATCH ペイロードの正規化関数を置いて閉じ込める**。「触らない」= キーを含めない / 「消す」= `null` を明示とし、`undefined` に意味を持たせない。adapters の公開面は正規化済みの型でしか受け付けない形にする（散文の規約にしない）

## ESLint による補完

### 役割分担（能力ベース・食い違いの排除）

どちらのツールに検査を置くかは、**「biome がその検査を表現できるか」のみ**で決める（能力ベース）。好み・慣れ・プリセットの都合で ESLint 側に置いてはならない。

**排すのは重複そのものではなく、食い違いである。**同じ検査が 2 回走るだけなら結論は一致するので害はない。害になるのは、(1) 実装が別なので判定や提示される修正候補が食い違う、(2) 設定が片方だけ緩められ、どちらが正か決まらない、の 2 つである。したがって判定軸は「重なっているか」ではなく **「食い違えるか」** であり、答えが是なら片方へ寄せる。

| 責務 | 担当 |
| --- | --- |
| フォーマット | biome 単独（ESLint のフォーマッタ機能は使わない） |
| import 整理 (organize imports) | biome（assist） |
| biome が表現できる lint 検査 | biome（設定は `biome.json` 1 枚。「設定を分けない」参照） |
| biome で表現できない検査 | ESLint |

- **同じ検査を両方のツールに持たせない**（上記の食い違いが成立するため）
- **biome が実装済みのルールは biome 側で有効化して使う**。「biome にルールは存在するが有効化していない」状態を理由に ESLint へ置くことは能力ベースに反する（例: import の循環検出は biome の `noImportCycles` を有効化済みのため、ESLint に持たせない）
- **縮小方向での運用**: biome が対応した検査は ESLint から削除し biome へ移管する。ESLint 側は常に「biome の隙間」だけを持つ

### 現時点で ESLint 側に置く検査

- **層境界の import 検査**（eslint-plugin-boundaries 等）。biome の `noRestrictedImports` + `overrides` では「import する側の層」を文脈に取る検査を表現できないため、現時点で biome 非対応の代表例である（`noImportCycles` が検出するのは循環のみで、層の依存方向違反は検出できない）
- 具体プラグインの選定と層定義マッピングは、フロント内責務分離の ADR（[0021](0021-frontend-responsibility.md)）の Enforcement 節で定める（プラグインは `eslint-plugin-boundaries`、層定義は同 ADR の依存マトリクス）
- **React のレンダリング規律の検査**（`eslint-plugin-react-hooks`）。React Compiler が持つ診断をルールとして提供するもので、**effect の中で state を導出する形・描画中の副作用・描画中に構築した JSX を try/catch で囲む形**などを検出する。biome の `react` ドメインが持つのは依存の網羅（`useExhaustiveDependencies`）と hook 呼び出し位置（`useHookAtTopLevel`）だけで、上記はいずれも表現できない
  - **食い違いうるルールは biome 側に残す**。実装が別なので提示される修正候補が異なり、設定を片方だけ緩めたときにどちらが正か決まらない。
    biome の `useExhaustiveDependencies` が既定で見るのは **`useEffect` / `useLayoutEffect` / `useInsertionEffect` / `useCallback` / `useMemo` / `useImperativeHandle`** であり、**effect だけでなく memo 系の依存も含む**。したがってこのプラグイン側では `exhaustive-effect-dependencies` と `memo-dependencies` の両方を有効化しない
  - **ルールを増やすときは、この対象 hook の一覧と突き合わせて重複を確かめる**。「effect 用」「memo 用」と名前が分かれていても、biome 側は 1 つのルールで両方を見ている
  - **preset は当てず、ルール単位で有効化する**（「ESLint 利用の条件」2 に従う）
  - 既存コードで満たせない箇所は、**理由を添えた行単位の抑止**に留め、書き換えは別 PR に分ける。lint の導入とコンポーネントの再設計を同じ PR に混ぜると、どちらが原因の回帰か切り分けられない

### ESLint 利用の条件

ESLint およびそのルールをリポジトリに追加してよいのは、以下をすべて満たす場合のみ。

1. **biome 非対応の検査であること**（能力ベース）。PR 本文に「biome で表現できないこと」の確認結果（該当ルールの有無・issue 等）を記す
2. **stylistic / フォーマット系ルール、biome と食い違いうる汎用ルールを入れない**。`eslint:recommended` / `eslint-config-next` 等のプリセット一括適用は行わない（biome の `next` / `react` ドメインおよび recommended ルール群と重複するため）。ルール単位の opt-in のみとする
3. **flat config（`eslint.config.ts`）で管理する**。Next.js 16 では `next lint` が廃止され `next build` も lint を実行しないため、ESLint CLI を直接実行する
4. **ESLint 本体・プラグインは devDependency として exact pin し、追加時に `pnpm audit` を実施する**（[0004](0004-library-management.md) の主要 dev ツール扱い）
5. **biome が該当検査に対応した時点で ESLint 側から削除し biome へ移管する**。対応状況の確認は 0004 の定期監査サイクル（`pnpm outdated` の週次〜月次確認）および biome バージョン更新 PR のチェック項目に組み込む

## バージョン管理

Biome は npm devDependency として exact pin する。**版の正は `package.json` の `devDependencies` であり、ここには写さない。**

実体は `pnpm install` で取得され、ローカル / CI いずれでも同一バージョンで動作する（pnpm 採用方針については [0001-package-manager.md](0001-package-manager.md) を参照）。

ESLint 本体・プラグイン・設定の読み込みに要するツールも同様に、devDependency の exact pin とする（0004）。

## 設定方針

`biome.json` の要点は次の通り。詳細は同ファイルを参照すること。

### 設定を分けない

**biome の設定は `biome.json` 1 枚とし、プロファイルを持たない。** 保存時・手元・pre-commit・CI のどこから呼んでも同じ規則が掛かる。

分けない理由は、**弱いほうが暗黙に探索される名前を持つと、構造的な false pass ができる**ことにある。`--config-path` を渡さない呼び出し —— エディタの拡張、素の `biome check`、このリポジトリを初めて触る人 —— は弱いほうを読んで緑を返すが、ゲートは強いほうで拒否する。緑と赤のどちらが正しいのかは、呼び出しに `--config-path` が付いていたかどうかで決まり、**出力のどこにも現れない**。

分ける根拠になりうるのは保存時の応答性だけであり、**このリポジトリではその根拠が成立しない** —— 全ファイル走査で 2,332 ファイル / 約 2 秒であり、`project` ドメインのルール（`noImportCycles`）を含めても含めなくても差が測れない。根拠が実測で消えた以上、分割は費用だけが残る。

したがって:

- **`--error-on-warnings` は既定に含める**（`pnpm lint` が付ける）。付ける / 付けないで結果が変わる呼び出しを 2 通り持たない
- `pnpm lint` と `pnpm lint:ci` の差は**規則ではなく、走る道具**である（後者は ESLint と境界の突合が続く）。同じ biome にどこまで見せるかで差を付けない
- 応答性を根拠に規則を落とす提案は、**このリポジトリでの実測を添える**こと。上流の一般論では足りない
- hook / CI からの実行フローは [0151-git-hooks.md](0151-git-hooks.md) を参照

### VCS 連携

- `vcs.enabled = true` / `clientKind = git`
- `useIgnoreFile = true` で `.gitignore` を尊重し、無視対象は二重定義しない

### フォーマッタ

| 項目 | 値 |
| --- | --- |
| インデント | 半角スペース 2 |
| 行幅 | 100 |
| 改行コード | `lf` |
| クォート | `"`（JS / JSX とも） |
| セミコロン | 常時付与 |
| trailing comma | `all` |
| アロー括弧 | 常時付与 |

### Linter

- `recommended: true` を基準に運用
- `next` / `react` ドメインの推奨ルールを有効化
- 追加で有効化（現行値は `biome.json` が正）：
  - `noConsole: warn`
  - `noExplicitAny: error`
  - `noUnusedImports / noUnusedVariables: error`
  - `noUndeclaredDependencies: error`
  - `noNestedComponentDefinitions: error` / `noNextAsyncClientComponent: error`
  - `noUnknownAtRules: off`（Tailwind ディレクティブ用）
- バグ性検出ルール群（`noConstantBinaryExpressions` / `noLeakedRender` / `noShadow` / `useIframeSandbox` 等）も有効化する
- `noImportCycles: error`（`project` ドメイン。保存時も含めて常に掛ける）

### Assist

- 保存時 `organizeImports: on`

### Overrides

- `.vscode/**` … JSON の `allowComments` を有効化（jsonc 用）
- `**/*.d.ts` … `noExplicitAny` を off
- `scripts/**` … `noConsole` / `noExplicitAny` を off（運用スクリプト用）
- `public/**` … `noSvgWithoutTitle` を off（静的 SVG アセットは使用側の `alt` で代替テキストを担保する）
- `src/adapters/gen/**` / `mocks/*/**` … **生成物は linter の対象外にし、整形だけ掛ける**。生成器の出力作風で CI が止まると、直す手段が生成器へのパッチしか無くなる。整形は生成物にも掛ける（差分が読める形に揃える）
- `src/**/generated/**` … formatter も off（再生成で上書きされる出力であり、整形しても次の生成で戻る）

### ESLint（`eslint.config.ts` — 補完分）

- flat config 1 ファイル（`eslint.config.ts`）で管理する。カスタムルールの実装だけは `eslint-rules/` へ分ける（設定と実装を同じファイルに積むと設定の見通しが落ちるため）
- 依存マトリクスは `architecture.ts` を単一の正とし、flat config はそれを import して検査へ変換する。**マトリクスを config 側へ書き写さない**
- 置くのは「ESLint 利用の条件」を満たす補完検査（現時点では層境界検査）のみ。formatter 連携・stylistic 系・biome 重複ルールは設定しない
- 実行は `pnpm lint:ci` の 2 段目に直列で組み込む（pre-commit / CI）。層境界検査は TS resolver を伴い保存時実行には重いため、エディタでは拡張の診断並走のみとする
- **import resolver を設定する**。層境界検査は import 先を実ファイルまで解決できて初めて成立し、解決できない import は「どの層でもない」として黙って通る。`@/*` を解く TypeScript resolver を設定し、**違反を仕込んで error になることを確認してから**検査を導入したと見なす
- ignore 対象（`.next/` / `out/` / 生成物等）を flat config 内で宣言し、biome の除外方針と食い違わせない
- 各ルールには「なぜ biome で表現できないか」を示すコメントを付し、移管判定を容易にする

## 基本コマンド

`package.json` の scripts を経由して実行する。

```bash
# Lint + Format チェック（biome。warn もブロックする）
pnpm lint

# 上に ESLint と境界宣言の突合を続ける（CI・pre-commit が回すゲート）
pnpm lint:ci

# Lint + Format を自動修正
pnpm fix

# Format のみ書き換え
pnpm format
```

直接実行する場合：

```bash
pnpm exec biome check --error-on-warnings                          # lint + format チェック（= pnpm lint）
pnpm exec biome check --fix                                        # 自動修正
pnpm exec biome format --write
pnpm exec eslint .                                                 # 補完検査
```

`lint:ci` は `pnpm lint`（biome）→ ESLint（`lint:eslint` = `eslint .`）→ 境界宣言の突合（`check:architecture`）を直列に回す。`pnpm lint` は biome のみである。境界検査系ルールは auto-fix をほぼ持たないため、`pnpm fix` は biome のみとする。

## エディタ連携

VSCode を前提に統合を行う。`.vscode/extensions.json` で `biomejs.biome` を推奨拡張に指定し、`.vscode/settings.json` で以下を有効化している。

- `editor.defaultFormatter`: `biomejs.biome`
- `eslint.format.enable`: `false`（フォーマッタは biome 単独。ESLint のフォーマッタ機能は無効のまま）
- 保存時の挙動（`editor.codeActionsOnSave` に併記）：
  - `source.fixAll.biome`: `always`
  - `source.organizeImports.biome`: `always`
  - `source.fixAll.eslint` を併記（境界系ルールは auto-fix をほぼ持たないため、biome の整形と衝突しない）
  - `editor.formatOnSave`: `true`

これにより、保存ごとに整形・import 整理・自動修正は biome（canonical 名の `biome.json` を自動採用）が担い、ESLint は補完検査の診断を並行表示する。**保存時に掛かる規則はゲートと同じである**（上記「設定を分けない」）。

なお、`dbaeumer.vscode-eslint` は `.vscode/extensions.json` の推奨拡張に含める。フォーマットは biome が担うため、`.vscode/settings.json` では ESLint のフォーマッタ機能を無効にする。

### `.editorconfig`

repo ルートに `.editorconfig` を置く。担当範囲は **biome が整形しないファイル**（`Makefile` / `*.mk` / `*.md` / `*.toml` / `*.yaml` 等）と、biome 拡張が入っていないエディタでの保存時の既定挙動であり、biome の対象ファイルには関与しない。

- 共通値（`charset` / `end_of_line` / `indent_style` / `indent_size` / `insert_final_newline` / `trim_trailing_whitespace`）は上記「フォーマッタ」表と一致させる。食い違った場合は `biome.json` が正
- 例外は 2 件 — `*.md` は行末 2 スペースが改行を意味するため `trim_trailing_whitespace = false`、`Makefile` / `*.mk` はレシピ行がタブを要求するため `indent_style = tab`
- `formatter.useEditorconfig` は既定の `false` のまま据え置く。有効にしても `biome.json` の値が優先されるため biome 対象ファイルの結果は変わらず、整形設定の入口だけが 2 本になる

## 禁止事項

- Prettier の併用は禁止（フォーマッタは biome 単独）。pre-commit と CI は `biome check` で整形を判定するため、Prettier が書いたファイルは hook が落とし、どちらが正かを決める仕事が恒久に増える。見直すのは biome の整形が本リポジトリで実際に扱う言語のいずれかを覆わなくなったとき（対応言語が減る、または新たに扱う言語が biome の対象外であるとき）だけで、Prettier の plugin が豊富であることは理由にならない
- ESLint をフォーマッタとして使うことは禁止（`eslint.format.enable` の有効化 / stylistic・フォーマット系ルールの導入を含む）
- `.editorconfig` に biome の対象ファイル向けの独自値を書くことは禁止（整形の権威は `biome.json`。`.editorconfig` は biome が見ないファイルのみを担当する）
- biome が表現できる検査を ESLint 側に置くことは禁止（能力ベース。食い違いが成立する。「ESLint 利用の条件」を満たさない ESLint ルール追加はすべて本 ADR 違反）
- `eslint:recommended` / `eslint-config-next` 等のプリセット一括適用は禁止（ルール単位 opt-in のみ）
- `biome.json` のフォーマッタ・リンタを個別案件理由で一方的に無効化しない（必要なら ADR 改訂で合意する）
- 自動生成物や `node_modules` などは `biome.json` の `files.includes` / `eslint.config.ts` の ignore で除外し、`biome-ignore` / `eslint-disable` コメントの多用は避ける
- biome の設定ファイルを増やさない（プロファイル分割の禁止。上記「設定を分けない」）

## 補足

- ルールの追加・無効化が必要になった場合は、まず `overrides`（biome）/ ファイルスコープ設定（ESLint flat config）での局所適用を検討し、グローバル変更は最後の手段とする
- バージョン更新時は `pnpm exec biome check` で差分が出ないことを確認し、出る場合は `pnpm fix` で吸収した上で同 PR に整形コミットを含める。biome 更新 PR では、ESLint 側に残している検査の biome 対応状況（移管可否）も併せて確認する
- nursery ルールはバージョン更新で挙動・所属グループが変わり得る。exact pin 運用（[0004-library-management.md](0004-library-management.md)）を前提に、更新 PR で差分を確認する
- `process.env` 直読禁止のような **biome で表現できる規約は biome 側（`noProcessEnv` 等）に置き、ESLint には置かない**（能力ベースの適用例。有効化は環境変数管理の ADR = [0030](0030-environment-variable-management.md) とセットで行う）

## 関連 ADR

- [0001-package-manager.md](0001-package-manager.md) — pnpm 採用 / lockfile 取り扱い
- [0004-library-management.md](0004-library-management.md) — ESLint 本体・プラグインの exact pin / `pnpm audit` / 移管判定の定期監査
- [0151-git-hooks.md](0151-git-hooks.md) — `pnpm lint:ci` を呼ぶ pre-commit / pre-push の運用（段階責務・pre-commit の速度目標と退避ルール）
- [0153-ci-configuration.md](0153-ci-configuration.md) — `pnpm lint:ci` を PR の必須チェックに置く CI 構成
- [0021-frontend-responsibility.md](0021-frontend-responsibility.md) — ESLint 層境界検査のプラグイン選定（`eslint-plugin-boundaries`）と層定義マッピング（Enforcement 節）。マトリクスの正は `architecture.ts` が持ち、flat config はそれを import する
