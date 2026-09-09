---
name: new-issue
usage-class: situational
description: >-
  Turn a question about a possible change into a GitHub issue whose premises have been verified against the actual implementation — or into the finding that it should not be an issue at all. Use whenever the user wonders aloud whether something is feasible, reports behavior they think is wrong, proposes a refactor, or asks 「これ issue にしといて」「これって直せる？」「こういう機能入れられる？」. The value is not drafting prose: it is tracing the path end to end before asserting anything, refusing to guess when information is missing, and writing the body so each factual claim is individually falsifiable later. Five blockers stop a draft from being filed — asserting runtime behavior without observing it, citing implementation without checking it is current, comparing options with no measured basis, claiming an impact radius without exhausting the search, and not having searched existing issues. The body follows the field set this repository's own issue templates require, because a form-filed issue and a `--body-file` one must carry the same fields and only the latter goes unchecked; on top of that it adds a premises section recording where each claim was verified, and a 論点 section carrying options with a reasoned recommendation. Filing is gated behind "should this be an issue at all" — an existing issue that only needs a comment, or a fix small enough to just make, is not a new issue. Do NOT use it to review a diff (`impl-review` / `test-review` / `comment-sweep`), to compare options nobody has chosen between yet (`research` first), or to write an ADR.
argument-hint: '[question or description] [--verify=observed|static] [--output=file|draft]'
---

# New Issue

Convert a question about a possible change into an issue that can be trusted later — or into the
conclusion that no issue is warranted.

The drafting is the easy part. What this skill exists for is the step before it: **checking that what
you are about to assert is true of the code as it stands right now**, and refusing to fill gaps with
plausible guesses. An issue is read months later by someone who will act on it; a confident sentence
that was never verified costs more than no issue at all.

A Japanese reference translation lives at `SKILL.ja.md` in this directory (for human reference only;
not loaded as a skill).

## When to Use

- The user wonders whether something is feasible, or proposes a change in passing.
- The user reports behavior they believe is wrong.
- The user asks for an issue outright.

## Contract

| | |
| --- | --- |
| **Owns** | 前提の裏取り、falsifiable な本文の作成、「これは issue か」の関門、起票 |
| **Never** | 実行していない振る舞いを断定する / 測っていないコストを比較に出す / 未決の選択を決着として書く / 素の外部リンクを自分の判断で貼る |
| **Starts when** | 変更の可能性についての問いがあり、追跡する値打ちがありそうなとき |
| **Stops when** | 前提が反証された、既存 issue で足りる、その場で直せる大きさだった |

## Do NOT use this skill for

- Reviewing a diff — `impl-review` / `test-review` / `comment-sweep`.
- Comparing options nobody has chosen between yet — `research` first; its recommendation is not a
  decision.
- Writing an ADR.

## Why this exists

An issue's factual claims are usually wrong for one reason: **nobody looked outside the layer they
were thinking about.** A status code, the boundary a value actually crosses, the cost of an option —
each is statically checkable, and each is decided somewhere the author never opened. Reading "the
relevant layer" is not the same as tracing the path.

## Step 0 — Confirm two things (one `AskUserQuestion`)

**Verification depth** — how far a behavioral claim must be proven before filing.

| Mode | Behavior |
| --- | --- |
| `static` *(default)* | Code reading only; every behavioral claim is marked unverified in the body |
| `observed` | Stand the app up and observe the behavior before filing. **Ask first** — running the app is a separate decision here, not a step this skill takes on its own |

**Output** — whether this run ends in a filed issue or a handed-over draft.

| Mode | Behavior |
| --- | --- |
| `file` *(default)* | Present the body, then file after approval |
| `draft` | Produce the body and the analysis; file nothing |

Searching existing issues is not a mode. It always happens — it is cheap, and skipping it is how a
duplicate gets filed.

## Step 1 — Capture the question

Restate what the user is actually asking, in one or two sentences, and confirm it. A question asked in
passing (「これ直せる？」) usually carries an unstated assumption about *where* the problem is; naming
that assumption early is what lets Step 2 disprove it.

Record what triggered this: a symptom the user hit, a review finding, a code reading. **The origin
determines how much of it is already evidence and how much is conjecture.**

## Step 2 — Trace the path end to end

This is the step the skill exists for. **Do not read only the layer the question points at.**

For a behavioral question, follow the request from the entry point outward:

```txt
proxy → route segment / route handler / Server Action → features → adapters → the backend contract
```

**`src/proxy.ts` is the most commonly skipped segment and the most commonly decisive one**, because it
can reject or rewrite a request before the layer under discussion ever runs — and its `matcher`
decides which paths it sees at all.

Two boundaries specific to this layer decide more claims than they look like they should:

- **The rendering boundary.** Whether the code in question runs on the server or reaches the browser
  changes what it can touch and what a claim about it means. `"use client"` is a bundle boundary, not
  a "renders on the client" instruction — [`docs/design/rendering.md`](../../../docs/design/rendering.md)
  is canonical, and a claim that gets this wrong is wrong in a way that reads plausible.
- **The import matrix.** What a kernel may reach is decided by [`architecture.ts`](../../../architecture.ts),
  not by what happens to compile today. Read it rather than inferring the rule from an example.

For a structural question, trace the dependency direction instead, and read `docs/rules.md` and the
owning layer `README.md` at runtime rather than from memory.

Then establish, for each thing you intend to assert:

- **Is it current?** The file may have changed in a branch that merged this week. Check recent history
  for the paths involved (`git log --oneline -15 -- <paths>`).
- **Is the radius complete?** If the claim is 「ここだけが〜」, reverse-traverse the graph
  (`graphify affected <symbol>`) rather than guessing at call sites — it returns each one with a
  relation label and `file:line`, which is the evidence a claim of absence needs. **A claim of scope
  is a claim about absence**, and absence is what an exhaustive search is for. State the graph's
  freshness, and fall back to an exhaustive search when it is behind.
- **Does a cost comparison rest on anything?** 「hot path に 1 回読みが増える」 is checkable. **An
  unmeasured cost is not a trade-off, it is a guess.**

## Step 3 — Five blockers

A draft does not proceed to Step 4 while any of these is true. They are deliberately mechanical: **an
author asked to *notice* that they are unsure will usually not notice.**

| # | Blocker | Resolution |
| --- | --- | --- |
| 1 | The draft asserts runtime behavior that was never observed | Observe it (Step 5), or mark the claim unverified and say so in the body |
| 2 | Cited implementation was not checked for currency | Check history for those paths |
| 3 | An option comparison has no measured basis | Measure it, or drop the comparison and present the options without a cost claim |
| 4 | An impact-radius claim rests on a partial search | Reverse-traverse the graph, search exhaustively, or narrow the claim to what was covered |
| 5 | Existing issues were not searched | Search |

**When information is missing, ask — do not estimate.** A plausible guess written in an issue's
confident register becomes fact for everyone who reads it afterward. Missing information includes
which behavior is actually desired, which of several possible causes the user has in mind, and
whether a constraint the code implies is intentional. Ask about those; do not resolve them by
inference.

## Step 4 — Draft the body

**The field set is this repository's, not this skill's.** Read `.github/ISSUE_TEMPLATE/` at runtime,
pick the template that matches, and fill the fields it marks required. Do not carry a field list in
this file — the templates change, and a list here would be the copy that rots.

Two things make that non-optional rather than tidy:

- **`scripts/issue-field-lint` matches the required headings exactly**, at `###`. A body filed with
  `##` fails the check on an issue you just created.
- **The templates only bind the web form.** A `--body-file` issue bypasses them entirely — and that is
  the path an agent files on. The lint exists because of that gap; writing the fields yourself is
  what closes it.

On top of the template's fields, add three sections. They are what makes the issue checkable later:

```markdown
### 前提            ← 事実の主張ごとに、どこで裏取りしたか
### 論点            ← 選択肢と、理由付きの推奨（決着ではなく論点として）
### やらないこと
```

**The 前提 section is the point.** Write each premise as a separate, individually falsifiable
statement with the evidence behind it:

```markdown
### 前提

- 保護対象の経路に無資格の要求が届く — **確認済み**: `matcher` がその接頭辞を選んでいない
  （`src/proxy.ts`、`<commit>` 時点）
- この値は表示側まで生の形で届かない — **未確認**: 静的な読みのみ。実際の応答は観測していない
```

Whoever picks the issue up reads this section and can tell, claim by claim, which ones still hold.
**Prose that buries its assumptions cannot be checked that way** — and that is how a wrong claim
survives to implementation.

Three writing rules that keep an issue from rotting:

- **Cite symbols and paths, never line numbers.** A line number is stale by the next refactor, and a
  reader who follows one to the wrong place trusts what they find there.
- **Record the recommendation together with its basis.** A recommendation that turns out to be wrong
  is fine and normal; one whose reasoning is invisible cannot be overturned by evidence.
- **Redact before writing a security finding.** This repository is public and an issue cannot be
  retracted. Describe the shape, cite `path` and symbol, and never reproduce a secret-shaped value.
  A finding whose point cannot survive redaction is one to raise privately, not to file.

**For a link to another repository's issue or PR, use `redirect.github.com`.** A plain `github.com`
link posts a public cross-reference on that thread, and editing the body afterwards does not retract
it. Whether to send that signal deliberately is a human decision, **without exception** — ask every
time, and never make the call yourself, even under a standing delegation. `AGENTS.md` governs.

Write the body in Japanese. Present it and wait for approval.

## Step 5 — Observing the behavior (only under `--verify=observed`)

