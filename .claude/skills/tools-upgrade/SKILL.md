---
name: tools-upgrade
usage-class: lifecycle
description: >-
  Audit `mise.toml` `[tools]` entries against upstream latest versions, with a configurable supply-chain
  quarantine. The latest release is fetched from each tool's own backend. Releases newer than `min_age_days`
  are reported as informational only and never applied automatically, so a newly published malicious version
  cannot be pulled in before upstream has time to detect and revoke it. Confirms the window and the per-tool
  update set, rewrites approved entries atomically, reinstalls with `make install-tools`, and verifies with
  `pnpm install` + `pnpm lint:ci` + `pnpm build`. Use it on a routine cadence or after a security advisory.
  Sibling of `actions-pin`, which covers the pinned GitHub Actions rather than `mise.toml`.
---

# Tool Version Upgrade

This skill audits `mise.toml` against upstream latest versions for every tool in the `[tools]` table, with a **supply-chain quarantine gate**: releases newer than their backend's window are surfaced as informational only and are never applied automatically (Step 0 resolves the window and states why it exists).

A Japanese reference translation is available at `SKILL.ja.md` in the same directory (not loaded as a skill; for human reference only).

## When to Use

Use this skill when:

- Routine periodic (monthly / quarterly) check of pinned tool versions
- Before a release, to confirm there are no known CVEs patched since the current pins
- After a security advisory, to see whether the relevant tool can be updated

Do NOT use this skill for:

- Upgrading Node.js itself — use `/node-upgrade`, which reviews the release notes and breaking changes of that Node line
- Updating npm dependencies (`package.json`) — use `pnpm add` / `pnpm update` directly ([0004](../../../docs/adr/0004-library-management.md))
- One-off ad-hoc version bumps — edit `mise.toml` and run `make install-tools`. The quarantine
  still applies: `make tools-cooldown-check` fails a pin whose upstream release is younger than
  its window, whichever path put it there
- Upgrading **mise itself** — `mise.toml` declares what mise resolves and cannot declare mise, so its
  version lives in `.github/actions/setup-mise/action.yaml` and is out of this skill's reach. The
  procedure, including the three places that must agree, is item 8 of the `repo-ops` runbook

## Step 0. Resolve the quarantine window per backend

**The window is not a single number, and it is not this file's to choose.** ADR
[0110](../../../docs/adr/0110-security-operations.md) 1.1 sets one per backend, because the window
tracks how fast a malicious release gets detected and revoked on that distribution channel — not how
much damage the tool could do. A single value applied to every backend silently under-quarantines
whichever channel has the longer window. Waiting buys most of the protection: typical malicious
releases (npm `ua-parser-js` 2021, PyPI `ctx` 2022) were detected and yanked within 24-72 hours.

Procedure:

1. **Read ADR 0110 1.1 this run** and build the backend → window table from what it currently says.
   Do not keep a copy of the numbers in this file: a value written here is a second source of truth
   that goes stale the moment the ADR moves.
2. If a value is present in the skill arguments (e.g. `/tools-upgrade 14`), treat it as a proposed
   override applying to **every** backend, and say so in the question.
3. Always invoke `AskUserQuestion`, presenting the table from step 1 as the default:
    - Question: 「リリースを自動適用の対象にするまでの最小経過日数を確認してください（既定は ADR 0110 1.1 の backend 別の窓）」
    - Options: 「ADR どおり（backend 別）」 / 「全 backend に同じ日数を当てる（値を指定）」 / 「キャンセル」
4. Validate every resolved value is a non-negative integer. Carry the result as
   `<MIN_AGE_DAYS(backend)>` through the rest of the procedure.
5. **When the ADR names no window for a backend that `mise.toml` actually uses**, do not invent one.
   Apply the longest window the ADR states for that run, and report the omission as a finding — a
   backend with no declared window is a gap in the ADR, not a licence to pick a number here.

Do NOT fetch any upstream API or read `mise.toml` until the window table is confirmed.

## AI Modification Scope

Per the "Exception: Skill Execution" clause in `AGENTS.md`, the following paths are permitted to be modified while this skill is running:

- `mise.toml` (the `[tools]` table — write only entries the user explicitly approved)

`mise.toml` is the only tracked file this skill writes (Step 6: nothing propagates from it).

The following remain protected even during skill execution:

- `AGENTS.md` / `CLAUDE.md`
- Generated artifacts (`src/adapters/gen/**` and the imported `openapi.gen.yaml` — [0072](../../../docs/adr/0072-api-type-generation.md)) <!-- skill-lint-ignore -->
- Any file unrelated to the version bump

## Step 1. Parse `mise.toml`

Read `mise.toml` and enumerate every key under `[tools]`. For each key, determine the backend:

| Key format | Backend | Latest-version source |
| --- | --- | --- |
| `aqua:owner/repo` | aqua (GitHub Releases) | `gh api repos/owner/repo/releases/latest` |
| `npm:package` | npm | `https://registry.npmjs.org/{package}` |
| `pipx:package` | pipx (PyPI) | `https://pypi.org/pypi/{package}/json` |
| `core:node` (runtime) | mise core | `https://nodejs.org/dist/index.json` |
| `core:python` (runtime) | mise core | `https://www.python.org/api/v2/downloads/release/` |

A key with no backend prefix must not appear: [0003](../../../docs/adr/0003-version-manager.md) requires
the backend to be explicit, because a tool registered under several backends silently changes its
download source when the registry default moves. Surface such a key as a finding instead of resolving it.

For each tool, fetch:

- **Latest stable version** (skip pre-release tags: `-rc`, `-beta`, `-alpha`, `-pre`, `-dev`, etc.)
- **Release date** (ISO 8601 timestamp)

