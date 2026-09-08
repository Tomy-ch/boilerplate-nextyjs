---
name: repo-ops
description: Operational runbook for this repository's recurring, easy-to-trip-on gotchas around the mise-managed toolchain, the pnpm lockfile, the Makefile setup targets, the scratch directories, and the lefthook git hooks. Read-only knowledge skill — it tells you the exact command to run; it does not silently mutate state. This is deliberately a SPARSE STARTER for the Next.js boilerplate: it carries only the gotchas that genuinely exist today (mise / pnpm / make DRY_RUN / scratch paths / lefthook hooks), and grows as new operational traps are discovered (in contrast to the go-boilerplate original, whose items were mostly Docker / sqlc / DB-runner specific and do not apply here — ADR 0011 no-docker). Triggers: "make install-tools が mise not found で落ちる", "DRY_RUN はどのターゲットで効くのか", "setup-repo を試しに実行したい", "pnpm install --frozen-lockfile が落ちる", "mise.toml を変えた後の反映", "pnpm のスクリプトが ERR_PNPM_IGNORED_BUILDS で落ちる", "pnpm-workspace.yaml に覚えのない allowBuilds が付いている", "スクラッチ出力をどこに置くか", "commit が commitlint に弾かれる", "hook が command not found で落ちる", "mise 自身の版を上げたい", "mise を上げたら CI の digest 照合で落ちた".
---

# Repo Ops Runbook

Concrete recovery + procedure steps for the operational gotchas that recur in this repo. This is a
**lookup table, not a workflow**: find the symptom, run the fix. When a step is destructive or touches a
root file, say so to the user first per `CLAUDE.md`.

> **Scope note.** This runbook is intentionally sparse: only the traps that genuinely exist here are
> listed. This repository is a presentation layer with no Docker tool-runner and no DB
> ([0011](../../../docs/adr/0011-no-docker.md)), so items about either do not belong. Add an item
> when a new trap bites.

## 1. `make install-tools` fails with `mise not found`

`make install-tools` runs `mise install`, which reads `[tools]` from `mise.toml` (ADR 0003). It first
checks that `mise` itself is on `PATH` and exits with a message if not.

