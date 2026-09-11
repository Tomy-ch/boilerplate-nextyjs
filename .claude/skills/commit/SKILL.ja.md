> **このファイルは `SKILL.md` の日本語訳です。**
> 直接編集しないでください。内容の変更が必要な場合は canonical な `SKILL.md`（英語版）を更新し、その後この日本語訳を同期してください。
> Claude Code のスキルとしては `SKILL.md` のみが読み込まれます。このファイルはスキル本体ではなく、レビューや学習用の翻訳ドキュメントです。

# Commit

このスキルは `/commit` から起動される。引数文字列は `$ARGUMENTS`。

このコマンドは作業ツリーの未コミット変更を分析し、適切な粒度とプロジェクトの prefix 規約に沿った 1 つ以上の git コミットを作る。コミットメッセージはすべて日本語（`AGENTS.md` に従う）。

このコマンドは全コミットで意図的に lefthook を迂回する（`git commit --no-verify`）。複数コミットへ分割する際に `.lefthook.yaml` の pre-commit 検査（現状は `pnpm lint:ci` / `pnpm lint:md`）が N 回発火しないようにするため。あとから回すこともしない。`AGENTS.md` の *Do not pre-run the gates* がゲートを hook と CI に置き、**判定は CI が正**としているためである。Step 6 はこの実行が書いたものだけを整形し、どのゲートを CI へ預けたかを報告する。

## Step 0. 自動フォーマット

冒頭で `pnpm fix` を 1 回実行し、フォーマット由来の差分を吸収する（biome format + 自動修正可能な lint ルール。フォーマッタは biome 単独、[0002](../../../docs/adr/0002-formatter-linter.md)）。これにより後続の差分検査からノイズの主要因が消え、Step 6 の検証が純粋なフォーマットで落ちる可能性も下がる。

```sh
pnpm fix
```

`pnpm fix` 自体が失敗した場合は中断してユーザへ報告する。続行しない。生じた変更は作業ツリーへ畳み込まれ、Step 2 で検査する候補変更集合の一部になる。

## Step 1. 事前チェック

以下を並列に実行する:

```sh
git rev-parse --abbrev-ref HEAD                      # 現在のブランチ
git rev-parse HEAD                                   # 現在の HEAD コミット（ORIGINAL_HEAD として保存）
git status --porcelain                               # staged + unstaged
git diff --shortstat                                 # unstaged の要約
git diff --staged --shortstat                        # staged の要約
git rev-parse --verify MERGE_HEAD 2>/dev/null        # merge 進行中の検出
git rev-parse --verify CHERRY_PICK_HEAD 2>/dev/null  # cherry-pick 進行中の検出
git rev-parse --verify REBASE_HEAD 2>/dev/null       # rebase 進行中の検出
```

現在の HEAD コミットハッシュを `ORIGINAL_HEAD` として保存する。Step 5 で失敗したときのロールバック先になる。

以下のいずれかに該当する場合は中断する（コミットしない）:

- 現在のブランチが `^(production|develop|staging|release/.+|hotfix/.+)$` に一致する。`AGENTS.md` の git 規約（[0150](../../../docs/adr/0150-git-workflow.md)）により、保護ブランチへは決してコミットしない。ユーザへ知らせ、先に feature ブランチ（例: `feature/<issue-or-topic>`）を作るよう依頼する。
- staged / unstaged の porcelain 出力がどちらも空。コミットするものが無い旨を伝えて停止する。
- `MERGE_HEAD` / `CHERRY_PICK_HEAD` / `REBASE_HEAD` のいずれかが設定されている。リポジトリが操作の途中なので、先にそれを解決するよう依頼する。

### マージ済み PR のチェック（現ブランチの PR が既にマージ済みなら新ブランチを推奨する）

保護ブランチの中断判定を通過したら、現在のブランチに紐づく pull request が既に**マージ済み**でないかを確認する。PR がマージ済みのブランチへ新しいコミットを積むのはほぼ確実に意図しない操作である — そのコミットは base へ流れない死んだブランチに溜まり、後で `submit-pr` がマージ済み PR を再オープン / 更新しようとしてしまう。

