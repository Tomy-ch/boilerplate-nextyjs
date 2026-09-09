---
name: back-prop
usage-class: situational
description: >-
  Integrator for drift detection between what the documents declare and what the tree actually does. Confirms scope (changed files / whole repository / one kernel) and detection categories once via `AskUserQuestion`, resolves the per-kernel file list, then fans out the read-only `drift-detector` agent IN PARALLEL — one invocation per in-scope kernel, all in a single message — passing the resolved files so no detector re-resolves git. Detectors are strictly read-only and only surface findings: (A) a README states something the code no longer does, (B) the code repeats a pattern at three or more sites the README never documents, (C) a skill's body restates a rule a README already owns, (E) business vocabulary has leaked out of `docs/spec/` into a layer README or into an ADR. The integrator then runs the per-item approval loop itself, single-threaded, and performs the README writes after explicit confirmation; skill-body changes are handed to `manage-skill`, and implementation code is never written. Use it after a multi-kernel change, before a release, or as a periodic hygiene sweep — 「README とコードがずれていないか見て」「この規約どこにも書いてないよね？」. Detection criteria are single-sourced in `prompts/detect-drift.md`, which both this skill and the detector read at runtime. Do NOT use it for README ↔ disk structural drift (`sync-readme`), for judging a README's portal-worthiness (`readme-review`), for reviewing a diff (`impl-review` / `test-review` / `comment-sweep`), or to fix implementation code.
---

# Back Prop

Integrator for drift detection across the kernels. Fans out read-only detectors in parallel,
aggregates, then drives the per-item approval and write loop itself.

A Japanese reference translation lives at `SKILL.ja.md` in this directory (for human reference only;
not loaded as a skill).

## When to Use

- After a change that touched several kernels, before a pull request review.
- A periodic hygiene sweep — an undocumented convention, a skill that has grown a copy of a rule, a
  README that describes something that moved.
- When introducing a repository-wide convention, to see where it is already followed and where it is
  not.

To check a single kernel, run this integrator and pick that kernel in the scope question.

## Contract

| | |
| --- | --- |
| **Owns** | 宣言（README / スキル / 語彙表）と実物のずれの検出、per-item の承認、README への書き込み |
| **Never** | 実装コードの書き換え / ADR 本文・`docs/rules.md` の書き換え / 承認なしの書き込み / detector に書かせること |
| **Starts when** | 複数カーネルを触った後、あるいは定期の掃き取り |
| **Stops when** | 全 finding の承認 / 棄却が終わったとき。user はいつでも打ち切れる |

## Do NOT use this skill for

- **README ↔ ディスクの構造 drift** — `sync-readme`. **The two do not overlap**: that one asks
  whether the README's file and directory listing matches what is on disk; this one asks whether the
  README's *statements* still describe what the code does. Neither is a subset of the other, and the
  only place they meet is an inventory section.
- **A README's portal-worthiness** — `readme-review`.
- **Reviewing a diff** — `impl-review` / `test-review` / `comment-sweep`.
- **Fixing implementation code.** Findings are surfaced; the fix is the user's.

## Architecture: parallel detectors, integrator-side approval

Detection is delegated to the read-only [`drift-detector`](../../agents/drift-detector.md) agent,
invoked **once per in-scope kernel**, all in one message so they run concurrently. One agent
definition, many invocations — a per-kernel agent file each would be the same logic maintained in
eleven places, and the copy is what rots.

**The detectors are strictly read-only**: they surface findings with reasoning and candidate options,
and they never call `AskUserQuestion` and never write. The approval and write loop runs **here**,
single-threaded after aggregation, which is what lets the detectors fan out with zero write
contention.

**The detection criteria are single-sourced** in [`prompts/detect-drift.md`](prompts/detect-drift.md).
This skill does not restate them, and neither does the agent definition — both read that file. What
follows is the orchestration only.

## Step 0 — Confirm scope and categories (one `AskUserQuestion`)

Two batched questions, defaults auto-detected from the diff.

