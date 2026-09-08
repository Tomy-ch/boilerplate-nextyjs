# Claude スキル運用方針 (運用系)

本プロジェクトでは、開発プロセスに付帯する **運用フロー** (コミット分割 / PR 作成 / リリースノート生成 / 依存監査 / メタ inventory 等) を Claude Code の **スキル** として `.claude/skills/` 配下に配置する。本 ADR では運用系スキルの配置 / 命名 / 構造 / カバー範囲を定義する。

開発系スキル (scaffolding / レビュー / ドキュメント同期 等) は [0155-claude-skills-development.md](0155-claude-skills-development.md) で別途扱う。

## Status

Accepted

## 採用理由 / 目的

- 反復する運用作業 (コミット分割 / リリース手順 / 依存監査 等) を **手順スクリプト + ユーザ確認** の形に固定し、人間 / AI エージェント間で同じ手順を再現できるようにする
- 各スキルの `SKILL.md` を **一次情報** とし、運用フローの「何をどの順序でやるか」を 1 ファイルで完結させる
- 商用操作 (push / tag / release / `mise.toml` 書換 等) を伴うスキルは **必ずユーザ確認** を挟む形に統一し、暴走を構造的に防ぐ

## 対象範囲 (運用系の定義)

「運用系」= 開発プロセスを進めるための **オペレーション** を扱うスキル。コード / ドキュメントの生成・編集を主目的としないものを指す。

具体的には:

- Git / GitHub 操作 (commit / PR 作成 / 更新)
- リリース工程 (release notes / tag)
- 依存・ツール監査 (`mise.toml` 更新 / `pnpm audit`)
- `.claude/` 配下のメタ inventory

開発系 (コード / ドキュメントの生成・編集を主目的とするもの) は 0155 で扱う。

## 配置と命名

### 配置

```text
.claude/
└── skills/
    └── <slug>/
        ├── SKILL.md         ← canonical (英語)、Claude Code が読む
        └── SKILL.ja.md      ← 日本語翻訳 (参考用、Claude Code は読まない)
```

- `SKILL.md` は **英語の canonical 版**。Claude Code が読み込んでスキルを実行する
- `SKILL.ja.md` は **人間用の翻訳** で、スキルとしてはロードされない

### 命名規則

- ディレクトリ名 `<slug>` は **kebab-case**、動詞ベース
- ユーザは `/<slug>` で起動する
- 例: `commit` / `submit-pr` / `release-notes` / `tools-upgrade` / `tool-map` / `design-export`

## frontmatter

`SKILL.md` の冒頭に以下の YAML frontmatter を置く。

| キー | 必須 | 用途 |
| --- | --- | --- |
| `name` | ✓ | スキル名 (ディレクトリ名と一致) |
| `description` | ✓ | スキルが何をするかの 1 段落説明。Claude Code の skill picker / トリガ判定に使われる |
| `usage-class` | ✓ | 利用の型。`frequent` / `situational` / `lifecycle` / `automatic` / `safety` のいずれか |
| `argument-hint` | 任意 | 起動引数の形式ヒント (例: `[--dry-run]`) |
| `allowed-tools` | 任意 | 使用許可するツールの明示 (Bash の細粒度許可など) |

`usage-class` は [0160](0160-agent-environment-loop.md) の決定 3 が定める。**判定は呼出回数ではなく型に対して行う** —— 型を持たないスキルは「呼ばれなかった」を根拠に退役させられる側へ落ちる。宣言をスキル自身に持たせるのは、別ファイルの台帳に置くと**スキルが増えた日に台帳だけが古くなる**ためで、機械強制は `scripts/skill-lint` の enum 検査が持つ（[0144](0144-decision-enforcement-pairing.md)）。ツール側が解釈しない追加キーであり、読むのはこのリポジトリの機構だけである。

`description` は **どのような状況で発火すべきか** を含めること (機能の説明ではなく「いつ使うか」)。

## 本文構造

`SKILL.md` の本文は以下の節を持つ。

