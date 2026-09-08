# Claude スキル運用方針 (開発系)

本プロジェクトでは、コード / ドキュメントの生成・編集・レビューに付帯する **開発フロー** を Claude Code の **スキル** として `.claude/skills/` 配下に配置する。本 ADR では開発系スキルの配置 / 命名 / 構造 / subagent パターン / カバー範囲を定義する。

運用系スキル (コミット / PR / リリース / 依存監査 等) は [0154-claude-skills-operations.md](0154-claude-skills-operations.md) で別途扱う。

## Status

Accepted

## 採用理由 / 目的

- ドキュメント同期 / 設定編集 / コードレビューの **反復作業** をスキル化し、人間と AI エージェントが同じ手順で再現できるようにする
- 多層 review が必要な作業 (adversarial review 等) を **subagent パターン** で構造化し、単一エージェントの bias を回避する
- スキルが依拠するリポジトリの構造 (config カーネル等) を名指しし、スキルがそれを固定値で持たず実行時に読む境界を定める

## 対象範囲 (開発系の定義)

「開発系」= **コード / ドキュメント / 設定の生成・編集・レビュー** を主目的とするスキル。

具体的には:

- ドキュメント同期 (canonical EN / 翻訳 JA ペア管理 / README の現実合わせ)
- ドキュメント評価 (README が portal-worthy か等)
- 設定編集 (環境変数の e2e 追加等)
- コードレビュー (adversarial / 多視点)

運用系 (Git 操作 / リリース / 依存監査) は 0154 で扱う。

## 配置・命名・frontmatter

配置・命名・frontmatter の規約は **0154 と共通** ([0154-claude-skills-operations.md](0154-claude-skills-operations.md) 参照)。

要約:

- 配置: `.claude/skills/<slug>/SKILL.md` (canonical 英) + `SKILL.ja.md` (翻訳参考)
- 命名: kebab-case 動詞ベース
- frontmatter: `name` / `description` / `argument-hint` (任意) / `allowed-tools` (任意)
- 本文構造: When to Use / Do NOT use / Step 番号付き手順 / 検証

## カバー範囲 (既存スキル)