以下を実行する（gh CLI。`gh` が無い / 未認証 / リモートが無い場合は、このチェックをスキップして続行する）:

```sh
gh pr view --json number,state,mergedAt,baseRefName,headRefName,url 2>/dev/null
```

結果の解釈:

- **PR が見つからない、または `gh` が使えない** → そのまま続行（何もしない）。
- **`state` が `OPEN`** → 通常の「既存 PR ブランチ」のケース。続行する。Step 7 が PR ブランチに対する push 前確認を既に強制している。
- **`state` が `MERGED`**（または `mergedAt` が非 null）→ コミット前に停止し、`AskUserQuestion` で（最新の）base から新ブランチを切ることを推奨する:
  - 質問: 「現在のブランチ `<headRefName>` は PR #`<number>` が既にマージ済みです。このままコミットすると、base に流れない死んだブランチに積み増しになります。新しいブランチを切って作業しますか？」
  - 選択肢:
    - 「新しいブランチを切る（推奨）」 — 未コミットの変更内容から導いたブランチ名（例: `feature/<topic>`）を提案して確認し、base を最新化してから切り替える:

      ```sh
      BASE=$(make -s base-branch)
      test -n "$BASE" || { echo "ベースブランチを解決できませんでした"; exit 1; }
      git fetch origin "$BASE"
      git switch -c <new-branch> "origin/$BASE"
      ```

      ここでの base は**現行の**リリースラインであり、`make base-branch` が `origin` の実状態から解決する。マージ済み PR の `baseRefName` は使わない。あれは古い作業がマージされた先を記録しているだけで、その後に新しいリリースラインが開いていることは十分あり、そこから切ると新しい作業が 1 世代遅れて始まる。`gh repo view --json defaultBranchRef` が答えにならないのも同じ理由で、GitHub のデフォルトブランチも現行のラインより遅れうる。`git switch -c … origin/release/*` は新ブランチの upstream を**保護された** base に設定するため、最終的な push は明示 refspec（`git push -u origin <new-branch>`）を使い、素の `git push`（保護 base を対象にしてしまう）は決して使わないこと。未コミットの作業ツリー変更は新ブランチへ持ち越される。以降は新ブランチ上で通常フロー（Step 2 以降）を続ける。**例外:** `--dry-run` のときはブランチを切り替えない — 警告と推奨コマンドを提示するだけにし、dry-run の提案を続ける。
    - 「このブランチのまま続ける」 — マージ済みブランチ上でのコミットをユーザが受け入れた場合。現在のブランチで続行する。
- **`state` が `CLOSED`**（マージされずクローズ）→ 中断はしないが、その旨を一度ユーザへ伝えて続行する。

`.lefthook.yaml`（あれば）を読み、`pre-commit:` のコマンド項目一覧を抽出する。この一覧は 2 か所で使う — (a) Step 4 で表示し、分割中に何がスキップされるかをユーザへ知らせる、(b) Step 6 でコミット後の検証ゲートとして直接実行する。`.lefthook.yaml` が無い場合はその旨を記録して続行する（Step 6 は `pnpm fix` のみのフォールバックになる）。

`$ARGUMENTS` の解釈:

| フラグ | 効果 |
| --- | --- |
| `--dry-run` | 分割提案のみ行い、staging もコミットもしない。 |
| `--scope=staged` | 現在 staged の変更のみを対象とする。 |
| `--scope=all` | staged と unstaged の双方を対象とする（既定）。 |

## Step 2. 変更の検査

各変更の性質を理解するため、詳細な差分を集める:

```sh
git diff --staged                     # staged の全差分
git diff                              # unstaged の全差分
git diff --staged --name-only
git diff --name-only
```

以下は **rider ファイル**として扱う — 単独でコミットを構成せず、それを生んだソース変更に相乗りする:

- ロックファイル: `pnpm-lock.yaml` は、それを生んだ `package.json` の変更に相乗りする（[0001](../../../docs/adr/0001-package-manager.md) — ロックファイルはコミット必須であり、単独ではコミットしない）
- 生成された API 生成物: `src/adapters/gen/**` と取り込んだ `openapi.gen.yaml`（[0072](../../../docs/adr/0072-api-type-generation.md) — 編集禁止。バックエンドの spec から再生成される） <!-- skill-lint-ignore -->
- Next.js が管理する型: `next-env.d.ts`

