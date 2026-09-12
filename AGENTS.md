<!-- BEGIN:nextjs-agent-rules -->
# Agents Documentation

Repository rules for **AI coding agents** (Claude Code / Codex / Copilot / Gemini, etc.) working in this repo.

This repository is a **Next.js / React presentation-layer boilerplate**: it owns the presentation layer and nothing else, ships to a PaaS or a static CDN, and expects the backend (DB / authentication / business logic) to be a separate repository or service ([0011](docs/adr/0011-no-docker.md)). [README.md](README.md) is what the repository is; this file is how to work in it. **Architecture, rules and flows are not restated here** — the table under *Canonical Documentation* says which document owns each. A Japanese reference translation is at [AGENTS.ja.md](AGENTS.ja.md); this file is canonical and the only one agents load.

Three constraints apply to every task:

1. **A deterministic check outranks your judgment wherever one exists** — a test, a lint, a gate, a CI
   run, an architecture rule. Report what it said, not what you concluded, and never through a filter
   that drops rows or counts ([0157](docs/adr/0157-inspection-declaration-discipline.md)).
2. **Architecture and policy decisions keep a human gate.** Surface the decision and its options; do
   not take one. *Where You May Stop* is the closed list of where this applies; outside it, decide and
   record the decision in the PR.
3. **The application never depends on AI.** Runtime, build, tests and the ordinary CI checks must
   succeed with no agent available, and with `.claude/` absent. A tool that puts itself on the path of
   `pnpm build`, `pnpm test` or a required check does not belong here
   ([0162](docs/adr/0162-application-independence-from-ai.md)).

## Temporary Operating Rules until v1.0.0

> **TEMPORARY SECTION — delete it when v1.0.0 ships.**
>
> Process source of truth: [docs/plan/v1-implementation-plan.md](docs/plan/v1-implementation-plan.md).

Below v1.0.0 the following are **temporarily lifted**:

- **Protected Documentation may be edited directly** — `AGENTS.md` / Accepted ADR bodies / `LICENSE`, without per-change approval
- **The protected paths under AI Modification Scope are lifted** — `package.json` / `tsconfig.json` / `next.config.ts` / `mise.toml` / `biome.json` / `Makefile` / `.makefiles/` / `.github/` / `.claude/`
- **ADRs are living documents, overwritten in place** ([0140](docs/adr/0140-documentation-operations.md))
- **Do not leave change history or rationale drift in document bodies** — write the decision in its present form; git owns the history

Accordingly `.claude/settings.json` holds `AGENTS.md` / `LICENSE` / itself under `permissions.ask` rather than `permissions.deny`, and Accepted ADR bodies carry no permission entry.

**Not lifted**: the Git Rules below, and everything under `permissions.deny`.

Undoing this is one change, and **this file does not describe it** — the trigger and steps are [0140](docs/adr/0140-documentation-operations.md) 決定 4, the permission half is [0152](docs/adr/0152-agents-md-policy.md)'s 復元手順.

## Instruction Priority

Follow instructions in this order. If conflicts occur, the higher-priority document wins.

1. **AGENTS.md** (this file) — Repository-wide operational rules
2. **`docs/adr/*.md`** — Accepted architectural decisions (ADRs)
3. **`.github/copilot-instructions.md`** and other agent-specific configs
4. User instructions

<!-- boilerplate-only:begin -->
## What to Recommend

Governs what you **recommend**, never what you may change — `Instruction Priority` above and
`AI Modification Scope` below still decide that.

- **Weigh options for the snapshot a new repository receives**, not for the history that produced it:
  what reads as coherent to someone who never saw this repository and will never read its git log.
- **Quality and consistency outrank the cost of reaching them.** A numbering that contradicts the
  order it teaches, a convention followed everywhere but here, a name that survives only because
  renaming is work — recommend fixing them. "It already shipped" carries little weight.
