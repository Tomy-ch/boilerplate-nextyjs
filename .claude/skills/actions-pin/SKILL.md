---
name: actions-pin
usage-class: lifecycle
description: Audit and upgrade the SHA-pinned GitHub Actions referenced by `.github/workflows/**` and `.github/actions/**`, with a supply-chain quarantine and an automatic step-back to the previous aged version. Default is minor-only (stay within the current majors); pass `major` to also bump major versions; pass a bare number or `days=N` to set the exclusion window (`ACTIONS_PIN_MIN_AGE_DAYS`, default 14). The version source of truth is the trailing tag comment on each `uses: owner/repo@<sha> # <tag>` line; `.github/actions-pin.toml` is the resolved tag→SHA lockfile, driven by `make actions-pin-resolve` / `actions-pin-apply` / `actions-pin-check` (backed by `scripts/actions-pin/`). For each target major the skill prefers the moving major tag when its latest is aged, else steps back to the newest exact version older than the exclusion window, else holds — so a freshly published (possibly compromised) release is never adopted. `resolve` itself fails closed when a tag declared immutable (any comment tag but a bare major number) resolves to a different SHA: a re-pointed tag is a security event, not a refresh, and the intended-update escape hatch is `ACTIONS_PIN_ALLOW_MOVED`. Verifies with `make actions-pin-check` + `make actionlint`. Major bumps additionally verify `with:` input compatibility and are held (not auto-applied) on a breaking change. Sibling of `tools-upgrade` (which covers `mise.toml`, not Actions). Use on a routine cadence or after an Actions security advisory.
argument-hint: "[major] [days=<N>]"
allowed-tools: Read, Edit, Bash, Glob, Grep, AskUserQuestion
---

# GitHub Actions Pin Upgrade

This skill audits and upgrades the SHA-pinned GitHub Actions in `.github/workflows/**` and
`.github/actions/**`, with a **supply-chain quarantine gate** plus an **automatic step-back**, so
that a freshly-published (possibly compromised) version is never pulled in before upstream has time
to detect and revoke it. The rule that picks each pin is §The Target-Selection Rule.

It is the sibling of `tools-upgrade` — that skill covers `mise.toml` `[tools]`; this one covers
GitHub Actions pins. They share the same quarantine philosophy but operate on different SSOTs.

A Japanese reference translation is available at `SKILL.ja.md` in the same directory (not loaded as
a skill; for human reference only).

## How Pinning Works in This Repo

Read this before doing anything — the mechanism determines every step below. The decision behind it
is [ADR 0153](../../../docs/adr/0153-ci-configuration.md) §3.

- Each external reference is pinned as `uses: owner/repo[/sub]@<40-hex-sha> # <tag>`. The **tag in
  the trailing comment is the version source of truth**, not the `@<sha>` part.
- `.github/actions-pin.toml` is the lockfile: `"owner/repo@<tag>" = "<sha>"` (SSOT for `apply`,
  regenerated in full by `resolve`).
- `make actions-pin-resolve` — reads the comment tag of every `uses:`, resolves it to a commit SHA
  via `git ls-remote` (annotated tags are dereferenced to the commit), applies the quarantine, and
  rewrites the lockfile. `ACTIONS_PIN_MIN_AGE_DAYS` (default 14) controls the gate; when a resolved
  SHA is inside the window it **keeps the existing pin** (its own built-in step-back for moving
  tags). This is the only command that touches the network. It **fails closed and writes nothing**
  when a tag declared immutable resolves to a different SHA — see "Re-pointed tags" below.
- `make actions-pin-apply` — rewrites each `uses:` `@<sha>` from the lockfile, keeping `# <tag>`.
- `make actions-pin-check` — verifies pins match the lockfile without writing (CI / pre-commit hook).
  Offline. It fails on an unregistered reference, an unpinned or drifted `@<sha>`, a malformed
  lockfile, a lockfile entry no `uses:` references any more, and a `uses:` written in a notation the
  scanner cannot read.
- **`uses:` must be written one step per line (block notation).** YAML flow mapping
  (`- {name: X, uses: owner/repo@v1}`) is outside what the scanner reads, so it is rejected rather
  than silently skipped. If a bump would need one, rewrite the step in block notation.
- **A moving major tag (`# v6`) auto-advances to the latest within-major release** on the next
  `resolve`. A same-major refresh is therefore just `resolve` + `apply`. A **major bump requires
  editing the comment tag** (`# v6` → `# v7`) first. An **exact-version comment (`# v6.1.0`) never
  moves** on `resolve`; bumping it requires editing the comment.
