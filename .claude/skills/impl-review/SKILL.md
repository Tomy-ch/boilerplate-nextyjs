---
name: impl-review
usage-class: frequent
description: >-
  Local adversarial, low-bias review of THE CHANGE ITSELF, run by subagents on a model that is not the
  implementer's, each finding then re-derived by an independent skeptic. Adds a runtime build and request
  stage that mocked component tests cannot reach, and posts surviving findings to the branch's PR as inline
  comments. Use it before a commit or PR for a second opinion the implementer's own model would not surface,
  and after a multi-kernel change whose RSC / Client boundary or request path no test covers. Subject: the
  implementation only — `/test-review` and `/comment-sweep` are peers under the Review Phase Protocol in
  `AGENTS.md`, never chained from inside it. Do NOT use it for formatting (`pnpm lint:ci`), for applying fixes
  (read-only on source), or for the tests and comments.
---

# Local Review

Independent, adversarial, **different-model** code review you can run locally — no Copilot, no cloud `/code-review`. The implementer's own model has blind spots; the whole point is to review with another model so those blind spots get caught. Built on the `/code-review` finder → verify pattern, plus a runtime build + request stage that mocked component tests structurally cannot reach.

A Japanese reference translation of this skill lives at `SKILL.ja.md` in this directory (for human reference only; not loaded as a skill).

## When to Use

- Before committing / opening a PR, to get a second opinion the implementer's model would not produce on its own.
- After a multi-kernel change where mocked component tests pass but the RSC / Client boundary, `src/proxy.ts`, or the `adapters` request path is unverified.
- Whenever you want an adversarial pass focused on bugs, auth / IDOR, and layer violations.

Do NOT use this skill for:

- Style / formatting — `pnpm fix` / `pnpm lint:ci`.
- Static layer-boundary enforcement — `pnpm lint:ci` runs `eslint-plugin-boundaries` (ADR [0021](../../../docs/adr/0021-frontend-responsibility.md) Enforcement) plus `pnpm check:architecture`, so import direction **is** statically gated. The `architecture` lens is therefore the *semantic* pass on top of that gate: spend it on violations the matrix cannot express (a type leaking through a legal import, responsibility placed in the wrong kernel, an abstraction that inverts the dependency only nominally), not on re-deriving what ESLint already fails on. Exhaustive layer-compliance auditing belongs to a dedicated auditor skill, which **does not exist yet** (BACKLOG GB-1).
- Applying fixes — this skill is read-only on source; it reports, the user fixes.
- Auditing the tests (`/test-review`) or the comment stock (`/comment-sweep`) — peers, not sub-steps.

## Core Idea — reviewer ≠ implementer

Bias reduction is the design constraint, not a nicety. Reviewers therefore run as **subagents on a different model than whoever wrote the code**:

- The reviewer agents (`adversarial-reviewer`, `review-verifier`) default to **`sonnet`** in their frontmatter, which differs from the usual Opus implementer.
- **The reviewer model is chosen by the user in Step 0.** The options are `fable` (Fable 5) / `sonnet` / `opus` / `haiku`, plus an *auto* default that resolves to a model ≠ the session's implementer. Pass the chosen model to every reviewer subagent via the `Agent` tool's `model` parameter (it takes precedence over the agent file's `sonnet` default) — e.g. `opus` for depth, `haiku` for a cheap divergent pass, `fable` for a fresh independent perspective.
- **The orchestrator MUST guarantee reviewer ≠ implementer.** If the user selects the same model as the session's implementer, warn that it undermines the different-model bias reduction and confirm before proceeding. Never silently let reviewer and implementer be the same model.
- Reviewer subagents are **read-only** (their agent files grant no Edit/Write) — they only return findings, and this skill never mutates source at all. What to change is the user's call, made from the report.

**This skill audits the change and nothing else.** It has no test lens and no comment lens, and it
invokes no other skill. Those are `/test-review`'s and `/comment-sweep`'s subjects, each asked for and
run in its own right beside this one, per the Review Phase Protocol in `AGENTS.md`. A review skill
that offers to run the next one makes the subjects stop being independently answerable, and lets a
drift in one skill's question silently drop the other two from every flow that went through it.

## Precedence — findings are ranked, not just collected

Reviewers disagree, overlap, and report the same fact in two vocabularies. Without a ranking the
report is a flat list in which a naming nit outranks a kernel placed on the wrong side of a boundary
because its finder called it "high". The tiers in the Step 2 table are that ranking:

| Tier | Lenses | What it decides |
| --- | --- | --- |
| 1 | `architecture` | what the code should *be* |
| 2 | `security`, `correctness` | whether what it is, works |
| 3 | `runtime-gap`, `cohesion` | whether it holds up in the real system, and whether the unit is one anybody can keep |

**A change at a higher tier propagates downward; a lower tier does not, as a rule, act on a higher
one.** Moving a responsibility into another kernel invalidates the behavior verified against it where
it stood; a seam that would split one file never justifies moving that responsibility. Four
consequences follow, and each of them is a rule, not a suggestion:

1. **Order the report by tier, then by severity within a tier** — never by severity alone. A tier-3
   `high` sits below an architecture `medium`, because the architecture finding may delete the code
   the lower one is about.
2. **Mark a lower-tier finding 保留 while a higher-tier finding it depends on is unresolved.** Report
   it, say what it is waiting on, and do not present it as actionable. Re-check it after the
   higher-tier decision lands; it often disappears.
3. **When two tiers report the same fact, keep the higher tier's framing and fold the lower one in as
   corroboration** — one finding, not two. Two entries for one fact reads as two problems and
   double-counts the change's apparent risk.
4. **Agreement among lenses at the same tier raises confidence; agreement from a lower tier does
   not raise a higher finding's severity.** Two tier-2 lenses independently reaching the same defect
   is strong evidence — say so. A tier-3 lens agreeing with a tier-1 finding adds nothing to its
   severity, though it may be cited as support.

**The exception is criticality, and it is yours to notice, not to resolve.** A lower-tier finding
can be the more urgent one — an exploitable hole surfaced by the `runtime-gap` lens does not wait for
a placement debate. When a lower-tier finding looks critical enough to outrank the tier above it,
**do not silently reorder: present both and ask the user.** The ranking exists so that ordinary
disagreements resolve without a human; a finding that breaks the ranking is exactly the case a human
should see.

## Step 0 — Confirm Scope

Call `AskUserQuestion` immediately. Default-detect scope by checking branch vs base. Resolve the base the way `commit` and `submit-pr` already do — `gh pr view --json baseRefName -q .baseRefName`, and `make -s base-branch` when no PR exists. Never `gh repo view --json defaultBranchRef`: `.makefiles/README.md` owns why, and a base resolved that way silently widens the diff by a release generation. If there are unmerged commits, default to "changed files", otherwise "whole working tree / specific paths".

```text
質問: どの範囲をレビューしますか？
選択肢:
  - 変更ファイルのみ（ベースブランチとの diff）  ← 未マージのコミットがある場合の既定
  - 作業ツリーの未コミット変更（git status の差分）
  - レビュー指摘への対応分（前回レビューの最終コミット...HEAD）  ← 反映そのものが未レビュー
  - 特定のパス/ファイルを指定
  - キャンセル
```

### Reviewer model selection

In the same `AskUserQuestion` call (a second question alongside scope), ask which model the
reviewer subagents run on:

```text
質問: レビュアーをどのモデルで実行しますか？（バイアス低減のため 実装者 ≠ レビュアー を推奨）
選択肢:
  - 自動（実装者と異なるモデルを既定選択）  ← 既定
  - fable（Fable 5）
  - sonnet
  - opus（深掘り）
  - haiku（安価・高速な発散パス）
```

*Auto* resolves to the agent-file default (`sonnet`) when the implementer is not `sonnet`,
otherwise to a different tier. If the user picks the implementer's own model, warn (per Core
Idea) that it weakens the different-model guarantee and confirm before continuing. The chosen
model is passed to every `adversarial-reviewer` / `review-verifier`
`Agent` call via the `model` parameter in Step 2 and Step 3.

