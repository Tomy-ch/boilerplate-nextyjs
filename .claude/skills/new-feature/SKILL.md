---
name: new-feature
description: >-
  End-to-end driver that takes one screen from a direction to a reviewed, spec-backed, tested feature slice, chaining the rails this repository already ships instead of inventing a parallel path — `docs/playbook.md` (where things go), `pnpm gen` (placement / naming / boundaries), `docs/templates/feature-readme.md` (the spec sections a feature README must carry), `mocks/` (implement against the contract without a backend), and `docs/spec/route/**` (what the screen promises). It follows the repository's screen-implementation order — direction → story → review → split → spec → tests — because tests written before the look is settled get rewritten, and it reads that order from `docs/playbook.md` at runtime rather than hardcoding it. Use it whenever a NEW screen or feature slice is being added and you want the whole path built consistently: 「画面を追加したい」「feature を新しく作りたい」「新しい画面を一から作って」「new-feature」, or when a direction exists and the placement, README sections, spec, and tests all still have to be produced. Do NOT use it to modify an existing feature (edit it directly), to add anything under `src/components/**`, `src/adapters/**`, `src/model/**`, `src/stores/**`, or `src/capabilities/**` — those are kernels, so run `pnpm gen <kind> <name>` directly and skip the story-first order, which exists only where a screen's look is being settled, to write tests for code that already exists (`scaffold-test`), or to review anything (`impl-review` / `test-review` / `comment-sweep` are peers under the Review Phase Protocol and this skill never invokes them). Halts on a failing phase and never auto-rollbacks; the user stays the author-of-record for the direction, the look, and the promises.
---

# New Feature

Builds one screen end-to-end by chaining what this repository already has, so the person adding a
screen does not have to rediscover where things go. The skill owns the **order** and the
**hand-offs**; every rule it applies is read at runtime from the document that owns it.

A Japanese reference translation of this skill is available at `SKILL.ja.md` in the same directory
(not loaded as a skill; for human reference only).

## When to Use

- A new screen or feature slice is being added and the direction (what it should show) exists or is
  about to be decided.
- The placement, the feature README sections, the spec under `docs/spec/route/**`, and the tests all
  still have to be produced, and you want them produced in an order that does not create rework.

## Do NOT use this skill for

- **Modifying an existing feature** — edit it directly. This skill assumes nothing is there yet.
- **A kernel-side unit** (`components` / `adapters` / `model` / `stores` / `capabilities`) — run
  `pnpm gen <kind> <name>` directly. `docs/playbook.md` exempts kernels from the story-first order
  because no look is being settled there.
- **Writing tests for code that already exists** — that is `scaffold-test`.
- **Reviewing** — `impl-review`, `test-review`, and `comment-sweep` are peers under `AGENTS.md`'s
  Review Phase Protocol. This skill hands the decision to the user and **never invokes them**; a
  skill that chained them would make the three subjects stop being independently answerable.

## What this skill reads at runtime

Nothing below is restated inside this file. Read the source each run so the skill tracks the
conventions as they change.

| Source | What it decides |
| --- | --- |
| `docs/playbook.md` | The screen-implementation order, the placement reverse-index, and the gate policy |
| `docs/templates/feature-readme.md` | The sections a feature README must carry |
| `docs/spec/README.md` | The two-layer spec split and where each file goes |
| `src/features/README.md` and the kernel READMEs | Import boundaries, `test-requirement`, public surface |
| `architecture.ts` | The dependency matrix `pnpm gen` and ESLint boundaries enforce |
| `mocks/README.md` | How to drive the screen without a backend |

If any of these disagree with this file, **they win** — report the disagreement rather than
following this file.

## Step 0. Confirm the subject

Call `AskUserQuestion` before writing anything:

1. **Feature name** (kebab-case) and the route it will live at.
2. **The direction** — what the screen shows, or a pointer to where that was decided. If the user
   has only an idea, say so and run Step 2; do not invent product content.
3. **Whether a spec already exists** under `docs/spec/route/**` for this route.

Read `docs/playbook.md` now and follow the order it states. The order below mirrors it at the time
of writing; **if they differ, the playbook is correct.**

## Step 1. Ground the design in the repository

Launch 2–3 `Explore` agents in parallel (one message) on different aspects — the closest existing
screen and its full `app` → `features` → `adapters` path, the kernel conventions the new screen will
touch, the contract and mock handlers it will consume. Read the files they surface before designing;
present the patterns found with `file:line` references.

Reuse the existing `Explore` / `Plan` agent types. Do not define new ones (ADR 0155).

## Step 2. Direction (order step 1)