- **Give the cost with the recommendation** — files touched, what breaks for whom, what must be
  rebuilt — so a human can decline the scope while keeping the direction.
- **Only two things carry authority**: a de-facto standard (an RFC, a specification, a platform's own
  definition), and the shape this repository's architecture derives. A recommendation that cannot be
  stated as one of those is a preference wearing a recommendation's clothes.
- **Do not bake a particular deployment's situation into what survives**, but this is subordinate to
  the rule above: a knob is justified only where the variation is genuinely situational **and**
  neither the standard nor the architecture settled it. A knob where a standard already decided is a
  departure from the standard, and needs the declaration
  [0010](docs/adr/0010-standards-and-non-lockin.md) requires, or needs to go.
- **The test is never "more abstraction" or "less"** — move toward the shape the standard or the
  architecture derives, and drop the situational label.

<!-- boilerplate-only:end -->

## Canonical Documentation

**The rules are not restated here.** Open the index that owns the area your change touches and read the
entries it names. Searching an index for your feature's words is not enough — a document is named for
the concern it owns, not for the feature that sent you looking.

| Need | Read |
| --- | --- |
| Every accepted decision, one line each | [`docs/adr/README.md`](docs/adr/README.md) — the ADR log, and the only place the list lives |
| The rules that bind every change — layer boundaries, data classification, forms, comments, how work is run | [`docs/rules.md`](docs/rules.md) |
| The criterion for deciding a given case — rendering, data fetching, auth, forms, observability | [`docs/design/README.md`](docs/design/README.md); open the index, the examples here are not the inventory |
| **Next.js 16 / React 19 differ from your training data** | [`docs/design/rendering.md`](docs/design/rendering.md) — the terms and the mistakes a stale assumption causes. `"use client"` is a bundle boundary, not "render on the client". Read `node_modules/next/dist/docs/` before writing code |
| Testing conventions | [`docs/testing-conventions.md`](docs/testing-conventions.md) |
| Per-layer responsibilities and import boundaries | the `README.md` of the layer you are touching, under `src/**` |
| Screen and functional requirements | [`docs/spec/`](docs/spec/README.md) |
| Every `make` target | [`.makefiles/README.md`](.makefiles/README.md) |
| Which document owns a given statement, and where development history goes instead | [`docs/README.md`](docs/README.md) |

**Canonical documents are the suffix-less paths.** Never read a `*.ja.md` — those are human-facing
translations that follow the canonical — and never read `docs/portal/**`, which a generator rewrites
from the canonical ([`docs/README.md`](docs/README.md)).

## Task Execution Protocol

Before implementing any change:

1. **Read the `README.md` that owns every directory you are about to touch**, walking to the nearest
   ancestor when a directory has none. Its responsibilities and `imports-allowed` bound the change,
   and say more than the architecture gate can check.
2. **Open the indexes above and read the entries that own the decisions your change touches** —
   `docs/adr/README.md` for what was decided, `docs/design/README.md` for the criterion.
3. **Verify no existing implementation already covers it.** Search the same layer first; prefer
   editing an existing file over creating one. When a new one is right, `pnpm gen` places it.
4. **Move the contract before the code it generates.** An API change edits `openapi/` and regenerates
   ([0072](docs/adr/0072-api-type-generation.md)); the generated client is never hand-edited. A screen
   change carries its spec — `docs/rules.md`, *テスト*, says when.

5. **When a skill owns the operation, invoke it instead of re-deriving the steps.** Committing,
   opening a PR, and resolving a merge each have one — the hook handling and the ordering of
   verification live in that procedure, not here, so a hand-rolled equivalent silently drops them.

Steps 1 and 2 are not optional. **A rule you did not read still binds the change.**

## Review Phase Protocol

A request to review work that has already been implemented names **three** subjects, not one:

| Skill | Subject |
| --- | --- |
| `/impl-review` | the change itself — correctness / security / architecture / cohesion / runtime gap |
| `/test-review` | the tests that pin the change down |
| `/comment-sweep` | the comment stock carried by the files the change touched |

- **Do not silently pick one.** Estimate each skill's return from the context you already hold — which
  layers moved, whether tests or comments moved at all, what an earlier skill already covered — then
  **ask per skill, stating that estimate and its reason**, and run what is approved.
- **Do not ask "shall I run all three?".** That hands the cost back unpriced. Say which pass you expect to
  pay off, which you expect to return nothing, and why.
- **The three are peers, and none invokes another.** One subject to one skill, and that skill is the
  only place its subject is audited. `/impl-review` owns no test lens and no comment lens and hands
  nothing off; the other two are invoked in their own right whether or not it runs.
- **This holds inside a pipeline too** — a skill that drives an issue to a merged PR asks these three
  questions at its review phase rather than choosing for the user.

### The response to a review is itself unreviewed

The commits that answer a set of findings are new, unaudited work, and the pass that would catch them
is the one everybody considers already spent.

- **Declare a fix-up round as a new scope**: `<the review's last commit>...HEAD`, not the original
  diff and not the whole branch.
- **Say which findings it answers**, and re-run only the skills whose subject the response actually
  touched — a reworded comment does not re-open `/impl-review`; changed control flow does.
- The estimate rule above still governs. **"The review already happened" is a statement about the code
  that was reviewed, never about the code that replaced it.**

## Forbidden Shortcuts

**This file does not enumerate them.** What can be decided mechanically is caught by the gates — biome
and ESLint, `pnpm check:architecture` and `eslint-plugin-boundaries`, the coverage threshold, the pin
and marker checks, and `permissions.deny` in `.claude/settings.json`. The rest is stated by the
`README.md` of the layer you are touching and by [`docs/rules.md`](docs/rules.md).

**A rule this file does not repeat is still a rule.** Not finding a prohibition here is evidence about
this file, not about the prohibition.

**Two responsibility rules have no gate at all**, and `docs/rules.md` says so at each of them: neither
is decidable from the shape of the code. Hold them yourself:

- **Do not pre-emptively handle a problem another layer owns.** Skip what a lower layer already holds
  and what cannot occur; keep what the lower layer cannot catch and what the UX needs here. **A
  security concern is never dropped for being duplicated.**
- **Do not try to exhaustively sanitise a value that came from upstream.** This layer accounts for the
  values it produced; blanket-hardening what the backend put in a string, a path or an identifier is
  not a design goal — exhaustiveness is unreachable and the supplier's concerns bleed into this side's
  structure. Close what must be closed at the supplier or the boundary.

## Where You May Stop

**The places you may hand a decision back are a list, not a judgment**, and the list is closed.
Outside it: decide, act, and record what you decided in the PR body.

### The stopping points

Each is owned by the document named; this section indexes them and restates none.

| Stop | Owner |
| --- | --- |
| Pushing to an existing PR branch after amending | *Git Rules* below — use its exact wording |
| A plain cross-repository link instead of `redirect.github.com` | ADR [0159-1](docs/adr/0159-1-cross-repository-references.md). **Per case, every time**, even under a standing delegation — a standing grant does not transfer this |
| An outward or commercial action a skill is about to take | ADR [0154](docs/adr/0154-claude-skills-operations.md) |
| A change that removes an element the user can see | `docs/rules.md`, *作業とエージェント* |
| Adding a dependency | ADR [0004](docs/adr/0004-library-management.md) — walk its 選定基準 and paste its 採用判断のテンプレ into the PR. Silently routing around the dependency is the same decision, taken without the record |

### The trip wires

These stop the work **whatever your judgment says**. Continuing is itself the error.

1. **The next step needs an operation under `permissions.deny`.** Re-routing it through another
   interpreter is not a solution; neither is editing the deny list.
