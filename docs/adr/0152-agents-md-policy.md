# AGENTS.md 運用方針

本プロジェクトでは、AI コーディングエージェント (Claude Code / Codex / Copilot / Gemini 等) が参照する **規約集約ファイル** として `AGENTS.md` を repo ルートに 1 本配置する。本 ADR では `AGENTS.md` の位置付け / 構成 / 本文言語 / 更新責務を定義する。

## Status

Accepted

## 採用理由 / 目的

- 複数の AI エージェントが共通して読む規約のサーフェイスを **1 本に集約** し、エージェントごとの設定ファイル (`.claude/` / `.cursor/` / `.gemini/` / `.github/copilot-instructions.md` 等) は AGENTS.md を参照する建付けにする
- 確定済み ADR の本文を AGENTS.md に二重化しない (一次情報は `docs/adr/` 配下)
- 未策定領域に対する暫定運用 (どこまでなら勝手にやってよいか) を明示し、ADR が無い領域でも作業が破綻しないようにする
- boilerplate としてテンプレートから作った側が「最初に読むエージェント規約」を辿れる入口を残す

## ファイル配置と参照関係

```text
.
├── AGENTS.md                          ← 規約本体 (本 ADR の対象)
├── CLAUDE.md                          ← `@AGENTS.md` の 1 行のみ (Claude Code が読む)
└── .github/copilot-instructions.md    ← AGENTS.md を参照する補助
```

- **本体**: `AGENTS.md` (repo ルートに 1 本)
- **CLAUDE.md**: 内容は `@AGENTS.md` の 1 行のみ。Claude Code の機能でシンボリック参照する
- **エージェント固有設定** (`.github/copilot-instructions.md` / `.cursor/` / `.gemini/` 等) は AGENTS.md を参照する補助層と位置付け、規約本体を持たない

エージェント固有設定に規約を写す形は採らない。同じ規則を 2 箇所に書くと片方だけが古くなり、ずれた側は「そのエージェントだけが読む規約」として生き残って、ADR と正面から食い違う指示になる。参照に徹する形なら、この種のずれは構造的に起こらない。固有設定に書きたくなった規約は AGENTS.md か ADR へ置く。

## 本文言語

本文は **英語** を既定とする。

ただし以下は **日本語のまま残す**:

- コミット規約のサンプル (件名が日本語であることを示すため)
- PR 確認文言「変更はローカルにコミット済みです。これらの変更をプルリクエストにプッシュしますか？」 (AI エージェントがこの文言で確認することをルール化しているため)
- PR テンプレートのセクション名 (`概要` / `変更内容` / `動作確認方法`、`.github/pull_request_template.md` の実セクションと一致させるため)

### なぜ本体は英語か

`Language Rules` 節で定める「AI 生成出力は日本語」は **AI が生成する成果物** (コード / PR / コメント等) に対するルールであり、**人間が編集する authoritative ドキュメント** には適用しない。AI エージェントの training data は英語が中心で、規約自体の理解精度は英語の方が安定する。

## 構成 (節構造)

以下の節順序で構成する。各節の責務は固定する。

| # | 節 | 責務 |
| --- | --- | --- |
| 1 | Project Overview | リポジトリの役割 / ロール / バックエンド分離前提 |
| 1.5 | Temporary Operating Rules until v1.0.0 | **v1.0.0 未満の期間限定節**。Protected Documentation / AI Modification Scope の一時解除を宣言する。v1.0.0 到達時に削除する([0140](0140-documentation-operations.md) の同名節と対) |
| 2 | Instruction Priority | 指示の優先度 (後述) |
| 2.5 | What to Recommend | **boilerplate 限定節**。推奨 (行為ではなく助言) を何に向けて最適化するかを定める。本文を `boilerplate-only:begin` / `end` で囲み、作った側の初期化で節ごと削除する <!-- boilerplate-only:line --> |
| 3 | Accepted Rules (ADRs) | 確定済み ADR の表で要約。詳細は `docs/adr/` に委譲 |
| 4 | Pending Decisions | 未策定領域の扱い (後述) |
| 5 | AI Modification Scope | 編集可 / 編集禁止 / エージェント設定保護 / Skill 実行時 Exception |
| 6 | Recommended Commands | pnpm / make の主要コマンド |
| 7 | Git Rules | 0150 の要点抜粋 |
| 8 | Language Rules (+ `### Output Language` サブ節) | 可視出力は日本語が既定であること、その対象 |
| 9 | Internal Processing | 内部処理は英語可。最終出力には日本語ルールを適用 |
| 10 | Exception | ユーザが明示的に英語を指示した場合のみ英語可 |
| 11 | Code Style | ADR 0002 を前提とした実行手順 |
| 12 | Review Phase Protocol | 「レビューして」が指す 3 つの subject (`impl-review` / `test-review` / `comment-sweep`) と、実行可否を見積もり付きで問う責務 |
| 12.5 | Purity Sweep | **boilerplate 限定節**。全ファイルを 1 度ずつ通す純化パス(純粋性 / 設計判断の蒸留 / 所有文書への還元)の規則と、台帳・照会フックの在り処を述べる。本文を `boilerplate-only:begin` / `end` で囲む。削除の契機は台帳の完了で、条件と同時に消す対象は [`.agents/README.md`](../../.agents/README.md) が持つ <!-- boilerplate-only:line --> |
| 13 | Protected Documentation | 直接編集禁止ファイルの宣言 |

節の追加・順序変更は ADR 改訂を要する。表 (Accepted Rules) への ADR 追加は軽微編集とし、ADR 改訂は不要。

**小数番号は「いずれ削除される節」の印**である。削除しても 1〜13 の恒久節の番号が動かないことを保証する。削除の契機は節ごとに異なるので上の表に書き、削除時は節ごと消して表の該当行も消す。削除される節は本表に明示されたものだけを認める。

