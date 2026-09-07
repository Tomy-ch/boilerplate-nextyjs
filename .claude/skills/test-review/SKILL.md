---
name: test-review
description: >-
  Independent quality review of this repository's test files (`*.test.ts` / `*.test.tsx`), with an adversarial finder + skeptical verifier two-stage pipeline. Defaults to `git diff` HEAD-vs-working tree to surface the changed test files; alternative scopes (branch-vs-base, specific paths) selectable via `AskUserQuestion`. Hardcodes no rules — reads ADR 0090 (testing strategy: export-name `describe`, 正常系 / 異常系 comment separators, table-driven ban, one-test-per-subject, skip discipline, layer responsibilities), ADR 0091 (verification methods: async RSC placement, a11y automated checks), the kernel README's `test-requirement` frontmatter, and the subject source file at runtime as the source of truth, so the reviewer stays in sync as conventions evolve (README > Code > SKILL priority). Fans out five `adversarial-reviewer` subagents on `sonnet` by default (so reviewer ≠ an Opus implementer) — one per lens: (1) structural compliance (the outermost `describe` is the exported symbol's own name and viewpoints are divided by `// ----- 正常系 -----` / `// ----- 異常系 -----` comment separators rather than nested `describe`s, which side a case sits on follows whether the subject itself fails, Japanese case names, every case named individually (`it.each` / `it.for` with a name template is fine; a hand-rolled `for` / `forEach` around a bare `it` is not), nested `describe` only for a shared-setup context, `it.skip` only for what survives extracting the blocking side effect into a mockable module and never with a "covered elsewhere" reason, `it.todo` only when it names its resolving issue / phase, MSW at the HTTP boundary rather than hand-written fetch stubs, co-location — deferring the four name-level shapes the `one-to-one` gate already fails on); (2) viewpoint coverage (the layer's `test-requirement` and the ADRs' per-layer duties are actually exercised, with four adjudication rules when the declaration and the tests disagree); (3) semantic quality (weak assertions, over-mocking, snapshot-as-assertion, time pinning leaks, plus the Testing Library guiding principles for component targets — query priority, `user-event` over `fireEvent`, wait-not-sleep, semantic matchers); (4) branch × meaning completeness (code-origin: reads the subject source and builds a per-function two-axis matrix — Axis A 分岐網羅 every branch has a covering case, Axis B 意味網羅 each covered branch asserts its distinctive outcome rather than merely executing); (5) subject symbol completeness (code-origin: builds the subject's exported-symbol table and flags every symbol with no test at all). Lenses 4 and 5 are the code-origin finders; 1–3 are test-file / ADR-driven. Each surviving finding is verified by an independent `review-verifier` subagent that classifies CONFIRMED / PLAUSIBLE / REFUTED, defaulting to skepticism. Synthesizes a single Japanese report grouped by lens with per-finding severity (修正必須 / 補完推奨 / 再考 / 追加検討). Reporting is read-only, but the semantic gaps it finds are not left as a report: Step 5 adds the missing cases to the working tree after one `AskUserQuestion` confirmation, because this repository's tests are written by AI and a gap that is only reported gets reproduced. Use this whenever the user asks to review tests, check test quality or coverage viewpoints, or asks 「テストをレビューして」「テストの観点が足りているか見て」「このテストは意味があるか」. It is the sole owner of the test subject — no other review skill carries a test lens — and it is invoked in its own right beside `/impl-review` (the change) and `/comment-sweep` (the comment stock), never from inside them. Do NOT use it to review implementation code (`impl-review`) or to run the tests (`make test-full`).
---

# Test Review

Adversarial, low-bias review of this repository's test files. It surfaces what looks broken,
under-tested, or vacuously asserted — and then, with one confirmation, closes the semantic gaps it
found rather than leaving them as a report.

A Japanese reference translation of this skill is available at `SKILL.ja.md` in the same directory
(not loaded as a skill; for human reference only).

## When to Use

- Before commit / PR, on the test files in the current change.
- **When coverage sits at 100 % but regressions still ship.** This repository enforces a 100 %
  coverage gate (`make test-full`), which means coverage carries no information about whether the
  assertions mean anything — every line is executed by construction. That is exactly the blind spot
  Lens 4 Axis B exists for.
- As a standalone audit of a kernel or a component directory.

## Do NOT use this skill for

