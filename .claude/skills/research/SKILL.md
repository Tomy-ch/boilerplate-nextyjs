---
name: research
description: >-
  Compress an undecided design, library, or operational question into a comparison a human can decide from — options scored on axes chosen for the question, a recommendation stated with its basis, and the conditions that would reverse it. Use whenever a choice is genuinely open and nobody has picked yet: which library or pattern to use, where a responsibility belongs, whether to introduce an abstraction, how to shape a seam — 「A と B どっちが妥当？」「どう設計すべき？」「このライブラリ入れていい？」「何を使うのが普通？」「選択肢を出して」. It starts by trying to dissolve the question rather than answer it: a standing ADR, a 撤回条件 in the ADR backlog, an entry in the out-of-scope list, or an isomorphic mechanism already living in one of the kernels settles it without a comparison, so it says so instead of manufacturing three options. When a branch is real it fixes the evaluation axes BEFORE enumerating options, so the axes cannot be reverse-engineered from a preferred answer, and it never fixes the option count — inventing a third option for a do-it / do-not question is how a comparison becomes theatre. The starting axes are read at runtime — de-facto standard and non-lock-in, derivation from the adopted architecture, purity of the template snapshot, and for a dependency the selection criteria in the library-policy ADR and the pull request template's dependency section — and the axes a run did not raise are listed with the reason. Cost is stated plainly and never lets it pick the answer. External claims carry publisher, date and URL; an unverifiable one is reported as unverified and lowers the confidence rather than being dressed up. Read-only and decision-free: it produces 決めるべきこと and stops, because adopting an option, writing the ADR, and filing the issue are human calls. Do NOT use it to establish what the repository currently does (`repo-truth` first — a comparison built on a wrong premise is worse than none), to find the sanctioned procedure for an operation (`how-to`), to file the outcome (`new-issue`), or to review a diff (`impl-review` / `test-review` / `comment-sweep`).
argument-hint: '[question] [--stage=dissolve|full] [--sources=repo|external] [--axes=<csv>]'
---

# Research

Turn an open question into a decision a human can actually make — or into the finding that it was
never open.

A Japanese reference translation lives at `SKILL.ja.md` in this directory (for human reference only;
not loaded as a skill).

## When to Use

- A design, library, or operational choice is open and nobody has picked yet.
- Someone asks for options, or asks what the normal approach is.
- A decision is being reconsidered and needs its trade-offs laid out again.

## Contract

| | |
| --- | --- |
| **Owns** | 未決の比較、評価軸の確定、推奨とその反転条件、決めるべきことの提示 |
| **Never** | 採択 / ADR の執筆 / 実装 / 案数合わせの選択肢の捏造 / 出典・数値の捏造 |
| **Starts when** | 選択が開いていて、まだ誰も決めていないとき |
| **Stops when** | 現状が不明（`repo-truth` へ）、既に決着している、外部情報を確認できない |

## Do NOT use this skill for

- Establishing what the repository currently does — `repo-truth` first.
- Finding the sanctioned procedure for an operation — `how-to`.
- Filing the outcome — `new-issue`.
- Reviewing a diff — `impl-review` / `test-review` / `comment-sweep`.

## Why this exists

Three failure modes make a comparison worse than no comparison, and all three look like diligence.

**The axes get reverse-engineered from the answer.** Once a preferred option exists, the criteria
that favour it are the ones that get written down. Fixing the axes first is the only defence, and it
has to happen before any option is named.

**Cost picks the answer.** 「30 ファイル触ることになる」 quietly becomes the deciding argument.
`AGENTS.md`'s *What to Recommend* is explicit that here quality and consistency outrank the cost of
reaching them, and that the cost is stated so a human can decline the scope while keeping the
direction. Stating the cost is required; letting it choose is not.

**Evidence gets manufactured.** A benchmark number, a version, a 「一般に推奨される」 — each is easy to
produce and hard to notice as invented. An unverified claim in a comparison's confident register
becomes the basis of a decision nobody can trace back.

There is a fourth thing this skill exists to prevent, and it is subtler: **answering a question that
was never open.** See Steps 0 and 1.

## Arguments

