> **このファイルは `SKILL.md` の日本語訳です。**
> 直接編集しないでください。内容の変更が必要な場合は canonical な `SKILL.md`（英語版）を更新し、その後この日本語訳を同期してください。
> Claude Code のスキルとしては `SKILL.md` のみが読み込まれます。このファイルはスキル本体ではなく、レビューや学習用の翻訳ドキュメントです。

# Manage Skill

このスキルは `/manage-skill` から起動される。引数文字列は `$ARGUMENTS`。

**この**リポジトリの `.claude/skills/` 配下のスキルを作成・保守する。構造としては薄いラッパで、*方法論*（draft → test → review → improve → 必要なら description の最適化）は Anthropic 公式の `skill-creator` スキルが持ち、本ファイルはその上に本リポジトリ固有の規約を重ねて、生成されたスキルが `commit` / `new-env` / `canonicalize-doc` 等の既存スキルと並んで違和感なく収まるようにする。

## When to Use（使うべき状況）

- 新規スキル / `/<name>` コマンドを作る。あるいは現在の会話で繰り返している作業をスキル化する。
- `.claude/skills/` 配下の既存スキルを更新・修正・改善・リファクタ・リネーム・拡張する。**`SKILL.md` / `SKILL.ja.md` を手で編集する前に**、この入口を通す。
- スキルの `description` を発火精度のために最適化する。あるいはスキルの eval を回す。
- 壊れた対訳ペアを修復する（`SKILL.ja.md` が欠けている / 古い）。

## Do NOT use this skill for（使うべきでない状況）

- **canonical ドキュメント** — `docs/**` とディレクトリごとの `README.md` は `sync-readme`（README ↔ ディスクの drift）/ `canonicalize-doc`（EN / JA ペア）/ `readme-review`（portal 価値評価）の担当。
- **subagent 定義単体** — スキル変更を伴わない `.claude/agents/<slug>.md` 単独の編集は対象外。スキルの subagent 配線が変わる場合は両方まとめて対象になる（後述「subagent」）。
- **他 AI ツールの設定** — `.cursor/` / `.gemini/` / `.github/copilot-instructions.md` は `AGENTS.md` により対象外。
- **ADR の起草** — 新しい規約を持ち込むことになるスキルは、先に ADR が要る（後述「新規スキルの所属を決める」）。

## AI Modification Scope

`AGENTS.md` は `.claude/**` を「そのエージェント自身であっても勝手に触ってはならないエージェント設定パス」として扱う。**このスキルの起動自体が、その制限を解除する明示的なユーザ指示にあたる** — ただし対象は `.claude/skills/**`、`.claude/agents/**`（それを配線するスキルと同時のときのみ）、および `scripts/**`（このスキルが所有するスクリプトに限る）に限られ、解除はこの実行の間だけ。

このスキルの実行中も保護されたままのもの:

- `AGENTS.md`
- `LICENSE`
- Accepted な ADR 本文。Step 5 は ADR [0154](../../../docs/adr/0154-claude-skills-operations.md) / [0155](../../../docs/adr/0155-claude-skills-development.md) のカバー範囲テーブルへ行を追加するが、それが今できるのは `AGENTS.md`「Temporary Operating Rules until v1.0.0」が ADR 本文への承認要件を解除しているからにすぎない。この暫定運用が外れたら、行追加も他の ADR 編集と同様にユーザの明示的承認を要する — ADR 自身の「リスト追加は軽微編集」という記述だけでは `AGENTS.md` を上書きできない。
- `.claude/settings.json` — プラグイン bootstrap が `claude` CLI 経由で書き込む（Step 0）。ここで手編集してはならない。
- `.claude/settings.json` の `permissions.deny` に載っているパス。

## Step 0. 公式の方法論を用意して読み込む

*どうやるか* の正典は公式の `skill-creator`。まずその存在を保証する:

```bash
pnpm exec tsx scripts/bootstrap-plugins
```