1. **タイトル** (`# <Skill Name>`) と冒頭 1 段落の概要
2. **(任意) `SKILL.ja.md` への言及** — 翻訳が存在する場合、その旨を明記
3. **When to Use** — 利用すべき状況の列挙
4. **(任意) Contract** — 下記
5. **Do NOT use this skill for** — 利用すべきでない状況・代替手段の列挙
6. **Step <番号>. <タイトル>** — 番号付き手順 (前処理がある場合は Step 0 から始める)
7. **検証 / 終了処理** — `pnpm fix` / `pnpm lint` / テスト等の最終確認

### Contract 表 —— 隣に扉を持つスキルだけが置く

**問いの受け口になるスキル**は、`## Contract` の 2 列表を When to Use の直後に置く。同じ名詞が
複数のスキルの description に現れ、**区別する信号が語彙ではなく意図**になる領域があり、そこでは
「何を所有し、何を決してやらないか」を 4 行で宣言しないと、隣の扉との境界が本文の散文へ溶ける。

| 行 | 何を書くか |
| --- | --- |
| **Owns** | このスキルだけが答える主題 |
| **Never** | 主題に隣接するが、このスキルが決してやらないこと |
| **Starts when** | 起動してよい状況 |
| **Stops when** | 途中でも打ち切る条件 |

**持たせるのは扉だけ。**全スキルへ必須化しない —— 扉を持たないスキル（生成・同期・リリース操作）では
4 行が `description` の Do NOT 節の写しになり、[0140](0140-documentation-operations.md) の
「同じ判定を 2 か所に持たない」に当たる。**扉かどうかは「同じ問いが別のスキルへ行きうるか」**で決める。

## カバー範囲 (既存スキル)