**Two questions, and no more.** There is no test question and no comment question here — those
subjects belong to `/test-review` and `/comment-sweep`, asked for separately (Core Idea, "This skill
audits the change and nothing else").

### Flags

- `--no-comment` — suppress Step 6 (do not post to the PR); produce the local report only. **Default is opt-out**: when an open PR exists for the current branch, Step 6 posts the surviving findings as inline review comments unless this flag is given.

## Step 1 — Gather Context

- Resolve the base ref and produce the review target: `git diff <base>...HEAD` (or `git diff` for uncommitted), plus the changed-file list (`git diff --name-only ...`).
- Detect which **kernels / elements** are touched. The inventory is ADR [0027](../../../docs/adr/0027-directory-structure.md)'s physical layout, and what each may import is ADR [0021](../../../docs/adr/0021-frontend-responsibility.md)'s dependency matrix: `src/app/**` (3 elements — route-segment `page`/`layout`, route-handler `route.ts`, metadata), `src/features/<name>/**`, `src/model/**`, `src/components/**`, `src/adapters/server/**` · `src/adapters/client/**`, `src/capabilities/**`, `src/stores/**`, `src/config/**`, `src/errors/**`, `src/logging/**`, `src/observability/**` — plus the **boot / build boundary entries that sit outside the kernels**: `src/proxy.ts`, `src/instrumentation.ts`, `next.config.ts`. Several kernels are not on disk yet (ADR 0027 creates each when its decision lands); detect what exists rather than assuming the full set.
- Note whether a **request-time seam** is touched — a Route Handler (`src/app/**/route.ts`), a Server Action (`src/features/<name>/actions.ts`), `src/proxy.ts`, the response header configuration (`next.config.ts` `headers()`), or the **layout shell / Provider composition** (`src/app/**/layout.tsx` — ADR [0026](../../../docs/adr/0026-layout-shell-mount.md); a missing Provider only fails when the route actually renders). This decides whether Step 4-2 runs. <!-- skill-lint-ignore -->
- Note whether a **generated API artifact** is touched (`**/gen/**` — the types / zod schemas of ADR [0072](../../../docs/adr/0072-api-type-generation.md)). A regenerated artifact ripples to every consumer, so widen the review to the `adapters` conversions and features that import it, not just the changed file.

### Resolve the static verdict once, here

The lenses must not run the gates — each one that did would recompute the same verdict, once per
lens, and this repository's authority for a gate verdict is CI anyway (`docs/playbook.md`,
*ゲートを先回りして回さない*). So **the orchestrator resolves it a single time and hands the result to every finder**:

```bash
gh pr checks --json name,state,link 2>/dev/null   # the branch's PR, if one is open
```

Pass the outcome into every `adversarial-reviewer` prompt in one of three shapes, and **never
collapse them**:

| Shape | When | What the lens does with it |
| --- | --- | --- |
| **緑** | every required check passed on this head | Skip what the static gates already cover; spend the lens on what they cannot express |
| **赤: `<check>`** | a required check failed | Read the failure as a confirmed finding's evidence, and do not re-derive it |
| **未取得** | no PR, checks not started, `gh` unavailable | Treat the gates as **unknown, not clean** — an unrun check is not a passing one ([0157](../../../docs/adr/0157-inspection-declaration-discipline.md)) |

**Do not run the gates here either to fill in 未取得.** The point of the third row is that the
absence of a verdict is itself reportable; a local run would replace an honest gap with a number CI
has not agreed to.

## Step 2 — Fan-out Finders (different model, concurrent)

Spawn all finders concurrently (issue every `Agent` call in a single message). Pass the Step 0 user-selected reviewer model to every `Agent` call via the `model` parameter (omit only when *auto* already resolves to the agent-file default). Every finder runs `adversarial-reviewer` — one per lens, `agentType: "adversarial-reviewer"`, `label` like `find:security`.

| Finder | Tier | Agent | Run when |
| --- | --- | --- | --- |
| `correctness` | 2 | adversarial-reviewer | always |
| `security` | 2 | adversarial-reviewer | always (especially when a Route Handler / Server Action / `src/proxy.ts` / auth / a generated API request-response type is touched) |
| `architecture` | 1 | adversarial-reviewer | always |
| `cohesion` | 3 | adversarial-reviewer | always |
| `runtime-gap` | 3 | adversarial-reviewer | when a Route Handler / Server Action / `src/proxy.ts` / Provider mount / generated API artifact is touched — the seams a mocked component test does not exercise |