| Slug | 役割 | カバー範囲 |
| --- | --- | --- |
| `canonicalize-doc` | EN / JA ペア同期 | canonical 英ドキュメントと日本語翻訳の同期 / 新規作成 |
| `sync-readme` | README ↔ ディスク同期 | 単一 README の記述を実ディレクトリ状態に合わせて更新。子ディレクトリの README は digest + 参照リンクのみ |
| `readme-review` | README の portal 価値評価 | 単一 README を `docs/portal/manifest.yaml` 登録基準で採点 |
| `portal-manifest-sync` | portal manifest の監査 | `docs/portal/manifest.yaml` を、実在する README と 2 つの生成スクリプト（`pnpm portal:guides` / `portal:docs`）の双方に突き合わせる。生成側が既に決めている stale と構造警告は再実装せず読み取り、生成側が黙って飲み込む「`Other` へ落ちる登録」と、部品リファレンス README の除外、残る curation 候補の分類を担う。判定基準は持たず `readme-review` を実行時に読む。書き込みは `manifest.yaml` だけで、未登録 README を drift 扱いした自動追加はしない |
| `new-env` | 環境変数の e2e 追加 | 目的別 config モジュール / env ファイル / 変数表 docs を一括で同期 (対象構造は [0030](0030-environment-variable-management.md)、後述) |
| `impl-review` | adversarial code review | 5 観点 (correctness / security / architecture / cohesion / runtime-gap) の subagent fanout + verifier による多段検証。`cohesion` は「1 つの単位が変わる理由を複数持つ」を見る単位内の観点で、カーネル跨ぎの配置を持つ `architecture` とは重ならない。対象は変更そのものだけで、ソースへは書き込まず、指摘は PR へインライン投稿する |
| `scaffold-test` | テストの新規作成 (unit / component) | テストを持たない対象の**集合**について、対象自身の分岐からケースを導き `<subject>.test.ts(x)` を書く。画面 1 枚分の一斉配置を単位とし、`test-requirement` の宣言元ディレクトリごとに確認を取る。規則は焼き込まず [0090](0090-testing-strategy.md) / [0091](0091-test-verification-methods.md) / 最近傍 README の `test-requirement` / 1:1 ゲート自身を実行時に読む。責務はディレクトリではなくシンボルに従い、HTTP 境界を跨ぐものは `scaffold-integration-test` へ残す。対象は read-only で、検証できない分岐は skip せず所見として報告する |
| `scaffold-integration-test` | HTTP 境界の結合テスト作成 | `adapters` のクライアントや Route Handler を、契約から生成された MSW ハンドラで動かすテストを書く。[0090](0090-testing-strategy.md) の「integration = HTTP 境界のみ / 内側は mock / 形と型をアサート」を保ち、ハンドラの手書きと `fetch` stub を禁じる |
| `comment-sweep` | コメント在庫の管轄判定 | 蓄積したコメントを 維持 / 削除 / 書換 / **移設** の 4 判定で裁く。移設は根拠を ADR や層 README へ動かし、コードには効力のある残余と 1 行の参照を残す。read-only のレビュアーが出せない判定であり(移設先の文書を書く必要がある)、判断対象も差分ではなく在庫である。さらにファイル単位のパスが **集約**（重複 / 分散 / 総量過多）を拾う。1 件ずつの管轄判定では各コピーが単独で通ってしまうためで、対象がコメントの集合になる唯一の判定である。適用は 確認して適用 / 自動適用 (`--apply`) / 報告のみ (`--report-only`) の 3 モードで、自動適用は文書書き込みを伴う移設を適用せず、集約は確度 high のときだけ適用する |
| `test-review` | テストの品質レビュー | 5 レンズ (構造準拠 / 観点カバレッジ / 意味的品質 / 分岐×意味 / シンボル網羅) の fanout + verifier。規則は焼き込まず [0090](0090-testing-strategy.md) / [0091](0091-test-verification-methods.md) とカーネル README の `test-requirement` を実行時に読む。報告は read-only だが、意味網羅の穴だけは確認 1 回で塞ぐ (Step 5) |
| `full-verify` | リポ全体の検証 | アーキテクチャ (Pass 1) + 全実装 (Pass 2) の妥当性を検証し、`tmp/reviews/` (architecture.md / mod_*.md /_index.md) に所見 Markdown を生成。read-only (コード変更なし) |
| `full-apply` | full-verify 所見の適用 | `tmp/reviews/` の所見を severity 順 (Critical → Low) に修正適用。設計判断を要する所見は理由付きで defer し、コミット前に `pnpm fix` / lint / build で検証。`full-verify` と対をなす |
| `adr-scan` | ADR 候補の全リポ発見 | de facto に存在するが BACKLOG 未追跡の設計判断を read-only で走査し、taxonomy (decision / exclusion / rule / inventory) と Tier / frame ID へ分類した候補 inventory を出力。暫定の one-off スキルで、BACKLOG へ反映した時点で削除する |
| `new-feature` | 画面 1 枚の e2e 動線 | 画面を「ディレクション → story → レビュー → 分離 → 仕様書 → テスト」の順で通す。順序そのものを含め、規則は焼き込まず [`docs/playbook.md`](../playbook.md) / [`docs/templates/feature-readme.md`](../templates/feature-readme.md) / [`docs/spec/README.md`](../spec/README.md) / カーネル README を実行時に読む。配置・命名・境界は `pnpm gen` に委ね、`docs/spec/**` は**読み込み入力であって生成入力ではない**。story のレビューが返るまでテストを書かない。レビュー 3 本（`impl-review` / `test-review` / `comment-sweep`）は `AGENTS.md` の Review Phase Protocol に従い**呼ばずに user へ渡す**。commit / push はしない |
| `back-prop` | 宣言と実物のずれの検出 | README / スキル / 語彙表が述べていることと、木が実際にやっていることのずれを 4 種（A README→コード / B コード→README の未文書化パターン（該当 3 件以上） / C スキル↔README の重複 / E 業務語彙の家出）で検出する。integrator + read-only の `drift-detector` をカーネルごとに 1 メッセージで並列起動し、承認と書き込みは integrator が単一スレッドで行う。検出基準は `skills/back-prop/prompts/detect-drift.md` が SSOT で、スキル本文も agent 定義も書き直さず読む。書き込みは層 README のみ。スキル本文の変更は `manage-skill` へ、E2（ADR / `docs/rules.md` への漏れ）は報告のみ。`sync-readme`（構造の drift）とは交わらない |
| `glossary` | 語彙表の保守 | `docs/spec/glossary.md` を保守する。目録を決定的に抽出し、機械で決着する 4 種（新出用語 / 孤児 / 解決しない参照 / 二重定義）を分けたまま提示する。**正名を選ばず、2 語を同義と宣言しない** —— 前者はチームがどう話すかの判断、後者は機械的な痕跡を残さない。「使われ方に合わせて行を書き換える」を選択肢として出さない（表が散文の索引に化け、文書が誤っていると言えなくなる）。書くのは語彙表だけで、指し先の文書には触れない |
| `context-map` | 接触点の地図の保守 | `docs/design/context-map.md` を保守する。辺を `src/config/` / `src/adapters/` / `src/app/api/**` / metadata / `src/proxy.ts` から列挙し、辺ごとに 2 軸を記録する。**翻案の有無は `architecture.ts` が機械で決め、境界の所有はコードから出てこない**（相手と交渉できるかは組織的な事実）。所有は証拠つきの候補として提示して人に選ばせ、自分の権限でラベルを書かない。仕組みは主題ごとの design 文書が持ち、地図は指すだけ |
| `context-map-audit` | 地図と実物の突合 | **完全 read-only。**3 種の乖離（接触点はあるが辺が無い / 辺の相手が消えた / 記録された翻案が依存表と食い違う）を報告し、編集しない —— 乖離は「地図が古い」とも「コードが決定から外れた」とも読め、監査にはその 2 つを区別できない。所有は監査しない（突き合わせる相手がコードに無い）。**検査した辺と検査できなかった辺の数を必ず述べる** —— 件数を言わない「乖離なし」は、何も走査しなかった実行と見分けが付かない |
| `verify-spec` | 仕様書と実装の読み合わせ | [0143](0143-spec-driven-development.md) の**内容の突合**を所有する。route ごとに read-only の `spec-validator` を並列起動し、4 種（約束と実装の食い違い / 振り分けの誤り / 上位 layout の書き直し / 書かないものが書かれている）を挙げる。**存在の突合はやり直さない**（ゲートが決着させており、散文で再現すると写像の 2 つめの実装ができる）。**どちらが動くべきかは決めない** —— 向きは 0143 が決めているが、約束が変わったのか実装がずれたのかは読み合わせから見えない。確かめられなかった約束は、確かめられなかったものとして報告する。書き込みは一切しない |
| `scaffold-test` | テストの雛形生成 | 観点の列挙を**書く前に**、read-only の `test-perspective-enumerator` へ群ごとに出す。テストを書くモデルは「何を検査するか」を「どう主張するか」と同時に決めるので、**並ぶのは主張を書きやすいケース**になる。分けても一覧が完全になるわけではないが、**ケースにならなかった観点を声に出して見送る**ことになり、落としたものが見える。最寄りの `test-requirement` README の `## テスト観点` は人が書いた観点であり、実装していないように見えても落とさず人へ渡す（README とコードのどちらが誤りかは、このスキルの判断ではない）|
| `manage-skill` | スキルの作成・更新の単一入口 | 公式 `skill-creator` の方法論をラップし、本 ADR / [0154](0154-claude-skills-operations.md) の配置・命名・frontmatter・本文構造と [0140](0140-documentation-operations.md) の対訳ペアを上乗せする。`.claude/skills/**` への変更はこのスキルを入口とし、`SKILL.md` / `SKILL.ja.md` の直接手編集に先立って通す。公式プラグインの用意は `scripts/bootstrap-plugins` が担う |