- **The shape of the comment tag declares which of the two it is.** A bare major number (`v6` / `6`)
  is moving; everything else (`v6.1.0`, `v6.1`, `main`) is immutable and its SHA moving is a fail.
  An upstream with a moving minor tag (`v6.1`) therefore produces a false positive, which fails safe.

### Re-pointed tags

`resolve` exits 1 and **writes no lockfile at all** — not the accepted moves, not the other entries —
when an immutable-declared tag resolves to a different SHA, printing `key: <old> -> <new>` per
finding. Once a re-pointed SHA lands in the lockfile, `check` answers "consistent" forever after, so
the write is withheld rather than reported alongside.

An intended update to an immutable tag is approved per key:

```sh
make actions-pin-resolve ACTIONS_PIN_ALLOW_MOVED="actions/cache@v6.1.0 actions/checkout@v7.0.0"
```

Approval covers one move. A key that did not move is reported as a redundant approval — leaving a
stale one in place would wave the next re-point through. The quarantine still applies independently;
`ACTIONS_PIN_ALLOW_MOVED` silences only the re-point failure. A key no `uses:` references is an
error, so a typo cannot pass as a granted approval.

> Rationale: [0153](../../../docs/adr/0153-ci-configuration.md) decision 3.

## When to Use

Use this skill when:

- Routine periodic refresh of pinned Actions SHAs (default minor-only mode)
- Bumping Actions to newer major versions (`major` argument)
- After a GitHub Actions security advisory

Do NOT use this skill for:

- `mise.toml` tool versions — use `tools-upgrade`
- The Node runtime — use `node-upgrade`
- npm dependencies — those are Dependabot / a dedicated PR, not this skill
- Local composite actions (`uses: ./...`) — they have no `@ref` and are not pinned

## Arguments

Parse the invocation arguments (order-independent); they drive behavior, so the strategy is NOT
asked interactively:

| Token | Meaning | Default |
| --- | --- | --- |
| `major` (or `--major`) | Also bump to newer **major** versions. Absent → **minor-only** (stay within the current majors). | minor-only |
| a bare integer, or `days=N` (or `--days N`) | Exclusion window in days = `ACTIONS_PIN_MIN_AGE_DAYS`, used both by the skill's step-back computation and passed to `make actions-pin-resolve`. | `14` |

Examples: `/actions-pin` (minor, 14d) · `/actions-pin major` (minor+major, 14d) ·
`/actions-pin major 30` (major, 30d) · `/actions-pin 21` (minor, 21d).

The exclusion days must be a non-negative integer. `0` disables the quarantine (adopt even brand-new
releases) — only honor it when the user explicitly passes `0`, and surface the supply-chain risk.

## AI Modification Scope

Per the "Exception: Skill Execution" clause in `AGENTS.md`, the following paths may be modified while
this skill runs:

- `.github/workflows/*.{yml,yaml}` — the `uses:` comment tags + the `@<sha>` (written by
  `make actions-pin-apply`)
- `.github/actions/*/action.{yml,yaml}` — same
- `.github/actions-pin.toml` — the lockfile (written by `make actions-pin-resolve`)

The following remain protected even during skill execution:

- `AGENTS.md` / `CLAUDE.md` / `LICENSE` / Accepted ADR bodies
- Anything listed under `permissions.deny` in `.claude/settings.json`
- Any file unrelated to the pin upgrade. Do NOT change `with:` inputs, step logic, or
  `scripts/actions-pin/` — if a bump needs an input change, surface it and stop.

## The Target-Selection Rule (core of this skill)

For each action, the **target major** `M` is its current major in minor-only mode, or the latest
available major in `major` mode. Pick the pin for `M` as follows (`N` = exclusion days, cutoff =
`now - N days`):

1. **Moving tag, aged** — if a moving major tag `vM` exists and its latest resolved SHA is older
   than the cutoff → pin `# vM` (preferred: keeps auto-advancing on future runs).
2. **Step back to the previous aged exact** — else (the `vM` head is inside the window, or no moving
   `vM` tag exists) → choose the newest exact release `vM.x.y` whose `published_at` is older than
   the cutoff, and pin `# vM.x.y`. This is the "use the one-previous version" behavior — it reaches
   `M` now while honoring the quarantine.
3. **Hold** — if no release in `M` is older than the cutoff (e.g. `M` is brand-new and only `vM.0.0`
   exists, still fresh) → leave the action unchanged and report it as held.

Notes on the rule:

- In **minor-only** mode, `M` is the current major, so step 1 normally applies and
  `make actions-pin-resolve` does the work (it keeps the existing pin when the within-major head is
  fresh — equivalent to step 2). The skill only edits a comment tag when it must force a step-back
  to an exact version, or to bump an exact-pinned action's patch line.