| Slug | 役割 | カバー範囲 |
| --- | --- | --- |
| `commit` | コミット分割と実行 | 作業ツリーの変更を prefix 規約 (Feat/Fix/...) で分割し、`git commit --no-verify` で個別に積む。最後に lefthook 相当の検証を 1 回まとめて回す |
| `submit-pr` | PR 作成・更新 | 現ブランチに既存 PR があれば update、なければ create を自動選択。push 前にベースブランチを取り込む (保護ブランチは checkout も push もしない)。PR 本文は `.github/pull_request_template.md` から生成 |
| `release-notes` | リリースノート生成 | `AskUserQuestion` で FROM タグと NEXT_VERSION を確認し、`.github/release/<NEXT>.md` を生成 |
| `tools-upgrade` | `mise.toml` の依存監査 | upstream の latest と比較し、backend 別の窓（[0110](0110-security-operations.md) 1.1）でサプライチェーン検疫。承認後に `mise.toml` 更新 |
| `node-upgrade` | Node.js バージョン更新 | SSOT である `mise.toml` `[tools] node` ([ADR 0003](0003-version-manager.md)) を対象バージョンへ更新し、lockfile 再構築 + `pnpm install` / `pnpm lint` / `pnpm build` で検証。`@types/node` のメジャー追随は別 PR ([0004](0004-library-management.md)) |
| `actions-pin` | GitHub Actions の SHA ピン監査 | `.github/actions-pin.toml` を SSOT に `uses:` の版を検疫付きで更新する。除外窓より新しいリリースは採らず、窓を通過済みの版へ step-back する。実体は `make actions-pin-{resolve,apply,check}` ([0153](0153-ci-configuration.md)) |
| `repo-truth` | 現状の事実回答 | 「このリポジトリはいまどうなっているか」を一次資料から答え、根拠と推論を分ける。索引を関心で先に読み、キーワード検索は最後の網にする（文書は所有する関心で名付けられるため、統べるファイルは問いの語を含まない）。**未定義**（所有索引を通読した上で無い）と**確認できず**（通読していない）を別の結論として出し、覆った前線を添える。read-only で、見つけた drift は直さない |
| `how-to` | 目標 → 正規手順 | 実行したい操作に対し、前提 / コマンド / 成功判定 / 復旧 / 破壊性を揃えて返す。まず所有スキルへ振って止まり、無ければ make ターゲットと `package.json` の scripts の両方を索引で読む。手順が無ければ **UNDEFINED** と前線を出し、**コマンドを発明しない**。`repo-ops` が症状駆動で「手順が無い」と結論できないのに対し、こちらは目標駆動でそれを結論できる。`--mode=run` でもゲートは回さない |
| `question` | 問いの読みの解決とルーティング | 3 軸（世界 / 意図 / 対象）で問いの読みを解き、**本当に割れた軸だけ**を `AskUserQuestion` で確認して所有スキルへ渡す。自分では答えない。行き先は `.claude/skills/*/SKILL.md` の frontmatter を実行時に読んで解決し、表をハードコードしない。**世界の軸が「この窓の差分」に解けたときは `AGENTS.md` の Review Phase Protocol へ渡す** —— レビュー 1 本へ直接振ると、3 本を対等に問う規律を迂回する |
| `research` | 未決の選択の比較 | 評価軸を**選択肢を挙げる前に**固定し、案 / 利点欠点 / リスク / 既存構造との整合 / コストで比較して、反転条件付きの推奨を出す。案数は合わせない。まず問いを溶かす —— 現行 ADR / BACKLOG の**撤回条件** / `docs/project/out-of-scope.md` / カーネルを列挙して探す同型の前例。コストは述べるが判定に重みとして入れない。採択・ADR 執筆・起票はしない |
| `resolve-merge` | マージの着地 | 衝突パスをクラスへ分け、クラスごとの機械的解決を当てる —— 生成物は片側を選ばず出典から作り直し、pin lockfile は resolver を回し、追記専用のレジストリは和集合にする。**衝突が無くても走る**（派生物は無衝突マージでも古くなる）。ベースの取り込みは `make base-merge` が持つ。終わり方は 2 つだけで、機械的に解けないものが 1 つでも残ればマーカーを残して打ち切りコミットしない、全部解ければコミットと push の可否を聞く。ゲートは回さない |
| `new-issue` | issue の起票 | 前提を実装で裏取りしてから起票する。**5 つの blocker**（観測していない振る舞いの断定 / 鮮度未確認の引用 / 測っていない比較 / 部分的な探索からの影響範囲 / 既存 issue の未検索）が下書きを止める。本文の欄は `.github/ISSUE_TEMPLATE/` を実行時に読んで埋め（`scripts/issue-field-lint` が `###` の完全一致で見る）、そこへ 前提 / 論点 / やらないこと を足す。最後に「そもそも issue か」の関門を通す |
| `supply-chain-triage` | 検疫に掛かった版の証拠採点 | 窓に捕まった 1 つの版について、[0110](0110-security-operations.md) の 4 つの問いを 4 軸 0–12 で採点する。**report-only** —— lockfile も pin も窓も触らない。成果物を読むが決して実行しない。**取れなかった証拠は `?` として報告し `0` に数えない**（`?` が 2 つ以上なら帯を出さず INSUFFICIENT-EVIDENCE）。暴露面はスコアと別の行で報告する。`actions-pin` / `images-pin` / `tools-upgrade` / Dependabot の連鎖先 |
| `repo-ops` | 運用 gotcha のランブック | mise ツールチェーン / pnpm lockfile / make `DRY_RUN` / `tmp/reviews` 等の再発しやすい躓きへの対処手順集。read-only の知識スキルで、状態は変更しない。**症状駆動**であり、答えるのは自分の索引に載っているものだけ —— 載っていない症状は `how-to`（目標。手順の不在を結論できる）か `repo-truth`（現状）へ振る。**このランブックは意図的に不在を結論できない**（できるようにすると沈黙が答えと区別できなくなる） |
| `tool-map` | `.claude/` 配下の inventory | commands / skills / agents の表 + Mermaid 依存マップを生成 |
| `design-export` | デザインシステムの外部書き出し | `pnpm design:bundle` が作る `tmp/design-bundle`（shadcn registry / 目録 / トークン）を、送り先ごとの手順で運ぶ。依存の向きは repo → design の一本で、書き出した先の成果物を取り込む経路は持たない。特定 SaaS の手順は [0010](0010-standards-and-non-lockin.md) の非ロックインによりこのスキルの中だけに閉じる |

新規追加は本 ADR の趣旨 (運用系の定義) に合致する場合のみ。リスト追加は軽微編集とし ADR 改訂は不要。

## 外部スキル (上流の配布物)

上の表は本リポジトリが **著作・保守する** スキルである。上流が配布するスキルはこれと別扱いにする。線は **「著作物か配布物か」** で引く。