2. **The next step rewrites history or touches a protected branch** — force push, rebase, amend-then-push.
3. **The next step edits a generated artifact.** `git check-attr linguist-generated -- <path>` answers
   for any path; a generated banner says the same.
4. **Two sources that both claim authority disagree.** Noticing is the job; resolving is not
   (`docs/rules.md`, *作業とエージェント*).
5. **The change would make a document assert something it cannot check** — a rule with no owner, a
   claim with no evaluator ([0157](docs/adr/0157-inspection-declaration-discipline.md)).

### Everywhere else

Decide, and **write the decision into the PR body** — what you chose, and what you chose against. A
recorded decision can be reversed by a reader; a silent one can only be found by re-deriving it.

## AI Modification Scope

By default, AI agents may modify code only in the following scope. All other paths require an explicit user instruction.

> Below v1.0.0 the protected paths in this section are lifted — see "Temporary Operating Rules until v1.0.0" above.

### Allowed

- Under `src/`
- `public/` (asset additions)

### Do not touch without user instruction

- Repository-root config files: `package.json` / `pnpm-workspace.yaml` / `tsconfig.json` / `next.config.ts` / `mise.toml` / `biome.json` / `postcss.config.mjs` / `Makefile`, etc.
- `.makefiles/` (release / branch operation make targets)
- `.github/` (workflows / settings / issue and PR templates)
- `LICENSE`
- Accepted ADR bodies (`docs/adr/0001-*.md` and onward, with Status: Accepted)

### Agent configuration file protection

An agent's configuration must not be touched even by that agent itself; modification requires an explicit user instruction. **Maintaining them is part of the standard path, not an exception** — it is reached through the skill that owns it (`manage-skill` for a skill or agent definition, `canonicalize-doc` for a translation pair), and invoking that skill supplies the instruction. Never on an agent's own initiative.

- Claude Code: `.claude/` (`.claude/skills/` / `.claude/settings.json` / `.claude/settings.local.json`, etc.)
- OpenAI Codex CLI: `.agents/skills/`
- Cursor: `.cursor/` (including `.cursor/rules/*.mdc`) / `.cursorrules`
- GitHub Copilot: `.github/copilot-instructions.md` / `.github/instructions/` / `.github/prompts/`
- Gemini CLI / Code Assist: `.gemini/` / `GEMINI.md`

`AGENTS.md` is shared **Protected Documentation** across all agents.

### Exception: Skill Execution

