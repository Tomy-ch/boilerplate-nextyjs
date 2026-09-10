---
name: scaffold-integration-test
usage-class: situational
description: >-
  Write the HTTP-boundary integration test for one seam — an `adapters` API client or a Route Handler — driven
  by the contract-generated MSW handlers rather than a hand-written stub. Use it when a new client function
  lands under `adapters`, when a Route Handler is added under `src/app/`, when a regenerated contract (`make
  api-gen`) changes a wire type, or on 「この API クライアントの結合テストを書いて」「契約どおりに動くか確かめるテストが欲しい」「route handler
  の境界をテストして」. ADR 0090 scopes these to the boundary only: what is asserted is the shape and type at the seam,
  not the business value, which unit tests own. Read-only on the subject. Do NOT use it for pure logic with no
  HTTP boundary (`scaffold-test`), to review existing tests (`test-review`), to hand-write MSW handlers (they
  are generated), or for browser end-to-end tests.
argument-hint: '[path/to/subject.ts]'
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, AskUserQuestion
---

# Scaffold Integration Test

Write the test that exercises one HTTP seam through the contract-generated mocks, and stops there.

A Japanese reference translation of this skill is available at `SKILL.ja.md` in the same directory
(not loaded as a skill; for human reference only).

## When to Use

- A new API client function landed under `src/adapters/server/**` (or the client-side counterpart once ADR 0024's split lands on disk).
- A Route Handler (`route.ts`) was added under `src/app/`.
- `make api-gen` regenerated a wire type and the seam needs a test that would have caught the drift.
- An existing seam is covered only by unit tests that stub `fetch` by hand, and the boundary itself
  has never been driven through the generated handlers.

## Do NOT use this skill for

- **Pure logic with no HTTP boundary** — `scaffold-test`. A retry policy or a payload normalizer is a
  unit, even though it lives under `adapters`.
- **Reviewing tests that exist** — `test-review`.
- **Adding or editing MSW handlers** — they are generated from the contract, and `mocks/handlers.ts`
  only wires them (`stableHandlers`). Hand-writing one lets the mock and the contract drift apart, which is
  exactly the failure the generated set exists to prevent. If a handler is missing, the contract is
  what needs regenerating.
- **Browser end-to-end** — that is Playwright, a different row of ADR 0090's table.

## What this skill reads and writes

Read **at runtime**; nothing about the conventions is frozen into this file.

| Source | What it decides |
| --- | --- |
| [ADR 0090](../../../docs/adr/0090-testing-strategy.md) | integration = HTTP boundary only / inside mocked / shape and type asserted; structure and naming |
| [ADR 0091](../../../docs/adr/0091-test-verification-methods.md) | Verification methods, including where async RSC tests sit |
| `mocks/handlers.ts` / `mocks/node.ts` | The generated handler set and the wiring around it |
| [`vitest.setup.msw.ts`](../../../vitest.setup.msw.ts) | The server the test imports rather than boots, and `serveJson` for the cases that assign a response |
| `src/adapters/gen/**` | The wire types and zod schemas the seam validates against |
| Sibling `*.contract.test.ts` | The established local shape — file naming, config mocking, assertion style |
| The nearest `README.md` frontmatter (`test-requirement`) | Confirms the subject is an `integration` seam at all |
| The subject source | Which endpoints it calls and what it normalizes on the way out |

Writes exactly one file, following the sibling naming convention (`<subject>.contract.test.ts` as the
established form). The subject is **read-only**.

## Step 0. Resolve the seam and confirm it is one

Take the subject from the argument, or ask with `AskUserQuestion` offering the clients and Route
Handlers that have no contract test yet. Detect what exists rather than assuming the full layout —
ADR [0024](../../../docs/adr/0024-adapters-server-client-split.md) creates the client half when its
decision lands, and Route Handlers arrive with the features that need them.

Then confirm it is actually an HTTP seam. Read the subject and check that it issues a request through
the shared fetch wrapper. **A module under `adapters` that performs no request is not an integration
subject** — a payload normalizer, a resilience policy, a circuit breaker are units, and they belong
to `scaffold-test`. Say so and stop rather than writing an integration test with nothing at its
boundary.

Confirm the nearest `test-requirement` reads `integration`. If it does not, and the subject really is
a seam, that is a documentation gap — report it and continue.

## Step 1. Read the inputs

1. ADR 0090 and ADR 0091.
2. `mocks/handlers.ts`, `mocks/node.ts`, and `vitest.setup.msw.ts` — learn what the generated set
   covers, and that the interception is started by **`vitest.setup.msw.ts`**, which the test file
   imports. It runs with `onUnhandledRequest: "error"`, so a request the generated set does not cover
   fails the test rather than escaping to the network.
3. The subject source in full — which endpoints it calls, what it validates, what it normalizes.
4. The generated types the subject imports from `src/adapters/gen/**`.
5. A sibling `*.contract.test.ts` as the structural template.

## Step 2. Derive the case set from the contract

One case per response the **contract** declares for the endpoints the subject calls — not per branch
of the subject, which is `scaffold-test`'s axis.

- **Success**: the shape the caller receives. Assert the type and structure the adapter promises after
  normalization, not the raw wire shape — the point of the seam is that the wire type does not leak.
- **Each declared error status**: that the adapter maps it to the normalized error kind the `errors`
  kernel defines, rather than surfacing a status code upward.
- **Schema mismatch**: that a response failing the generated zod schema is rejected at the boundary
  instead of flowing inward. This is the case that justifies validating at all.
- **The normalization the adapter performs**: query serialization, pagination cursors, payload
  shaping — asserted through what the handler received, when the generated set allows overriding a
  handler for the case.

**Assert shape and type, not business value.** Whether the third product's price is 1200 belongs to a
unit test of the mapping function. What belongs here is that the caller receives a well-formed page
whose items satisfy the promised type — and that a malformed response does not get through.

## Step 3. Plan and confirm

Show the file path and the case list before writing, then confirm with `AskUserQuestion`:
「この構成で結合テストを書きますか？」 / 「ケースを追加・修正したい」 / 「キャンセル」.

## Step 4. Write the file

Apply what Step 1 read. As the conventions stand today that means:

- **The outermost `describe` is the exported symbol's own name**; viewpoints divided by
  `// ----- 正常系 -----` / `// ----- 異常系 -----`; Japanese `it` strings.
- **Do not start an MSW server.** Importing `vitest.setup.msw.ts` starts it and resets the handlers
  after each test. Assign a response for one case with its `serveJson(url, body)` helper, which also
  returns the requests it received, and let the per-test reset undo it.
- **Prefer the generated handler's own response.** Assign a body only for the cases that look at the
  adapter's own mapping — relying on the generated draw makes the test move whenever the mock's value
  ranges change.
- **Mock configuration, not the network.** The seam needs a fixed base URL, so mock
  `@/config/environment` with `vi.hoisted` + `vi.mock` against `PARSED_ENVIRONMENT` from
  `@/config/environment.fixture`, the way the sibling contract test does, and import the subject
  **after** the mock so the hoisting order holds.
- **Never hand-roll a `fetch` stub.** If the generated handlers do not cover the endpoint, the
  contract is what is missing.
- **Do not assert on log output or spans** unless the seam's contract is the telemetry itself.

## Step 5. Verify

```sh
pnpm fix
pnpm exec vitest run <the written test file>
pnpm exec vitest run --config vitest.scripts.config.ts scripts/one-to-one.gate.test.ts
```

The gate run matters here too: a contract test whose top-level `describe` names no export is an
`unknown-describe` violation when its subject file has exports.

Report honestly what ran and what did not — in particular, whether every declared error status of the
endpoint got a case, or only the ones the generated handler set can produce today.

## Step 6. Hand off

State what was written and what the seam is now pinned against. Offer `test-review` on the new file:
this skill derives cases from the contract, and `test-review` asks whether the assertions carry
information and whether the layer's duty is actually exercised.

## Constraints

- ✅ Read ADR 0090 / 0091, `mocks/**`, the generated types, and a sibling contract test at runtime
- ✅ Drive the boundary through the generated handlers only
- ✅ Assert shape and type at the seam; leave value correctness to unit tests
- ✅ Confirm the case plan before writing
- ❌ Edit the subject, the generated handlers, or anything under `src/adapters/gen/**`
- ❌ Start an MSW server the setup file already starts
- ❌ Hand-write a `fetch` stub or a handler
- ❌ Write an integration test for a module with no HTTP boundary

## Checklist

- [ ] Subject confirmed to be an HTTP seam; `test-requirement` checked
- [ ] ADR 0090 / 0091, `mocks/**`, generated types, and a sibling contract test read this run
- [ ] Cases derived from the contract's declared responses, including a schema-mismatch case
- [ ] Case plan confirmed with the user
- [ ] File written with the sibling naming convention and the export-name `describe`
- [ ] `pnpm fix`, the new test, and the 1:1 gate all run
- [ ] Uncovered declared statuses reported rather than silently omitted