- **Reviewing implementation code** — that is `impl-review`.
- **Running the tests** — `make test-full` does that. This skill reads tests; it never executes them.
- **Writing tests for a symbol that has none** — that is `scaffold-test`. Step 5 closes gaps in
  tests that already exist; it does not author a subject's first test.

## What this skill reads

The rule sources are the ADRs, `docs/testing-conventions.md`, and the kernel READMEs, read at runtime:

| Source | What it decides |
| --- | --- |
| [testing-conventions](../../../docs/testing-conventions.md) | Semantic coverage over line coverage, assertion strength, the Testing Library principles for component / hook targets, the mock boundary, what goes where |
| [ADR 0090](../../../docs/adr/0090-testing-strategy.md) | Framework split (Vitest / RTL / MSW / Playwright), export-name `describe`, `正常系` / `異常系` comment separators, per-case naming, one-test-per-subject, skip / todo discipline, per-layer responsibilities, integration = HTTP boundary only |
| [ADR 0091](../../../docs/adr/0091-test-verification-methods.md) | Where async RSC tests live, how a11y automated checks are integrated |
| The kernel `README.md` frontmatter (`test-requirement: unit \| component \| integration \| route \| feature`) | Which test layer the target belongs to |
| [AGENTS.md](../../../AGENTS.md) | `describe` / `it` strings are Japanese |
| Sibling test files in the same directory | Established local patterns (fixture style, helper signatures, MSW wiring) |
| The subject source file | Required by the two code-origin lenses |

**Do not import rules from the go-boilerplate original.** Where a Go convention has no counterpart
here — `t.Parallel()`, the `require` vs `assert` split, generated `*_mock.go` — it does not apply.
Vitest runs files in parallel by default and has a single `expect`; the mock boundary is MSW.

**Where the rule sources are silent, say so rather than inventing a rule.** `docs/testing-conventions.md`
carries the semantic-quality standard, so Lens 3 applies *it* rather than a general principle — but
where it does not reach, report the gap in 補遺 instead of smuggling in a rule as if it were repository
policy (`AGENTS.md`, "Pending Decisions": do not introduce conventions on your own).

## Writes

The Japanese report, always. Plus — after one confirmation in Step 5 — the test files the
semantic findings point at. The reviewer subagents stay read-only; the orchestrator does the writes.

## Step 0. Resolve Scope

`AskUserQuestion`:

- Question: 「test-review の対象スコープを指定してください」
- Options:
  - 「変更ファイル (HEAD-vs-working tree, 推奨)」 — `git diff --name-only` から `*.test.ts` / `*.test.tsx` を抽出。新規追加 (`--diff-filter=A`) も含める
  - 「ブランチ base 比較」 — `git merge-base` で base を解決し、その間に touch されたテスト
  - 「特定パス / ディレクトリ (free-text)」
  - 「キャンセル」

If no test files are in scope, stop — there is nothing to review. The one case that keeps running is
a scope of **production files with no paired test**: an untested subject is precisely Lens 5's
subject, and Lenses 1–3 simply have nothing to read for it (skip them for that file rather than
returning an empty result that reads as a pass).

For each target test file, resolve its **subject source file** — the same directory, the basename
without `.test`. Required by Lenses 4 and 5.

## Step 1. Read Layer Context

For every target:

1. Walk up from the file to the nearest kernel `README.md` and read its `test-requirement`
   frontmatter and body.
2. Read ADR 0090 and ADR 0091 once per run.
3. Read the subject source file.
4. Read sibling test files in the same directory.

`test-requirement` is what ADR 0090's per-layer table keys off. A `unit` kernel and a `component`
kernel are not held to the same viewpoints, and a target whose kernel declares `integration` is
bound by "HTTP 境界のみ / 内側は mock / 型・形状をアサート".

## Step 2. Fan Out Five Adversarial Reviewers

Spawn five `adversarial-reviewer` subagents **in parallel**, each on `sonnet` by default so the
reviewer differs from an Opus implementer. Each gets the same Step 1 bundle and a different lens.

Two are **code-origin** — they start from the subject source, so code with no test at all still
enters their field of view. That is the blind spot a test-file-first read structurally cannot see.

### Lens 1: Structural Compliance

Mechanical adherence to ADR 0090. As of this writing that means:

- **The outermost `describe` is the exported symbol's own name**, one per subject. A `正常系` /
  `異常系` group at the top level is a violation, and so is bundling several subjects under one
  `describe` or splitting one subject across two.
- **Viewpoint grouping is comment separators, not nested `describe`s.** `it` calls sit directly under
  the subject's `describe`.
