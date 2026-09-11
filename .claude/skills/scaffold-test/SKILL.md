---
name: scaffold-test
usage-class: situational
description: >-
  Write the Vitest test files for existing symbols in this repository — the counterpart to `test-review`,
  which only judges tests that already exist. Use it when a callable export has no test and the 1:1 gate is
  about to fail (`missing-test-file` / `missing-describe`), when a screen has just been implemented and its
  modules need their tests placed together, when coverage falls below the 100 % gate, or on
  「テストを書いて」「このコンポーネントのテストを足して」「カバレッジが足りないので埋めて」. It hardcodes no viewpoints: ADR 0090 / 0091, the nearest
  README's `test-requirement`, the 1:1 gate, sibling tests, and the subject source are read at runtime.
  Read-only on the subject. Do NOT use it to critique existing tests (`test-review`), to write HTTP-boundary
  tests (`scaffold-integration-test`), or to run the suite.
argument-hint: '[path/to/subject.ts[:symbol] | path/to/dir/ | (省略で未テストを一括解決)]'
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, AskUserQuestion
---

# Scaffold Test

Write the test files for the symbols that do not have one, in the shape this repository's gates
already enforce.

**The unit of work is a set**, resolved in Step 0; one symbol is just a set of size one.

A Japanese reference translation of this skill is available at `SKILL.ja.md` in the same directory
(not loaded as a skill; for human reference only).

## When to Use

- The 1:1 gate reports `missing-test-file` or `missing-describe` for a callable export.
- A new function / component / hook / Server Action landed and its test still has to be written.
- `make test-full` fails the coverage threshold and the uncovered branches need cases.
- A subject's test exists but a newly added export in the same file has none — this skill adds the
  missing `describe` block without touching the ones already there.
- A screen was just implemented and its tests are placed as one step, after the refactoring and the
  specification are done.

## Do NOT use this skill for

- **Judging tests that already exist** — `test-review` owns that, with five adversarial lenses.
- **HTTP-boundary integration tests** — an `adapters` client or a Route Handler tested through MSW is
  `scaffold-integration-test`'s subject. This skill writes unit / component tests.
- **Running the suite** — `make test-full` / `make scripts-test`.
- **Repairing a test that its subject broke** — that belongs to the change that broke it, where the
  author knows whether the test or the behavior is wrong.

## What this skill reads and writes

Everything below is read **at runtime**. The lists later in this file say how the skill applies the
conventions; they are not the rules, and where they and the sources differ the sources win — the
gates follow the sources, not this skill.

| Source | What it decides |
| --- | --- |
| [ADR 0090](../../../docs/adr/0090-testing-strategy.md) | `describe` = export name, which axis the comment separators use, per-case naming, skip / todo discipline, per-layer duties, mock boundaries |
| [ADR 0091](../../../docs/adr/0091-test-verification-methods.md) | Where async RSC tests live, how the a11y automated check is integrated |
| The nearest ancestor `README.md` frontmatter (`test-requirement`) | Which layer duty the subject is held to |
| `scripts/lib/untested-modules.ts` | What is deliberately excluded — a subject listed there does not get a test |
| Sibling tests in the same directory | The established local shape (fixture style, helper signatures, MSW wiring) |
| The subject source | The branch set the cases are derived from |
| `AGENTS.md` | `describe` / `it` strings are Japanese |

Writes one `<subject>.test.ts` (or `.test.tsx`) next to each subject in the set. Nothing else — no
fixture modules, no helpers shared across directories, no edits to the subjects.

**The subject is read-only.** Never edit, rename, split, or export something extra to make a symbol
testable. When a symbol genuinely cannot be verified as written, say so and stop — see Step 5.

## Step 0. Resolve the subject set

The unit of work is a **set**, not a single symbol. A screen lands with twenty-odd untested modules
at once, and the procedure that produced it asks for the tests to be placed together. One subject is
just a set of size one.

Ask the gate what is missing rather than reading the exclusion declarations yourself:

```sh
pnpm exec vitest run --config vitest.scripts.config.ts scripts/one-to-one.gate.test.ts
```

Its failure output names every `missing-test-file` / `missing-describe` subject with `file:line`.
**The gate is the authority on what needs a test.** A subject it does not report is already excluded —
either by an explicit path in `scripts/lib/untested-modules.ts`, or by one of the glob constants in
that same file (`RUNTIME_ONLY_MODULES` covers `src/app/**/page.tsx`, which no unit run can render).
Re-deriving the exclusions by reading the lists invites disagreeing with the gate that actually runs.

### Narrow it to the change in hand

The gate reports the whole repository. In a tree with parallel worktrees that includes subjects
another session is mid-way through, and writing tests for those collides with their work. Intersect
the gate's output with the files this branch actually touched:

```sh
git diff --name-only $(git merge-base HEAD origin/<base>)...HEAD
```

Offer the intersection. When the gate reports subjects outside it, **say so and leave them alone** —
they are someone else's, and their absence from this run is information the user wants.

### Constants have contracts too

The gate only surfaces **callable** exports. A module that exports nothing but constants requires no
`describe` and never appears, even with no test at all. When the user names such a subject directly,
take it: a constant's exact members and ordering are worth pinning even though the gate is silent.

### Where each file goes

- Subject `src/foo/bar.ts` → `src/foo/bar.test.ts`
- A subject that renders JSX → `.test.tsx`
- The test sits **next to** the subject. A `__tests__/` directory is a violation of ADR 0090.

### Group the set for confirmation

Group the subjects by **the directory whose `README.md` declares the `test-requirement` they fall
under** — the nearest ancestor declaration, the same one Step 1 reads. Subjects in one group share a
duty, so they share how their cases are derived, and one agreement carries the whole group.

Groups are the unit of Step 3's confirmation and Step 6's verification. Twenty-two subjects become
three or four decisions instead of one unreadable list or twenty-two interruptions.

**Note which runner governs each group**, because it changes the commands in Step 6: subjects under
`src/` (and the other roots in the default `include`) run under the default config; subjects under
`scripts/` run under `vitest.scripts.config.ts`. A set that spans both is two verification passes,
not one.

## Step 1. Read the layer context

1. Walk up from the subject to the nearest ancestor `README.md` carrying `test-requirement` in its
   frontmatter, and read both the frontmatter and the body — **including its `## テスト観点` section
   when it has one.** Those lines are perspectives a human wrote for this slice, and they are the one
   part of the input this skill did not derive. They are declarations with a reader: a slice README
   that lists a perspective nothing ever asserts is a checklist that rots unwatched.
2. Read ADR 0090 and ADR 0091.
3. Read the subject source in full.
4. Read the sibling tests in the same directory.

`test-requirement` selects the duty the test owes:

| Value | Duty |
| --- | --- |
| `unit` | Pure logic. Assert returned values and thrown error kinds |
| `component` | Rendering and behavior through Testing Library, **plus the `axe` assertion ADR 0091 requires** |
| `integration` | HTTP boundary only — inside is mocked, shape and type are asserted |
| `route` / `feature` | Per ADR 0090's table — read it rather than assuming |

### The duty follows the symbol, not the directory

`test-requirement` is one word in frontmatter, and a directory holds symbols that are not all the
same. **The README body is where the layer says which of its symbols the declaration actually
covers** — `src/adapters` declares `integration` and then its body narrows that to modules with an
external round-trip, sending pure transforms to `unit`. Read the body, not just the frontmatter;
step 1 above asks for both because this is what the body is for.

That decides the *duty* a symbol owes. It does not hand the symbol to another skill.

### An `integration` duty is not a handoff

`scaffold-integration-test` is not the other half of this file — it writes a **second, separate**
file asking a different question. Check the split against a directory that already has both rather
than assuming — find one with `ls src/adapters/**/*.contract.test.ts` and read its `.test.ts`
sibling:

| File | Question | Owner |
| --- | --- | --- |
| `<subject>.test.ts` | Does each export behave as written? | **this skill — every callable export, boundary-crossing ones included** |
| `<subject>.contract.test.ts` | Does the boundary match the generated contract? | `scaffold-integration-test` |

**The 1:1 gate only resolves `<subject>.test.ts`** — confirm this in `resolveTestFile`
(`scripts/lib/one-to-one.ts`) before relying on it. So a `describe` living only in the contract test
never satisfies the gate, and leaving a boundary-crossing symbol "to the other skill" leaves the gate
red permanently. Write it here, mocking HTTP at the layer's own boundary, and say in the closing
report whether a contract test is also warranted.

**When no ancestor declares `test-requirement` at all**, derive the duty from sibling tests plus
ADR 0090, and report the missing declaration. Do not invent a duty silently — the gap is the finding.

## Step 2. Derive the case set from the subject

Build the case list from the **subject's own branches**, not from a template. For each exported
symbol in scope:

- Every conditional, every early return, every thrown error kind.
- Every boundary pair — both sides, so the differing outcome is what the case pins.
- Every guard against `null` / `undefined` / empty input.
- For a component: each variant / state it owns, per the `components/README.md` state table. A
  component that does not own loading / empty / error / success must not have those states invented
  for it.
- For a hook: the states it transitions through, asserted through the rendered result rather than by
  reaching into its internals.

**A branch with no distinctive assertion is not covered.** The repository gates coverage at 100 %, so
"the line ran" carries no information — what carries information is that the case asserts the outcome
that distinguishes *this* branch from its neighbours: which error, which rendered state, which value.