これらのパスの一部はまだ存在しない（生成パイプラインは [0072](../../../docs/adr/0072-api-type-generation.md) の実装 PR で着地する）。存在しないパスは「rider 無し」として扱い、エラーにしない。

## Step 3. prefix リファレンス

コミットごとに以下から**ちょうど 1 つ**の prefix を使う（先頭大文字・英語・コロン付き）:

| Prefix | 用途 | 例 |
| --- | --- | --- |
| `Feat:` | 新機能・新画面・新エンドポイント | `src/app/` 配下の新規 route segment、新規 Route Handler、新規コンポーネント / hook |
| `Fix:` | バグ修正（意図から外れた挙動の是正） | エラーハンドリング修正、ロジック修正、a11y 欠陥の修正 |
| `Refactor:` | 外部挙動を変えない内部整理 | 関数分割、リネーム、責務移動、レイヤ再編 |
| `Perf:` | パフォーマンス改善 | 再レンダリング削減、バンドルサイズ削減、不要な client 境界の除去 |
| `Docs:` | ドキュメント変更 | `README*`、`docs/`、`*.ja.md`、コードコメント、リリースノート |
| `Test:` | テストの追加・修正 | `*.test.ts` / `*.test.tsx`、テストフィクスチャ、テストヘルパ |
| `Build:` | ビルド・依存・ツールチェーン | `package.json` / `pnpm-lock.yaml`、`mise.toml`、`next.config.ts`、`tsconfig.json`、`Makefile`、`.makefiles/**` |
| `CI:` | CI/CD 設定 | `.github/workflows/**`、`.lefthook.yaml`、GitHub Actions 関連 |
| `Chore:` | その他の雑務 | `.gitignore`、エディタ設定、`.claude/**`、その他の小作業 |
| `Style:` | ロジックに影響しないフォーマットのみの変更 | `pnpm fix` / `pnpm format`（biome）の出力 |
| `Revert:` | 既存コミットの取り消し | `git revert` の出力、または同等の手動 revert |

この一覧に無い prefix を発明しない。曖昧なときは最も近いものを選ぶ（大半は `Feat` / `Fix` / `Refactor` のいずれか）。

### パスからのヒント

| パスパターン | 候補 prefix |
| --- | --- |
| `src/**/*.ts`、`src/**/*.tsx`（テスト以外） | `Feat` / `Fix` / `Refactor` / `Perf`（差分から判断） |
| `src/**/*.test.ts`、`src/**/*.test.tsx` | `Test` |
| `src/**/*.stories.*` | `Docs`（カタログ項目）／ 新規コンポーネントと同時なら `Feat` |
| `src/app/**`（新規 route segment、`page.tsx` / `layout.tsx` / `route.ts`） | `Feat`（新画面・新エンドポイント） |
| `src/adapters/gen/**`、`openapi.gen.yaml` | rider のみ — 単独コミットにしない（Step 2 参照） <!-- skill-lint-ignore --> |
| `src/**/*.css`、design token | フォーマットのみなら `Style`、それ以外は `Feat` / `Fix` |
| `env/**`、`*.env*` | `Feat` / `Chore`（差分から判断。秘密情報は決してコミットしない） |
| `docs/**/*.md`、`README*.md`、`*.ja.md` | `Docs` |
| `package.json`、`pnpm-lock.yaml`、`mise.toml`、`next.config.ts`、`tsconfig.json`、`biome.json`、`postcss.config.mjs`、`Makefile`、`.makefiles/**`、`scripts/**` | `Build` |
| `.github/workflows/**`、`.lefthook.yaml` | `CI` |
| `.gitignore`、`.claude/**`、`.markdownlint*`、エディタ設定 | `Chore` |

## Step 4. 分割の提案

適切な粒度でコミット候補の一覧を作る。各項目:

```txt
[N] <Prefix>: <短い日本語タイトル>
    files:
      - path/to/file1
      - path/to/file2
    rationale: <なぜこれらが 1 コミットに属するか>
```

### 粒度の指針

- **1 つの意味的変更 = 1 コミット。** feature + refactor + fix を 1 コミットへ混ぜない。
- **テストは対象の実装と同居してよい**（新規ハンドラとそのテストは一緒でよい）。既存コードへテストだけを追加する場合は、単独の `Test:` コミットにする。
- **生成物はソース変更と同居する。** Step 2 の rider ファイルは、それを生んだ変更と同じコミットに相乗りする。
- **フォーマットのみの変更は単独の `Style:` コミット。** Step 0 の `pnpm fix` が生んだ出力は、明らかに同じ変更の一部なら該当グループへ畳み込んでよい。無関係なら別の `Style:` コミットとして出す。
- **`Docs:` は既定で単独。** 例外として、ドキュメントが新機能の一部である場合（新規パッケージに添える README 等）は同居してよい。
- **1 コミット 1 prefix。** 2 つ書きたくなったら、その分割が間違っている。

### lefthook の通知

分割提案とあわせて、コミット段階では**スキップ**され、そのまま **CI へ預けられる** lefthook コマンドを表示する。一覧は `.lefthook.yaml` から動的に読む（設定であり、ハードコードしない）。現在の設定に対応する出力例:

```txt
This command will run `git commit --no-verify` on every commit.
The following lefthook pre-commit commands are SKIPPED here and left to CI,
which is the authority on whether they pass:
  - <name>  (<run>)   ※ glob: <glob があれば>
```

`pre-push` のコマンドはこのゲートに**含まない**。それらは push 経路に留まり、このコマンドは push を起動しない。

### 確認

`AskUserQuestion` で提案を確認する:

- 質問: 「提案したコミット分割でよいですか？」
- 選択肢: 「この提案で進める」／「修正したい箇所を指摘する」

`--dry-run` が指定されている場合は、提案を表示して停止する。staging もコミットもしない。

## Step 5. 各コミットの実行

承認された各グループについて、以下を順に実行する:

```sh
# このグループに属するファイルのみを staging する（-A / . は決して使わない）
git add path/to/file1 path/to/file2

# HEREDOC は必須（タイトル / 空行 / 本文 / フッタの体裁を保つ）。
# --no-verify は意図的。lefthook は設計上迂回する（Step 4 の通知を参照）。
git commit --no-verify -m "$(cat <<'EOF'
<Prefix>: <短い日本語タイトル>

<任意の本文: 何を変えたか・なぜか>

Co-Authored-By: <実行中のモデル名> <noreply@anthropic.com>
EOF
)"
```

### コミットメッセージの規則

- **タイトル**: `<Prefix>: <日本語タイトル>`。50 文字以内を目安にする。
- **本文**: 任意。書く場合はタイトルの後に空行を 1 行入れ、72 文字程度で折り返す。「何を」より「なぜ」を優先する。
- **言語**: 日本語（`AGENTS.md` の出力規約に従う）。
- **`Co-Authored-By` フッタ**: 必須。形式は `Co-Authored-By: <実行中のモデル名> <noreply@anthropic.com>` — 例: `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`。実際にコミットを生成しているモデルの識別子を、環境が示すとおりに使う。本ドキュメントにハードコードされたモデル名を写さないこと — モデルのリリースごとに古くなり、誤った名前はコミットの帰属を誤らせる。
- **`Refs:` footer（レビュー適用コミットのみ）**: `full-apply` / `impl-review` / `code-review` の指摘を適用したコミットには、`Refs: tmp/reviews/mod_*.md (<severity>)` の行を footer へ足し、コミットからfinding へ辿れるようにする。通常のコミットには付けない。
- **HEREDOC**: 必須（タイトル + 空行 + 本文 + フッタの体裁を保つ）。
- **`--no-verify`**: このコマンドが作る全コミットで必須 — 冒頭で述べたコマンド限定の例外であり、検証は Step 6 の 1 回のパスで行う。
- **`-a` / `git add -A` / `git add .` は決して使わない。** 常にファイル名を指定して staging する（`.env` や資格情報の巻き込みを避ける）。
- **`--no-gpg-sign` と `--amend` は引き続き禁止。**