新規追加は本 ADR の趣旨 (開発系の定義) に合致する場合のみ。リスト追加は軽微編集とし ADR 改訂は不要。

## subagent パターン

`impl-review` / `full-verify` / `back-prop` / `verify-spec` は **複数の subagent を組み合わせる構造** を持つ。

```text
impl-review (orchestrator)
 ├─ adversarial-reviewer (per lens)   ← .claude/agents/adversarial-reviewer.md
 │   ├─ correctness 観点
 │   ├─ security 観点
 │   ├─ architecture 観点
 │   ├─ cohesion 観点
 │   └─ runtime-gap 観点
 └─ review-verifier                   ← .claude/agents/review-verifier.md
     (各 finding を CONFIRMED / PLAUSIBLE / REFUTED 判定)

full-verify (orchestrator / in-session fast-path)
 ├─ arch-verifier (Pass 1)            ← .claude/agents/arch-verifier.md
 │   (構造の設計妥当性。基準は skills/full-verify/prompts/verify-arch.md が SSOT)
 └─ impl-verifier (Pass 2 / unit 単位で並列 fanout) ← .claude/agents/impl-verifier.md
     (unit ごとの実装品質。基準は skills/full-verify/prompts/verify-impl.md が SSOT)

back-prop (integrator)
 └─ drift-detector (カーネル単位で並列 fanout)   ← .claude/agents/drift-detector.md
     (宣言と実物のずれ。基準は skills/back-prop/prompts/detect-drift.md が SSOT)

verify-spec (integrator)
 └─ spec-validator (route 単位で並列 fanout)     ← .claude/agents/spec-validator.md
     (約束と実装の読み合わせ。基準は skills/verify-spec/prompts/validate-spec.md が SSOT)

scaffold-test (orchestrator)
 └─ test-perspective-enumerator (群単位で並列 fanout) ← .claude/agents/test-perspective-enumerator.md
     (書く前の観点の列挙。読むのは対象と最寄りの test-requirement README と 0090 / 0091)
```