1. 「back-prop のスコープを選んでください」
   - 「変更ファイルのみ（ベースとの diff。触れたカーネルだけ fan-out）」
   - 「リポジトリ全体（全カーネルを fan-out）」
   - 「特定のカーネルのみ（続けて指定）」
   - 「キャンセル」

2. 「検出する drift の種別を選んでください（複数選択、既定は全部）」
   - 「(A) README → コード」 / 「(B) コード → README の未文書化パターン」 /
     「(C) スキル ↔ README の重複」 / 「(E) 業務語彙が家を出ていないか」

**(C) and (E) do not depend on source files**, so they are worth selecting even when the diff touches
no code — a prose-only change is exactly the case that lets a skill's copy of a rule drift, and the
one that lets a business term settle into a README.

## Step 1 — Resolve the kernels and their file lists

For "changed files" mode:

```sh
BASE=$(gh pr view --json baseRefName -q '.baseRefName' 2>/dev/null || make -s base-branch)
test -n "$BASE" || { echo "ベースブランチを解決できませんでした"; exit 1; }
git diff --name-only "origin/${BASE}...HEAD"
```

**An existing pull request's `baseRefName` stays the authority** — the drift you report has to sit in
the diff the PR shows. With no PR, `make base-branch` resolves the latest release line from `origin`'s
live state. `gh repo view --json defaultBranchRef` is not the fallback: the GitHub default branch
keeps answering with an earlier release line.

**Stop on an unresolved base rather than continuing.** An empty file list fans out zero detectors and
reports no drift, **which reads exactly like a clean run**.

Map the changed files to kernels by their path under `src/`, and **read the kernel list from
[`architecture.ts`](../../../architecture.ts) rather than carrying one here** — a list in this file
would be wrong the first time a kernel lands. Keep the per-kernel file list; you pass it to each
detector so it does not re-resolve git.

When (C) or (E) is selected, additionally resolve the prose corpus — the layer `README.md` files,
`docs/adr/*.md`, `docs/rules.md`, and for (C) the `SKILL.md` bodies — and intersect it with the diff
in changed-files mode. Add one `docs`-scoped detector invocation whenever that intersection is
non-empty, or always in full-repository scope.

No source changes **and** no prose changes in changed-files mode → exit cleanly, saying so.

## Step 2 — Fan out the detectors in parallel

For each kernel in scope, spawn `drift-detector` with the **Agent tool**, all in **a single message
with multiple tool calls** so they run concurrently. Pass each one:

- `layer` — the kernel name, or `docs` for the prose-only invocation
- `files` — the pre-resolved file list from Step 1
- `categories` — the selected subset
- `baseRef` — the base branch

Each detector's final message **is** its findings. Collect them with their kernel label.

> If the agent cannot be spawned in the current environment, follow `prompts/detect-drift.md` inline
> instead — the integrator still runs the approval and write loop single-threaded afterwards.

## Step 3 — Aggregate (read-only checkpoint)

Combine the findings into one Japanese summary grouped by kernel and category, so the user sees the
whole surface before any decision:

```text
back-prop drift 検出結果（scope: <X>, 種別: <選択された種別>）

[<kernel>]  A <n> / B <m> / C <k> / E1 <p> / E2 <q>
  ...（各 finding: 該当・正本・理由・選択肢・確度）

総 finding: <sum>。これから 1 件ずつ承認 / 棄却を確認します。
```

When every detector came back clean, say which kernels were checked. **A clean report that does not
name its scope is indistinguishable from a run that fanned out nothing.**

## Step 4 — Per-item approval and write (single-threaded)

For each finding, **the integrator** drives the decision:

1. `AskUserQuestion` with the candidate options the detector surfaced (コード修正 / README 更新 /
   規則の緩和 / スキルの簡略化 / 無視).
2. On an approved **README** change: state the reasoning, show the draft as a before / after, and
   write after final confirmation.
3. On an approved **skill** change: **hand it to `manage-skill`** rather than editing the body here.
   That skill is the single entry point for `.claude/skills/**`, and it is what keeps the canonical
   and the translation 1:1 — an edit made here would leave `SKILL.ja.md` behind.
