---
name: impl-issue
usage-class: frequent
description: >-
  Drive a GitHub issue from environment setup to a merged PR as a semi-automatic pipeline whose stopping points are enumerated rather than judged. Use whenever the user hands over an issue URL or number to be worked end-to-end (「この issue やって」「wt 上で対応して」「着手して PR まで」「#123 お願い」), or asks to resume such a run. It owns three things — progress orchestration, reconciling the approved plan against what was actually built, and mechanically detecting the moments needing a human call — and no implementation judgment: the work is delegated to `commit` / `submit-pr` / `resolve-merge` and to the three peer review skills `impl-review` / `test-review` / `comment-sweep`, and a screen-shaped issue is handed to `new-feature` rather than reimplemented here. It sets up an isolated worktree, builds a written plan in three stages whose necessity derives from one invariant — the plan is seen by a model that is not the implementer's — and holds it for approval before coding, then watches five mechanical trip-wires so drift becomes visible instead of silent. The plan's approval covers the whole run, and the skill carries a closed list of the five places it may stop. A scope mode settled up front decides whether the run ends at a merge, at the PR (the 「pr作って」 shape), or at a local commit, and whatever an earlier ending leaves undone is named rather than left silent. Every call it records is appended to a run record file as it happens, so a long run outliving its own context still produces a complete closing comment and can be resumed. Before merging it harvests the general form of what was fixed into the documents that survive a sample purge, because the fix itself lives only in code that may be discarded. Do NOT use it for a change with no issue behind it (`commit` + `submit-pr`), for reviewing an existing diff (`impl-review` / `test-review` / `comment-sweep`), or for authoring skills (`manage-skill`).
argument-hint: '<issue-url-or-number> [--scope=merge|pr|commit] [--review-mode=all|harmful|issues] [--issue-mode=fix-here|search|file] [--flow=record-on-tripwire|halt-on-tripwire] [--derive=ask|derive] [--plan=full|draft-review|single]'
---

# Impl Issue

Semi-automatic issue → PR pipeline. The machine handles progression, bookkeeping, and detection; the
human keeps every judgment call. A long autonomous run stops being a black box because each departure
from the approved plan surfaces when it happens rather than at the end.

The commands live here so a run is reproducible from this file alone. Detail that drives itself stays
behind pointers: [`.makefiles/README.md`](../../../.makefiles/README.md) (target registry),
[`docs/playbook.md`](../../../docs/playbook.md) (where things go, and the screen order),
[`docs/rules.md`](../../../docs/rules.md) (the implementation rules), and `AGENTS.md`'s
*Where You May Stop*.

A Japanese reference translation lives at `SKILL.ja.md` in this directory (for human reference only;
not loaded as a skill).

## When to Use

- The user hands over an issue URL / number and wants it taken to a merged PR.
- The user asks to resume a run that stopped at a decision point.

## Do NOT use this skill for

- **A change with no issue behind it** — `commit` then `submit-pr` directly.
- **Reviewing an existing diff** — `impl-review` / `test-review` / `comment-sweep`, which are peers
  under `AGENTS.md`'s Review Phase Protocol and are asked for in their own right.
- **Authoring a skill** — `manage-skill`.
- **Filing the issue in the first place** — `new-issue`. This skill starts from one that exists.

## Contract

| | |
| --- | --- |
| **Owns** | issue → merged PR の進行、承認済み計画と実物の突き合わせ、人間判断が要る瞬間の機械的検出 |
| **Never** | 未決の設計を独自に補完する / 実装判断そのもの（委譲先が持つ） |
| **Starts when** | 採択済みの issue が提示されたとき |
| **Stops when** | 下表の 5 箇所だけ。それ以外では停止せず、判断は run record と PR へ記録する |

## Stopping — the complete list

Where this pipeline stops is a specification, not a judgment. It stops here and nowhere else:

| # | Where | What is decided |
| --- | --- | --- |
| 1 | Step 0 | The six modes, in two back-to-back calls, before anything else |
| 2 | Step 3 | Approval of the written plan |
| 3 | Step 4 | A trip-wire whose row says halt |
| 4 | Step 7 | Which of the three peer review skills to run, each with its estimated return |
| 5 | Step 8 | Runtime verification failed; and the merge itself |

`AGENTS.md`'s *Where You May Stop* still governs above this list — its stopping points and trip wires
are not overridden here, and the rows above are where **this pipeline** additionally waits.

Three moments look like stopping points and are not. Each is where an unlisted stop otherwise creeps in:

- **A phase boundary.** The Step 3 approval covers Steps 4–9, because the plan enumerates the whole
  run and that is what was approved. A phase ending is not an event — and neither is a seam.
- **A subagent's completion notification.** Reviews and audits fan out; a report arriving is where
  work resumes, not where it pauses.
- **A mode settled in Step 0.** That is spent authority. Re-confirming a fix which review mode already
  authorized asks the user to approve the same thing twice.

Asked one at a time, a stop always looks cheap while its cost is diffuse, so "ask" wins every
individual judgment. That is why the list above is closed rather than advisory.

## What this skill does NOT do

It holds no implementation judgment. It never decides which design to adopt, whether a reviewer is
right, or whether a finding deserves an issue. It routes those to the user and records the answer.

| Work | Owner |
| --- | --- |
| Commit splitting and execution | `commit` |
| Push + PR create/update | `submit-pr` |
| Taking the base in, and any conflict | `resolve-merge` |
| A new screen or feature slice | `new-feature` — hand the whole implementation phase to it |
| Review of the change itself | `impl-review` |
| Review of the tests | `test-review` |
| Review of the comment stock | `comment-sweep` |
| The implementation itself | you, following the approved plan |

## AI Modification Scope

`AGENTS.md` confines AI edits to `src/` / `public/` / `docs/adr/BACKLOG.md` by default. Below v1.0.0
its *Temporary Operating Rules* already lift the protected-path list; what remains is that an issue
about CI, tooling, or documentation reaches surfaces the default scope never names. **Invoking this
skill is the explicit user instruction that relaxes the remainder**, because this skill is
issue-generic: the issue decides the surface.

The relaxation is bounded, and the bound is the plan:

- The Step 3 plan's **Files to touch** section is the permitted surface. A path outside `src/` must
  appear there **before** it is edited, named explicitly rather than implied by a glob.
- Say so when presenting the plan, so the user approves those paths knowingly rather than discovering
  them in the diff.
- Reaching a path the plan does not list halts under either flow mode (trip-wire 1′, Step 4).

Hard-protected even during this skill, whatever the issue asks:

- `AGENTS.md` / `CLAUDE.md` / `LICENSE`
- Anything under `permissions.deny` in `.claude/settings.json`
- Generated artifacts — `**/gen/**` and anything carrying a generated banner. Regenerating through
  its generator is fine; hand-editing is not (`AGENTS.md`, trip wire 3)
- `baseline/images` — the gitlink moves only through the retake path (`docs/design/vrt.md`)

## Step 0 — Confirm the six modes (two consecutive `AskUserQuestion` calls)

Ask before anything else, in two back-to-back calls: **where the run ends and what it does with
findings**, then **what it may decide on its own and what planning costs**. Two calls rather than one
because a single call caps at four questions — when a seventh mode is added, split again rather than
dropping one. **This is still one stopping point.** The user answers both without the run doing
anything in between.

Defaults are marked; the user's choice always wins.

### First call — where the run ends, and what it does with findings

**Scope mode** — how far this run goes. Ask it first: it bounds every mode below it, and a run that
ends at the PR never reaches the steps the others govern.

| Mode | Ends at | What is never reached |
| --- | --- | --- |
| `merge` *(default)* | Step 9 — merged, handed over, issue closed | — |
| `pr` | Step 8, at the PR. CI is left running | Harvest, runtime verification, merge, close |
| `commit` | Step 5, with the work committed locally | Everything from the push onward |

**A trigger phrase can set this, and 「pr作って」 sets it to `pr`.** When the user handed the work over
in words that already name an endpoint, that **is** the answer and the option is confirmed rather than
asked open.

**Say what each ending leaves undone, in the closing report.** A run that stops at `pr` has not
verified the request path and has not harvested anything, and neither absence is visible from the PR.
Under `pr`, **name the harvest as outstanding in the PR body** — Step 8 places it after CI goes green
precisely because that is the last moment it can happen, and a scope that ends earlier moves the debt
onto whoever merges rather than cancelling it.

**Review mode** — what happens to a review finding.

| Mode | Confirmed finding | Everything else |
| --- | --- | --- |
| `all` | Apply, even if the change is large | — |
| `harmful` *(default)* | Apply only what is clearly harmful within the change's scope | Route to issue mode |
| `issues` | Apply nothing | Route to issue mode |

**Issue mode** — what happens to a finding that falls outside the change.

| Mode | Behavior |
| --- | --- |
| `fix-here` *(default)* | Fix it in this run. `docs/rules.md`, *作業とエージェント* makes this the repository's default: 範囲外であることは起票の理由にならない |
| `search` | Search existing issues first; on a duplicate, comment there instead of filing |
| `file` | File without searching |

**`fix-here` is the default because the alternative compounds.** One run that files three findings
produces three unfinished pieces of work, and the person who picks each up rebuilds the reproduction
from scratch. Filing is right only for what needs **another decision or another agreement** — a new
ADR, adopting a mechanism, work in another repository. `issues` × `file` produces the most new issues
of any combination; before executing it, show the count and confirm.

**Flow mode** — what a trip-wire does.

| Mode | Behavior |
| --- | --- |
| `record-on-tripwire` *(default)* | Record the call and continue; surface every recorded call in one PR comment at the end |
| `halt-on-tripwire` | Stop at that trip-wire and ask |

**Neither mode reaches the trip-wires marked halt in Step 4.** Those are the decisions `AGENTS.md`
keeps behind a human gate unconditionally.

### Second call — what the run may decide, and what planning costs

**Derive mode** — what happens to a design question the plan did not settle.

| Mode | Behavior |
| --- | --- |
| `ask` *(default)* | Surface it and wait. The run stops on the question |
| `derive` | Read the ADRs, `docs/rules.md`, and the layer READMEs first; for what they leave open, decide from the de-facto standard (RFC / specification / the platform's own definition) and record the derivation |

**`derive` does not authorize preference.** `AGENTS.md`, *What to Recommend* names exactly two
authorities — a de-facto standard, and the shape this repository's architecture derives — and this
mode delegates only those. A question that neither answers is not derivable, and it goes back to the
user however the mode is set. Every derivation is written to the run record with the clause it rested
on, so a reader can disagree without repeating the work.

The mode exists because `docs/rules.md` already forbids the opposite failure: **導出で決まる判断を、
保留として issue へ逃がさない.** `ask` is the safe default, and `derive` is what the user picks when
they will not be present to answer.

**Plan mode** — how much the planning phase spends. Step 3 has three stages; this decides which of
them run. **Every mode satisfies Step 3's invariant** (the plan is seen by a model that is not the
implementer's).

| Mode | Stages | Cost |
| --- | --- | --- |
| `full` *(default)* | 3a + 3b + 3c | Three passes — the drafter's, plus two more on a top tier |
| `draft-review` | 3b + 3c | Two passes; the framing stage is skipped |
| `single` | 3b only, drafted by a model that is not the implementer's | One pass |

**Say what the mode costs when you ask, not just what it does.** A one-line documentation fix and a
cross-layer feature do not deserve the same planning budget, and the user is the only one who knows
which this is before Step 3 has read anything. Recommend `full` when the issue spans layers, changes
a contract, or names a design decision; `draft-review` when the shape is settled and only the details
need working out; `single` when the plan is a formality — and say which you are recommending and why.

## The run record — where "record the call" writes to

This pipeline is told to record things: a trip-wire it continued past, a gate it skipped, a finding it
rejected, a derivation it made. Step 9 owes all of them to a PR comment at the end.

**They go in a file, appended as they happen** — beside the plan, under the gitignored `tmp/`, named
for the issue. Not into the conversation.

A long run outlives its own context. Whatever is only remembered gets summarized away somewhere in the
middle, and the failure is silent in both directions: Step 9 still writes a confident PR comment, and
nothing in it says an entry went missing. The file is also what makes the run resumable.

| Written at | Entry |
| --- | --- |
| Step 0 | the six settled modes |
| Step 3 | the plan file's path, and whether 3a / 3c ran |
| Step 4 | every trip-wire that fired — its number, what triggered it, and the call taken |
| Step 4 | every derivation made under `derive`, with the clause it rested on |
| Step 6 | every gate that did not run, and why |
| Step 7 | every finding rejected, or fixed differently than proposed, with the reason |
| Step 8 | what runtime verification covered, and what it did not |

Write the entry when the event happens, not in a batch at the end — a batch is exactly the thing a
compaction eats.

## Seams — where compacting is cheap

Two points carry almost nothing forward, because everything that matters is already on disk.

| Seam | Everything downstream needs | Where it already lives |
| --- | --- | --- |
| After Step 5 (implementation reconciled) | the approved plan, the diff, the calls taken so far | the plan file, `git diff`, the run record |
| After the PR is opened (Step 8, while CI runs) | the PR, the branch, the calls taken so far | GitHub, `git`, the run record |

At either seam: **write the run record first, then recommend compacting, then keep going.** At the PR
seam, ask — everything after it is the heaviest reading left in the run. The exception is a run under
standing delegation with the user away: announce and continue, because a question nobody is present to
answer stalls the run at the moment it was told to finish on its own.

**Neither seam is a stopping point, and the list stays at five.** Compaction decides nothing about the
work.

## Step 1 — Kickoff

```bash
printf '\033]0;%s\007' "<issue-number>-<slug>"   # label the window so parallel runs stay distinguishable
gh issue view <n> --json number,title,body,labels,state,comments
```

**Compare the issue against the actual base before writing anything.** An issue body is a snapshot of
the repository as it was when someone wrote it; line numbers, 「X はまだ無い」, and 「Y に呼び出し側が
無い」 go stale. Verify each factual claim against the base you are about to branch from — this is
`docs/rules.md`'s 「『まだ直っていない』『未着手』『存在しない』と言う直前に、測り直す」 applied at the
one moment it is cheapest.

Then post a kickoff comment recording branch name, base commit, and — most importantly — **every
discrepancy found above**.

```bash
gh issue comment <n> --body-file <file>
```

## Step 2 — Secure the environment

Do this before any code is touched, so nothing lands in a shared checkout.

**Ask where the worktree goes if the user has not said.** This repository declares no location for
them, and the answer is a property of the machine, not of the repository — so derive it from the
existing worktrees (`git worktree list`) rather than inventing one. When the user's instruction
already carried 「wt 上で」 or an explicit path, that **is** the answer and this question is skipped.

### Initial setup — no worktree yet

```bash
# 1. Resolve the active release line off origin's live state.
BASE=$(make -s base-branch)
test -n "$BASE" || { echo "ベースブランチを解決できませんでした"; exit 1; }

# 2. Branch from current origin, not a stale local ref.
git fetch origin "$BASE"
git worktree add -b feature/<n>-<slug> <worktree-path> "origin/$BASE"

# 3. node_modules is not shared between worktrees.
cd <worktree-path> && pnpm install --frozen-lockfile
```

`make base-branch` reads `origin`'s live state. Use nothing else: the local `refs/remotes/origin/HEAD`
is fixed at clone time and `git fetch` never updates it, the GitHub default branch stays on an earlier
release line, and the harness's own "Main branch" line reports that same stale symref. All three answer
without warning, so a branch cut from a generation-old base looks correct until the files everyone
expects turn out to be missing.

If the user's instruction named a release version other than the resolved one, ask before branching —
a deliberate backport target is the one case the resolver cannot know about.

Branch creation is `git switch -c` / `git worktree add -b`; `git checkout` is not used for branch work
(`docs/rules.md`, *作業とエージェント*).

### Resuming into an existing worktree

Setup already happened. Observe it and report what you found; do not re-run any of it.

**Read the run record before anything else.** Inspecting the worktree recovers where the work is, not
what has been decided about it — the settled modes, the trip-wires that fired, the gates that were
skipped are in that file and nowhere else.

```bash
git rev-parse --show-toplevel
test -d node_modules && echo 'node_modules: present' || echo 'node_modules: absent'
git status --short
```

A missing `node_modules` is a fact to report; run `pnpm install --frozen-lockfile` when a build or a
server is actually imminent, not as a resume ritual.

## Step 3 — Plan, then wait

**The invariant: the plan is seen by a model that is not the implementer's.** The three stages below
are one default way of satisfying it, not the rule — read the rule off the session's own model rather
than off a model name written here.

No later gate re-opens the plan: `impl-review` / `test-review` / `comment-sweep` all take the finished
change as their subject, so whether the plan solves the issue at all is checked here or nowhere.

| Stage | Runs on | Produces | Runs in |
| --- | --- | --- | --- |
| 3a Framing | a tier at or near the top, on a family that is not the implementer's | the questions the plan must answer — nothing else | `full` |
| 3b Research and draft | the strongest tier available, as a subagent | the plan file | every mode |
| 3c Plan review | the same model as 3a; in `single`, the invariant is carried by 3b | findings, appended to the plan file as their own section | `full`, `draft-review` |

**Resolve each stage's model at runtime; do not read one off this file.** A name written into a skill
is a snapshot of a roster that changes. **Do not draft on a model chosen for cheap survey work** —
`docs/rules.md` draws the line at whether the output enters the repository, and a plan does.

### 3a — Framing

Hand it the issue body, the Step 1 discrepancies, and the paths you have already read.

**It returns open questions, not answers.** It has read almost nothing of the repository at this point,
so anything it asserts is a generality — and a generality handed to a stronger drafter anchors rather
than widens. Refuse a draft plan, a recommendation, or a direction if it returns one.

### 3b — Research and draft

Run it as a subagent, so the research happens in a window that carries none of the orchestrator's
accumulated framing. Give it the issue, your Step 1 corrections, the paths you have already read, and
3a's questions. Tell it to verify your summary rather than trust it.

**When the issue touches code whose current behaviour you have not traced, send `code-explorer`
first** — the read-only agent from the official `feature-dev` plugin, which follows call chains from
entry point to output and returns the files worth reading. Run two or three in one message on
different aspects, read what they name, and hand that to 3b as input. It answers 「いまどう動いて
いるか」, which is not what 3b is for: 3b decides what to change. **Nothing else from that plugin is
used here** — see ADR [0155](../../../docs/adr/0155-claude-skills-development.md).

**Point it at the documents that own the answers** rather than restating them: `docs/playbook.md`'s
reverse index for placement, ADR [0021](../../../docs/adr/0021-frontend-responsibility.md)'s dependency
matrix for what a layer may import, the layer `README.md` frontmatter for the per-layer instance of it,
and `docs/rules.md` for the rules the change must satisfy. It owes an answer to **every** 3a question.

The plan is a written artifact, not a chat message, because Step 5 compares against it mechanically.
Write it under the gitignored `tmp/`. It must contain:

| Section | Why it is required |
| --- | --- |
| Files to touch | Step 5 diffs this against `git diff --name-only`; it is also the permitted surface |
| Per-step deliverables | Lets a partially-finished run be resumed or handed over |
| Chosen options **and rejected ones, with reasons** | Trip-wire 2 fires when a rejected option is later adopted |
| Gate table | Fixes at plan time whether runtime verification is required, so it cannot be quietly dropped |

**When the issue is a new screen, the plan says so and hands Steps 4–7 to `new-feature`.** That skill
owns the screen order (direction → story → review → split → spec → tests) and reads it from
`docs/playbook.md` at runtime. Do not re-derive that order here.

### 3c — Plan review

Whether it is required is derived, never assumed: when 3b ran on the implementer's own model the plan
has been seen by no other model yet, so **3c is required**; when 3b already ran on a different family,
the invariant is satisfied and 3c is optional.

Append its findings to the plan file as their own section and **present them beside the plan, not
folded into it** — a reviewer that silently rewrote the plan would hide the disagreement at the moment
the user is being asked to approve it.

### Then wait

Present the plan and **wait for approval. Do not implement before it.** That approval covers Steps 4–9.

## Step 4 — Implement, watching five trip-wires

<!-- boilerplate-only:begin -->
The plan is approved and implementation begins — the boundary between deciding and building, which
only this skill knows. Stamp it, so this repository's own feedback loop can later say how long each
phase actually took (ADR [0161](../../../docs/adr/0161-development-window-as-feedback-unit.md)):

```sh
.agents/closed-loop/marks.sh planApprovedAt 2>/dev/null || true
.agents/closed-loop/marks.sh implStartedAt 2>/dev/null || true
```
<!-- boilerplate-only:end -->

Follow the approved plan. These triggers are deliberately mechanical — relying on you to *notice* that
a decision was significant is exactly how drift goes unreported.

| # | Trip-wire | Default | Why |
| --- | --- | --- | --- |
| 1 | Touching a file the plan does not list, **inside** `src/` | Record | Scope grew, but within the surface the default modification scope already permits |
| 1′ | The same, **outside** it (`.github/`, `scripts/`, `.makefiles/`, `docs/`, root config) | **Halt** | The plan is the permitted surface; widening it is the user's call |
| 2 | Choosing an option the plan rejected, or a third one | **Halt** | The rejection had a reason; overriding it silently discards that reasoning |
| 3 | A failure rooted in an architecture rule (`eslint-plugin-boundaries`, `pnpm check:architecture`, a layer README's `imports-allowed`) | **Halt** | These are not formatting — satisfying them changes the design |
| 4 | Rejecting a reviewer's finding, or applying a different fix than proposed | **Halt** | A finding can be correct while its proposed fix is harmful; that judgment is not yours alone |
| 5 | Skipping a gate | Record | Step 6 already requires stating it in the PR |

**Halt rows halt under either flow mode.** When one fires, present the situation with your
recommendation. `halt-on-tripwire` extends that treatment to the Record rows.

Two rules from `docs/rules.md` bind the whole step and are not trip-wires, because they are not
about drift:

- **利用者に見えている要素を減らす判断は、人のものである。** The rendering tree is yours; removing a
  column, an operation, a status display, or an explanatory sentence is not. This is also a listed
  stopping point in `AGENTS.md`.
- **見つけたものは、その場で直す** — under issue mode `fix-here`, a defect found in a part you touched
  is fixed in this run, with the check that catches it again, rather than filed.

## Step 5 — Reconcile the plan against reality

Run this before the gates. Compare:

- `git diff --name-only` against the plan's file list — report additions and untouched entries.
- Options actually taken against the plan's chosen / rejected lists.
- Gate table entries against what you actually ran.

Present the deltas. A long run drifts for good reasons; the problem is drift the user never saw. If
nothing drifted, say so in one line and move on.

## Step 6 — Gates belong to the hook and to CI

**Do not pre-run the gates.** `AGENTS.md` and `docs/playbook.md` both put the authority in the hook and
in CI, and running the same check by hand does not make its result more true — on a loaded machine the
duplicate run is itself a source of failures unrelated to the change. Commit, push, and read the verdict.

What this step owes is the statement, not the run: **say in the PR which gates were left to CI.**
Silence reads as "verified". `make load-status` prints which gates run locally right now; do not
pre-empt that decision with `--no-verify`.

Re-running the single file you just edited is fine. Sweeping the whole suite is not.

Runtime verification is deliberately *not* here. It belongs after the PR exists (Step 8), so CI runs in
parallel with it instead of after it.

## Step 7 — Review

A completed change has three review subjects, each owned by one skill: `impl-review` (the change),
`test-review` (the tests), `comment-sweep` (the comment stock of the touched files). They are peers —
none invokes another — so this step must not silently pick one.

Follow the Review Phase Protocol in `AGENTS.md`: **estimate each skill's return from the context this
run already holds** — which layers the change touched, whether tests or comments moved at all — then
ask the user per skill, stating that estimate and its reason, and run what they approve.
「三つとも回しますか」 is not a question; it hands the cost back unpriced.

This step is where the estimate is cheapest to make: the plan, the diff, and the Step 5 reconciliation
are already in hand.

Handle findings per the review mode from Step 0. Auto-application is confined to what is
machine-checkable. **A fix that changes the design is always a decision point**, even under review mode
`all`: `all` authorizes a large rewrite, not an unreviewed one.

**A fix-up round is a new scope.** `AGENTS.md`'s *The response to a review is itself unreviewed* governs
what happens after findings are applied — declare the range as `<the review's last commit>...HEAD` and
re-run only the skills whose subject the response actually touched.

## Step 8 — PR, then harvest, then runtime verification, then merge

**Scope mode decides how much of this step runs.** Under `commit` the step does not run at all — stop
after Step 7, report, and say the work is committed and unpushed. Under `pr` it stops after the PR is
opened. Only `merge` reaches the end of it.

Open the PR first via `submit-pr`, so CI starts while the rest of this step runs.

### Harvest — before the merge, after CI is green

**Collect the general form of what was fixed into the documents that survive a sample purge**
(`docs/rules.md`, the layer README, the ADR that owns the area, `docs/testing-conventions.md`). The fix
itself lives only in code that may be discarded, and discarding it takes the conclusion with it.

The timing is not negotiable: **CI 緑後・merge 前.** Fixes arrive from three moments — during
implementation, from the reviews, and from CI — and harvesting before the PR exists misses the third.
Enumerate mechanically with `git log --oneline <base>..HEAD`, never from memory.

`docs/rules.md`, *作業とエージェント* owns the two filters that keep the documents from bloating, and
requires that what was dropped is stated rather than silently discarded.

### Runtime verification — the merge gate when a request-time seam moved

**The gate is the same one `impl-review` Step 4-2 uses**: a touched Route Handler (`src/app/**/route.ts`),
Server Action, `src/proxy.ts`, the response header configuration, or the layout shell / Provider
composition. When none of those moved, say so and skip the stage — the run must not claim a check it
had no reason to make (ADR [0157](../../../docs/adr/0157-inspection-declaration-discipline.md)).

When the gate is open, this is a run of `pnpm build` and `pnpm start`, which are neither lint nor test
but spend the same machine. **Say so before starting them**, and pick a port that no parallel worktree
holds.

```bash
APP_ENV=local pnpm build
APP_ENV=local pnpm start --port <3000+N>
curl -i http://localhost:<port>/<path>
```

`APP_ENV` must be explicit — an unset value is not treated as `local`, so the shipped development
secrets are rejected and the server exits at boot. Assert the happy path, that no raw upstream status
leaks, the security headers the change should produce, and — for a path the change protects — that the
no-credential request is actually rejected.

**There is no backend in this repository.** What genuinely cannot be reached without one — a real
success response, cross-subject authorization — is **stated as 到達不能**, never simulated and never
reported as passing.

**Green CI is not a substitute** for a seam the mocked tests cannot reach. When runtime verification
cannot run at all, there are two honest options and no third: do not merge yet, or add an integration
test driving the same path and merge on that. Say plainly which one you took.

### Merge

Wait for CI without burning the session on a foreground sleep loop:

```bash
until [ "$(gh pr checks <n> --json bucket --jq '[.[]|select(.bucket=="pending")]|length')" = "0" ]; do sleep 30; done
gh pr checks <n>
```

**Take the base in before merging if it moved.** Whether to is a judgment `docs/rules.md` owns —
「base の変更が自分の変更を意味的に壊せるか」, not whether the files overlap. `resolve-merge` owns the
merge itself and every conflicted path.

Then merge:

```sh
gh pr merge <n> --merge
```

<!-- boilerplate-only:begin -->
Stamp it — a merge performed here is observed by nobody else until the loop goes back to `gh` for it:

```sh
.agents/closed-loop/marks.sh mergedAt 2>/dev/null || true
```
<!-- boilerplate-only:end -->

## Step 9 — Close out

**Reached only under scope mode `merge`.** Under `pr` or `commit`, close the run with the report
instead: what was built, where it stopped, and what the ending left undone — the harvest above and
the runtime verification most of all.

Close the issue **manually** — auto-closing keywords do not fire when the PR targets a release branch
rather than the default branch:

```bash
gh issue comment <n> --body-file <handover> && gh issue close <n>
```

The handover comment covers, per the completion criteria: **どの条件をどう満たしたか / 指示と違えた
判断とその理由 / 別 issue が妥当な積み残し**.

**Fetch again before asserting anything about the state of the world.** Release lines move in minutes
here, so a handover written from a session-start snapshot claims things that stopped being true.

**Clean up the worktree, not the branch.** `git worktree remove` leaves the local branch, and that is
the correct end state; the remote branch is deleted by GitHub on merge. Do not run `git branch -d`.

Finally, record in a PR comment any call not already visible in a commit message or the PR description.
**Read the run record and work down it** — every trip-wire recorded rather than halted on, and every
derivation made under `derive`, lands here, and the file is the only place they all survive.

## Delegating without double-asking

Sub-skills ask their own questions. Since this skill already settled them, pass the answers as a
payload so the sub-skill skips its own gate.

| Sub-skill | Pass through | Suppresses |
| --- | --- | --- |
| `commit` | The grouping you already presented | Its grouping-approval question |
| `submit-pr` | That a review already ran; the push decision | Its review prompt and push confirmation |
| `new-feature` | The approved plan, and the subject | Its Step 0 subject confirmation |
| `impl-review` | Scope, reviewer model | Its Step 0 |
| `test-review` | Scope, reviewer model | Its scope question |
| `comment-sweep` | Scope **and apply mode** | Its scope and apply-mode questions |
| `resolve-merge` | The base | Its base resolution |

**Every row is required, because a missing one reinstates a gate this skill already settled.** A
sub-skill whose default is to confirm per item — `comment-sweep` is the one to watch — will do exactly
that when its apply mode does not arrive.

## Do / Do NOT

- ✅ Ask scope mode first, and honour it — report what an early ending left undone rather than implying it was covered.
- ✅ Secure the worktree before touching code, and ask where it goes when the user has not said.
- ✅ Verify the issue's claims against the actual base, and put the discrepancies in the kickoff comment.
- ✅ Get the plan approved before implementing, and keep it as a file so Step 5 can diff against it.
- ✅ Put the plan through a model that is not the implementer's, and present that review's findings
  beside the plan rather than folded into it.
- ✅ Treat the five trip-wires as mechanical triggers, not as things to notice.
- ✅ Stop only at the five listed places; append every other call to the run record as it happens.
- ✅ Harvest the general form into the surviving documents after CI is green and before the merge.
- ✅ Say explicitly which gates were left to CI, and which paths runtime verification did not reach.
- ✅ Fix what you find, and file only what needs another decision.
- ✅ Pass every sub-skill its settled answers, apply mode included.
- ❌ Pre-run the gates to produce a green of your own.
- ❌ Merge with a request-time seam moved and never exercised, or present green CI as having exercised it.
- ❌ Auto-apply a fix that changes the design, in any mode.
- ❌ Remove an element the user can see without asking first.
- ❌ Decide a design question from preference under `derive` — only a standard or the architecture.
- ❌ Ask for approval at a phase boundary, or treat a subagent's completion as one.
- ❌ Pick which review skills run, or run one on the assumption another chains it.
- ❌ Delete the local branch during cleanup.
- ❌ Carry the run's decisions in context alone, or build Step 9's comment by recalling them.

## Checklist

- [ ] Six modes confirmed in Step 0's two calls, with plan mode's cost stated when it was asked,
      and scope mode asked first.
- [ ] Kickoff comment posted, including issue-vs-base discrepancies.
- [ ] Environment secured on the right half of Step 2 — a new worktree from a freshly fetched base with
      `pnpm install --frozen-lockfile`, or an existing one observed and reported.
- [ ] Plan built through the stages plan mode selected, all four sections present, seen by a model that
      is not the implementer's, and approved before implementation.
- [ ] Trip-wires handled per their row's default and the flow mode; every call appended to the run
      record when it happened.
- [ ] Both seams taken: record written, compaction recommended, PR seam asked unless unattended.
- [ ] No stop outside the five listed places.
- [ ] Plan reconciled against the actual diff.
- [ ] Gates left to CI, and said so in the PR.
- [ ] The three review skills each estimated and put to the user; the approved ones run with their
      answers passed through.
- [ ] General form harvested into the surviving documents, with what was dropped stated.
- [ ] Runtime verification run for a moved request-time seam — or its absence stated with which of the
      two options was taken — before merging.
- [ ] Issue closed manually with a handover comment; the worktree removed and the local branch kept;
      remaining judgment calls recorded in a PR comment.