| Argument | Effect |
| --- | --- |
| `--stage=full` *(default)* | Run through to a recommendation |
| `--stage=dissolve` | Run Steps 0-1 only and stop — is it already decided, is there an isomorphic precedent? |
| `--sources=repo` | Repo evidence only; make no external claim rather than an unverified one |
| `--sources=external` *(default)* | External lookup permitted, cited per the Sources section |
| `--axes=<csv>` | The caller fixes the evaluation axes; Step 2 adopts them instead of choosing |

`--stage=dissolve` is the cheap mode and often the whole answer: most questions that arrive here are
either settled already or structurally identical to something this repository solved. Reach for it
when the ask is 「これはそもそも未決なのか？」 — and **report the dissolution as a result, not as a
failure to compare**.

`--sources=repo` is the honest mode when lookup is unavailable. It is not a degraded run; it is a run
that declines to guess, and it must say which claims it therefore could not make.

## Step 0 — Establish that the question is actually open

A comparison built on a wrong premise about the current code is worse than no comparison, because it
looks decidable.

Before anything else, establish the current state. If it is unclear or contested, **stop and say
so**: the user should run `repo-truth` first. Do not invoke it yourself and do not paper over the gap
with an assumption, because the assumption then silently shapes every option.

**Three places settle a question here, not one.** Missing any of them produces this skill's most
expensive output — a comparison that re-litigates something already decided.

| Where | What it settles |
| --- | --- |
| [`docs/adr/`](../../../docs/adr/README.md) | A standing decision, including the deliberate exclusions |
| [`docs/adr/BACKLOG.md`](../../../docs/adr/BACKLOG.md) | A slot's **撤回条件** — what was deferred, and what would have to become true to revisit it |
| [`docs/project/out-of-scope.md`](../../../docs/project/out-of-scope.md) | What this repository deliberately does not carry, and under what condition it would |

The last two are what make 「やらない」 a decision rather than an absence. A question that looks open
is often one whose 撤回条件 simply has not been met — and the answer is that condition, not a
comparison.

**Look for the deciding record by concern, not by keyword.** `AGENTS.md` states plainly that
searching an index for your feature's words is not enough, because a document is named for the
concern it owns. Read the entries in `docs/adr/README.md` and `docs/design/README.md` and pick by
what each one governs.

If something already decides this, that is the answer. Report it, note whether the reasoning still
holds, and stop. **Re-opening a settled decision is a human's call** — a precedent is not an
authorization.

## Step 1 — Look for an isomorphic mechanism first

Before treating this as a design question, check whether this repository already solves a
structurally identical problem somewhere else. When it does, placement, construction, and call-site
are already decided by that precedent, and scoring options would be inventing a branch that does not
exist.

This is the cheapest step and the most frequently skipped one. **Enumerate the kernels from
[`architecture.ts`](../../../architecture.ts)** — that file is the authority on what exists and what
may import what — then read the owning `README.md` and [`docs/design/placement.md`](../../../docs/design/placement.md)
at runtime rather than reasoning from the shape of the problem.

**An isomorphic mechanism is found by its shape, which means a keyword search will not find it.** It
solves a different problem with the same structure, so it shares no vocabulary with the question —
the precedent for a retry window is a pagination cursor, and no search for 「窓」 reaches it.

**This is what the graph is for.** `graphify` indexes structure rather than text, so it reaches the
precedent that shares no words with the question — the one case where search is guaranteed to fail
and traversal is not:

```bash
graphify query "<structural question>" --budget 8000   # 既定の budget は大きなリポジトリで切り詰められる
graphify affected <symbol>                             # その前例に何が依存しているか＝どれだけ効いているか
```

Confirm any candidate in source before calling it isomorphic — a graph edge shows a relation, not
that the two solve the same shape of problem. When the graph is behind the working tree, say so: a
structural sweep you could not run is part of what makes 「前例なし」 a weaker claim.

That asymmetry sets the burden of proof. 「見つけた」 is verifiable by inspection, so it needs no
frontier. 「無い」 is a claim about every kernel you did not open, so **say which kernels were
enumerated** — and if the sweep was partial, present the options as *provisional pending that check*
rather than asserting the branch is real.

Say plainly when it applies:

> 設計分岐なし。`<X>` は既存の `<Y>` と同型で、配置・構築・呼び出し位置はそちらの前例で確定する。