Fill `docs/templates/feature-readme.md` into `src/features/<name>/README.md`: the route and the
contract it consumes, the state table, the kernel dependencies, the Server Action return contract,
and the test viewpoints. The state table drives the next step, so it is written before any component
exists.

Where the direction is genuinely underspecified, ask with `AskUserQuestion` rather than choosing
product behavior. The user is the author-of-record for what the screen promises.

## Step 3. Story first (order step 2)

Run `pnpm gen feature <name>` for the slice, plus `pnpm gen component <name> --as=<heading>` for any shared part the
design calls for. Let the generator place, name, and bound the files — never hand-place them, and
never pass it an input other than the one it takes (`architecture.ts` + the layer README are its
single source; `docs/spec/**` is **not** a generation input).

It emits three flat files — `README.md`, `<name>.tsx`, `<name>.test.tsx` — and does **not** split the
slice into `list/` and `detail/`. That is deliberate: ADR 0027 keeps the screen axis collapsed until a
second screen arrives, so the split belongs to Step 5, not here. Do not pre-create the directories the
generator declined to make.

Then write the stories for all four states the README's state table declares — loading / empty /
error / success. Split the view so it holds no fetching, which is what lets every state come out of
a story.

## Step 4. Review hand-off (order step 3)

**Stop here and let a human settle the look.** Serve the real thing rather than describing it:

```bash
pnpm storybook
```

The script already defaults `APP_ENV` to `local`, so it needs no prefix. It serves on `:6006` — run
one instance per tool and leave closing it to the user. Hand over the URL and the story ids to look
at, and wait.

**Do not write tests before this returns.** That is the whole reason the order exists — a test
written against an unsettled look gets rewritten, and a rewritten test tends to be relaxed until it
passes rather than until it is right.

## Step 5. Split (order step 4)

Move what the review settled into its layers. Decide placement from `docs/playbook.md`'s reverse
index and the kernel READMEs; carry the criteria as a reference path to the ADR that owns it rather
than restating it in code or in the README.

## Step 6. Spec (order step 5)

Write `docs/spec/route/<...>/page.{function,screen}.md` per `docs/spec/README.md`: the functional
requirements and the screen requirements, split by "could a screen exist with the same contract and
the same user goal but a different description?".

The spec records settled promises, which is why it is written here and not first. It **points at**
the contract, tokens, `rules.md`, the component catalog, and the ADRs — it never copies them.

## Step 7. Tests (order step 6)

Chain the `scaffold-test` skill for the units now in place. It derives the viewpoints from the
subject's own branches and the nearest README's `test-requirement`; do not restate test conventions
here.

## Step 8. Gates and hand-off

`docs/playbook.md` states who owns the verdict: **the hooks and CI**. Do not sweep the whole lint or
the whole suite locally — commit, push, and read the result. `make load-status` shows which gates run
locally right now.

Close with a Japanese summary: the files produced per layer, the four states covered, the spec files
written, and what CI is still deciding. Then state — do not run — that `AGENTS.md`'s Review Phase
Protocol asks the user per skill whether to run `/impl-review`, `/test-review`, and
`/comment-sweep`, with an estimate of what each is likely to return for this change.

**Do not commit. Do not push.** Both belong to the user, through `/commit` and `/submit-pr`.

## Constraints

- ❌ Write tests before the review in Step 4 returns.
- ❌ Hand-place a file `pnpm gen` would have placed, or feed the generator an input other than
  `architecture.ts` + the layer README.
- ❌ Treat `docs/spec/**` as a generation input — it is a **read** input only.
- ❌ Invoke `impl-review` / `test-review` / `comment-sweep`.
- ❌ Invent product behavior when the direction is underspecified — ask.
- ❌ Run the full lint or the full test suite locally to pre-empt a gate.
- ❌ Restate in this file a rule that `docs/playbook.md`, a kernel README, or an ADR owns.
- ✅ Japanese for everything the skill emits or writes to the repository.
- ✅ Halt on a failing phase and surface it; never auto-rollback earlier writes.
- ✅ Reuse the existing `Explore` / `Plan` agent types.

## Checklist

- [ ] Feature name, route, and direction confirmed via `AskUserQuestion` (Step 0)
- [ ] `docs/playbook.md` read this run, and its order followed
- [ ] Feature README filled from the template before any component existed (Step 2)
- [ ] Files placed by `pnpm gen`; four-state stories written (Step 3)
- [ ] Storybook served and the look settled by a human before any test was written (Step 4)
- [ ] Spec written under `docs/spec/route/**` after the split (Steps 5–6)
- [ ] Tests produced via `scaffold-test` (Step 7)
- [ ] No local full-suite runs; no commit; no push; no review skill invoked (Step 8)