**No lens here audits the tests or the comments** (Core Idea, "This skill audits the change and
nothing else"). When a lens surfaces an untested change or a comment's content in passing, say so in
the 補足 section as an observation and name the skill that owns it — never grow a lens to cover it.

Each `adversarial-reviewer` prompt MUST include: the lens name + its definition, the base ref + changed-file list + the diff, and pointers to `AGENTS.md` / the relevant `README.md` / the governing ADRs.

**`cohesion` lens definition.** `architecture` asks *which layer owns this*; `cohesion` asks *how many different asks would land on this same function or file*. The two never overlap, and the gap between them is real: a unit can sit in exactly the right kernel and pass `eslint-plugin-boundaries` and `pnpm check:architecture` while still forcing whoever revises an error's wording to read the code that talks to the network. Nothing in the toolchain sees that, and `full-verify`'s `impl-verifier` — which does own cleanliness and maintainability — only runs over the whole repository, so without this lens the finding waits for an audit instead of surfacing on the diff that introduced it.

The discipline that keeps it from becoming taste: every finding must **name two distinct reasons to change and who would ask for each**, then name the seam. A finding that cannot be stated that way is dropped, the same way a `correctness` finding without a failing input is dropped. Splitting is not free — each seam is one more file to open before the whole picture is visible — so the two reasons are what pays for it. Length alone is never a finding.

## Step 3 — Adversarial Verify

Collect all findings and **dedup** by (file, line, claim). When two lenses report the same fact, do not keep both: fold the lower tier's entry into the higher tier's framing as corroboration, so one fact stays one finding. For each surviving finding, spawn one `review-verifier` subagent (concurrently), handing it the single finding + the base ref. Use `agentType: "review-verifier"`, `label` like `verify:<file>`, and the Step 0 user-selected reviewer `model` (same reviewer ≠ implementer rule).

- Keep **CONFIRMED** and **PLAUSIBLE** findings. Drop **REFUTED** (but keep a count for the report).
- For a critical/high finding where a single verdict feels shaky, spawn 2–3 verifiers and go by majority — diversity beats one opinion on the findings that matter.

## Step 4 — Runtime Verification (build + request)

Run this from the **orchestrator (main session)**, not a subagent — it needs interactive bash, a real server process, and possibly user confirmation. It is where the defects Step 2's `runtime-gap` lens only *predicts* get confirmed or dropped — as far as the stage reaches; see "What this stage does NOT reach" under 4-2. Two stages, each with its own gate.

### 4-1 Build verification — whenever app code is touched

Gate: the diff touches `src/**`, `next.config.ts`, `src/proxy.ts`, or `src/instrumentation.ts`.

Run `pnpm build`. This is not a slower `pnpm lint:ci` / `pnpm typecheck` — those are per-file and structurally cannot see the module graph the build assembles:

- **RSC / Client boundary violations** — a `server-only` module reachable from the client graph, `"use client"` on a module that imports server config, a client hook mixed into `adapters/server` (ADR [0024](../../../docs/adr/0024-adapters-server-client-split.md)).
- **Secret leakage into the client bundle** — server config reached from a client-side layer. ADR [0030](../../../docs/adr/0030-environment-variable-management.md) lets only `NEXT_PUBLIC_` literals cross, and the bundle is where the violation actually materializes.
- **Build-time config validation** — `next.config.ts` imports the schema and evaluates it in full (ADR 0030), so a missing or invalid variable fails here and nowhere earlier. Note that ADR 0030's *second* validation point, `src/instrumentation.ts`'s `register()`, runs once at **server start**, not during the build — only Step 4-2 reaches it.
- Route / metadata type errors raised only by the App Router's own generated types.

A build failure **is** a CONFIRMED finding: report it with the output. Do not fix it here — the code lenses are read-only.

### 4-2 Request verification — only when a request-time seam is touched

Gate: Step 1 found a touched **request-time seam** (the list is in Step 1).

1. Start the app built in 4-1: `pnpm start --port <3000+N>`, on a port distinct from other worktrees so a parallel session's server is not the one under test. Run it in the background and stop it when done.
2. `curl -i` the touched path(s) and assert:
   - the happy-path status and body shape;
   - **no raw upstream status leaks** — a backend failure must surface as the normalized `errors` classification, not a pass-through 4xx/5xx (ADR [0071](../../../docs/adr/0071-bff-api-integration.md));
   - the security headers / CSP the change should produce (ADR [0111](../../../docs/adr/0111-csp-security-headers.md) — `next.config.ts` `headers()` is the default seam; a nonce CSP forces every route dynamic, which is itself a finding if unintended);
   - for a path the change intends to protect, that the no-credential request is actually rejected — prove it, do not infer it from reading the handler.
3. **`src/proxy.ts` changes:** exercise both a path the `matcher` selects and one it excludes. A matcher regression is invisible to unit tests and to the build (ADR [0043](../../../docs/adr/0043-middleware-policy.md)).
4. **Layout shell / Provider changes:** request a route beneath the changed layout and confirm it renders — a Provider dropped from the shell leaves a hook without context, which surfaces as a runtime error or an error boundary, not a build failure (ADR [0026](../../../docs/adr/0026-layout-shell-mount.md)).

**What this stage does NOT reach.** It asserts the four points above plus the matcher and shell checks — nothing else. The `runtime-gap` lens can raise categories this stage cannot execute today, chiefly **cache / revalidation** (a mutation that fails to invalidate its tags) and **retry / idempotency / breaker semantics**: both need the `adapters` layer and a backend, and ADR 0071 leaves their concrete shape to the implementation PR. Report those findings as 到達不能 rather than treating an unrun check as a pass.

**There is no backend in this repository** — DB / auth / business logic belong to a separate service (ADR [0011](../../../docs/adr/0011-no-docker.md) / [0070](../../../docs/adr/0070-backend-role-separation.md)), so a Route Handler's upstream call fails unless a stub is configured. That is not a reason to skip the stage: the *failure* path is precisely what ADR 0071's error normalization owns, so assert it. What genuinely cannot be reached without a backend — a real success response, cross-subject authorization — is **stated as 到達不能 in the Step 5 report**. Never simulate it, and never report it as passing.

**Destructive guard:** a Server Action can mutate real backend state. If one is in scope and running it would write to a shared environment, confirm with the user first — ADR [0154](../../../docs/adr/0154-claude-skills-operations.md)'s 商用操作前のユーザ確認 requires it of any skill whose step reaches outside the working tree — and say what the restore path is.

Fold any runtime-confirmed defect into the report as CONFIRMED with the build output / curl evidence.

## Step 5 — Synthesize Report (Japanese)

Produce one Japanese report:

```text
## ローカルレビュー結果（reviewer: <model> / implementer: <model>）

スコープ: <base>...HEAD（<N> files） / lens: correctness, security, architecture, cohesion, runtime-gap
未監査の観点: テスト（/test-review）・コメント（/comment-sweep）は本スキルの対象外
静的ゲート: 緑 / 赤（<check>）/ 未取得（走っていない検査は通った検査ではない）
ランタイム検証: 4-1 build 実施 / 4-2 リクエスト検証 実施（curl）・対象外（リクエスト時 seam の変更なし）・到達不能（バックエンド不在で未検証の経路: <経路>）

### CONFIRMED（要対応）
- [重大度] タイトル — path:行
  - 問題 / 根拠 / 修正案
  - 検証: verifier 判定（+ 該当すれば build / curl 結果）

### PLAUSIBLE（要確認・判断保留）
- ...

### 補足
- REFUTED: <n> 件（finder が挙げたが verifier が否定）
- ランタイム検証でカバーした経路 / スキップした経路
- 他スキルが所管する観点として気づいた点（あれば。所管スキル名を添える）
```

The `lens:` line lists only the lenses that actually ran.

The **`未監査の観点:` line is mandatory**, and it is not boilerplate: this skill audits one of the
three review subjects, and a report that says nothing about the other two reads as a full review to
anyone who did not run them. State plainly that the tests and the comments were not looked at here,
so the omission is visible rather than inferred from a `lens:` list that never mentioned them. Do not
soften it into a recommendation — whether to run the other two is the user's call under the Review
Phase Protocol, and this line only records what this run did not cover.

Order by tier, then by severity within a tier, CONFIRMED before PLAUSIBLE — never by severity alone. A finding held behind an unresolved higher-tier one is marked 保留 with what it is waiting on. Always state what runtime checks ran and what was
skipped — silent omission reads as "covered everything" when it was not.

## Step 6 — Post Findings as Inline PR Comments (default; opt out with `--no-comment`)

By default, post the surviving **CONFIRMED + PLAUSIBLE** findings to the branch's PR as **inline review comments** — one per finding, anchored to its `path:line`, instead of a single wall-of-text comment. **Never post REFUTED.** The Step 5 local report is still produced regardless; this step is additive.

Only this skill's own findings are posted — `/test-review` and `/comment-sweep` produce their own output for the user to act on (Core Idea, "This skill audits the change and nothing else").

Skip this step entirely when:

- invoked with `--no-comment`, OR
- no open PR exists for the current branch (`gh pr view` returns nothing) — keep the local report only and optionally offer to open a PR.

Posting to GitHub is an outward-facing action, so confirm **once** before posting — show the count and the target PR (`AskUserQuestion`: 「<N> 件の指摘を PR #<番号> にインラインコメントとして投稿しますか？」/「投稿する」「投稿しない（ローカルレポートのみ）」).

**Redact before posting.** This repository is public, and a `security` finding quotes the very thing it flags — a leaked token, a hardcoded credential, a PII sample. Posting that verbatim republishes the secret in a place that cannot be retracted. Before building the payload, rewrite every finding body so the evidence is described, not reproduced: replace concrete secret-shaped values with `***REDACTED***` and cite `path:line` instead. A finding whose point cannot survive redaction (the value *is* the finding) stays in the local report only — say so in the summary rather than posting it.

**`gh api` is available for this call.** `.claude/settings.json` allows `Bash(gh api *)` and denies only the shapes that lose committed work: anything containing `DELETE`, and ref manipulation (`git/refs`, whose `force` update is an API-side force push). Posting a review is neither, so it runs. Those denies still hold during skill execution — if a call you need is blocked, surface it and let the user decide. Never re-route a blocked request through `python3` / `pnpm exec tsx` / any other allowed interpreter (that defeats the guard rather than satisfying it), and never edit `permissions.deny` to unblock yourself.

The permission layer is not what makes this safe — a pattern rule cannot tell an advisory review from a destructive write. The control that matters is the single confirmation above, so do not skip it on the grounds that the command is allowed.

**Fallback when the API call fails:** post a single summary comment with `gh pr comment` — the findings grouped by file with `path:line` references instead of true line anchors — and say plainly in the Step 5 report that the findings were summarized, not inlined.

### Procedure

1. Resolve PR number, repo, and the commit the comments anchor to:

   ```sh
   gh pr view --json number,url -q '.number'        # PR number
   gh repo view --json nameWithOwner -q '.nameWithOwner'
   git rev-parse HEAD                                # anchor SHA
   git rev-parse @{u}                                # pushed head — warn if it differs from HEAD
   ```

   The anchor commit MUST be the commit pushed to the PR. If local `HEAD` ≠ `@{u}`, warn the user to push first (the API rejects comments whose `commit_id` is not on the PR).

2. Decide which findings can be inline. A GitHub inline comment must target a line present in the PR diff. Parse the diff hunks (`gh pr diff <PR> --patch` or `git diff <base>...HEAD`):
   - `(path, line)` inside an added/context hunk → inline comment, `side: "RIGHT"`.
   - `(path, line)` on a removed line → inline comment, `side: "LEFT"`.
   - Off-diff (the reviewer referenced unchanged context) → **cannot** be inline; fold it into the review summary `body`.

3. Build one review and post all comments atomically (a single review, not N standalone comments):

   ```sh
   gh api --method POST repos/<owner>/<repo>/pulls/<PR>/reviews --input payload.json
   ```

   `payload.json`: <!-- skill-lint-ignore -->

   ```json
   {
     "commit_id": "<SHA>",
     "event": "COMMENT",
     "body": "🔎 impl-review (reviewer: <model>) — CONFIRMED <n> / PLAUSIBLE <m>\n\ndiff 外で行アンカー不可の指摘:\n- <path>: <要約>",
     "comments": [
       {
         "path": "<file>",
         "line": "<行番号>",
         "side": "RIGHT",
         "body": "🔎 [CONFIRMED · high] <問題の要約>\n\n根拠: <...>\n修正案: <...>\n検証: <verifier 判定>"
       }
     ]
   }
   ```

   Use `event: "COMMENT"` — this is an advisory review, never `REQUEST_CHANGES` / `APPROVE`. Prefix every comment body with `🔎 impl-review` (or the `🔎 [verdict · severity]` tag) so the posts are distinguishable from human review.

4. Robustness: if the API rejects the batch (422 — a line is not in the diff), move the offending comment(s) to the summary `body` and retry. Report afterward what was posted inline vs. summarized — never silently drop a finding.

## Do / Do NOT

- ✅ Guarantee reviewer model ≠ implementer model (user selects it in Step 0; warn + confirm if they pick the implementer's model).
- ✅ Run finders concurrently (one message, multiple `Agent` calls), all via `adversarial-reviewer` — one per lens.
- ✅ Independently verify every finding before reporting; drop REFUTED.
- ✅ Run `pnpm build` (Step 4-1) whenever app code is touched, and the request stage (Step 4-2) when a request-time seam is.
- ✅ When a generated artifact changed, widen the *finders'* read scope (Step 1) to every consumer that imports it — Step 4 does not widen; it verifies the paths it can reach.
- ✅ State a path as 到達不能 when the missing backend blocks it — never simulate it, never call it passing.
- ✅ Confirm with the user before running a Server Action that would mutate shared backend state.
- ✅ Rank findings by tier before severity, fold a duplicated fact into the higher tier's framing, and mark a blocked lower-tier finding 保留 rather than presenting it as actionable.
- ❌ Silently reorder a lower-tier finding above the tier that outranks it — present both and ask the user.
- ✅ State on the `未監査の観点:` line of every report that the tests and the comment stock were not audited here.
- ✅ By default, post the CONFIRMED + PLAUSIBLE findings to the branch's PR as inline review comments (Step 6); suppress with `--no-comment` or when no open PR exists.
- ✅ Confirm once before posting to the PR (outward action); anchor each comment to its `path:line`, fold off-diff findings into the review summary.
- ✅ Redact secret-shaped values out of every finding body before posting — this repository is public and a post cannot be retracted.
- ❌ Skip the Step 6 confirmation because `gh api` is allowed — the permission rule is not the safety control, the confirmation is.
- ❌ Route a denied command through an allowed interpreter, or edit `permissions.deny` to unblock yourself — surface the block and offer the summary-comment fallback instead.
- ✅ State in the report which lenses did not run and why.
- ❌ Post REFUTED findings, or use `REQUEST_CHANGES` / `APPROVE` — the posted review is advisory `COMMENT` only.
- ❌ Mutate source at all — every lens reports, the user fixes.
- ❌ Grow a lens that audits the tests or the comments, or invoke `/test-review` or `/comment-sweep` from here. They are peers under the Review Phase Protocol; surface such an observation in 補足 and name the skill that owns it.
- ❌ Let a reviewer run on the same model as the implementer.
- ❌ Report speculative style nits as findings, or pad the list to look thorough.
- ❌ Edit generated files or anything in the deny list while verifying.

## Checklist

- [ ] Scope confirmed via `AskUserQuestion`; base ref resolved.
- [ ] Reviewer model selected in Step 0 and verified ≠ implementer model (warn + confirm if same).
- [ ] Finders fanned out concurrently, one `adversarial-reviewer` per lens — no test lens, no comment lens.
- [ ] No other skill invoked from this run.
- [ ] Report ordered by tier then severity; a duplicated fact folded once into the higher tier; blocked lower-tier findings marked 保留.
- [ ] Every finding independently verified; REFUTED dropped (count kept).
- [ ] Step 4-1 `pnpm build` run when app code was touched; Step 4-2 curl run when a request-time seam was; 到達不能 paths named; a mutating Server Action confirmed before running.
- [ ] Single Japanese report: CONFIRMED → PLAUSIBLE, runtime coverage stated, `未監査の観点:` line present.
- [ ] Unless `--no-comment` / no PR: confirmed once, then posted CONFIRMED + PLAUSIBLE as inline PR comments (off-diff → summary body); REFUTED excluded; `event: COMMENT`.