**A symbol with no branches still gets a test.** A component that only forwards props still has a
contract — where it forwards them and what its defaults are.

**The axis the cases are grouped on depends on what the subject returns, and ADR 0090 decides it** —
read its 軸の選び方 rather than reaching for a fixed pair. As it stands, a subject that returns a
*value* splits on `正常系` / `異常系`, and a subject that returns *rendering* must not be split that
way at all: for it an upstream failure is one of the states it displays, so the axis is the state
(`// ----- 空のとき -----` and its siblings). Grouping a component's cases into `正常系` / `異常系`
is on the ADR's ❌ list.

Where the `正常系` / `異常系` axis does apply, assign by **whether the case sits inside or outside the
happy path**, not by how the subject expresses the failure — the ADR is explicit that a thrown error,
a returned error state and a silently dropped value all belong on the same side.

### Enumerate before deriving, in a different head

Before listing anything yourself, spawn one `test-perspective-enumerator` per subject group
(`agentType: "test-perspective-enumerator"`, `label` like `perspectives:<group>`). It reads the
subject, the nearest `test-requirement` README including its `## テスト観点`, and ADR 0090 / 0091,
and returns one line per perspective with the assertion that would distinguish it.

**The split is the point.** A model that writes a test decides what to test while deciding how to
assert it, and those are not independent — the cases that get listed are the cases that are easy to
assert. Holding a list you did not produce does not make the list complete; it makes the omissions
**visible**, because a perspective that never becomes a case now has to be declined out loud.

Reconcile its output against your own derivation:

- Every returned perspective becomes a case, **or is declined in the Step 3 confirmation with the
  reason.** "Covered by another test" is not a reason (ADR 0090).
- A `宣言` perspective the subject does not appear to implement is **not** dropped. Put it to the
  user: the README and the code disagree, and which one is wrong is not this skill's call.
- Its 「区別できない」 block feeds Step 5 — those are subjects that cannot be verified as written.
- Its 「読めなかった」 block goes into the report verbatim. An input that could not be read is not an
  input that held nothing ([0157](../../../docs/adr/0157-inspection-declaration-discipline.md)).

**When the README has no `## テスト観点` section, or it holds only the template placeholder, say so
and do not invent one.** The absence is reportable: it means this slice's perspectives live only in
whoever is reading the code right now. Proceed on the derived set, and name the gap in Step 3 so the
user can decide whether the README should gain the section before the tests are written.

## Step 3. Plan and confirm, one group at a time

Confirm **per group**, not per file and not for the whole set. Show every subject in the group with
its planned path and case list, so the agreement covers all of them at once:

```txt
群: <feature>/（test-requirement: feature）

書き出し先: <feature>/<期間を解く純関数>.test.ts
  describe("toPeriodRequest")
    ----- 正常系 -----
    - 日付の要らない区分はそのまま求められる形になる
    ----- 異常系 -----
    - range で日付が欠けていれば求めない
    - range で終了日が開始日より前なら求めない
  describe("toPeriodHref")
    ----- 正常系 -----
    - 日付を持ち越さない

書き出し先: <feature>/ui/<表の部品>/<表の部品>.test.tsx
  describe("RankingTable")
    ----- 空のとき -----
    - 行が無ければ、無いと判る文言を出す
    ----- 揃っているとき -----
    - 契約の並び順のまま順位を出す
    - 表として読み上げられる（axe）
```

The two subjects above are grouped together and still carry **different separators** — the axis
follows what each subject returns, per Step 2. A group is a unit of confirmation, not a unit of
uniformity.

Confirm with `AskUserQuestion`: 「この構成で書きますか？」 / 「ケースを追加・修正したい」 /
「この群は飛ばす」 / 「ここで止める」. The plan is cheap to change; a written file is not.

**Write and verify the group before planning the next one.** Batching every group's plan up front
trades away the thing that makes the batch tractable — what the first group teaches about the local
shape (fixture style, how the siblings mock) should reach the second group's plan.

**When the user stops mid-set, say which groups were written and which were not.** A half-written
set with the 1:1 gate still red is a legitimate stopping point, but only if the remainder is named.

## Step 4. Write the file

Apply what Step 1 read. As the conventions stand today that means:

- **The outermost `describe` is the exported symbol's own name**, one per subject. Multiple exports in
  one file get multiple top-level `describe`s, in source order.
- **Viewpoints are divided by comment separators on the axis Step 2 settled**, with the `it` calls
  directly under the subject's `describe`. Nested `describe` is for a shared-setup context only,
  named for that context — never for the viewpoints themselves.
- **`it` strings are Japanese**, stating the behavior *and* the branch condition.
- **One case per `it`.** `it.each` / `it.for` is fine when it carries a name template that identifies
  each case; a hand-rolled `for` / `forEach` around a bare `it` is not.