Invoking a skill (Claude Code's `/<skill-name>`, or an equivalent) counts as an **explicit instruction**. While it runs, this scope is relaxed to what the skill's `SKILL.md` declares.

- Relaxed **only for the skill's duration**, only to the scope it declares, and its own confirmation steps still apply
- **Hard-protected even during skill execution**: `AGENTS.md`, Accepted ADR bodies, `LICENSE`, and anything under `permissions.deny`
- A skill must not be a loophole. If its procedure touches a sensitive area (`.github/workflows/`), its `SKILL.md` declares that so the user knows when invoking it

## Installing Things

Covers every `install` surface: package managers (`brew`, `pnpm add -g`, `pip`), toolchain managers
(`mise use -g`), IDE / agent integrations (`<tool> install`), plugins and extensions.

- **Never install on your own initiative.** Wanting to *use* a tool is not the instruction to *install*
  one; an unavailable tool is a finding to report. Agent integrations in particular write project-scope
  instruction files (`CLAUDE.md`, `AGENTS.md`, `.cursor/`, `.gemini/`, git hooks) — an "install"
  becomes an edit to the rules you are working under.
- **First check what the setup already does.** The toolchain is pinned in [`mise.toml`](mise.toml) and
  reached through `make install-tools`, so the capability is usually already behind a `make` target.
  Say what you checked before concluding otherwise.
- `allow` carries only the project-local idempotent installs, so everything else already surfaces for a
  human decision. Adding a *dependency* is a stricter question —
  [0004](docs/adr/0004-library-management.md), and a listed stopping point.

## Recommended Commands

Run every command **bare. `mise exec -- <command>` is forbidden** — in what you type, in
`.lefthook.yaml`, in `.makefiles/` recipes, anywhere ([0003](docs/adr/0003-version-manager.md)). If a
bare command resolves outside mise, the fix is `PATH`, not a wrapper (`repo-ops` has the symptom).

### pnpm (ADR 0001)

**The script list is `package.json`; [README.md](README.md) names the ones reached for daily.** Three
things are not derivable from it:

- **`pnpm add -E`** for a core dependency or main dev tool — [0004](docs/adr/0004-library-management.md)
  requires the exact pin, and adding a dependency at all is a stopping point.
- **`pnpm gen <kind> <name>`** scaffolds a feature / component / adapter in the shape
  [0027](docs/adr/0027-directory-structure.md) / [0028](docs/adr/0028-naming-convention.md) require.
- **`pnpm lint` is biome only**; `lint:ci` adds ESLint and the boundary check, which is what the hook
  and CI run. **A green `pnpm lint` does not mean a green `lint:ci`** — the react-hooks rules (a ref
  written during render, a `setState` inside an effect) and the ban on type assertions exist only on
  the ESLint side ([0002](docs/adr/0002-formatter-linter.md)). To check one by hand:
  `pnpm exec eslint <path>`.

### make (branch operations / gates / review)

**The full registry is [`.makefiles/README.md`](.makefiles/README.md)**; `make help` prints the same
list from the recipes. Release, tagging, hotfix and one-time setup targets live there, not here.

```bash
make base-branch           # Print the latest release line, read from origin (ADR 0150)
make base-merge            # Merge that base into the current branch; prints unresolved paths
make load-status           # Show the current gate band and why (ADR 0151)
make vrt-review            # Open the stories CI flagged, in a throwaway worktree
make e2e-review            # Same for the screens CI flagged — production build, not the dev server
```

#### Working in a git worktree

Several worktrees run against one host and **nothing allocates ports for you.** Anything that serves —
`pnpm dev`, `pnpm start`, `make e2e`, `make lighthouse`, `make vrt-review` — takes an explicit port
(`E2E_PORT` / `VRT_REVIEW_PORT` / `--port`); pick one no other worktree holds rather than the default,
and do not hijack a server another checkout started. `make review-clean` removes the throwaway
worktrees the review targets leave under `tmp/review/` — Ctrl-C does not, and they keep a
`node_modules` each.

#### Reach every target as `make ai-<target>`

`make ai-trivy-fs` runs `make trivy-fs` with all output captured to `tmp/ai-logs/trivy-fs.txt`: silent
on success, exit code passed through, and one line naming the log on failure. **This is the default,
not a judgment about which targets look noisy.** The exceptions are a closed list: targets whose
output is the answer (`help`, `load-status`, `base-branch`, `lighthouse-report`), and targets that
never return (`e2e-report`, `vrt-report`). `make clean-ai-logs` clears the directory.

#### Read a CI run with `--log-failed`, not `--log`

Measured on this repository's Test workflow, `--log` is **1.6 MB / ~450,000 tokens** where the same
run's `--log-failed` was **1,959 bytes** and carried the complete failure. Use `--log-failed` first,
always; reach for `--log` only when the failure is genuinely not in a failed step, and say what you
narrowed it with. **Never report a gate's verdict through a lossy filter**
([0157](docs/adr/0157-inspection-declaration-discipline.md)).

<!-- boilerplate-only:begin -->
### Do not pre-run the gates

**This section is removed from a repository created from this template**, where one working tree makes
pre-running cheap. Here, several worktrees run against one host and the gates multiply rather than
queue.

**The hooks and CI run them for you, and CI is the authority** ([0151](docs/adr/0151-git-hooks.md)):
`pre-commit` runs the full lint chain and the cached tests, `pre-push` adds the type check, the full
test run and the secret scan.

- **Commit, push, and read the verdict from the hook or CI.**
- Re-running a single file you just edited is fine; sweeping the whole suite or the whole lint is not.
- `make load-status` prints which gates run locally right now; when the host is loaded the heavy ones
  are delegated to CI automatically. **Do not pre-empt that with `--no-verify`** — bypassing is
  governed by 0151's policy, not by how slow a gate feels.
<!-- boilerplate-only:end -->

### Two tools that only change what reaches your context

Neither is on the path of `pnpm build`, `pnpm test` or any required check (constraint 3). Both are
pinned in [`mise.toml`](mise.toml). Costs and exclusions are [`.claude/README.md`](.claude/README.md);
the discipline is here because it binds every turn.

**`rtk`** compresses a command's output before it reaches you (`rtk <sub> <the original command>`).

- **Route a wrappable command through it by default.** A command it cannot compress passes through, so
  there is nothing to weigh per call — `rtk git diff` is 10x here and `rtk find` 64x, while
  `rtk git log` merely passes through. What is weighed is loss, not benefit.
- **Do not wrap `grep` or `read`.** `rtk grep` passes small inputs through but **silently truncates
  large ones**, and `read` drops lines at every level above the default. Both produce output that is
  missing things while looking complete.
- **Never report a gate, a test or a lint through it.** `rtk log` and `rtk read -l` are denied for that
  reason, which is where a rule like this belongs
  ([0144](docs/adr/0144-decision-enforcement-pairing.md)).
- The arbitrary-command wrappers (`run` / `summary` / `smart`) are denied: they route around an allow
  list written at inner-command granularity.

**`graphify`** is a local AST knowledge graph of this repository (`/graphify`).

- **State its freshness whenever you used it.** The graph is the last `update` snapshot and is blind to
  uncommitted work. Compare against `git rev-parse HEAD` and say so in the answer.
- **The graph is a way to reach a file, never the evidence.** Open what it points at and cite that.
- **It is not the cheap default.** Against a targeted `grep` on small diffs it measured 0.76x–3.8x
  worse; what pays is `affected`. `query` truncates at a token budget, so it never answers a question
  needing exhaustiveness.
- Its LLM-calling subcommands send content off the machine and stay opt-in.

## Git Rules

[0150](docs/adr/0150-git-workflow.md) is authoritative. Key points only.

### Critical Rules

- **Force push, rebase, amend, and checking out a protected branch are denied** in
  `.claude/settings.json`, not merely discouraged. Stack fixes as **new commits**; do not route around
  the deny list.
- After amending commits on an existing PR branch, **confirm before pushing**, with this exact message: 「変更はローカルにコミット済みです。これらの変更をプルリクエストにプッシュしますか？」

### Branch, commit, pull request

- **Branch from `$(make -s base-branch)`.** Every other source is stale without saying so — the local
  `origin/HEAD`, the GitHub default branch, and a harness-supplied "Main branch" value alike. Name it
  `feature/` / `bugfix/` / `hotfix/` + `<issue-no>-` when there is one + a kebab description; release
  lines are `release/v<X.Y.Z>`. Two cases the resolver does not answer: **an existing PR's
  `baseRefName` is the authority**, and **a hotfix's base is a human decision — ask**
  ([`scripts/base-branch/README.md`](scripts/base-branch/README.md)).
- **Catch a branch up with `make base-merge`, never by rebasing**, and take in the base the branch was
  cut from — not whatever `base-branch` resolves today, which retargets instead of catching up.
  Whether to take it in at all is a judgment `docs/rules.md`, *作業とエージェント*, owns.
- **Commit subjects are `<Prefix>: <Japanese subject>` with no trailing `。`.** The prefix enum is
  verified by [`commitlint.config.ts`](commitlint.config.ts) through the `commit-msg` hook — read it
  there, not from a copy.
- **PR titles are Japanese**, and the body fills `概要` / `変更内容` / `動作確認方法` from
  [`.github/pull_request_template.md`](.github/pull_request_template.md). Merge commit is the default
  strategy; a push to an existing PR auto-dismisses prior approvals, so request re-review after one.

## Language Rules

**Internal processing may be in English** — code analysis, architectural reasoning, tool calls, every
intermediate step. **What is written back is Japanese**, unless the user explicitly directs otherwise,
in which case that direction governs for as long as it stands.

### Output Language

Targets:

- Responses to the user
- Code comments
- PR titles and bodies
- Commit messages
- Documentation
- Test `it` strings. The outermost `describe` is the exported symbol's own name, so it stays as written in the source ([0090](docs/adr/0090-testing-strategy.md))
- Inline documentation generated by the AI

Technical terms (HTTP status code names / API names / command names, etc.) may stay in English.

**Exception — comments in a workflow definition (`.github/workflows/**` and
`.github/actions/**`) are written in English**
([0140](docs/adr/0140-documentation-operations.md)). Everything else under `.github/` — the issue
and PR templates, `settings/`, a tool's own config — follows the Japanese rule.

### Response Discipline

Governs what you write back, not what you may do. It relaxes no rule above, and brevity is never the
reason to skip a confirmation this file requires.

- **Answer first.** The result, then the reasoning only where it is not obvious. No preamble, no
  restatement of the request, no closing recap.
- **Never assert a verifiable fact you did not read.** API names, flags, versions, paths, symbols,
  commit SHAs, package names — open the code or the doc first. "I have not verified that" is an answer; a
  plausible-looking invention is not.
- **Report the scope asked for, plus what blocks it.** Anything adjacent you noticed is one line or an
  issue, never an unrequested section.
- **Report a deterministic check as it reported itself** — never through a filter that drops rows,
  counts, or coverage ([0157](docs/adr/0157-inspection-declaration-discipline.md)).
- **Generated artifacts carry no decorative Unicode.** Code, config and commit messages use plain
  hyphens and straight quotes; prose written for humans keeps ordinary typography.

<!-- boilerplate-only:begin -->
## Purity Sweep

Every file in this repository is walked once. A `PreToolUse` hook looks the path up before you edit it
and, when the file is not yet recorded, tells you where the procedure is; **it never blocks**.
[`.agents/README.md`](.agents/README.md) owns the mechanism, the ledger and the query entry points.

The pass asks three questions of the **whole file**, not of your diff:

1. **Purity** — can a repository created from this template resolve every reference here, and is every
   statement still true once this repository is a template?
2. **Distillation** — what design judgment does this file embody?
3. **Routing** — which document owns that judgment: an ADR, a layer `README.md`, a feature
   `README.md`, `docs/rules.md`, or the code itself?

- The criteria are in `.agents/purity-sweep/purity-sweep.prompt`. Read it when the hook says so.
- **Record a file only once you have seen all of it** — an entry claiming a sweep that did not happen
  is worse than no entry, because nothing will look at that file again.
- Edits made through `Bash` rather than the file-editing tools do not trigger the hook; the rule
  applies to them anyway.

This is not a review lane. `Review Phase Protocol` judges **a change**; this judges the **accumulated
state of a file**, as a side effect of touching one.
<!-- boilerplate-only:end -->

## Protected Documentation

These require deliberate human review before modification:

- `AGENTS.md` (this file)
- Accepted ADR bodies (`docs/adr/0001-*.md` and onward, with Status: Accepted)
- `LICENSE`

Do not edit them directly — present the proposed change and edit only after explicit approval. Even
when a new file appears necessary, **prefer modifying an existing one** if it suffices.

> Below v1.0.0 this approval requirement is lifted — see "Temporary Operating Rules until v1.0.0" above.
<!-- END:nextjs-agent-rules -->