- In **major** mode, `M` is the new major with no existing lockfile key, so a fresh `vM` head would
  be **skipped** by `resolve` (→ `apply` reports it as unregistered). Step 2 is what makes the new
  major adoptable now; step 3 holds it otherwise.
- An exact step-back (step 2) deviates from the moving-major convention. Record in the commit that
  it can be returned to `# vM` once `vM` ages.

## Step 0. Pre-flight

Install dependencies and export a token so `resolve` (GitHub API for release dates) is not
rate-limited:

```sh
pnpm install --frozen-lockfile
export GITHUB_TOKEN="$(gh auth token)"
```

## Step 1. Parse Arguments and Inventory

Parse the arguments (above) into `<MODE>` (minor / major) and `<N>` (exclusion days). Then:

- Read `.github/actions-pin.toml` for the current `tag → sha` set.
- Grep `uses:` across `.github/workflows/` and `.github/actions/` to map each external action to its
  file locations and current comment tag (note actions referenced in multiple files).

## Step 2. Query Releases and Compute the Target Pin

For each distinct external action, fetch its release list with dates
(`gh api repos/<owner>/<repo>/releases -q '.[] | "\(.tag_name)\t\(.published_at)\t\(.prerelease)"'`;
skip pre-releases). Determine the target major `M` per `<MODE>`, then apply the Target-Selection
Rule to compute one of: pin `# vM` / pin exact `# vM.x.y` (step-back) / hold. Account for
**tag-format changes** across majors (some upstreams add or drop the `v` prefix) — the comment tag
must match the upstream tag string exactly or `resolve` fails with `ref ... が見つかりません`. For
step 1 candidates also confirm the moving `vM` tag actually exists (`git ls-remote … vM`); if
absent, fall to step 2.

## Step 3. Verify `with:` for Major Bumps

`resolve` / `apply` / `actionlint` catch syntax, NOT semantic input changes. For every action whose
**major changes**, read its release notes and the upstream action's own definition file, then compare
them against every `with:` block this repo uses. If the repo's actual inputs remain compatible → keep the bump. If a breaking input
change applies → **hold the action and report the required change**; do not auto-apply. Minor-only
refreshes within a major skip this check.

## Step 4. Where Step-back Is Not Available

The quarantine's normal answer is the **step-back** (rule 2): pin the newest already-aged exact
version. It needs no evidence gathering — it adopts something the window has already cleared. The
cases with no step-back available are:

- **A rule 3 hold** — no release in the target major is older than the cutoff, so the choice is wait
  or take the fresh one. There is no vetted alternative to fall back to.
- **An advisory whose fix exists only in the fresh head**, where waiting means staying vulnerable.
- **Any action held by the `with:` review** (step 3), if the user then asks whether the fresh
  version is safe in itself.

**Hand such a candidate to `supply-chain-triage`**, which scores it on direct evidence over four
axes and reports what it could not answer rather than passing it. Do not improvise a verdict here:
this skill knows the window and the step-back, and the evidence that discharges the window is a
different job. Take its band back, state plainly that no vetted alternative exists, and let the user
decide via `AskUserQuestion` — **a low score is evidence for that decision, not the decision**.

## Step 5. Display Plan and Confirm

Print a Japanese summary: bumps to apply (moving `# vM` / exact step-back `# vM.x.y`, each with the
chosen version + its age), held items (with reason: still-fresh new major / breaking `with:` / no
aged release), and unchanged. Then confirm the concrete set via `AskUserQuestion`
(`multiSelect: true` when several independent bumps are offered) so the step-back and hold decisions
are visible before any write.

## Step 6. Edit Comment Tags

For each approved bump, edit the trailing comment tag of the relevant `uses:` line(s) to the
computed target (`# v7`, or exact `# v4.1.0`). Leave the `@<sha>` as-is (`apply` rewrites it). When
an action appears in multiple files with an identical `uses:` line, a per-file replace-all is
appropriate; when several distinct actions share the same old comment in one file, match the full
unique `uses:` line so only the intended one changes. Leave held / unchanged actions untouched.

## Step 7. Resolve → Apply

```sh
export GITHUB_TOKEN="$(gh auth token)"
make actions-pin-resolve ACTIONS_PIN_MIN_AGE_DAYS=<N>   # the parsed exclusion days
make actions-pin-apply
```

`resolve` re-resolves every referenced tag and prints `⚠️ ... 既存ピンを維持` for any whose head is
inside the window — expected, not a failure.

A legitimate advance of a moving major tag is printed as `ℹ️ tag の解決先が前進しました` with the
old and new SHA.