Prefer the `gh` CLI (it handles `GITHUB_TOKEN` automatically and raises the rate limit). For non-GitHub endpoints, use `curl -fsSL`.

## Step 2. Classify

For each tool:

| Class | Condition |
| --- | --- |
| **up-to-date** | `pinned == latest` (after normalizing the optional leading `v` prefix) |
| **eligible** | `pinned != latest` AND `now - release_date >= MIN_AGE_DAYS(backend)` |
| **pending** | `pinned != latest` AND `now - release_date < MIN_AGE_DAYS(backend)` |
| **resolution_failed** | Backend lookup failed (network error, 404, parsing failure) |

The window is the one Step 0 resolved **for that tool's backend** (Step 1 already determined it), never one number for every tool.

Sanity rule: refuse to "upgrade" to a strictly lower version per semver — if the parsed latest is `<` the pinned version, classify as `resolution_failed` with reason "potential downgrade".

## Step 3. Display Summary

Print a Japanese-language summary grouped by class. Example:

```text
ツールバージョン監査結果（窓: backend 別 / ADR 0110 1.1）

✅ 更新候補（backend の窓を満たした / supply-chain quarantine 通過）:
  - actionlint: 1.7.11 → 1.7.12 （公開 2026-05-18, 17 日前）
  - gitleaks: 8.29.0 → 8.30.1 （公開 2026-04-29, 36 日前）

⚠️ supply-chain quarantine（backend の窓の内側、通知のみ）:
  - trivy: 0.72.0 → 0.73.0 （公開 2026-06-02, 2 日前）

✓ 既に最新:
  - shellcheck 0.11.0
  - zizmor 1.29.0
  ... (省略可)

❌ 取得失敗:
  - pipx:graphifyy: PyPI への接続失敗
```

A `pending` release is a candidate for `supply-chain-triage`: it scores the version on direct evidence over four axes so the window can be discharged by evidence rather than only by waiting. **Report the band; never adopt on the strength of a low score** — that decision is the user's ([0110](../../../docs/adr/0110-security-operations.md) §1.2).

## Step 4. Confirm Per-tool Update Set

If **eligible** is empty, skip to step 6 with no writes.

Otherwise invoke `AskUserQuestion` with `multiSelect: true`. Each option corresponds to one eligible tool, with the version diff and release date as the description. Default state: all selected.

The user may deselect individual entries (e.g., if a specific bump is known-broken).

## Step 5. Update `mise.toml`

For each approved tool:

- Locate the exact line in `mise.toml`
- Replace the version literal only — **preserve the key exactly, backend prefix included** (`aqua:owner/repo` / `pipx:package` / `core:node`), along with the original `v`-prefix convention if any. Rewriting a key to a bare name is the failure Step 1 refuses to resolve
- Do not reorder keys, do not touch unrelated keys, do not touch the `[settings]` table

After computing all approved changes, write `mise.toml` **once** (atomic single-pass write). Read the file → apply all replacements in memory → write.

## Step 6. Install the Approved Versions

Run `make install-tools` so the freshly pinned versions are the ones actually on `PATH`. Until this
runs, `mise.toml` and the installed toolchain disagree and every later step verifies the old versions.

There is no downstream propagation step: `mise.toml` is the single source of truth and no delivery-layer
file — no Dockerfile, no runtime manifest — carries a duplicated version
([0003](../../../docs/adr/0003-version-manager.md) / [0011](../../../docs/adr/0011-no-docker.md)).

## Step 7. Verify

```sh
pnpm install
pnpm lint:ci
pnpm build
```

Report the result table to the user (OK / FAIL per command). Do NOT automatically roll back on failure — the user decides whether to amend, revert, or proceed.

## Step 8. Final Report

Summarize:

- Number of tools updated
- Number quarantined (pending, not applied)
- Verification result
- Any failures to surface

Do NOT commit, stage, or push. The user reviews the resulting working tree and runs `/commit` (or similar) manually.

## Notes

- **Supply-chain quarantine rationale**: Step 0 — the window per backend is ADR [0110](../../../docs/adr/0110-security-operations.md) 1.1's decision, not this skill's, and it moves.
- **Pre-release exclusion**: this skill always selects the latest **stable** release. Pre-release tags are visible in upstream but never chosen as `latest`.
- **Calendar versioning**: for tools using calendar versioning (e.g., `2024.12.30`), comparison is lexicographic with semver fallback. The "potential downgrade" guard remains active.
- **Rate limits**: GitHub API anonymous limit is 60 req/h per IP. The skill SHOULD use `gh api` which authenticates via `GITHUB_TOKEN` (1000 req/h authenticated).
- **Idempotency**: multiple invocations are safe. A second run after a successful apply will show those tools as up-to-date.
- No commit / stage / push (Step 8).

## Checklist

Confirm the following before reporting completion:

- [ ] Backend 別の窓を ADR 0110 1.1 から読み、`AskUserQuestion` で確認した
- [ ] Every `[tools]` entry's backend was resolved (or surfaced as resolution_failed with a reason)
- [ ] Each tool was classified (up-to-date / eligible / pending / resolution_failed)
- [ ] Classification table presented to the user
- [ ] If eligible set non-empty: user confirmed per-tool update set via `AskUserQuestion`
- [ ] `mise.toml` rewritten atomically with only approved changes, preserving key formats and `v`-prefix convention
- [ ] `make install-tools` run after `mise.toml` was rewritten
- [ ] `pnpm install` + `pnpm lint:ci` + `pnpm build` run after writes
- [ ] Final result table reported to the user
- [ ] After updating `SKILL.md`, also update `SKILL.ja.md` to keep the Japanese translation in sync
- [ ] No commit / stage / push performed