4. On a **code fix**: surface it as the user's task. This skill never writes implementation code.
5. Loop over all findings; the user may abort partway.

**Write scope is exactly**: the layer `README.md` files. Everything else is a hand-off or a report.

**E2 findings are never put to approval at all.** They sit in an ADR or `docs/rules.md` — a decision
record and the governing document. Rewriting one to satisfy a detector inverts who decides. Surface
them in the report and leave them there. Nor may an E finding be "resolved" by editing
`docs/spec/glossary.md`: the vocabulary is `glossary`'s to maintain, and deleting a term to silence a
finding destroys the definition rather than moving it.

After writing, format only what this run wrote:

```bash
pnpm exec markdownlint-cli2 --no-globs --fix <paths you wrote>
```

`--no-globs` is load-bearing — without it the configured `globs` are *added* to your arguments and
the whole tree is rewritten. Leave `pnpm lint:md` to the hooks and CI.

## Step 5 — Closing report (Japanese)

```text
back-prop 完了（scope: <X>, 種別: <選択された種別>）

[<kernel>]  finding <N>, README 更新 <X>, manage-skill へ委譲 <Y>, コード修正委任 <Z>, 無視 <W>

総 finding: <sum>, README 書き込み: <sum>, コード修正委任: <sum>, 報告のみ（E2）: <sum>
```

State plainly what was **not** covered — a kernel left out of scope, a category not selected, a
detector that could not run. An unstated omission reads as 「そこは綺麗だった」.

## AI Modification Scope

Invoking this skill is the explicit instruction that relaxes `AGENTS.md`'s modification scope, and it
relaxes it **only** to the layer `README.md` files, and only for the duration of this run.

These stay protected even during execution: `AGENTS.md`, `LICENSE`, ADR bodies, `docs/rules.md`,
`docs/spec/**`, implementation code, generated files, and anything under `.claude/settings.json`'s
`permissions.deny`. The detectors write nothing at all.

## Do / Do NOT

- ✅ Confirm scope and categories once, before anything is read.
- ✅ Resolve the base the way `commit` and `submit-pr` do; stop when it cannot be resolved.
- ✅ Read the kernel list from `architecture.ts` at runtime.
- ✅ Fan the detectors out in one message so they run concurrently.
- ✅ Pass the resolved file list so no detector re-resolves git.
- ✅ Show the aggregate before any decision.
- ✅ State the reasoning and show a before / after draft before each write.
- ✅ Hand skill-body changes to `manage-skill`.
- ✅ Name the kernels checked, even — especially — on a clean run.
- ✅ Report in Japanese.
- ❌ Spawn the detectors one at a time.
- ❌ Let a detector write, or call `AskUserQuestion`.
- ❌ Write implementation code, an ADR body, `docs/rules.md`, or `docs/spec/**`.
- ❌ Put an E2 finding to approval, or silence an E finding by editing the glossary.
- ❌ Surface a (B) pattern with fewer than three sites.
- ❌ Restate the detection criteria here instead of pointing at `prompts/detect-drift.md`.
- ❌ Run `pnpm lint:md` or any other gate.
- ❌ Commit or push.

## Checklist

- [ ] Scope and categories confirmed in one `AskUserQuestion`.
- [ ] Base resolved via `baseRefName` / `make base-branch`; run stopped if it could not be.
- [ ] Kernel list read from `architecture.ts`; per-kernel file lists resolved.
- [ ] Detectors fanned out in a single message, each with `layer` / `files` / `categories` / `baseRef`.
- [ ] Prose corpus resolved and a `docs`-scoped detector added when (C) or (E) was selected.
- [ ] Aggregate summary printed before any decision; empty categories stated as empty.
- [ ] Per-item approval with reasoning and a before / after draft.
- [ ] Writes limited to layer `README.md`; skill changes handed to `manage-skill`.
- [ ] E2 findings reported only, never approved; glossary never edited to silence one.
- [ ] Only the written files formatted; no gate run.
- [ ] Closing report names what was not covered.
- [ ] Nothing committed, nothing pushed.