- **The axis depends on what the subject returns** (ADR 0090).
  - **A subject that returns a value** (pure function / adapter / store / Route Handler / Server
    Action) is divided by `// ----- 正常系 -----` / `// ----- 異常系 -----`. Flag a file with no
    separator once it has cases on both sides.
  - **A subject that returns markup** (component / rendering hook / `page-content`) is **not divided
    that way at all.** Flag a `正常系` / `異常系` separator in such a file as a violation. When the
    file is long enough to want grouping, the axis is the four states of `rules.md` 「状態表示と待機」
    (「各画面は loading、empty、error、success の 4 状態を設計する」) — loading / empty / error /
    success, named for the state.
- **For a value-returning subject, which side a case belongs on follows the happy path, not how the
  failure is expressed.** ADR 0090 is explicit: throw / reject / returning an error state / dropping
  the value / rendering nothing all sit under `異常系` when the input is outside the contract. Do not
  substitute "does the subject throw" for this — that reading scatters failure-path cases into
  `正常系`. And **absence has two kinds**: a declared optional (an optional prop, a nullable argument,
  an empty list) is *inside* the contract and stays `正常系`; something that ought to exist (a required
  setting, an expected response) is outside it and goes to `異常系`.
- **Case names are Japanese**, stating the behavior and the branch condition.
- **Every case is named individually.** `it.each` / `it.for` with a name template
  (`it.each(pairs)("$name の応答が契約を満たす", …)`) satisfies this and is **not** a violation — Vitest
  reports each case under its own name. A hand-rolled `for` / `forEach` around a bare `it` is a
  violation: the name is shared across cases so a failure does not identify which one, and the loop
  body usually shares state.
- **Nested `describe` only carries a shared-setup context**, named for that context
  (`describe("ログイン済みのとき", …)`). A nested `describe("正常系")` / `describe("異常系")` is a
  violation — that is viewpoint grouping, which belongs in the comment separators.
- **`it.skip` requires the extraction first.** In TS `vi.mock` reaches module boundaries, so "cannot be
  verified" is a narrow claim. Before accepting a skip, check whether the blocking side effect
  (`process.exit`, a load-time env read, spawning a process) was **extracted into its own module** with
  the subject merely calling it — then the test mocks that boundary and verifies the arguments and
  branches up to it. A skip that could have been an extraction is a finding. The reason must say what
  remains and why `vi.mock` / `vi.stubGlobal` cannot reach it. **"別のテストでカバー済み" is never a
  valid reason** — it makes the subject depend on another test's implementation: it stays green after
  the covering test shrinks or is deleted, nothing confirms the covering test really reaches the branch,
  and a branch added later goes unverified in silence, reducing the 1:1 mapping to a name-only shell.
- **`it.todo` must name where it gets resolved** (`it.todo("<behavior>(#123 で解消)")`). A bare
  `it.todo` with no issue / phase is a violation: the correct form is a real test written as far as the
  current conventions allow, with `暫定テスト：` prefixed to the `it` name.
- **The HTTP boundary is mocked with MSW**, not with a hand-rolled `fetch` stub or a module mock of
  the adapter. ADR 0090 scopes integration tests to that boundary.
- **Co-location.** Tests sit next to their subject; a `__tests__/` aggregation directory is a
  violation.

**Do not re-report what the gate already fails on.** `scripts/one-to-one.gate.test.ts` mechanically
catches the four name-level shapes — `missing-test-file`, `missing-describe`, `duplicate-describe`,
`unknown-describe` (a top-level `正常系` bundle lands here). Those are already red in CI, so state them
in one line at most and spend this lens on what the gate cannot read: separator grouping, which side a
case sits on, case-name quality, per-case naming, skip / todo discipline, the MSW boundary, and co-location.
**A subject with no test at all belongs to Lens 5** — this lens judges only the shape of the tests that
exist, so the two never double-report.

Read ADR 0090 at runtime and apply what it currently says — this list is its application, not a copy
that may drift.

Output: findings with `file:line` and the violated rule.

### Lens 2: Viewpoint Coverage

Compares what the layer owes to what the test actually exercises.

- The kernel's `test-requirement` selects the row of ADR 0090's per-layer table; check the test
  against that row's duty (unit = pure logic, component = 描画・振る舞い, integration = HTTP 境界の
  型・形状, route / feature per the ADR).
- For component tests, ADR 0091 makes the a11y automated check part of the duty — a component test
  with no `axe` assertion is a viewpoint gap.