<!-- boilerplate-only:begin -->
### boilerplate 限定の記述

**この template を配る側にしか意味を持たない記述**は `boilerplate-only` マーカーで囲み、作った側の初期化で剥がす。#2.5 がその筆頭だが、対象は AGENTS.md に限らずリポジトリ全体である。

マーカーの形は `sample` 族と同一で、`boilerplate-only:begin` / `:end` / `:line` / `:replace-begin` / `:replace-with` / `:replace-end` を持つ。機構は `scripts/setup/lib/markers.ts` が共有し、剥がしは `make setup-remove-boilerplate-only` が行う。

**族を分けてあるのは、消える契機が違うためである。** サンプルは題材を使うかで選べる任意の破棄だが、boilerplate 限定の記述はテンプレートから作った時点で前提が失効するので選択の余地が無い —— 残せば作った側が自分に効かない規則に従うことになる。同じ族にすると、サンプルを残す作った側が両方を残す。剥がしの道具そのものも、この理由から破棄の道具とは独立に自消滅する。

**剥がしが壊れていないことは CI が恒常的に検証する。** 剥がしは一度きりで自分ごと消える道具なので、対の無いマーカー・他の文書がリンクする見出しを持つ節の消失・古くなった台帳の項目は、誰かが実際にテンプレートから作って剥がすまで誰にも見えない。台帳の隣のユニットテストは剥がしを実行しないため、剥がしたあとの木は見られない。よって CI が使い捨てのチェックアウトで剥がしを実行し、残った木が全ゲートを通ることを PR ごとに確かめる (job の分割は [0153](0153-ci-configuration.md))。

**囲んだ節は、剥がしのあとも残るものから参照しない。** 作った側へ渡るコードや文書がここを指すと、参照先だけが消えて宛先の無いリンクが残る。剥がしの検査（`.github/workflows/strip-verify.yaml`）が見るのはマーカーの語の残留だけで、宛先を失った参照は捕まえない。作った側も読む根拠は、剥がされない側の ADR へ置く。
<!-- boilerplate-only:end -->

## Instruction Priority

AI エージェントは以下の優先度で指示に従う。矛盾時は上位を優先する。

1. **AGENTS.md** — 本ファイル
2. **`docs/adr/*.md`** — 確定済み ADR
3. **`docs/adr/BACKLOG.md`** — 未策定領域の進捗ボード
4. **`.github/copilot-instructions.md`** 等のエージェント固有設定
5. ユーザ指示

## 未策定領域の扱い

ADR 化されていない決定領域は `docs/adr/BACKLOG.md` が追跡し、AGENTS.md はその一覧を持たない。AGENTS.md の `Pending Decisions` 節が持つのは、未策定領域に踏み込んだときの振る舞いだけである:

1. **新しい規約・パターン・ライブラリを独自に持ち込まない**。ADR の判断はユーザへ委ねる
2. 暫定実装が避けられない場合は、着手前に「暫定実装」であることを明示する

ADR が策定されたら、確定済み ADR を `Accepted Rules` 表に追加する。

## BEGIN-END マーカー

本文は以下のマーカーで囲む:

```markdown
<!-- BEGIN:nextjs-agent-rules -->
... AGENTS.md 本文 ...
<!-- END:nextjs-agent-rules -->
```

将来 AGENTS.md に外部生成ブロック (例: ADR 一覧の自動同期) を挟む可能性に備えた境界線。現状は本文全体がマーカー内に入る。

## 更新責務

- AGENTS.md は `Protected Documentation` に列挙され、AI エージェントは直接編集しない。変更案を提示してユーザ承認を得てから編集する(**v1.0.0 未満の間はこの都度承認を解除する** — AGENTS.md #1.5 の期間限定節 / [0140](0140-documentation-operations.md))
- 本 ADR (0152) と AGENTS.md は **構成上の対応関係** を持つ。本 ADR を改訂する場合は AGENTS.md 側も同じ PR で揃える
- `Accepted Rules` 表への ADR 追加は軽微編集として扱う

## 禁止事項

- ❌ AGENTS.md と並列に同等の規約ファイル (CLAUDE-RULES.md / GENERAL-RULES.md 等) を追加すること (規約は AGENTS.md 1 本)
- ❌ 確定済み ADR の本文を AGENTS.md に転載 / 二重化すること (要旨表に留める)
- ❌ AGENTS.md の節順序を独自判断で変えること
- ❌ BEGIN-END マーカーを削除すること
- ❌ エージェント固有設定 (`.github/copilot-instructions.md` 等) に AGENTS.md と矛盾するルールを書くこと

## 補足

- `CLAUDE.md` の `@AGENTS.md` 形式は Claude Code が提供する機能。他エージェントは AGENTS.md を直接読む
- エージェント固有設定と AGENTS.md の内容がずれた場合は AGENTS.md を SSOT とし、固有設定側を AGENTS.md への参照に縮約する

## 関連 ADR

- [0002-formatter-linter.md](0002-formatter-linter.md) — `Code Style` 節が参照する biome 規約
- [0004-library-management.md](0004-library-management.md) — `Recommended Commands` 節が参照する pnpm exact pin ルール
- [0150-git-workflow.md](0150-git-workflow.md) — `Git Rules` 節が参照する Git 運用方針
- [0151-git-hooks.md](0151-git-hooks.md) — `Code Style` / `Recommended Commands` 節が参照する hook 方針
- [0154-claude-skills-operations.md](0154-claude-skills-operations.md) — Skill 実行時 Exception で参照する運用系スキル方針
- [0155-claude-skills-development.md](0155-claude-skills-development.md) — Skill 実行時 Exception で参照する開発系スキル方針