この bootstrap は `claude-plugins-official` marketplace を宣言し、本リポジトリが依存する公式プラグイン（`skill-creator`）を **project スコープ**で有効化する。宣言が本リポジトリの `.claude/settings.json` に載るため、信頼済みの clone であれば開発者ごとのセットアップ無しに同じ資産が揃う。冪等であり、再実行は no-op。新たに有効化したプラグインが読み込まれるのは*次の*セッションからで、そのとき `skill-creator` は `/skill-creator` としても起動できるようになる。ただしこのラッパはそれに依存しない — パス指定でファイルを読むため、同一セッション内でも動く。

実際に宣言が行われる回では、`claude` CLI は `.claude/settings.json` へ追記するのではなく**ファイル全体を書き直す** — `permissions` 内のキー順序が動きうる。追加される 2 キー以上の差分ノイズが出ることを見込み、内容を確認したうえで変更の一部としてコミットする。

その `SKILL.md` を全文読むこと（パスは以下の glob で探す）:

```bash
ls ~/.claude/plugins/marketplaces/*/plugins/skill-creator/skills/skill-creator/SKILL.md
```

**Creating a skill** / **Running and evaluating test cases** / **Improving the skill** / **Description Optimization** / blind comparison / packaging について書かれていることは、すべてそのまま適用する。同梱リソース（`scripts/` = benchmark 集計・description 最適化ループ・パッケージング、eval viewer、専用エージェント、スキーマ参照）は隣に置かれており、そのまま使う。実行は公式スキルのディレクトリから行い、自前で再実装しない。

bootstrap が失敗した場合（ネットワーク不通 / `claude` CLI 不在）は、中断せずユーザへ失敗を報告し、インラインに要約した方法論（draft → test → review → improve）で進めてよいかを確認する。

## Step 1. 操作内容を確認する

何かを書き始める前に `AskUserQuestion` を呼ぶ。ADR [0154](../../../docs/adr/0154-claude-skills-operations.md) が定める「入力は引数から暗黙に採用せず明示的に確認する」規約に従う:

1. **どの操作か** — 新規 / 更新 / description 最適化 / 対訳ペア修復。
2. **どのスキルか** — 更新・最適化・修復の場合、対象の `.claude/skills/<slug>/`。
3. **どちらの系統か** — 新規の場合、運用系（ADR 0154）か開発系（ADR 0155）か。

`$ARGUMENTS` の slug や操作を黙って採用しない。推奨選択肢として提示し、ユーザに確定させる。

### 新規スキルの所属を決める

| 系統 | ADR | 定義 |
| --- | --- | --- |
| 運用系 | [0154](../../../docs/adr/0154-claude-skills-operations.md) | 開発プロセスを進めるためのオペレーション — Git / GitHub、リリース、依存・ツール監査、`.claude/` のメタ inventory。コード生成・編集を主目的としないもの |
| 開発系 | [0155](../../../docs/adr/0155-claude-skills-development.md) | コード / ドキュメント / 設定の生成・編集・レビュー |

各系統の現在の構成員は、その ADR のカバー範囲テーブルが持つ。ここに一覧を置かず、今回の実行で読む。

提案されたスキルが、`BACKLOG.md` でまだ未決の領域に新しい規約・パターン・ライブラリを持ち込むことになる場合は、**そこで止めて ADR の判断をユーザへ委ねる**（`AGENTS.md`「Pending Decisions」）。スキルを、規約が暗黙に決まる場所にしてはならない。

近い役割の重複を作るくらいなら、既存スキルの拡張を優先する。粒度は「1 起動 = 1 オペレーション」（ADR 0154）。

## Step 2. リポジトリ規約のオーバレイを適用する

公式の手順に従いつつ、以下と食い違う箇所では**こちらを優先する** — これらを無視したスキルは本リポジトリに収まらない。

### 配置と構造

