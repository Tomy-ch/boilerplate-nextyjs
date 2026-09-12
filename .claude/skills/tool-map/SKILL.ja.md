> **このファイルは `SKILL.md` の日本語訳です。**
> 直接編集しないでください。内容の変更が必要な場合は canonical な `SKILL.md`（英語版）を更新し、その後この日本語訳を同期してください。
> Claude Code のスキルとしては `SKILL.md` のみが読み込まれます。このファイルはスキル本体ではなく、レビューや学習用の翻訳ドキュメントです。

# Tool Map

このスキルは `/tool-map` から起動される。ユーザの引数文字列は `$ARGUMENTS`。

このコマンドは、**プロジェクトレベル**の `.claude/` ディレクトリ配下に登録されたカスタマイズ項目をすべてインベントリ化する（`~/.claude/` は走査しない）。対象は commands / skills / agents の 3 種で、単一の Markdown レポートを出力する。

## Step 1. 入力の解決

`$ARGUMENTS` から以下の任意フラグを解釈する。欠けている / 不正なフラグについては `AskUserQuestion` で確認する。

| フラグ | 値 | 既定 |
| --- | --- | --- |
| `--lang` | `en` / `ja` | `ja` |
| `--output` | `inline` / `file` | `inline` |
| `--output-path` | 任意の相対パス | `./TOOL_MAP.md`（en）または `./TOOL_MAP.ja.md`（ja）— `--output=file` のときのみ使用 |
| `--include` | `commands,skills,agents` のカンマ区切り部分集合 | `commands,skills,agents`（3 種すべて） |

`AskUserQuestion` のフォールバック質問（未解決のフラグについてのみ聞く）:

1. 出力言語は？ — `en` / `ja`
2. 出力先は？ — `inline` / `file`（`file` の場合は `--output-path` も聞く）
3. どの種別を含めるか？ — `commands` / `skills` / `agents` / `all`

必要な値がすべて解決するまで、走査も書き込みも行わない。

## Step 2. 項目の列挙

カレントディレクトリ配下のプロジェクトレベルのパスのみを走査する:

| 種別 | パス glob | 項目ファイル |
| --- | --- | --- |
| commands | `.claude/commands/` | `<name>.md` <!-- skill-lint-ignore --> |
| skills | `.claude/skills/` | `<name>/SKILL.md`（`SKILL.ja.md` その他の `*.ja.md` 翻訳ファイルはスキップ） |
| agents | `.claude/agents/` | `<name>.md` |

検出コマンド（`Bash` で `find` / `ls` を使い、ファイルごとに `Read`）:

```sh
test -d .claude/commands && find .claude/commands -maxdepth 1 -type f -name '*.md'
test -d .claude/skills   && find .claude/skills   -mindepth 2 -maxdepth 2 -type f -name 'SKILL.md'
test -d .claude/agents   && find .claude/agents   -maxdepth 1 -type f -name '*.md'
```

スキップするもの:

- `*.ja.md` 翻訳ファイル（項目としてロードされないため）。
- `.claude/skills/` 配下で `SKILL.md` を持たないディレクトリ。
- 隠しファイル（`.DS_Store` 等）。

## Step 3. メタデータの抽出

見つかった各項目について frontmatter と本文を読み、以下を抽出する:

| フィールド | commands | skills | agents |
| --- | --- | --- | --- |
| Name | ファイル名の語幹 | `name:`（フォールバック: ディレクトリ名） | ファイル名の語幹（frontmatter に `name:` があればそれも） |
| Description | `description:` | `description:` | `description:` |
| Argument hint | `argument-hint:` | — | — |
| Allowed tools | `allowed-tools:` | — | `tools:` |
| Model override | `model:` | — | `model:` |
| Path | 作業ディレクトリからの相対 | 作業ディレクトリからの相対 | 作業ディレクトリからの相対 |

インベントリ表の Description は最初の 1 文（または約 120 文字）に切り詰める。

## Step 4. 依存の検出

依存とは、ある項目が別の項目を名前で呼び出す / 明示的に参照するクロスリファレンスを指す。本文テキストから次の方法で検出する:

1. **明示的な呼び出し表現**: `invoke the` + 名前 + `skill`、`chains into` + 名前、`via the Skill tool with` + 名前、`Agent({ subagent_type: '` + 名前 + `' })`、他コマンドの `/<name>` リテラル起動。
2. 走査済みの別項目の `name:` と一致する**バッククォート囲みの名前**。
3. `Chain` / `Calls` / `Depends on` / `Chains into` のような**セクション見出し**に続く名前参照。

依存は有向辺 `caller → callee` として記録する。各辺には呼び出し元・呼び出し先の種別を付ける（例: `skill → skill`、`skill → command`）。