### エラー処理

いずれかのグループで `git add` / `git commit` が失敗した場合（パスの打ち間違い、事前チェックをすり抜けた操作途中状態、GPG 署名失敗など）:

1. 直ちに以降のコミットを止める。次のグループへ進まない。
2. ユーザへ報告する:
   - どのグループが失敗したか（`[k]` の番号と提案タイトル）
   - 失敗したコマンドの stderr
   - このセッションで既に作成したコミット: `git log --oneline <ORIGINAL_HEAD>..HEAD`
3. `AskUserQuestion` で復旧方法を聞く:
   - 質問: 「ここまでに作成したコミットをどうしますか？」
   - 選択肢:
     - 「ロールバックする (`git reset --mixed <ORIGINAL_HEAD>`)」 — HEAD を保存した `ORIGINAL_HEAD` へ巻き戻し、変更はすべて作業ツリーに残し、index をクリアする
     - 「そのまま残して停止する」 — 部分的なコミットを残し、制御をユーザへ返す
4. ユーザがロールバックを選んだら `git reset --mixed <ORIGINAL_HEAD>` を実行し、`git status` と `git log --oneline -n 3` で確認する。`--hard` は決して使わない。

## Step 6. 検証

<!-- boilerplate-only:replace-begin -->
**ここでゲートを回さない。** `AGENTS.md` の *Do not pre-run the gates* は「hook と CI が回す。
**判定は CI が正**」と明言している。コミット後にリポジトリ全体へ `pnpm lint:ci` / `pnpm lint:md` を
掛け直しても判定が真になるわけではなく、負荷の高いホストでは二重実行そのものが、変更と無関係な失敗の
発生源になる。`make load-status` はいまローカルでどのゲートが走る帯かを表示し、その帯は推測ではなく実測で決まる。

**その規約はこのリポジトリだけのもの**で、テンプレートから作ったリポジトリからは剥がされる ——
この節ごと剥がされるのはそのためで、下に退避してある版がゲートの実行を戻す。作った側の
リポジトリは作業ツリーが 1 本で、ゲートの実行は書いてあるとおりの費用しか掛からない。

したがってこのステップがやることは 2 つだけである。

### 手順

1. **この実行が触ったものだけを整形する。**この実行が書いた Markdown に対して
   `pnpm exec markdownlint-cli2 --no-globs --fix <パス>`。`--no-globs` は効力を持つ ——
   付けないと設定の `globs` が引数へ**追加され**、木全体が書き換わる。
2. **どのゲートを CI へ預けたかを報告する。**ここに一覧を焼き込まず `.lefthook.yaml` から読む。

   ```txt
   検証は CI が持ちます。手元では回していません。
     - pre-commit で走るもの: <.lefthook.yaml の pre-commit.commands から列挙>
     - pre-push で走るもの:   <同 pre-push から列挙>
   ```

整形が追跡下のファイルを変えたら差分を提示する。コミットした状態が整形されていなかったということで、
追加のコミットを積むかは user が決める。
<!-- boilerplate-only:replace-with -->
<!-- = 全コミット成功後、検証ゲートを回す。`.lefthook.yaml` の `pre-commit:` に定義された各 -->
<!-- = コマンドと、最後に整形パスとして `pnpm fix`。`lefthook run pre-commit` 自体は呼ばない —— -->
<!-- = staged が空のとき lefthook は登録コマンドをスキップし、このスキルが残すのはまさにその状態。 -->
<!-- = -->
<!-- = ### 手順 -->
<!-- = -->
<!-- = 1. `.lefthook.yaml` を読み直し `pre-commit.commands.*.run` を列挙する。ファイルが無ければ -->
<!-- =    このステップを飛ばす。 -->
<!-- = 2. 各コマンドを順に実行し、終了状態と出力の末尾を控える。 -->
<!-- = 3. 最後に `pnpm fix`。追跡下のファイルが変わったら差分を提示する —— コミットした状態が -->
<!-- =    整形されていなかったということで、追加のコミットを積むかは user が決める。 -->
<!-- = 4. 各コマンドを OK / FAIL で報告する。失敗があればそれを報告して止める。コミットは -->
<!-- =    巻き戻さない —— 失敗は情報であり、どう答えるかは user が決める。 -->
<!-- boilerplate-only:replace-end -->