- `components/README.md` states which UI owns which states: a component that owns
  loading / empty / error / success must exercise them; one that does not own them must not have
  meaningless state cases invented for it. Read it for component targets.

**The kernel READMEs carry no Test Strategy prose section** — only the frontmatter. When a target's
viewpoints cannot be derived from the ADRs plus the frontmatter, report that as a documentation gap
in 補遺 rather than silently returning nothing, which would read as a pass.

**When the declaration and the tests disagree, adjudicate by these rules** rather than case by case, so
the same situation is not decided two different ways in two directories. State which rule you applied.

- **The tests are sound design → amend the declaration.** When the approach the tests take is
  architecturally justified, it is the declaration that failed to describe reality. Propose fixing the
  README — normally by giving the directory its own `test-requirement` — and propose **the criterion
  that selects the approach**, not just the approach, so the next directory in the same situation
  applies a rule instead of copying a precedent.
- **The declaration is the correct intent → amend the tests.** When the deviation has no design
  justification, the frontmatter states what should be true; bring the tests in line with it.
- **An inherited declaration governs only where its premises hold.** The nearest ancestor's
  `test-requirement` applies to a subdirectory only when its preconditions actually hold there — an
  `integration` declaration written for an HTTP-boundary adapter does not govern a sibling of pure
  formatting helpers. Resolving *formally* by the walk is not the same as the declaration applying:
  treat an inapplicable nearest declaration exactly like a missing one, as a documentation gap closed
  by giving that directory its own frontmatter.
- **A directory that is not a kernel still owns its viewpoints.** `scripts/` / `tokens/` /
  `docs-viewer/` have no kernel README above them by construction. Their viewpoints belong in their own
  README, and their absence is a gap to report — not a licence to review them against nothing.

Which side an adjudication took, and why, belongs in the PR that makes the change — not in the README
and not in this report beyond the one-line rule name.

Output: viewpoints the layer owes that the test does not exercise.

### Lens 3: Semantic Quality

Whether the assertions mean anything. **`docs/testing-conventions.md` is the standard here** — read it
this run and apply what it currently says. The principles below are its application, not a copy that
may drift; where it is silent, flag the gap in 補遺 rather than inventing a rule:

- Assertions that cannot fail in practice (`expect(x).toBeDefined()` on a value the type system
  already guarantees; `expect(fn).not.toThrow()` as the only assertion).
- Snapshot used where a specific assertion belongs — a snapshot records whatever the code does,
  including the bug.
- Over-mocking: a test that mocks the very thing it claims to verify.
- Time or randomness pinned by literal rather than injected, so the test rots on a date boundary.
- A test whose name promises more than it asserts.

For component / hook targets, hold them to the **Testing Library guiding principles**, which
`docs/testing-conventions.md` adopts by name — cite the document and the principle in the finding:

- **Query priority.** `getByRole` (with `name`) first, then `getByLabelText` / `getByPlaceholderText` /
  `getByText`, and `getByTestId` / `data-*` only as a last resort for something with no accessible
  handle. Querying by `data-slot` or a class name when a role and an accessible name exist is a
  finding — it tests the implementation, not what a user can reach.
- **`user-event` over `fireEvent`.** `user-event` replays the real input sequence (focus, keydown,
  pointer events) that a `fireEvent.click` skips, so a component that breaks under real interaction can
  still pass with `fireEvent`. Flag `fireEvent` where `user-event` covers the interaction.
- **Wait for the assertion, do not sleep.** `await waitFor(...)` / `await screen.findBy...` rather than
  an arbitrary timer; `vi.useFakeTimers` + `vi.advanceTimersByTime` when time itself is the subject. A
  bare `setTimeout` / fixed-delay `await` is flaky by construction.
- **Semantic matchers over truthiness.** `toBeVisible` / `toBeDisabled` / `toHaveAccessibleName` say
  what is being asserted; `toBeTruthy()` on a queried element asserts almost nothing.
- **Assert what the user observes**, not internal state — no reaching into a hook's internals or a
  private helper's call order when the rendered output distinguishes the branches.

Output: findings with `file:line` and a one-sentence reason the assertion is weak.

### Lens 4: Branch × Meaning Completeness (code-origin)

Reads the subject source and builds, per function, a two-axis matrix. **Coverage ≠ meaning**, and in
a repository with a 100 % gate that distinction is the only one left that carries information.