Under `--verify=static` this step does not happen, and **every behavioral claim in 前提 is marked
unverified**. An unverified claim presented in the same register as a verified one is worse than an
admitted gap.

Under `--verify=observed`, confirm the claims against a running app — **after asking, because standing
the app up is its own decision here**. `APP_ENV` must be set explicitly; the loader does not fall back
to a default, and the dev-only session entry requires the environment to name itself
([`docs/design/auth.md`](../../../docs/design/auth.md) is canonical for the auth side).

**Do not run the gates to "verify" anything.** They belong to the hooks and CI, and CI is the
authority. What this step observes is behavior, not a green check.

Report which claims were observed and which were only read.

## Step 6 — Decide whether this should be an issue at all

Run this gate before filing. **An AI that can write issues quickly will produce more of them than a
human would**, and issue count is itself a cost — a duplicate buries the original, and a backlog
nobody can read is a backlog nobody uses.

| Situation | Action instead of filing |
| --- | --- |
| An existing issue covers it | Comment there with the new finding |
| The fix is small enough to just make | Offer to make it now |
| Step 2 disproved the premise | Report that; file nothing |
| It is a decision, not a task | Propose an ADR, or a slot in `docs/adr/BACKLOG.md` with its 撤回条件 |
| It is a screen's promise, not a defect | Propose a spec update under `docs/spec/` |
| It is a thing deliberately not carried | Check `docs/project/out-of-scope.md` first — it may already be answered, with the condition that would change it |

Search before concluding it is new:

```bash
gh issue list --state open --limit 100 --search "<keywords> in:title"
gh issue list --state all --limit 50 --search "<keywords>"
```

**Include closed issues.** A previously rejected proposal is important context, and re-filing it
without acknowledging the rejection wastes the reader's time.

State which branch of the table applied. **Silence reads as "it was obviously an issue".**

## Step 7 — File

```bash
gh issue create --title "<title>" --label <label> --body-file <file>
```

Labels come from `.github/settings/labels.json`; read it rather than guessing a name. Report the URL,
and say which premises were observed and which only read.

If the user selected `--output=draft`, stop before this and hand over the body.

## Where this sits

Upstream sits `research`, which compares undecided options and stops at `決めるべきこと`. **Its
recommendation is not a decision** — a human's approval is what turns it into one, and this skill is
where that approved outcome becomes trackable. When a question arrives carrying a recommendation
nobody has approved yet, **that is the gap to name, not to close**: write it as the 論点, not as a
settled plan.

Downstream is whoever picks the issue up. Write for that reader: **state assumptions where they can be
checked, not where they read most smoothly.**

## Do / Do NOT

- ✅ Trace the whole path, `src/proxy.ts` included, before asserting anything.
- ✅ Read the rendering boundary and the import matrix rather than inferring them.
- ✅ Ask when information is missing; never fill the gap by inference.
- ✅ Read `.github/ISSUE_TEMPLATE/` at runtime and fill the fields it requires, at `###`.
- ✅ Write each premise as a separate falsifiable claim with its evidence.
- ✅ Search existing issues, closed ones included, before concluding it is new.
- ✅ Say explicitly which claims are unverified.
- ✅ Cite symbols and paths; record the recommendation's basis alongside it.
- ✅ Redact a security finding before it reaches a public issue.
- ✅ State which branch of the Step 6 table applied.
- ✅ Write in Japanese.
- ❌ Assert runtime behavior that was never observed, without labelling it as unverified.
- ❌ Carry the template's field list in this file instead of reading it.
- ❌ Present an unmeasured cost as a trade-off.
- ❌ Claim an impact radius from a partial search.
- ❌ File when an existing issue only needs a comment, or when the fix is smaller than the issue.
- ❌ Link another repository's issue with a plain `github.com` URL, or decide on your own that a
  cross-reference is warranted.
- ❌ Write line numbers into the body.
- ❌ Run a gate as a substitute for observing behavior.

## Checklist

- [ ] Verification depth and output mode confirmed in one `AskUserQuestion`.
- [ ] The question restated and confirmed; its origin recorded.
- [ ] Path traced end to end, `src/proxy.ts` included; rendering boundary and import matrix read;
      cited code checked for currency; impact radius searched exhaustively.
- [ ] All five blockers cleared, or the corresponding claim narrowed / marked unverified.
- [ ] Missing information asked about rather than estimated.
- [ ] Template read at runtime; required fields filled at `###`; 前提 / 論点 / やらないこと added.
- [ ] Premises written as separate falsifiable claims with evidence; symbols not line numbers.
- [ ] Security findings redacted; no secret-shaped value reproduced.
- [ ] Behavior observed, or every behavioral claim marked unverified.
- [ ] Existing issues searched including closed; the should-this-be-an-issue gate applied and its
      outcome stated.
- [ ] Any cross-repository link routed through `redirect.github.com`, or asked about individually.
- [ ] Filed and URL reported, or handed over as a draft.