**エージェント定義は 1 つ、起動は複数**である。カーネルごとにエージェントのファイルを置くと、同じロジックを層の数だけ保守することになり、腐るのは写しのほうになる。並列に走らせる根拠は「独立した観点を並行させる」であって、定義を増やすことではない。

このほか、特定スキルへの固定 wiring を持たない **単独起動の read-only レビュー subagent** として `doc-reviewer` (ドキュメント散文の品質) と `comment-reviewer` (コメント内容の品質基準。`comment-sweep` が実行時に基準の出所として読む) が `.claude/agents/` に存在する。下記の subagent 規約 (read-only / sonnet 既定 / モデル分散) に従う。

subagent 自身が read-only である規約は例外を持たない。書き込みを行うスキル (`comment-sweep` / `test-review` の Step 5) がソースを変えられるのは、**オーケストレーター側が適用する**からであって、subagent に編集権限を与えているからではない。

### subagent 規約

- subagent の配置は `.claude/agents/<slug>.md`
- スキルの `SKILL.md` は subagent の責務と起動 model (sonnet 既定 / Opus は限定的) を明記する
- subagent は **read-only on source** を既定とし、レビュー結果のみを返す (code edit は行わない)
- subagent 間でモデル分散 (reviewer ≠ implementer) を意図する場合は、`SKILL.md` でその意図を明示する
- 判定基準を持つ subagent は、基準をスキル配下の `prompts/` の 1 ファイルに置き、agent 定義と `SKILL.md` はそれを参照するだけで再掲しない。同じ検証が in-session と background の 2 経路で走るとき、両方が同じファイルを読むことで所見の質と形式が経路間でずれない。agent 定義が持つのは入力の受け取り方だけである

### subagent を使う判断

- **単一エージェントの bias を回避したい場合** (adversarial review / 多視点判定)
- **並列で独立した観点を走らせたい場合** (per-lens レビュー)
- **個別の review を集約・検証する 2 段構成が欲しい場合** (finder → verifier パターン)

単純な手順実行 (`canonicalize-doc` 等) は subagent を使わず orchestrator 1 本で完結させる。

## ドキュメント系の責務分担

ドキュメント関連 3 件は責務を分けて重複させない:

| スキル | 入力 | 出力 | 用途 |
| --- | --- | --- | --- |
| `portal-manifest-sync` | manifest + 実在 README + 生成スクリプトの出力 | manifest の編集（stale 削除と、名指しされた追加のみ） | portal に何を載せるかのキュレーション |
| `comment-sweep` | 1 ディレクトリのコメント在庫 | 5 判定の適用（コードと移設先の両方を書く。3 適用モード） | 置き場所の誤りと、同じ内容の分散を在庫から抜く |
| `scaffold-test` | テストを持たない対象の集合 | 対象ごとの `<subject>.test.ts(x)` | 1:1 ゲートとカバレッジゲートを満たすテストの新規作成 |
| `scaffold-integration-test` | HTTP 境界を持つ継ぎ目 | `<subject>.contract.test.ts` 1 ファイル | 契約駆動のハンドラで境界を固定する |
| `canonicalize-doc` | EN または JA のドキュメント | 不足側を生成 / 両側の drift を同期 | 1 ドキュメントの 2 言語ペア管理 |
| `sync-readme` | README + そのディレクトリ | 実状に合わせて README を書き換え | README ↔ ディスク drift 解消 |
| `readme-review` | README | 採点レポート (manual-worthy / borderline / 等) | portal 登録判断 |