- `.claude/skills/<slug>/SKILL.md`。`<slug>` は kebab-case の動詞ベースで、frontmatter の `name` およびディレクトリ名と一致させる。slug に空白・大文字・日本語を含めない。
- 同梱リソース（`scripts/` / `references/` / `prompts/` / `assets/`）は必要なとき公式の構成に従う。`SKILL.md` は 500 行程度までに収め、詳細は `references/` へ逃がして明示的に参照する。
- 同梱**スクリプト**は `pnpm exec tsx` から実行する TypeScript とする（`scripts/*.ts` と同じ形）。例外は、依存インストール前に単体で動くことを要件とする headless 駆動系（既存では `full-verify/run.sh`）のみで、そこではシェルを許す。

### frontmatter（ADR 0154）

| キー | 必須 | 用途 |
| --- | --- | --- |
| `name` | ✓ | kebab-case。ディレクトリ名と一致 |
| `description` | ✓ | 英語 1 段落。**何をするか**だけでなく**いつ発火すべきか**を必ず含める |
| `argument-hint` | 任意 | 引数を取る `/command` の引数形式 |
| `allowed-tools` | 任意 | 使用ツールの明示的な許可リスト |

`description` は公式の "pushy" なトリガ記述指針に従う — 何をするか、日本語のトリガ表現を含む具体的な利用文脈、そして**発火すべきでない**条件の明示。密度とトーンは `commit` / `new-env` の description を読んで揃える。

### 本文構造（ADR 0154）

1. `# <Skill Name>` と 1 段落の概要
2. `SKILL.ja.md` への言及
3. **When to Use**
4. **Do NOT use this skill for**
5. **Step N. <タイトル>** — 番号付き手順。前処理がある場合は Step 0 から始める
6. 検証 / 終了処理

### 言語（`AGENTS.md`）

- `SKILL.md` は **英語 canonical**。canonical 本文を日本語で書かない。
- 一方、スキルの*実行時の挙動*は日本語出力規約に従う — スキルが出力しリポジトリへ書き込むもの（応答 / コミット・PR 文面 / コードコメント / 生成ドキュメント）はすべて**日本語**。この要件をスキル自身の手順へ書き込むこと。

### 外向き操作の前のユーザ確認（ADR 0154）

push / tag / release / PR 編集 / `mise.toml` の書き換え、その他の破壊的操作を行うスキルは、実行前に必ずユーザ確認を挟む。`AskUserQuestion`、または PR への push については `AGENTS.md` が定める確認文言をそのまま用いる。これらを無人で実行させてはならない。

### subagent（ADR 0155）

subagent を持ち出すのは、ADR が認める理由があるときだけ — 単一エージェントの bias 回避、独立した観点の並列実行、finder → verifier の 2 段構成。使う場合は:

- 定義は `.claude/agents/<slug>.md` に置き、新種を発明せず既存タイプを再利用する。
- subagent は **read-only on source** で、所見だけを返す。書き込みは orchestrator 側が行う。
- 既定モデルは `sonnet`。reviewer ≠ implementer が重要な場合はその意図を `SKILL.md` に明記し、各 subagent の起動モデルも書く。
- 「念のため」で subagent を増やさない（ADR がコスト見合いで禁じている）。

### 正は実行時に読む

スキルは、drift する規約を本文へハードコードせず、該当する `README.md` / `docs/` / ADR を**実行時に読む**。インベントリ（purpose / env ファイル / 層）も実ツリーから検出する。`new-env` と `full-verify` がその手本。検出できたはずの一覧をハードコードしたスキルは、それ自体が drift の発生源になる。

### eval 生成物はバージョン管理へ入れない

公式の手順は `<skill-name>-workspace/` を作り、iteration / eval ディレクトリ・benchmark・viewer 出力を書く。スキルディレクトリの兄弟に置くと、追跡対象の `.claude/skills/**` の中に落ちてしまう。**置き場所を上書きする**こと — リポジトリの gitignore 済み `tmp/` 配下（例: `tmp/manage-skill/<skill-name>-workspace/`）に置く。eval 実行結果・benchmark・feedback JSON・viewer HTML はコミットしない。`git add -f` で押し込むこともしない。

## Step 3. 作成 / 更新

### 新規スキルの作成