Scoring axes are what you reach for when this step finds nothing — and finding nothing is a claim
that has to be earned.

## Step 2 — Fix the evaluation axes, then stop touching them

Choose the axes for *this* question and write them down before naming a single option.

**Read the starting axes at runtime; do not treat the list below as a fixed rubric.** They are where
this repository's judgments actually live, and each one is owned by a document that can change:

| Axis | Owned by |
| --- | --- |
| デファクトへの適合 / 非ロックイン | [0010](../../../docs/adr/0010-standards-and-non-lockin.md) |
| 採用アーキテクチャからの導出 | [0020](../../../docs/adr/0020-adopted-architecture.md) / [0021](../../../docs/adr/0021-frontend-responsibility.md) / `architecture.ts` |
| テンプレート適用時の状態としての純粋さ | `AGENTS.md` § What to Recommend |
| 依存を足す問いなら、選定基準 | [0004](../../../docs/adr/0004-library-management.md) と [`.github/pull_request_template.md`](../../../.github/pull_request_template.md) の依存欄 |

A question about a CI gate does not turn on the architecture axis; a question about adding a library
turns almost entirely on the last row. Pick what the question actually turns on, and say why each
axis is there.

**Write down the axes you did not raise, too.** An axis can be absent because the question does not
turn on it, or because this run could not source it — `--sources=repo` removes the industry-practice
axis outright, and a reader shown four axes has no way to tell which of the two happened. **The
comparison's shape is itself a claim about what mattered.**

The third row is the one most easily forgotten and most often decisive: **this repository's product
is the state a project receives when it is created from this template**, not the history that
produced it. Weigh each option for someone who has never seen this repository and will never read its
git log.

## Step 3 — Enumerate options — the count is not the point

Enumerate the options the question actually has. Three is a common number and not a requirement: a
do-it / do-not question has two, and inventing a third to fill the shape produces a straw man that
makes the comparison look more considered than it is. A question with five genuinely distinct
approaches gets five; compress by merging near-duplicates, never by dropping one that differs.

Per option, and against the axes fixed in Step 2:

| Field | What it must contain |
| --- | --- |
| 案 | A name that says what it is, not 「案 A」 |
| 利点 / 欠点 | Consequences, not adjectives |
| リスク | Failure mode, migration, operational burden, security, lock-in |
| 既存構造との整合 | Which kernel owns it, which rule in `docs/rules.md` it touches, what it forces elsewhere |
| コスト | Files touched, what breaks for whom, what must be regenerated — stated, never weighted into the verdict |

An unmeasured cost is not a trade-off, it is a guess. The same applies to blast radius:
「30 ファイルくらい触る」 is a number the graph produces rather than estimates, so reverse-traverse
from the symbols each option would change (`graphify affected <symbol>`) and report what it returned.

When a cost genuinely could not be measured, it goes under `未確認` with what measuring it would
change — **not into the cost field hedged with a qualifier**. A hedged number still reads as a
number, and it is the one the reader carries into the decision.

## Step 4 — Recommend, and say what would reverse it

**Give a recommendation.** A comparison handed over without one returns the work to the person who
asked; here the expectation is that the recommendation arrives with the options, not after being
asked for.

Then write the reversal conditions — the facts that, if different, would change the answer. This is
what makes a recommendation overturnable by evidence instead of by argument, and it is also the
honest record of what you were unsure about:

> この推奨は、`<前提>` が成り立つ限り。`<条件>` なら B が優位に転じる。

## Step 5 — Answer in this contract

Always this shape, in Japanese. Lead with the recommendation; the comparison is the support.

```markdown
## 問題
<何を決めようとしているか、1〜2 文>

## 前提
- <置いた仮定と、それが崩れたときの影響>

## 評価軸
- <軸> — <なぜこの問いでこの軸なのか>
- 立てなかった軸: <軸> — <なぜこの問いでは立てられない / 関係しないのか>

## 選択肢
### <案の名前>
- 利点 / 欠点 / リスク / 既存構造との整合 / コスト

## 推奨
<どれを、なぜ>

## 推奨が変わる条件
- <この事実が違えば結論が変わる>

## 未確認
- <測れなかったコスト / 確認できなかった主張> — <なぜ測れなかったか、測れば何が変わるか>

## 決めるべきこと
- <人が決める事項> — 記録先: ADR / BACKLOG の枠 / issue / spec / 層 README のどれか
```