`sync-readme` 実行後は内部で `canonicalize-doc` を chain する設計になっている。

## `new-env` の対象構造

`new-env` は **[0030](0030-environment-variable-management.md) の config カーネル**を対象とする。すなわち `src/config/` の目的別 config モジュール (`<purpose>.server.ts` / `<purpose>.client.ts` のスキーマ項目 + `#` private フィールド + getter)、検証を通る変数一式を持つ fixture、`env/.env.{local,ci,dev,stg,prd}`、変数表ドキュメントの 4 点を同期する。**fixture を対象に含めるのは、変数一式が型で結ばれているためである** —— 足し忘れると、書いた場所ではなく別ファイルの型検査が落ちる。

スキルは purpose インベントリ・スキーマライブラリ・env ファイル集合を**実行時に実ツリーから検出**し、固定値で持たない。スキーマライブラリは [0030](0030-environment-variable-management.md) の実装が決めるものであり、スキル側でライブラリ名を前提にしない。

**config カーネルが無いツリーでは、スキルは自らガードして停止する**。カーネルの構築 (スキーマ / 検証呼び出し / `env/` の新設) はスキルの仕事ではなく、変数追加の依頼を根拠にスキルがカーネルを新規作成することはない。

## 共通参照

すべての開発系スキルは以下を共通参照する:

- **AGENTS.md の Instruction Priority と Language Rules**: [0152](0152-agents-md-policy.md)
- **ドキュメント運用ポリシー**: [0140](0140-documentation-operations.md) — canonical EN / 翻訳 JA の同期方針
- **`canonicalize-doc` / `sync-readme` / `readme-review` / `portal-manifest-sync` のドメイン分担**: 本 ADR の「ドキュメント系の責務分担」表

## 禁止事項

- ❌ 開発系スキルから商用操作 (push / tag / release) を行うこと (運用系 = 0154 の領域)
- ❌ subagent をモデル分散 (reviewer ≠ implementer) なしで「念のため」増やすこと (コスト見合いに合わない)
- ❌ subagent に code edit 権限を渡すこと (read-only 原則)
- ❌ `new-env` に config カーネル (`src/config/` / スキーマ / 検証呼び出し / `env/`) を新規作成させること
- ❌ ドキュメント系 4 件 (`canonicalize-doc` / `sync-readme` / `readme-review` / `portal-manifest-sync`) の責務を重複させること。とくに **`portal-manifest-sync` に判定基準を持たせないこと** — 基準の単一ソースは `readme-review` であり、複製した瞬間に片方だけが更新される

## 補足

- subagent 設定 (`.claude/agents/`) は本 ADR と対になる。新規 subagent を追加する場合は `SKILL.md` 側の参照も更新する
- スキルの組み合わせ (`sync-readme` → `canonicalize-doc`) は `SKILL.md` 内で chain として明示する
- `impl-review` の lens (correctness / security / architecture / cohesion / runtime-gap) と `test-review` のレンズは追加・削除可能だが、本 ADR の趣旨 (adversarial / 多視点) を逸脱しないこと。**レビュー 3 スキルは対等で、互いを呼ばない** —— テストの所管は `test-review`、コメントの所管は `comment-sweep` にあり、`impl-review` はどちらのレンズも持たない ([AGENTS.md](../../AGENTS.md) Review Phase Protocol)

## 関連 ADR

- [0030-environment-variable-management.md](0030-environment-variable-management.md) — `new-env` が対象とする config カーネルの構造
- [0140-documentation-operations.md](0140-documentation-operations.md) — canonical EN / 翻訳 JA のドキュメント運用ポリシー
- [0150-git-workflow.md](0150-git-workflow.md) — `impl-review` が想定する「commit / PR 前」のタイミング
- [0152-agents-md-policy.md](0152-agents-md-policy.md) — AGENTS.md の Instruction Priority と Modification Scope
- [0154-claude-skills-operations.md](0154-claude-skills-operations.md) — 運用系スキルとの対 (配置・命名・frontmatter は共通)