- **Mock at the boundary the layer owns**: MSW for HTTP — the generated handlers under `mocks/`, started
  by importing `vitest.setup.msw.ts` in the test file that needs them (`vitest.setup.ts` starts no
  server; it guards `fetch` so an unmocked request fails loudly). Do not hand-roll a `fetch` stub.
  `vi.mock` for a module boundary, `vi.stubEnv` for configuration.
- **Components need `// @vitest-environment jsdom`** at the top of the file, and the `axe` assertion
  ADR 0091 requires.
- **Query the way a user reaches the element**: `getByRole` with an accessible name first, then
  label / placeholder / text. `data-*` is a last resort for something with no accessible handle.
  Use `user-event` over `fireEvent`, and `await waitFor` / `findBy*` rather than a timer.
- **Never write a skip to make the file pass.** If a branch cannot be reached, that is Step 5.

Keep fixtures local and obvious. A fixture component or builder at the top of the file is fine when
several cases share it; a shared fixture module is not this skill's to create.

## Step 5. When the subject cannot be verified as written

Sometimes a branch is unreachable without changing the subject — a side effect at module load, a
`process.exit`, a value that only a real network can produce. **Do not skip it, and do not edit the
subject.** Report it as a finding:

- Name the branch and why it cannot be reached with `vi.mock` / `vi.stubGlobal`.
- Propose the extraction that would make it reachable: move the blocking side effect into its own
  module so the subject merely calls it, then the test mocks that boundary and asserts the arguments
  and branches up to it.
- Let the user decide. The extraction is a change to production code, which is outside this skill.

This is the same bar ADR 0090 sets for `it.skip`: a skip is allowed only for what survives the
extraction, and "covered by another test" is never a reason.

## Step 6. Verify

Run these and report the results honestly, including anything that did not run:

Run these **after each group**, so a mistaken shape is caught before it is copied into the next one:

```sh
pnpm fix                                      # formatting + autofixable lint
pnpm exec vitest run <the files just written> # the new cases pass
```

Use the runner Step 0 noted for the group — subjects under `scripts/` need
`--config vitest.scripts.config.ts`, the rest use the default.

Confirm the branches are actually covered, scoped to the group's subjects:

```sh
pnpm exec vitest run <the files just written> \
  --coverage.enabled --coverage.include='<subject paths>' --coverage.reporter=text
```

All four metrics must read 100 % for each subject. If they do not, the case set missed a branch —
return to Step 2 rather than lowering the bar. **Scope the coverage run to the subjects in hand.**
The repository-wide number says nothing about this change, and in a tree with parallel worktrees it
is red for reasons that belong to someone else.

Run the 1:1 gate **once, after the last group**:

```sh
pnpm exec vitest run --config vitest.scripts.config.ts scripts/one-to-one.gate.test.ts
```

It proves the `describe` names satisfy the 1:1 mapping. Expect it to still report the subjects Step 0
excluded as another session's — **name those in the report**, because an unexplained red gate reads
as a failure of this run. Nothing else should remain: every subject this run took, boundary-crossing
symbols included, is expected to be green here.

## Step 7. Hand off to review

Say plainly what was written, what was verified, and what was left as a finding. Then offer
`test-review` on the new file: this skill writes from the subject's branches, and `test-review` asks
the questions a writer cannot ask about their own output — whether the assertions mean anything, and
whether the layer's duty is actually exercised.

## Constraints

- ✅ Read ADR 0090 / 0091, the `test-requirement` frontmatter, and sibling tests at runtime
- ✅ Japanese `it` strings; export-name `describe`; separators on the axis ADR 0090 assigns
- ✅ Confirm the case plan before writing, per group
- ✅ Narrow the set to this branch's files; leave another session's subjects alone
- ✅ Verify with the 1:1 gate and per-subject coverage
- ❌ Edit, rename, or restructure the subject — read-only, always
- ❌ Write `it.skip` / `it.todo` to make the file pass
- ❌ Write a test for a subject the 1:1 gate does not report as missing
- ❌ Hand-roll a `fetch` stub where MSW owns the boundary
- ❌ Treat the lists in this file as the rules — where they and the sources differ, the sources win

## Checklist

- [ ] Subject set resolved from the gate, narrowed to this branch's files, and grouped by `test-requirement` owner
- [ ] ADR 0090 / 0091 and the nearest `test-requirement` read this run
- [ ] Case set derived from the subject's branches, each with a distinctive assertion
- [ ] Case plan confirmed with the user, one group at a time
- [ ] File written next to the subject, with the export-name `describe` and separators
- [ ] `pnpm fix` and the new tests run per group; the 1:1 gate run once at the end
- [ ] Per-subject coverage confirmed at 100 % on all four metrics, scoped to the subjects in hand
- [ ] Unreachable branches reported as findings, not skipped