When only part of the question could be researched, return that part and name the rest as
unresearched. A precise partial comparison beats a complete-looking one.

## Sources

Every external claim carries publisher, title, URL, and access date. Prefer primary and official
material — the project's own documentation, a specification, a release note — over secondary
summaries.

When lookup is unavailable, or a claim cannot be confirmed, **say it is unverified and lower the
confidence of anything resting on it**. Never produce a benchmark figure, a version number, a
deprecation date, or a citation you did not read. A fabricated source is not a small error here: it
is indistinguishable from a real one at the moment a decision is made, and it survives into the ADR.

For an in-repository claim, cite the path and the symbol, never a line number.

## Standalone by design

This skill produces `決めるべきこと` and stops. It does not adopt an option, write an ADR, file an
issue, or start implementing — and it does not invoke `new-issue` for you.

**The gap between a recommendation and a decision is the whole point of the step.** A recommendation
that flows straight into implementation was never reviewed by anyone; `AGENTS.md` puts the areas
`docs/adr/BACKLOG.md` still leaves blank behind a human gate precisely so that the option surviving
to code is one somebody chose. The route onward is human approval, then `new-issue`.

## Do / Do NOT

- ✅ Establish the current state first; stop and ask for `repo-truth` when it is unclear.
- ✅ Check all three settling places — the ADRs, the backlog's 撤回条件, and the out-of-scope list.
- ✅ Search the indexes by concern, never by the feature's words.
- ✅ Look for an isomorphic mechanism before treating the question as a design branch — by shape, by
  enumerating the kernels, not by grepping the concept.
- ✅ Traverse the graph for structural precedents and for blast radius, then confirm in source.
- ✅ Say which kernels were enumerated before asserting no precedent exists; mark the options
  provisional when the sweep was partial.
- ✅ Fix the evaluation axes before naming any option, reading their owners at runtime, and justify
  each axis — including the ones you did not raise, and why.
- ✅ Put a cost you could not measure under `未確認` with what measuring it would change.
- ✅ Weigh options for the reader who receives the template snapshot, not for this repository's history.
- ✅ State cost plainly, as information, alongside the recommendation.
- ✅ Give a recommendation with its basis, and the conditions that reverse it.
- ✅ Cite publisher, title, URL, and access date for every external claim.
- ✅ Answer in Japanese.
- ❌ Manufacture an option to reach a target count, or drop one that genuinely differs.
- ❌ Choose the axes after the preferred option is known.
- ❌ Let cost decide the recommendation.
- ❌ Invent a benchmark, a version, a date, or a citation; present an unverified claim as verified.
- ❌ Adopt an option, write an ADR, file an issue, or implement anything.
- ❌ Assert that no precedent exists off a keyword search, or off kernels you did not enumerate.
- ❌ Re-open a settled decision on your own initiative.
- ❌ Chain into `repo-truth` or `new-issue`.

## Checklist

- [ ] `--stage` / `--sources` resolved; under `repo` the unmakeable claims were named.
- [ ] Current state established, or the run stopped with `repo-truth` named as the next step.
- [ ] All three settling places checked by concern; a standing decision or an unmet 撤回条件 reported
      as the answer if one exists.
- [ ] Isomorphic-mechanism check done by shape over enumerated kernels; 「設計分岐なし」 reported when
      it applies, and the enumerated scope stated when claiming none exists.
- [ ] Evaluation axes fixed and justified before any option was named, their owners read at runtime;
      axes deliberately not raised are listed with the reason.
- [ ] Costs and claims that could not be established are under `未確認`, not hedged inline.
- [ ] Options enumerated by what the question has, not to a target count.
- [ ] Each option carries consequences, risk, structural fit, and a stated cost.
- [ ] Recommendation given with its basis, and reversal conditions written.
- [ ] External claims sourced with publisher / date / URL; unverified ones labelled and discounted.
- [ ] `決めるべきこと` names the decisions and where each is recorded.
- [ ] Nothing adopted, filed, written, or implemented; no skill chained.