Fix: install `mise` (see <https://mise.jdx.dev/>), then re-run.

```bash
make install-tools     # installs Node.js + pnpm per mise.toml, then prints both versions
```

Rule of thumb: **mise is the SSOT for Node.js / pnpm versions.** After anyone changes `mise.toml`
(e.g. a `node-upgrade`), run `make install-tools` to bring the local toolchain in line, then confirm
with a bare `node --version` / `pnpm --version` from an activated shell. If either disagrees with
`mise.toml`, `PATH` is answering for something else — §2.

## 2. A bare `pnpm` is a different pnpm — scripts fail, `pnpm-workspace.yaml` changes on its own

`mise.toml` pins pnpm (ADR 0003), but a bare `pnpm` resolves through `PATH`, so a system-wide install
(Homebrew, a global npm install, Corepack) shadows the pinned one. A pnpm one major ahead of the pin
then behaves in two ways that both point the blame somewhere else:

- **The script never runs.** pnpm 11 checks dependency freshness before a script and shells out to
  `pnpm install`, which stops on the repo's unapproved build scripts — `ERR_PNPM_IGNORED_BUILDS`
  naming `esbuild` / `lefthook` / `sharp`, or, in the non-interactive shell an agent or CI has,
  `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` because it wants to purge a `node_modules` the other
  major wrote. The stack ends in `runDepsStatusCheck`, which is the tell: the gate failed, not
  `lint:ci` / `typecheck` / `md-lint`.
- **It edits a tracked root config.** pnpm 11 prepends a placeholder block to `pnpm-workspace.yaml`:

  ```yaml
  allowBuilds:
    esbuild: set this to true or false
    lefthook: set this to true or false
    sharp: set this to true or false
  ```

  Nothing announces this, so it rides along into `git status` and can reach a PR. `pnpm-workspace.yaml`
  is a root config outside the default AI Modification Scope — it is not yours to change in passing.

Compare the two resolutions; they should agree:

```bash
pnpm --version     # what PATH found
mise which pnpm    # the binary mise.toml pins
which -a pnpm      # who is shadowing whom
```

Recover by fixing `PATH`, not by wrapping the command:

```bash
git restore pnpm-workspace.yaml     # drop the allowBuilds block if it landed
eval "$(mise activate zsh)"         # put the pinned toolchain first (bash: mise activate bash)
pnpm lint:ci                        # then run it bare, as AGENTS.md prescribes
```

If the wrong pnpm already reinstalled `node_modules`, the pinned pnpm refuses to take it back with the
same `..._NO_TTY` abort. `CI=true` answers the purge prompt for it:

```bash
CI=true pnpm install --frozen-lockfile
```

`mise activate` in the shell is the whole fix — it is what makes a bare command resolve to the pin.
`mise exec -- <command>` is **forbidden** as a way around this (ADR 0003): it would repair one call while
leaving the `PATH` that broke it in place, and every caller that forgets the wrapper hits the same
failure. There is no wrapped spelling anywhere in this repository — not in `.lefthook.yaml`, not in
`.makefiles/`.

Hooks resolve through the same `PATH` you do, so a shell holding the wrong pnpm hands it to the hooks as
well (§7) — **a commit failing in `lint:ci` can be this, not your diff**. The `runDepsStatusCheck` frame
in the stack is what separates the two.

Moving the pin to the newer pnpm is `tools-upgrade`'s decision, not a workaround for this; it also
requires filling `allowBuilds` with real values rather than the placeholders.

## 3. `DRY_RUN` does nothing on `make setup-repo`

`DRY_RUN=1` gates only the two replacement helpers. `make setup-repo` never reads it, so there is **no
way to preview** what it will do.

```bash
DRY_RUN=1 make setup-replace-license-copyright COPYRIGHT_HOLDER='Example Inc.'  # preview
DRY_RUN=1 make setup-replace-repository-reference REPOSITORY=org/app           # preview
DRY_RUN=1 make setup-repo                                                      # ⚠️ runs for real
```

`1` is the only value that enables the dry run; anything else (including `DRY_RUN=0`) writes.

`make setup-repo` is a one-time repository-initialization target and is **destructive**: it deletes
every existing tag locally and on `origin`, deletes every release note except `v0.0.0.md`, removes the
`upstream` remote, and creates + pushes `v0.0.0` and the three protected branches. Confirm with the
user before running it, and never run it against an already-initialized repo (it aborts if `v0.0.0`
exists).

## 4. `pnpm install --frozen-lockfile` fails — lockfile out of sync

Per ADR 0001, `pnpm-lock.yaml` **must be committed** and kept in sync with `package.json`. A CI-style
`--frozen-lockfile` install fails when they diverge (e.g. a dependency was edited without re-locking).

Fix: re-lock and commit the lockfile in the same change as the `package.json` edit.

```bash
pnpm install                 # updates pnpm-lock.yaml to match package.json
git add package.json pnpm-lock.yaml
```

Rule of thumb: **any change to `package.json` dependencies requires committing the regenerated
`pnpm-lock.yaml` alongside it.** (`package.json` is a protected root config — dependency edits need an
explicit user instruction; per [0004](../../../docs/adr/0004-library-management.md), a dependency
*major* goes in its own PR.)

## 5. biome: `pnpm lint` vs `pnpm fix` (ADR 0002)

biome is the only formatter, and carries every lint check it can express. Prettier is not used.
ESLint holds exactly the checks biome cannot express — today the layer-boundary import check
(`eslint-plugin-boundaries`) and the `next/link` rule — and nothing else (ADR 0002, capability-based
split). Entry points:

```bash
pnpm fix       # biome check --fix : auto-fix what can be fixed
pnpm lint      # biome check       : report remaining errors (fix these by hand)
pnpm format    # biome format --write : formatting only
pnpm lint:ci   # biome (full profile) + ESLint boundaries + architecture cross-check
```

`pnpm lint:ci` is the gate the hook and CI run, and it is three stages in series: biome with
`biome.ci.jsonc` and `--error-on-warnings`, then `pnpm lint:eslint`, then `pnpm check:architecture`
(the layer READMEs' `imports-allowed` frontmatter against `architecture.ts`, which is the single
source of the dependency matrix). A failure names its own stage — read which one before assuming
formatting.

`noConsole` is `warn` by default — **do not leave `console.log` in commits** (AGENTS.md / ADR 0002).
Fix items the auto-fixer cannot handle by hand; do not sprinkle `// biome-ignore` (prefer a scoped
`overrides` in `biome.json`, which is a protected root config = user instruction).

## 6. Scratch output belongs under `tmp/`, and stays out of git

`/tmp` is ignored by `.gitignore`, so the following never reach `git status`:

- `tmp/reviews/` — `full-verify` / `full-apply` finding sets
- `tmp/<name>.md` — symlinks to work-plan documents whose real files live outside the repo

These are scratch output, not source: do not force them in with `git add -f`. A scratch file that
must survive belongs outside the repo, referenced through a symlink under `tmp/`.

**Worktrees live at `.claude/worktrees/<name>/`**, inside the repository — that is where the agent
tooling creates them and the location is not configurable, so a convention placing them elsewhere
only holds for the ones a human makes by hand. A checkout inside the tree lands in the scan surface
of every tool that walks it, so the exclusion is written in five places and they must stay in sync:

| Where | Entry |
| --- | --- |
| `.gitignore` | `/.claude/worktrees/` |
| `.markdownlint-cli2.yaml` | `ignores:` `.claude/worktrees/**` |
| `scripts/mermaid-lint` | `EXCLUDE_PREFIXES` |
| `scripts/skill-lint` | `EXCLUDE_PREFIXES` |
| `.makefiles/security/trivy.mk` | `--skip-dirs .claude/worktrees` |

None of these tools reads `.gitignore`, so ignoring a path there does not exclude it from any of the
other four. Adding a sixth tool that walks the tree means adding a sixth entry.

## 7. A commit or push is rejected by a hook (lefthook)

Hooks are declared in `.lefthook.yaml` (ADR 0151) and are **not** registered by `pnpm install` —
`pnpm exec lefthook install` must be run once after cloning. Hooks live in the common git dir, so a
worktree inherits them; what a worktree does **not** inherit is `node_modules`, so run `pnpm install`
in it or every hook fails with `command not found`.

| Stage | Entry point | What it checks |
| --- | --- | --- |
| pre-commit | `pnpm lint:ci`; `pnpm md-lint` when `*.md` is staged; `make actionlint` when a workflow is staged | biome full profile + ESLint layer boundaries + `architecture.ts` cross-check (§5); markdownlint + mermaid syntax + `.claude/**` semantics (`skill-lint`); workflow syntax + `run:` shell |
| commit-msg | `make commitlint` | the subject against ADR 0150 |
| pre-push | `make test-full`; `pnpm typecheck`; `make secret-scan` | Vitest cache 無効 + カバレッジしきい値; `tsc --noEmit`; secrets in the range being pushed (**fail-closed**) |

`make trivy-fs` is deliberately **not** wired into any hook (on demand only). A dependency vulnerability
cannot be resolved by the pusher on the spot and its status changes independently of the diff, so it does
not hold as a gate — reporting goes to the PR comment and blocking to the promotion gate (ADR 0110 3.1).

Reproduce a stage by running its entry point by hand — bare, from an activated shell. The exact
argument lists live in `.lefthook.yaml` — read them there rather than from a copy.

```bash
make secret-scan
```

Every command in `.lefthook.yaml` is written bare — `mise exec --` is forbidden there like everywhere
else (§2; ADR 0003 / 0151). A hook dying with `❌ <tool> が PATH にありません` while `mise ls` shows the tool
installed is therefore an environment report, not a hook bug: the shell that launched `git` does not have
the activated `PATH`. Fix it at the source — `make install-tools`, then activate mise in that shell. For
a launcher that never sources a profile (a GUI git client, an agent shell, CI), put mise's **shims**
directory on `PATH` instead (`mise activate --shims`, i.e. `~/.local/share/mise/shims`); the shims
resolve the same pins without a per-call wrapper. Do not wrap the entry to make this one caller pass.

A `secret-scan` failure is not retryable: the secret is inside the commit range being pushed, so it has
to come out of the history.

A commit-msg failure means the subject is not `<Prefix>: <subject>` with one of the 11 prefixes of
ADR 0150, the subject is empty, or it ends with `。`. `commitlint.config.ts` deliberately omits
`type-case` — the prefixes mix `Feat` and `CI`, so no single case rule fits. Merge and revert commits
are skipped by commitlint's default ignores.

### When a gate fails for a reason outside the change

A hook failure is only evidence about the change when the failure is *caused by* the change. Three
recurring cases are not:

- **Another session's file.** `pnpm typecheck` and `make test-full` read the whole working tree, not the
  commit range. An uncommitted file another window is mid-edit on fails the gate for a push that does not
  contain it.
- **Two runs sharing one output directory.** Vitest writes `coverage/.tmp` <!-- skill-lint-ignore --> and fails with
  `Something removed the coverage directory ... Make sure you are not running multiple Vitests with the
  same "coverage.reportsDirectory"` when a second run starts while the first is live. Nothing is wrong
  with the code; the two runs deleted each other's temp files.
- **A pre-existing failure on the base branch.** Verify by checking out the base and running the same
  gate.

In all three, `--no-verify` is the correct move and the cause is fixed separately — reshaping the change
to satisfy a gate it did not break makes the change worse. Two conditions hold it in place:

- **Say which gate failed and why it is outside the change**, in the report and in the PR. A carve-out
  taken silently is indistinguishable from skipping a real failure.
- **Never take it for a gate the push itself makes unrecoverable.** `secret-scan` is fail-closed for this
  reason: a secret in the pushed range cannot be un-pushed. `commitlint` likewise — the subject is already
  in history. Those two are fixed, never bypassed.

**Do not pre-empt the hook by running the heavy gates by hand first.** They are minutes of saturated host
to rediscover what the hook and CI run identically, and the saturation itself produces the second case
above. Pushing *is* the verification step.

To check a message without committing:

```bash
echo "Feat: 説明" | pnpm exec commitlint
```

## 8. mise itself needs a version bump, or CI broke after one

`mise.toml` declares what mise resolves; it cannot declare mise. The version of the binary therefore
lives in [`.github/actions/setup-mise/action.yaml`](../../../.github/actions/setup-mise/action.yaml),
and it is written **three times**: `MISE_VERSION`, `MISE_SHA256`, and the cache key. A composite
action cannot read a step's `env:` from a `with:` value, so the key has to carry the literals.

Take the digest from the release the version names:

```bash
curl -sSL "https://github.com/jdx/mise/releases/download/v<version>/SHASUMS256.txt" | grep 'linux-x64$'
```

Then edit all three to agree and confirm it:

```bash
make actions-mise-pin-lint
```

The same check runs in CI as part of `actions-lint`, so a half-finished bump does not merge. Reading
the failure when only one side was edited:

| What was edited | What happens |
| --- | --- |
| Version only | The key changes, so nothing is restored; the download then fails the digest check |
| Digest only | The key does not change, so the old binary is restored and fails the digest check |

Both are fail-closed — the wrong binary never executes — but neither message names the cause, which is
why the lint exists. The digest is checked on the restored binary as well as the downloaded one: an
Actions cache is shared across branches and writable by anything with push access, so it is not a
trust boundary ([0153](../../../docs/adr/0153-ci-configuration.md)).

Tool versions inside `mise.toml` are a different job — `tools-upgrade` owns those and deliberately
does not touch mise itself.

## Constraints

- ✅ Read-only knowledge: surface the exact command; run it only when the user asked you to perform the
  operation.
- ✅ Warn before destructive steps (tag/branch deletion in §3) per `CLAUDE.md`.
- ✅ Confirm with the user before editing root files (`biome.json` in §5, `package.json` in §4) —
  they are outside the default AI Modification Scope. §2's `git restore pnpm-workspace.yaml` is the
  exception: it discards an unrequested machine edit rather than making one.
- ❌ Do not add Docker / DB items here (Scope note).
