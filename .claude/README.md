# `.claude/`

Claude Code 向けの設定資産を置く。

| パス | 中身 |
| --- | --- |
| `skills/` | 本リポジトリが著作・保守するスキル。`/<slug>` で起動する（[ADR 0154](../docs/adr/0154-claude-skills-operations.md) / [0155](../docs/adr/0155-claude-skills-development.md)） |
| `agents/` | スキルが呼び出すサブエージェントの定義 |
| `settings.json` | 権限境界（`allow` / `ask` / `deny`）とプラグイン宣言 |

個々のスキル・エージェントの棚卸しはここに手書きしない。`/tool-map` が実体から生成する。

## セットアップ

clone 後に 1 度実行する。手順の全体は [README.md](../README.md) のクイックスタートにある。

### 公式プラグイン

```bash
pnpm exec tsx scripts/bootstrap-plugins
```

project スコープで宣言するため、宣言そのものは `settings.json` に載って clone で届く。上のコマンドは
marketplace の実体をローカルへ解決する。

### 外部スキル

```bash
pnpm exec tsx scripts/bootstrap-external-skills
```

外部スキル = 上流が配布するスキル。プラグインと違い実体が **user スコープ**（`~/.claude/skills/`）へ入るため、
リポジトリを信頼した clone では届かない。**マシンごとに 1 度**実行する。

現在の対象は graphify 1 件。任意であり、実行しなくてもビルド・lint・CI は何も変わらない。

## graphify

リポジトリを tree-sitter でローカル AST 解析して知識グラフ化し、`graphify-out/graph.json` と
`graphify-out/GRAPH_REPORT.md` を出す。`/graphify` で呼ぶ。

- 上流: `Graphify-Labs/graphify`（Apache-2.0）
- PyPI パッケージ名は **`graphifyy`**（y 2 つ）で、CLI 名が `graphify`。取り違えやすいので、手順を書く
  ときは必ず `graphifyy` を使う（理由は [`mise.toml`](../mise.toml) のコメント）
- 版の SSOT は [`mise.toml`](../mise.toml)。bump の検疫は [ADR 0110](../docs/adr/0110-security-operations.md) 1.1

**以下は `mise.toml` で pin している版の挙動**。既定値もサブコマンドも上流の版に紐づくため、pin を
上げたらこの節も突き合わせる（同 1.1 がレビュー項目として要求している）。

### 何がマシンの外へ出るか

既定はローカル完結で、API キーを必要としない。

| ローカル完結 | 外部 LLM API を呼ぶ |
| --- | --- |
| `update`（再抽出）、`query` / `affected` / `god-nodes` / `path` / `explain` / `diagnose` | docs / PDF / 画像の意味抽出、`--mode deep`、`--wiki`、コミュニティ命名（`label` / `cluster-only`） |

左列だけが `settings.json` の `allow` に載っている。右列は opt-in で、都度の確認を通す。

### 使うときの注意

- **導入は上の bootstrap スクリプト経由だけにする。** graphify の `install` 系統はリポジトリの
  `CLAUDE.md` / `AGENTS.md` / `.cursor/` / `.gemini/` / git hook を書き換えうる。`--platform` を
  付ければ user スコープ、という切り分けは成立しない — `--project` を足せば project スコープへ倒れ、
  `--platform cursor` / `--platform gemini` はフラグ無しでもカレントディレクトリを書く。
  `settings.json` の `deny` が `install` 系統を丸ごと塞いでいる
- **`query` は既定 budget（2000 token）で答えを切り詰める。** 切り捨てた側に答えがある場合があり、
  ツール自身がその旨を警告する。網羅性が要る問いには向かない
- **グラフは最後の `update` 時点のスナップショット。** 未コミットの変更は映らない
- **小さな差分では grep のほうが安い。** 実測では、狙って書いた grep に対して 0.76x〜3.8x 悪化し、
  上流が主張する削減は再現しなかった。価値が確認できたのは `affected`（relation 付きの推移的な
  変更影響）
- 出力 `graphify-out/` は追跡外。markdownlint / mermaid-lint / skill-lint の走査からも外してある
  （いずれも `.gitignore` を見ないため）

### 撤去

```bash
graphify uninstall --purge
```

`settings.json` の `deny` に載っているため、**エージェントからは実行できない**（deny は確認を挟まず
拒否する）。人間が自分の端末で直接叩く。Claude Code 以外のプラットフォームへ入れた場合は消し残す
ことがあるので、`~/.codex/skills/graphify/` などは目視で確認する。

リポジトリ側は、[`mise.toml`](../mise.toml) の pin・`settings.json` の `allow` / `deny`・
[`scripts/bootstrap-external-skills/skills.ts`](../scripts/bootstrap-external-skills/skills.ts) の
導入対象・この節を消せば戻る。

### インストーラの副作用

`bootstrap-external-skills` は user スコープにしか書かないが、上流のインストーラは
**`~/.claude/CLAUDE.md`（user グローバル）** も作成し、`/graphify` のトリガを登録する。リポジトリの
`CLAUDE.md` / `AGENTS.md` には触らない。

## rtk

