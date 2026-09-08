> このファイルは `SKILL.md`(canonical / 英語)の日本語参考訳です。スキルとしては読み込まれません(参考用)。

# Repo Ops Runbook

本リポジトリで繰り返し踏みがちな運用上の落とし穴に対する、具体的な復旧・手順ステップ集。これは
**ワークフローではなくルックアップ表**: 症状を見つけて対処を打つ。破壊的またはルートファイルに触れるステップは
`CLAUDE.md` に従い先にユーザへ伝える。

> **スコープ注記。** この runbook は意図的に薄く、実在する落とし穴だけを載せる。本リポジトリは Docker
> ツールランナーも DB も持たない表示層なので([0011](../../../docs/adr/0011-no-docker.md))、その種の項目は
> ここに属さない。新たに踏んだら項目を足すこと。

## 1. `make install-tools` が `mise not found` で落ちる

`make install-tools` は `mise install` を実行し、`mise.toml` の `[tools]` を読む(ADR 0003)。まず `mise` 自体が
`PATH` にあるか確認し、無ければメッセージを出して終了する。

対処: `mise` をインストール(<https://mise.jdx.dev/>)してから再実行。

```bash
make install-tools     # mise.toml に従い Node.js + pnpm を入れ、両バージョンを表示
```

原則: **mise が Node.js / pnpm バージョンの SSOT。** 誰かが `mise.toml` を変えたら(例 `node-upgrade`)、
`make install-tools` でローカルツールチェーンを揃え、activate 済みのシェルから素の `node --version` /
`pnpm --version` で確認する。どちらかが `mise.toml` と食い違うなら、`PATH` が別物を答えている(§2)。

## 2. 素の `pnpm` は別の pnpm ── スクリプトが落ち、`pnpm-workspace.yaml` が勝手に変わる

`mise.toml` は pnpm をピン留めしている(ADR 0003)が、素の `pnpm` は `PATH` で解決されるため、システム全体に
入った pnpm(Homebrew / グローバル npm install / Corepack)がピンを覆い隠す。ピンより 1 メジャー先の pnpm は、
次の 2 つの挙動でどちらも別の場所へ責任を押し付けてくる。

- **スクリプトがそもそも走らない。** pnpm 11 はスクリプト実行前に依存の鮮度を検査して `pnpm install` を呼び、
  それが本リポジトリの未承認ビルドスクリプトで止まる ── `esbuild` / `lefthook` / `sharp` を挙げる
  `ERR_PNPM_IGNORED_BUILDS`、あるいはエージェントや CI の非対話シェルでは、別メジャーが書いた
  `node_modules` を破棄しようとして `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`。スタックの末尾が
  `runDepsStatusCheck` であることが目印で、落ちたのは前段のゲートであって `lint:ci` / `typecheck` /
  `md-lint` ではない。
- **追跡対象のルート設定を書き換える。** pnpm 11 は `pnpm-workspace.yaml` の先頭にプレースホルダを追記する:

  ```yaml
  allowBuilds:
    esbuild: set this to true or false
    lefthook: set this to true or false
    sharp: set this to true or false
  ```

  何も告知されないため `git status` に紛れ込み、PR まで届きうる。`pnpm-workspace.yaml` は既定の
  AI 変更スコープ外のルート設定で、ついでに変えてよいものではない。

2 つの解決結果を突き合わせる。一致していなければならない。

```bash
pnpm --version     # PATH が拾った方
mise which pnpm    # mise.toml がピン留めした実体
which -a pnpm      # どちらがどちらを覆っているか
```

包んで回避せず、`PATH` を直して戻す:

```bash
git restore pnpm-workspace.yaml     # allowBuilds ブロックが付いていたら捨てる
eval "$(mise activate zsh)"         # ピン留めした方を先に置く(bash なら mise activate bash)
pnpm lint:ci                        # そのうえで AGENTS.md どおり素で実行する
```

誤った pnpm が既に `node_modules` を入れ直していた場合、ピン留めされた pnpm 側も同じ `..._NO_TTY` で
引き取りを拒む。`CI=true` が破棄の確認に代わりに答える:

```bash
CI=true pnpm install --frozen-lockfile
```

シェルの `mise activate` が修正のすべてで、素のコマンドがピン留めした方へ解決するのはこれによる。逃げ道として
`mise exec -- <command>` を使うことは **禁止**(ADR 0003)── その 1 回の呼び出しだけを直し、壊れた `PATH` を
残すため、包み忘れた次の呼び出し側に同じ失敗が回る。本リポジトリのどこにも包んだ書き方は存在しない
(`.lefthook.yaml` にも `.makefiles/` にも)。

hook も同じ `PATH` で解決するため、誤った pnpm を掴んだシェルは hook にもそれを渡す(§7)── つまり
**`lint:ci` で落ちた commit は、差分ではなくこれかもしれない**。スタックに `runDepsStatusCheck` が出るかどうかが
両者の分かれ目になる。

ピンを新しい pnpm へ動かすかは `tools-upgrade` の判断であって、この罠の回避策ではない。動かす場合は
`allowBuilds` をプレースホルダでなく実値で埋める作業も要る。

## 3. `DRY_RUN` は `make setup-repo` には効かない

`DRY_RUN=1` が効くのは置換系の補助ターゲット 2 つだけ。`make setup-repo` はこの変数を読まないため、
**事前にプレビューする手段が無い**。

```bash
DRY_RUN=1 make setup-replace-license-copyright COPYRIGHT_HOLDER='Example Inc.'  # プレビュー
DRY_RUN=1 make setup-replace-repository-reference REPOSITORY=org/app           # プレビュー
DRY_RUN=1 make setup-repo                                                      # ⚠️ そのまま実行される
```

dry-run が有効になる値は `1` のみ。それ以外(`DRY_RUN=0` を含む)はすべて書き換える。

`make setup-repo` はリポジトリ初期化の一度きりターゲットで**破壊的**: ローカルと `origin` の既存タグを全削除し、
`v0.0.0.md` 以外のリリースノートを削除し、`upstream` リモートを外し、`v0.0.0` と保護ブランチ 3 本を作成・push する。
実行前にユーザ確認を取り、初期化済みリポジトリでは実行しない(`v0.0.0` があれば中断する)。

## 4. `pnpm install --frozen-lockfile` が落ちる ── lockfile 不整合

ADR 0001 により `pnpm-lock.yaml` は**コミット必須**で `package.json` と同期させる。CI 相当の `--frozen-lockfile`
インストールは両者がズレると落ちる(例: 再ロックせず依存を編集)。

対処: `package.json` 編集と同じ変更で lockfile を再生成しコミット。

```bash
pnpm install                 # pnpm-lock.yaml を package.json に合わせて更新
git add package.json pnpm-lock.yaml
```

原則: **`package.json` の依存変更は、再生成した `pnpm-lock.yaml` を必ず同時コミットする。**(`package.json` は
保護対象のルート設定 ── 依存編集はユーザ明示指示が必要。[0004](../../../docs/adr/0004-library-management.md)
により依存メジャーは別 PR。)

## 5. biome: `pnpm lint` vs `pnpm fix`(ADR 0002)

フォーマッタは biome 単独で、biome が表現できる lint 検査はすべて biome が持つ。Prettier は不採用。ESLint が
持つのは biome で表現できない検査だけで、現時点では層境界の import 検査(`eslint-plugin-boundaries`)と
`next/link` のルールに限られる(ADR 0002 の能力ベース分割)。入口は次のとおり:

```bash
pnpm fix       # biome check --fix : 自動修正可能なものを直す
pnpm lint      # biome check       : 残エラーを報告(手で直す)
pnpm format    # biome format --write : フォーマットのみ
pnpm lint:ci   # biome(完全版)+ ESLint 境界検査 + architecture 突合
```

`pnpm lint:ci` は hook と CI が回すゲートで、3 段の直列である。`biome.ci.jsonc` + `--error-on-warnings` の
biome、`pnpm lint:eslint`、`pnpm check:architecture`(層 README の `imports-allowed` frontmatter と、依存
マトリクスの単一の正である `architecture.ts` の突合)。失敗はどの段かを名乗るので、整形の問題と決めつける前に
読む。

`noConsole` は既定 `warn` ── **`console.log` をコミットに残さない**(AGENTS.md / ADR 0002)。自動修正で直らない
ものは手で直す。`// biome-ignore` を多用しない(スコープ付き `overrides` を `biome.json` に。ただし `biome.json` は
保護対象ルート設定=ユーザ指示)。

## 6. スクラッチ出力は `tmp/` 配下に置き、git には乗せない

`/tmp` は `.gitignore` 済みなので、以下は `git status` に出ない。

- `tmp/reviews/` ── `full-verify` / `full-apply` の指摘集
- `tmp/<name>.md` ── 実体をリポジトリ外に置いた作業計画書への symlink

いずれもソースではなくスクラッチ出力: `git add -f` で強引に載せない。残す必要があるスクラッチはリポジトリ外に
実体を置き、`tmp/` 配下の symlink から参照する。

**worktree はリポジトリ内の `.claude/worktrees/<name>/` に置く** ── エージェントのツールがそこに
作り、置き場所は設定できない。別の場所に置く規約を敷いても、守られるのは人手で作った分だけになる。
ツリー内のチェックアウトは、ツリーを走査する全ツールの走査対象に入るため、除外は 5 箇所に書かれて
おり、その全てを揃えて保つ必要がある。

| 場所 | エントリ |
| --- | --- |
| `.gitignore` | `/.claude/worktrees/` |
| `.markdownlint-cli2.yaml` | `ignores:` の `.claude/worktrees/**` |
| `scripts/mermaid-lint` | `EXCLUDE_PREFIXES` |
| `scripts/skill-lint` | `EXCLUDE_PREFIXES` |
| `.makefiles/security/trivy.mk` | `--skip-dirs .claude/worktrees` |

これらのツールはいずれも `.gitignore` を読まないため、そこで ignore しても他の 4 箇所の除外にはならない。
ツリーを走査するツールを 6 つ目に増やすときは、除外も 6 箇所目を足すことになる。

## 7. commit / push が hook に弾かれる(lefthook)

hook は `.lefthook.yaml` で宣言される(ADR 0151)。`pnpm install` では登録されないため、clone 後に
`pnpm exec lefthook install` を 1 度実行する必要がある。hook は共通 git ディレクトリに置かれるので
worktree にも継承されるが、**`node_modules` は継承されない** ── worktree で `pnpm install` を実行しないと
すべての hook が `command not found` で落ちる。

| 段階 | 入口 | 検査内容 |
| --- | --- | --- |
| pre-commit | `pnpm lint:ci`、`*.md` が staged なら `pnpm md-lint`、workflow が staged なら `make actionlint` | biome 完全版 + ESLint 層境界 + `architecture.ts` 突合(§5) / markdownlint + mermaid 構文 + `.claude/**` の意味検査(`skill-lint`) / workflow 構文 + `run:` のシェル |
| commit-msg | `make commitlint` | subject を ADR 0150 に照らす |
| pre-push | `pnpm typecheck`、`make secret-scan` | `tsc --noEmit` / push 範囲の秘密(**fail-closed**) |

`make trivy-fs` は **hook に接続していない**(手動実行専用)。依存の脆弱性は push する当事者がその場で
解消できず、diff と独立に状態が変わるため、ゲートとして成立しないという判断による ── 報告は PR コメント、
ブロックは昇格ゲートが持つ(ADR 0110 3.1)。

各段の再現は、activate 済みのシェルから入口を素で叩けばよい。引数まで含めた正確なコマンド行は
`.lefthook.yaml` にあり、写しではなくそちらを読むこと。

```bash
make secret-scan
```

`.lefthook.yaml` の全コマンドは素で書いてある ── `mise exec --` は他と同様ここでも禁止 (§2; ADR 0003 / 0151)。
`mise ls` にツールが入っているのに `❌ <tool> が PATH にありません` で落ちる場合、それは hook の不備ではなく
環境の報告で、`git` を起動したシェルに activate 済みの `PATH` が無い。元から直す ── `make install-tools` の後、
そのシェルで mise を activate する。プロファイルを読まない起動元 (GUI の git クライアント / エージェントの
シェル / CI) では、代わりに **shims** ディレクトリを `PATH` に載せる (`mise activate --shims`、実体は
`~/.local/share/mise/shims`)。shims は呼び出しごとの包み込み無しで同じピンへ解決する。その呼び出しだけを
通すためにエントリを包まない。

`secret-scan` の失敗は再実行では解けない。秘密が push 範囲のコミットに入っているので、履歴から除く必要がある。

commit-msg で落ちた場合、subject が ADR 0150 の prefix 11 種を使った `<Prefix>: <subject>` になっていないか、
subject が空か、末尾が `。` で終わっている。
`commitlint.config.ts` は `type-case` を意図的に課していない ── prefix が `Feat` と `CI` のように大文字構成を
混在させるため、単一の case ルールが当たらない。merge / revert コミットは commitlint の既定 ignore で除外される。

コミットせずにメッセージだけ検査する:

```bash
echo "Feat: 説明" | pnpm exec commitlint
```

### 変更外の理由で gate が落ちたとき

hook の失敗が「その変更についての証拠」になるのは、失敗の原因がその変更にある場合だけである。次の 3 つは違う。

- **別セッションのファイル。** `pnpm typecheck` と `make test-full` は commit 範囲ではなく作業ツリー全体を読む。別の窓が編集途中の未コミットファイルが、それを含まない push を落とす
- **同じ出力先を共有する 2 つの実行。** Vitest は `coverage/.tmp` <!-- skill-lint-ignore --> へ書き、1 つ目が生きているうちに 2 つ目が始まると `Something removed the coverage directory` で落ちる。コードは何も壊れておらず、2 つの実行が互いの一時ファイルを消し合っただけである
- **base ブランチに元からある失敗。** base を checkout して同じ gate を回せば分かる

いずれも `--no-verify` が正しく、原因は別に直す。落ちていない gate を満たすために変更の形を変える方が、変更を悪くする。適用の条件は 2 つ。

- **どの gate がなぜ変更外なのかを必ず言う。** 報告にも PR にも書く。黙って迂回すると、本物の失敗を握り潰したのと区別が付かない
- **push 自体が不可逆にする gate には絶対に使わない。** `secret-scan` が fail-closed なのはこのためで、push した範囲に入った秘密は取り消せない。`commitlint` も同様に、件名は既に履歴へ入っている。この 2 つは迂回せず直す

**重い gate を先回りして手で回さないこと。** hook と CI が同じものを回すのを再発見するために数分ホストを飽和させるだけで、その飽和自体が上の 2 つ目を生む。push が検証の工程である。

## 8. mise 自身の版を上げたい / 上げたら CI が落ちた

`mise.toml` が宣言するのは mise が解決する対象であって、mise 自身は宣言できない。したがってバイナリの版は
[`.github/actions/setup-mise/action.yaml`](../../../.github/actions/setup-mise/action.yaml) にあり、
そこに **3 度**書かれている ── `MISE_VERSION` / `MISE_SHA256` / キャッシュキー。composite action は
`with:` の値からステップの `env:` を参照できないため、キーはリテラルを持つしかない。

digest は版に対応する release から取る。

```bash
curl -sSL "https://github.com/jdx/mise/releases/download/v<版>/SHASUMS256.txt" | grep 'linux-x64$'
```

3 箇所を揃えたら、揃っていることを確かめる。

```bash
make actions-mise-pin-lint
```

同じ検査が CI の `actions-lint` でも走るので、揃っていない状態はマージされない。片方だけを直したときの
落ち方は次のとおり。

| 直した側 | 起きること |
| --- | --- |
| 版だけ | キーが変わって何も復元されず、取得したものが digest 照合で落ちる |
| digest だけ | キーが変わらず古いバイナリが復元され、digest 照合で落ちる |

どちらも fail-closed(違うバイナリは実行されない)だが、どちらのメッセージも原因を名指ししない。検査を
置いてあるのはそのため。digest は取得したものだけでなく**復元したものにも**照合する ── Actions の
キャッシュはブランチを跨いで共有され、push 権限があれば書けるので、信頼境界ではない
([0153](../../../docs/adr/0153-ci-configuration.md))。

`mise.toml` の中のツールの版は別件で、`tools-upgrade` が担当し、mise 自身は意図的に触らない。

## 制約

- ✅ read-only ナレッジ: 正確なコマンドを提示。実行はユーザが操作を頼んだ時のみ。
- ✅ 破壊的ステップ(§3 のタグ/ブランチ削除)は `CLAUDE.md` に従い事前警告。
- ✅ ルートファイル編集(§5 `biome.json`、§4 `package.json`)は事前にユーザ確認 ── 既定の
  AI 変更スコープ外。§2 の `git restore pnpm-workspace.yaml` は例外 ── 頼んでいない機械的な変更を
  作るのではなく捨てる操作だから。
- ❌ Docker / DB の項目をここに足さない(スコープ注記)。