除外するもの:

- 自己参照（自分の名前に言及しているだけのもの）。
- 無関係な言語のフェンス付きコードブロック内（`bash` / `sh` / `make` / `sql` 等）の言及。**ただし**明らかに起動例である場合は除く。
- たまたま名前と一致した一般的な英単語。バッククォート囲みであるか、上記の呼び出し表現に続くことを条件とする。

検出した参照が走査結果に存在しない名前を指していた場合は、Notes 節向けに **broken edge** として記録する。

## Step 5. レポートの描画

以下の 4 節を、選択された言語で出力する。スキル名とパスは言語に関わらず原文のまま。

### 1. Summary

種別ごとの件数を 1 行ずつ。含めた種別のみ表示する。

- `Commands: N`
- `Skills:   M`
- `Agents:   K`
- `Total:    N + M + K`

### 2. インベントリ表

含めた種別ごとに 1 表を、commands → skills → agents の順で出す。件数 0 の種別は表を省略する（Summary には 0 として載せる）。

- **Commands 表**: Name | Description | Args | Allowed Tools | Model | Dependencies | Path
- **Skills 表**: Name | Description | Dependencies | Path
- **Agents 表**: Name | Description | Tools | Model | Dependencies | Path

`Dependencies` は `<callee-name> (<callee-type>)` のカンマ区切り。無ければ空。

### 3. 依存グラフ

Mermaid の `graph LR` 図。読み手が区別できるよう、種別に応じて各ノードへ class を当てる:

```mermaid
graph LR
  classDef cmd fill:#cce5ff,stroke:#3b82f6
  classDef skl fill:#d4edda,stroke:#22c55e
  classDef agt fill:#fff3cd,stroke:#f59e0b
  %% nodes (include isolated entries so standalone tools appear)
  %% edges: caller --> callee
  %% class assignments
```

ノード id には項目名を使う（Mermaid で使えない文字は `_` に置換する）。

### 4. Notes

以下を指摘する短い散文の節:

- **Leaf 項目**（出入りする辺が無い）。
- **Hub 項目**（2 つ以上から依存されている）。
- **Broken edge**（走査結果に存在しない名前への参照）。
- **種別をまたぐ連鎖**（例: skill が command を呼ぶ — ありうるが通常ではない）。
- **空の種別**（例: 「プロジェクトレベルの agents は見つかりませんでした」）。

### 言語

- `en`: 節見出し・散文・表ヘッダを英語で。
- `ja`: 節見出し・散文・表ヘッダを日本語で。

## Step 6. 出力

- `inline`: レポート全文を応答に含めて終了する。
- `file`: `--output-path` へレポートを書き出し、短い確認（1 行サマリ + ファイルパス）を返す。応答にレポート全文を重ねて出さないこと。

## Step 7. 書いたファイルの整形（`--output=file` のときのみ）

`--output=file` の場合、レポート書き出し後にそのファイルへ `pnpm exec markdownlint-cli2 --no-globs --fix <パス>` を掛ける。`pnpm lint:md` は pre-commit hook と CI に任せる（docs/playbook.md: ゲートを先回りして回さない）。

`--output=inline` のときは本ステップをスキップする（ファイルを書いていないため）。

## 制約

- このコマンドは**既定で read-only**。書き込みが許されるのはユーザが明示的に `--output=file` を選んだ場合のみで、確認済みの出力先パスに限る。
- 走査範囲は**プロジェクトレベルのみ**。`~/.claude/` 配下を読んだり一覧したりしない。
- プラグイン由来の項目は対象外。
- 走査した項目を変更しない。このコマンドは検査のみを行う。
- `.claude/commands/` / `.claude/skills/` / `.claude/agents/` が存在しない場合は、件数 0 として扱いレポートに記載する。エラーにしない。 <!-- skill-lint-ignore -->

## チェックリスト

完了を報告する前に確認する:

- [ ] 必要な入力がすべて解決済み（`$ARGUMENTS` または `AskUserQuestion` 経由）
- [ ] プロジェクトレベルの `.claude/{commands,skills,agents}/` のみを走査した
- [ ] skills の走査から `*.ja.md` を除外した
- [ ] 各項目の frontmatter を解析した（name / description / 種別固有フィールド）
- [ ] 文書化された規則どおりに依存を検出した（自己参照は除外、broken edge は記録）
- [ ] レポートに Summary / インベントリ表 / 依存グラフ（Mermaid）/ Notes が含まれる
- [ ] 単独の項目がグラフ上に孤立ノードとして現れる
- [ ] `--output=file` の場合、ファイルが書かれ、そのファイルに `markdownlint-cli2 --fix` を掛けた
- [ ] `--output=file` の場合、確認済みの出力先以外のパスを変更していない