シェル出力をエージェントのコンテキストへ届く前に圧縮するプロキシ。`rtk <サブコマンド> <元の引数>`
の形で元のツールを包む。

- 上流: `rtk-ai/rtk`
- 版の SSOT は [`mise.toml`](../mise.toml)。bump の検疫は [ADR 0110](../docs/adr/0110-security-operations.md) 1.1
- **build / test / CI のどの経路も呼ばない。** 入っていない checkout でも挙動は変わらず、変わるのは
  エージェントのコンテキスト量だけである

### 何が効いて、何が効かないか

**包める経路は原則 rtk を通す。** 圧縮できないコマンドは素通しになるので、通すかどうかを毎回量る必要は
ない。量るのは**採否ではなく、欠損の有無**である。

このリポジトリでの実測（`mise.toml` が pin する 0.45.0）。

| コマンド | 素 | rtk | 判定 |
| --- | --- | --- | --- |
| `rtk find <dir> -name ...` | 61,267B | 953B | ◎ 64x。ディレクトリごとに畳み、打ち切った残りは退避ファイルを案内する |
| `rtk git diff <rev>` | 544,079B | 54,585B | ◎ 10x。stat と変更行だけになる。レビューに耐える |
| `rtk ls -la <dir>` | 1,025B | 273B | ○ 3.8x。絶対量は小さい |
| `rtk git status` | 6,573B | 4,807B | ○ 1.4x |
| `rtk git log --oneline -50` | 4,255B | 4,255B | 素通し。包んでも減らないが、害も無い |
| `rtk grep -rn` | 21,557B | 21,557B | **✗ 使わない。** 小さい対象では素通しだが、大きい対象では**黙って打ち切る**（30,372B → 20,718B）。切り捨てた側に答えがあるかは出力から分からない |
| `rtk tree` | — | — | **✗ 採らない。** `tree` 本体は mise の registry にも GitHub のリリース資材にも無く pin できない（[0003](../docs/adr/0003-version-manager.md)）。ディレクトリ構造は `rtk find <dir> -type d` が 16,153B → 611B（26x）で同じ答えを出す |

**`grep` と `read` を包まない。** どちらも欠損する側で、[ADR 0157](../docs/adr/0157-inspection-declaration-discipline.md)
が禁じる「欠けているのに完全に見える出力」を作る。

### 塞いである 3 種類と、その理由

危険なのは `rtk` のサブコマンドではなく**包まれる側のコマンド**である。`settings.json` の `deny` は
性質の違う 3 つを塞いでいる。

- **任意コマンドの実行経路** — `run` / `summary` / `smart` は `rtk <sub> <任意のコマンド>` を
  実行する。残すと `rm -rf` / `sudo` / `git push --force` を包んで通す迂回路になり、内側のコマンド
  粒度で書かれた `allow`（`pnpm build *` / `make help`）を素通りする。`err` / `test` は同じ形だが
  **このリポジトリに客がいない** —— 嵩む出力は make のターゲット（`make ai-<target>` が担当）と
  CI ログ（`gh run view --log-failed` が担当）で、実測でも `pnpm build` は失敗時 2.1KB、
  `pnpm lint:md` は 106B しかない。効かないものを許可も禁止もせず、確認を挟む既定に置いてある
- **報告の真正性を壊す mode** — `log` と `read -l` は、**欠けているのに完全に見える出力**を作る。
  実測では、失敗した CI ログに `log` を当てたとき失敗理由そのものが消え（残ったのは、ファイル名に
  `error` を含む通過行を「エラー」と数えた要約だった）、`read -l aggressive` は 40 行のファイルを
  5 行にした。ゲートが何と言ったかを報告する義務（[ADR 0157](../docs/adr/0157-inspection-declaration-discipline.md)）は
  散文では守れないので、[ADR 0144](../docs/adr/0144-decision-enforcement-pairing.md) に従って機械側で塞ぐ
- **マシンを触るもの** — `init` はホームディレクトリへグローバルフックを書く。マシン設定は人間のもの

### マシン側のセットアップと、pin が届かない理由

自動書き換えフック（`rtk init -g`）と除外リストはユーザーのホームに住み、checkout の中には無いので
リポジトリと一緒には配られない。帰結が 2 つある。

- **フックは `PATH` から `rtk` を解決するため、`mise.toml` の pin に従わない。** 別途入れた `rtk` は
  pin された版と食い違う。版が問題になる場面では pin されたビルドを呼ぶ
- **除外の基準は、出力が冗長かどうかではなく、出力を厳密な値として読むかどうかである。** フックを
  入れる場合、このリポジトリで除外すべきものは次のとおり

  | 除外 | 理由 |
  | --- | --- |
  | `gh` | `--json` の出力が判断を左右する（`mergeable` / `baseRefName` / `state`） |
  | `make` | 出力そのものが値になる target がある（`load-status` / `lighthouse-report`）。かつ静音実行は `make ai-<target>` が担当する |
  | `pnpm` | `bundle-budget` / `render-mode` / `check:*` は数値そのものが主題 |
  | `curl` | API 応答の本文を仕様に照らして検証する |