**If `resolve` exits 1 with `不変を宣言した tag の解決先が変わりました`, stop.** This is the fail-closed
case of §Re-pointed tags, so nothing has been adopted yet. Report both SHAs for every listed key —
those two values are what make an upstream report actionable — and let the user decide. Do **not**
reach for `ACTIONS_PIN_ALLOW_MOVED` on your own: the only case it is for is a comment tag this repo
declared immutable that upstream in fact moves (a moving minor like `# v6.1`), and confirming that is
a human judgment. If it is confirmed, re-run with the key approved and note in the commit why that
tag moves.

If `resolve` aborts with `ref "vN" が見つかりません`, the moving-major tag does not exist — that
action should have been a step-2 exact pin; fix and re-run.

## Step 8. Verify

```sh
make actions-pin-check     # pins match the lockfile
make actionlint            # actionlint over the workflow definitions
```

Report OK / FAIL per command. Do NOT auto-roll-back on failure — the user decides.

## Step 9. Final Report

Summarize: actions bumped (moving / exact step-back), actions SHA-refreshed, actions held (with
reason), any re-pointed tag `resolve` failed on in step 7, verification result. List any exact-version pins
introduced so the user knows to revisit them once aged. Do NOT commit, stage, or push — the user
runs `/commit` (these changes take the `CI:` prefix) manually.

## Notes

- **Step-back is the default response to the quarantine, not a hold.** Holding happens only when no
  aged release exists in the target major.
- **A tag is a name, not an identity.** The lockfile exists because a tag can be re-pointed; an
  immutable-declared tag whose SHA moves is the case it was built to catch, and `resolve` fails
  closed on it (step 7).
- **The quarantine buys time; it does not prove age.** It reads the more recent of the release's
  `published_at` and the commit's date. A release object is bound to the tag *name* and does not move
  when the tag is re-pointed, and a commit date is git metadata the publisher can set freely — so
  neither signal alone describes the resolved SHA, and even together they are defeatable by a
  determined publisher. The gate is a delay against automated compromise, not a guarantee. Catching a
  re-point is `resolve`'s fail-closed job (step 7), not the quarantine's.
- **Quarantine vs new majors**: the gate keys off SHA age, and a new major has no prior lockfile
  entry, so a fresh major's moving tag is skipped by `resolve` until it ages — which is exactly why
  step 2 pins an aged exact version instead.
- **Not every action has a moving major tag.** Always `git ls-remote` the `vM` tag before assuming
  `# vM` resolves.
- **`actionlint` ≠ semantic safety.** It validates workflow syntax, not whether a bumped action's
  inputs / behavior still match usage. The `with:` review (step 3) is mandatory for major bumps.
- **annotated-tag deref**: `resolve` returns the dereferenced commit SHA (`refs/tags/vM^{}`), so the
  lockfile SHA can differ from a naive `git ls-remote vM` line.
- **`GITHUB_TOKEN`**: `resolve` queries the GitHub API for release dates. The repository's current
  action count fits in the 60 req/h anonymous limit, but export `gh auth token` so a larger run does
  not hit it. `GH_TOKEN` is accepted as well.
- **Idempotency**: a second run shows everything pinned and `make actions-pin-check` passes.
- The skill never auto-pushes.

## Checklist

Confirm before reporting completion:

- [ ] Arguments parsed into mode (minor / major) and exclusion days `<N>` (default 14)
- [ ] `pnpm install --frozen-lockfile` run and `GITHUB_TOKEN` exported
- [ ] Current pins inventoried from `actions-pin.toml` + a `uses:` grep
- [ ] Per action: target major determined by mode, then the Target-Selection Rule applied (moving
      `# vM` aged → exact step-back → hold)
- [ ] Tag-format changes and moving-tag existence accounted for
- [ ] For each major-changing action: `with:` compatibility verified; breaking ones held + reported
- [ ] `resolve` did not exit 1 on a re-pointed tag (if it did → stop, report both SHAs, do not
      approve with `ACTIONS_PIN_ALLOW_MOVED` without the user's judgment)
- [ ] Plan (bumps / step-backs / holds with reasons) presented and confirmed via `AskUserQuestion`
- [ ] Comment tags edited only for approved bumps; held / unchanged actions left untouched
- [ ] `make actions-pin-resolve ACTIONS_PIN_MIN_AGE_DAYS=<N>` + `make actions-pin-apply` run
- [ ] `make actions-pin-check` + `make actionlint` run and reported
- [ ] Exact-version step-back pins introduced are listed for later revisit
- [ ] After updating `SKILL.md`, also update `SKILL.ja.md` to keep the Japanese translation in sync
- [ ] No commit / stage / push performed