| | 自作スキル (`.claude/skills/`) | 外部スキル |
| --- | --- | --- |
| 実体の置き場 | リポジトリ内 (project スコープ) | `~/.claude/skills/` (user スコープ) |
| 配布 | 信頼済み clone で届く | マシンごとに導入が要る |
| 対訳ペア | 必須 ([0140](0140-documentation-operations.md)) | 作らない |
| `manage-skill` / `skill-lint` | 対象 | 対象外 |
| 更新経路 | 直接編集 | `mise.toml` の pin bump ([0110](0110-security-operations.md) 1.1 の検疫) |

したがって**外部スキルの `SKILL.md` をリポジトリへ持ち込まない**。40KB 級のサードパーティ本文を vendoring すると、対訳ペアの要求と SSOT の二重化が同時に発生し、上流の更新のたびに両方が腐る。

リポジトリが持つのは次の 4 点だけである。

1. `mise.toml` の pin (版の SSOT)
2. 導入スクリプト `scripts/bootstrap-external-skills`
3. `.claude/settings.json` の権限境界
4. 除外設定 — 出力を他ツールの走査から外す側 (`.gitignore` と md lint 3 種) と、ツールの解析対象を絞る側 (`.graphifyignore`) の両方向

### 権限境界はパターンで書く

外部スキルを配布するツールは、スキルを置く命令とは別に、**リポジトリ内のファイルを書き換える命令**を持ちうる。graphify の場合、書き換え先は `CLAUDE.md` / `AGENTS.md` / `.cursor/` / `.gemini/` / git hook — いずれも AGENTS.md が保護対象と定めるファイルである。

**「どのサブコマンドが user スコープか」で線を引かない。** graphify には `<name> install` という系統と `install --platform <name>` という系統があり、後者だけが user スコープに見える。実際は違う: `--project` フラグは後者を project スコープへ倒し、`--platform cursor` / `--platform gemini` はフラグ無しでもカレントディレクトリを書く。系統の名前で安全側を選り分けようとすると、この種の例外を 1 つ見落とすたびに穴が開く。**導入はスクリプト経由に一本化し、エージェントには `install` 系統を丸ごと禁じる。**

これを `deny` に載せるのは、散文の禁止だけでは足りないためである。エージェントは `--help` を読んで自分で到達しうるし、そのとき参照するのは ADR ではなく CLI のヘルプになる。

**列挙ではなくパターンで書く。** 上流はプラットフォーム対応を継続的に足しており、名前を並べた deny は次の pin bump で黙って穴が開く。塞ぐべきは「そのとき存在した名前」ではなく「install という形」である。

ただし deny が塞ぐのは正面の経路だけである。後述「外向き操作の統制をどこに置くか」のとおり、パターンは前方一致のグロブで、同じ実行は汎用インタプリタからも絶対パスからも起こせる。deny は取り違えと自走を止める第一段であって、統制の全体ではない。

### 前提にしない

外部スキルは **lint / CI / git hook / build のいずれのゲートにも接続しない**。導入しなくても何も壊れない状態を保つ。上流が pre-1.0 でも採れるのはこの構成が理由であり、逆に言えばゲートへ繋いだ時点でその根拠は失われる ([0110](0110-security-operations.md))。

繋げない理由はもう 1 つある。外部スキルの出力 (graphify ならグラフ) は最後に走らせた時点のスナップショットで、未コミットの変更を映さない。ゲートへ載せれば「古い出力で緑」が成立し、検査していないものを合格へ倒す ([0157](0157-inspection-declaration-discipline.md))。繋ぐ判断が起きるとすれば、本リポジトリでの価値が実測で確かめられ、かつ鮮度をゲートの中で保証する機構が入ったときだけで、導入済みであることも上流が pre-1.0 を抜けたことも理由にならない —— 成熟度が上がっても鮮度の問題は消えない。

現在の外部スキルは graphify (コードベース知識グラフ) 1 件。導入手順と運用上の注意は [`.claude/README.md`](../../.claude/README.md) が持つ。

## 商用操作前のユーザ確認

以下の操作を含むスキルは **実行前にユーザ確認を必須** とする:

- `git push` / `gh pr create` / `gh pr edit` (`submit-pr`)
- `git tag` / `gh release create` (`release-notes` の後続)
- `mise.toml` の書き換え (`tools-upgrade`)
- `git reset --hard` 系の破壊的操作