## Step 7. push 方針と最終リマインド

- **自動 push しない**（`AGENTS.md` の git 規約に従う）。
- Step 6 が終わったらユーザへ報告する:

  ```txt
  N 件のコミットを作成しました。
  検証は CI が持ちます（手元では回していません）。
  プッシュは手動で実行してください: `git push --no-verify`
  ```

  Step 6 の整形が追跡下のファイルを変えたなら、そう述べてファイル名を挙げる —— コミットした状態が
  整形されていなかったということで、追加のコミットを積むかは user が決める。

- 既存 PR ブランチで作業している場合は `AGENTS.md` に従い、push 前に確認する:
  「変更はローカルにコミット済みです。これらの変更をプルリクエストにプッシュしますか？」

## 制約（まとめ）

- ❌ `production` / `develop` / `staging` / `release/*` ブランチへの直接コミット
- ❌ `git push` / `git push --force` / `git reset --hard` / `git checkout --` / `git clean -f` の自動実行
- ❌ `--no-gpg-sign` / `--amend`
- ❌ `git add -A` / `git add .` / `git commit -a`（常にファイルを明示する）
- ❌ 1 コミットへの複数 prefix の混在
- ❌ `--no-verify` 無しのコミット（lefthook が N 回走ってしまう）
- ✅ 日本語のコミットメッセージ
- ✅ メッセージは HEREDOC で渡す
- ✅ `Co-Authored-By` フッタ
- ✅ このコマンドが作る全コミットで `--no-verify`
- ✅ 現在のグループのファイルのみを staging する
- ✅ Step 0 で検査前に `pnpm fix` を 1 回実行する
- ✅ Step 1 で安全なロールバックのため `ORIGINAL_HEAD` を捕捉する
- ✅ Step 1 で現ブランチの PR がマージ済みかを検出し（`gh pr view`）、コミット前に base から新ブランチを切ることを推奨する（`gh` が使えない場合は穏当に縮退する）
- ✅ 失敗時は `AskUserQuestion` で `git reset --mixed <ORIGINAL_HEAD>` を提案する
<!-- boilerplate-only:replace-begin -->
- ✅ Step 6 はこの実行が書いたものだけを整形し、CI へ委ねたゲートを報告する
<!-- boilerplate-only:replace-with -->
<!-- = - ✅ Step 6 は lefthook 定義の各コマンド + `pnpm fix` を直接実行する（`lefthook run pre-commit` は使わない） -->
<!-- boilerplate-only:replace-end -->
- ❌ `lefthook run pre-commit` を呼ばない（冒頭参照）

## チェックリスト

完了を報告する前に確認する:

- [ ] Step 0 で `pnpm fix` が成功した
- [ ] コミット前に `ORIGINAL_HEAD` を捕捉した
- [ ] 保護ブランチ以外でコミットした
- [ ] 現ブランチの PR がマージ済みかを確認し、該当する場合は新ブランチを推奨した（そしてユーザの選択に従った）
- [ ] リポジトリが merge / rebase / cherry-pick の途中でなかった
- [ ] ユーザが分割提案を承認した（`--dry-run` の場合を除く）
- [ ] lefthook のスキップ通知を、動的に読んだコマンド一覧つきでユーザへ表示した
- [ ] 各コミットの prefix が 1 つである
- [ ] 各コミットメッセージが日本語で `Co-Authored-By` フッタを含む
- [ ] 各コミットが `--no-verify` を使い、HEREDOC で渡された
- [ ] `git add` がファイルを明示している（`-A` / `.` を使っていない）
- [ ] 生成物がソース変更と同居している
- [ ] Step 6 がこの実行の書いたものだけを整形し、CI へ委ねたゲートを報告した
- [ ] 検証結果（OK / FAIL / no changes）をユーザへ提示した
- [ ] 自動 push を行っていない