**Division from Lens 5**: Lens 4 audits *within* a symbol that already has a test. "No test at all"
is Lens 5's finding — when Lens 5 flags a symbol, do not also enumerate its branches here (that is
one gap, not N).

**Axis A — 分岐網羅**: every logical branch is reached by at least one case. Every conditional, every
thrown error kind, every boundary pair, every guard against nil / empty input. A branch reached only
by a harness that never executes the body is not covered.

A branch with no covering case is **分岐未カバー** → severity **追加検討**. Cite the subject
`file:line` and propose an `it` name. Attach a **criticality (1-10)** scored by production impact —
orthogonal to severity, which says what *kind* of gap it is — plus one line on the regression that
would ship: 9-10 データ破壊 / 認証・認可の穴 · 7-8 ユーザ影響のあるロジック誤り · 5-6 軽微な edge ·
3-4 網羅性のための nice-to-have · 1-2 任意. Order 追加検討 by criticality descending. Do not attach
criticality to 修正必須 findings — those are fix-now regardless.

**Axis B — 意味網羅**: each covered branch's case asserts that branch's *distinctive* outcome.

- An error branch asserts which error, not merely that it threw.
- A success branch asserts the resulting value or DOM state that distinguishes it from the others.
- A state-changing handler asserts the post-change state, not just that it was called.
- A boundary case asserts the differing outcome on both sides.

A branch that is covered but not distinctly asserted is **分岐カバー済み・意味未検証** → severity
**再考**. Tie it to the specific branch and the case that nominally covers it.

### Lens 5: Subject Symbol Completeness (code-origin)

Starts from the subject source at *symbol* granularity, answering "does a test exist for this at
all?" A test-file-first read can only judge the tests it finds; a symbol with zero tests is
invisible to it.

1. Build the exported-symbol table from the paired subject (exported functions, components, hooks,
   and unexported module-level functions carrying branching logic). Generated files and test-only
   helpers are out of scope.