確認には `AskUserQuestion` または AGENTS.md `Git Rules > Critical Rules` が定める確認文言 (`変更はローカルにコミット済みです。これらの変更をプルリクエストにプッシュしますか？`) を用いる。

### 外向き操作の統制をどこに置くか

**統制はスキル本文の確認に置き、`permissions` のパターン規則には置かない。**

`permissions` は `deny` → `ask` → `allow` の順に評価され、[deny は allowlist 例外を持てない](https://code.claude.com/docs/en/permissions)。したがって「`gh api` は原則禁止、レビュー投稿だけ許可」という形は表現できず、コマンド名で線を引く限り「全部塞いで機能を殺す」か「開ける」かの二択になる。

加えてパターンは前方一致のグロブであり、同じ HTTP 呼び出しは `python3` や `pnpm exec tsx` からも送れる。汎用インタプリタを許可したまま特定コマンドを塞いでも、防げるのは素直な経路だけで、統制としては成立しない。

そこで `permissions.deny` に残すのは **コミット済みの作業を失い、取り戻す手段が無い操作** に限る。`gh api` について具体的には `DELETE` を含む呼び出しと ref 操作 (`git/refs`。その `force` 更新は API 側の force push にあたり、[0150](0150-git-workflow.md) の force push 禁止を素通りする経路になる)。それ以外の外向き書き込みは、実行前の 1 度の確認で担保する。

この帰結として、**スキルは「コマンドが許可されているから」を理由に確認を省いてはならない**。許可は「機械が止めない」ことしか意味せず、止めるのは人間の判断である。

## `AskUserQuestion` の利用

スキル内で **確認が必要な入力** (FROM タグ / バージョン番号 / 検疫日数 / 出力形式等) は `AskUserQuestion` ツールで明示的に確認する。

- 引数 / 直近メッセージの値を **暗黙に採用しない**
- 確認は実行直前に行い、ドリフトを避ける

## 共通参照

すべての運用系スキルは以下を共通参照する:

- **Git 規約**: [0150](0150-git-workflow.md) — ブランチ・コミット・PR の規約
- **hook 方針**: [0151](0151-git-hooks.md) — `--no-verify` を用いる場合の例外運用と最終検証
- **mise.toml の SSOT**: [ADR 0003](0003-version-manager.md) — `tools-upgrade` が監査対象とする
- **ライブラリ運用**: [0004](0004-library-management.md) — 依存更新時の exact pin / メジャー更新分離の原則
- **AGENTS.md の Instruction Priority と Language Rules**: [0152](0152-agents-md-policy.md)

## 禁止事項

- ❌ 運用系スキルから業務ロジックを直接編集すること (コード編集は開発系 = 0155 の領域)
- ❌ `SKILL.md` の frontmatter `description` を「機能説明」のみで書くこと (発火条件を含めること)
- ❌ 商用操作 (push / tag / release) を確認なしで実行すること
- ❌ `SKILL.md` を翻訳ファイル (`SKILL.ja.md`) で上書きすること (canonical は英)
- ❌ skill 名 / ディレクトリ名に空白・大文字・日本語を含めること

## 補足

- スキルは Claude Code 専用。Codex / Cursor 等の他エージェントへは展開していない
- スキルの粒度は「1 起動 = 1 オペレーション」を原則とする。複数オペレーションを束ねたい場合は別スキルとして分けるか、メタスキルから個別スキルを呼ぶ形にする
- スキル数の上限は設けないが、似た役割の重複は避ける

## 関連 ADR

- [0003-version-manager.md](0003-version-manager.md) — `tools-upgrade` が監査対象とする `mise.toml`
- [0004-library-management.md](0004-library-management.md) — 依存更新時の規約
- [0150-git-workflow.md](0150-git-workflow.md) — `commit` / `submit-pr` の Git 規約
- [0151-git-hooks.md](0151-git-hooks.md) — `commit` が回避する lefthook の取り扱い
- [0152-agents-md-policy.md](0152-agents-md-policy.md) — AGENTS.md と本 ADR の関係
- [0155-claude-skills-development.md](0155-claude-skills-development.md) — 開発系スキル方針 (本 ADR と対をなす)