公式の **Creating a skill** フロー（Capture Intent → Interview → Write SKILL.md → Test Cases）を回し、そのうえでオーバレイを適用する — 正しい配置、ADR 準拠の frontmatter と本文構造、英語 canonical な本文、`tmp/` 配下の eval workspace。

### 既存スキルの更新

- ユーザが明示的にリネームを求めた場合を除き、既存の `name` とディレクトリはそのまま維持する。リネームする場合はディレクトリ移動と、そのスキルへの全参照の更新を伴う。
- *インストール済み*のプラグインスキルと違い、リポジトリのスキルはその場で書き換えられる — `.claude/skills/<slug>/` 配下を**直接編集**する。read-only なので `tmp` へコピーする、といった手順は不要。
- eval のベースラインとして、公式の指針どおり編集前のスキルを `tmp/` 配下へスナップショットし、前後比較できるようにする。
- 変更によって他所の記述が無効にならないか確認する — ADR のカバー範囲テーブル、このスキルへ chain している他スキル、`tool-map` の依存マップ。

## Step 4. 日本語対訳ペアを同期する

本リポジトリのスキルは必ず `SKILL.md` の隣に `SKILL.ja.md` を持つ（ADR [0140](../../../docs/adr/0140-documentation-operations.md) / 0154）。これは任意ではない。canonical な `SKILL.md` が確定 / 変更されたら:

- `canonicalize-doc` スキルを chain し、canonical な `SKILL.md` から `SKILL.ja.md` を生成 / 同期する。
- `SKILL.ja.md` は **YAML frontmatter を持たず**、「これは翻訳であり、直接編集せず、更新は `SKILL.md` から流す」旨の blockquote から始める。
- 完了とする前に、見出し構造と節数が一致していることを確認する。`SKILL.md` だけ変わって日本語側が古いのは drift。

## Step 5. ADR へ登録する

新規スキルは、所属する系統の ADR のカバー範囲テーブルに載って初めて完了 — 運用系なら 0154、開発系なら 0155。どちらの ADR も「リスト追加は軽微編集とし ADR 改訂は不要」と明記しているため、既存行と同じ体裁で slug / 役割 / カバー範囲の行を直接追加する。新しい subagent を導入した場合は 0155 の subagent 図にも追加する。

既存スキルのカバー範囲が実質的に変わったときも行を更新する。

## Step 6. 検証

- `pnpm lint:ci` と `pnpm typecheck` — 同梱スクリプトまたは `scripts/` の TypeScript を追加・変更した場合は必須。先に `pnpm fix` で自動修正可能な指摘を潰す。
- `pnpm md-lint` — `.claude/**` を含め、Markdown に触れたら必ず実行する。3 段で走る — markdownlint（体裁）、mermaid-lint（図の構文）、`skill-lint`（frontmatter のキー、`SKILL.md` / `SKILL.ja.md` の見出し構造、本文が参照する `make` ターゲット・パスの実在性）。`skill-lint` が判定できない部分 — 対訳が同じことを言っているか、本文の内容が今も正しいか — は引き続きこのスキルの責務。
- eval 生成物が staged になっていないこと（`git status`）と、保護対象パスに触れていないことを確認する。

## Definition of Done

- 公式 `skill-creator` の方法論を解決して読み込んだ（Step 0）。
- `.claude/skills/<slug>/SKILL.md` が存在し、`name` がディレクトリ名と一致した kebab-case、`description` が密度のある英語の "pushy" 記述、本文が ADR 0154 の構造。
- `SKILL.ja.md` を `canonicalize-doc` 経由で canonical 側から生成 / 同期済み。frontmatter 無し、sync ノートあり、`SKILL.md` と 1:1。
- スキルが ADR 0154 または 0155 のカバー範囲テーブルへ登録済み。
- 同梱スクリプトが `tsx` 実行の TypeScript である（インストール前単体実行の例外に当たる場合を除く）。
- eval 生成物をコミットしていない。保護対象パスに触れていない。
- 検証コマンドを実行し、**機械検査されなかった範囲**も含めて正直に報告した。