2. Match each symbol to a test.
3. Flag every unmatched symbol as **シンボル未カバー** → severity **補完推奨**, citing
   `symbol @ file:line`, proposing the `describe` name (the symbol's own name) with its
   `// ----- 正常系 -----` / `// ----- 異常系 -----` skeleton of `it` calls, and attaching the same
   criticality score. Order by criticality descending.

## Step 3. Verify Each Finding

Each surviving finding goes to an independent `review-verifier` subagent on `sonnet`. It re-derives
the conclusion from the code rather than trusting the finder, and **defaults to skepticism** —
label PLAUSIBLE or REFUTED when ambiguity remains.

Verification runs in parallel across findings. REFUTED findings are dropped from the report, with
the count mentioned so the user knows the noise floor. CONFIRMED and PLAUSIBLE are kept.

## Step 4. Synthesize the Report

One Japanese report:

```text
# Test Review レポート

対象: <スコープ + ファイル一覧>
レンズ: 構造準拠 / 観点カバレッジ / 意味的品質 / 分岐×意味 / シンボル網羅
verifier 通過: CONFIRMED <n> 件 / PLAUSIBLE <m> 件 / REFUTED <k> 件（除外済み）

## サマリ
- 修正必須 / 補完推奨 / 再考 / 追加検討: 各 <件数>

## 構造準拠（修正必須）
- [<severity>] <file>:<line> — <違反した規則>
  - 出典: ADR 0090 の該当節
  - verifier: CONFIRMED / PLAUSIBLE

## 観点カバレッジ（補完推奨）
## 意味的品質（再考）
## シンボル網羅（補完推奨）  ← criticality 降順
## 分岐網羅（追加検討）      ← criticality 降順
## 意味網羅（再考）

## 補遺
- <ADR / README / testing-conventions.md の補完候補>
```

Severity mapping:

- **修正必須** — Lens 1. ADR 0090 の規則違反。CONFIRMED → 修正必須 / PLAUSIBLE → 確認推奨
- **補完推奨** — Lens 2 と Lens 5。層が負う観点が未実施、またはシンボルにテストが 1 つも無い
- **再考** — Lens 3 と Lens 4 Axis B。通るが何も明らかにしない
- **追加検討** — Lens 4 Axis A。subject 起点で見つけた未カバー分岐

## Step 5. Close the Semantic Gaps (default; skip on the user's word)

**A reported gap that nobody closes gets reproduced.** This repository's tests are written by AI, so
the same missing assertion reappears the next time the same shape of code is written. Reporting is
therefore not the end state for the findings that describe a *missing or vacuous assertion*.

In scope for this step:

- **再考** — Lens 3 (weak / vacuous assertions) and Lens 4 Axis B (covered but not distinctly asserted)
- **追加検討** — Lens 4 Axis A (a branch with no covering case)

Out of scope — report only:

- **修正必須** (Lens 1) — a structural rule violation is a rewrite of existing cases, and which way to
  resolve it can depend on an ADR amendment (Lens 2's adjudication rules). Leave it to the user.
- **補完推奨** (Lens 2 / Lens 5) — a symbol with no test at all is `scaffold-test`'s job, and a missing
  layer viewpoint may be a declaration bug rather than a test bug.

Confirm once before editing:

- `AskUserQuestion`: 「意味網羅の穴 <N> 件にテストを追加しますか？」 — options: 「すべて追加」 /
  「1 件ずつ確認」 / 「追加しない（レポートのみ）」.

Then, per finding:

1. Add the case under the subject's existing `describe`, on the side the outcome puts it
   (ADR 0090), with a Japanese `it` name.
2. **Prove the case earns its place.** Break the branch it covers — invert the condition, drop the
   guard — confirm the new case fails, then restore. A case that passes against the broken
   implementation verifies nothing and must not be kept. Report what you broke and that it failed.
3. Never weaken an existing case to make room, and never delete one.

After editing, verify: `pnpm fix`, `pnpm lint:ci`, and the target's own test run. Do NOT commit —
leave the changes for the user (or a later `/commit`).

Skip the step when the user declines, and say so in the report rather than leaving it silent.

## Step 6. Next Action

End with one concrete suggestion covering what Step 5 did **not** close — the 修正必須 and 補完推奨
findings. Name the files and the specific cases, and point a symbol with no test at all at
`scaffold-test`. If nothing survives verification, say so (「verifier 通過後 0 件です」).

## Relationship to the other review skills

This skill owns the **tests**, and it owns them alone: no other review skill carries a test lens, and
this one is invoked in its own right rather than from inside another. `/impl-review` (the change) and
`/comment-sweep` (the comment stock) are its peers under the Review Phase Protocol in `AGENTS.md` —
asked for separately, decided separately, and never delegating to one another.

Lens 5 owns "no test at all" and Lens 4 owns branch × meaning, so both shapes have exactly one
reporter. This skill never chains onward.

## Constraints

- ❌ Editing anything outside Step 5's scope. Reporting is read-only; only the semantic gaps are
  closed, only after the confirmation, and only in test files.
- ❌ Running the tests (`make test-full` is a separate, heavier gate — `repo-ops` §7).
- ❌ Trusting finder output without verification, unless the caller passed `skip_verifier: true`.
- ❌ Hardcoding the rule list — ADR 0090 / 0091 and the kernel READMEs are read at runtime.
- ❌ Importing Go-only conventions (`t.Parallel()`, `require` vs `assert`, generated mocks).
- ❌ Inventing a convention where the rule sources are silent — report the gap instead.
- ✅ Skepticism by default in the verifier.
- ✅ Reviewer model defaults to `sonnet`; the orchestrator may override to keep reviewer ≠ implementer.
- ✅ criticality (1-10) は Lens 4 Axis A と Lens 5 の finding に付す本番影響のソート鍵で、レンズ由来の severity を置換しない。
- ✅ 「テストが 1 つも無いシンボル」は Lens 5 の所管。Lens 1 の逆方向確認や Lens 4 と二重報告しない。
- ✅ Step 5 で足した各ケースは、対象の分岐を壊すと落ちることを確かめてから残す。

## Checklist

- [ ] Scope resolved, and each target's subject source located.
- [ ] ADR 0090 / 0091 and the kernel `test-requirement` were read this run.
- [ ] All five lenses ran in parallel.
- [ ] Lens 5 ran before Lens 4's branch analysis and the two did not double-report a zero-test symbol.
- [ ] Lens 4 ran both axes.
- [ ] Every finding went through `review-verifier` unless the caller disabled it.
- [ ] REFUTED dropped, count reported.
- [ ] Report is Japanese, grouped by lens, with severities and criticality ordering.
- [ ] Step 5: confirmed once, then closed the 再考 / 追加検討 findings; each added case was shown to
      fail against the broken branch; `pnpm fix` + `pnpm lint:ci` + the target's test run are green.
- [ ] Nothing outside test files was edited; no commit was made.
