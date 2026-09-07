---
name: commit
description: Analyze the current working-tree changes (staged + unstaged), group them into appropriately-scoped commits with the project's prefix convention (Feat / Fix / Refactor / Perf / Docs / Test / Build / CI / Chore / Style / Revert), and execute each commit in Japanese after user approval. Pre-flight also checks whether the current branch's PR is already merged and, if so, recommends cutting a fresh branch from the base before committing. Commits are made with `git commit --no-verify` to skip lefthook during the split; after all commits succeed, the command runs the lefthook-defined commands directly plus `pnpm fix` as a final verification gate (lefthook itself is bypassed because it skips checks when nothing is staged). Respects CLAUDE.md's git rules (no direct commits to protected branches, no force-push, no auto-push after PR amend, Co-Authored-By footer, HEREDOC commit messages).
argument-hint: [--dry-run] [--scope=staged|all]
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*), Bash(git branch:*), Bash(git rev-parse:*), Bash(git reset:*), Bash(git fetch:*), Bash(git switch:*), Bash(gh pr view:*), Bash(pnpm fix:*), Bash(pnpm lint:*), Bash(pnpm md-lint:*), Bash(pnpm typecheck:*), Read, AskUserQuestion
---

# Commit

You have been invoked via `/commit`. Argument string: `$ARGUMENTS`

This command analyzes uncommitted changes in the working tree and produces one or more git commits with appropriate granularity and the project's prefix convention. All commit messages are in Japanese, per `CLAUDE.md`.

This command intentionally bypasses lefthook on every commit (`git commit --no-verify`) so that the pre-commit checks defined in `.lefthook.yaml` (currently `pnpm lint:ci` / `pnpm md-lint`) do not fire N times during multi-commit splits. Instead, after all commits succeed, Step 6 runs each lefthook-defined `pre-commit` command directly plus `pnpm fix` as a single verification pass. We do not call `lefthook run pre-commit` itself because lefthook skips registered commands when nothing is staged (which is exactly the case after this command stages and commits everything).

## Step 0. Auto-format

Run `pnpm fix` once at the very start to absorb formatting fixes (biome format + auto-fixable lint rules — biome is the sole formatter, [0002](../../../docs/adr/0002-formatter-linter.md)). This removes the most common source of noise from the subsequent diff inspection and reduces the chance the Step 6 verification fails on pure formatting.

```sh
pnpm fix
```

If `pnpm fix` itself fails, abort and report the failure to the user. Do not continue. Any changes it produces are folded into the working tree and become part of the candidate change set inspected in Step 2.

## Step 1. Pre-flight Checks

Run these in parallel:

```sh
git rev-parse --abbrev-ref HEAD                      # current branch
git rev-parse HEAD                                   # current HEAD commit (save as ORIGINAL_HEAD)
git status --porcelain                               # staged + unstaged
git diff --shortstat                                 # unstaged summary
git diff --staged --shortstat                        # staged summary
git rev-parse --verify MERGE_HEAD 2>/dev/null        # detect ongoing merge
git rev-parse --verify CHERRY_PICK_HEAD 2>/dev/null  # detect ongoing cherry-pick
git rev-parse --verify REBASE_HEAD 2>/dev/null       # detect ongoing rebase
```

Save the current HEAD commit hash as `ORIGINAL_HEAD`. This is the rollback target if anything fails during Step 5.

Bail out (do not commit) if any of the following:

- Current branch matches `^(production|develop|staging|release/.+|hotfix/.+)$`. Per `AGENTS.md` git rules ([0150](../../../docs/adr/0150-git-workflow.md)), never commit to protected branches. Inform the user and ask them to create a feature branch first (e.g., `feature/<issue-or-topic>`).
- Both staged and unstaged porcelain outputs are empty. Tell the user there is nothing to commit and stop.
- Any of `MERGE_HEAD` / `CHERRY_PICK_HEAD` / `REBASE_HEAD` is set. The repository is mid-operation; ask the user to resolve that first.

### Merged-PR check (recommend a fresh branch when the current branch's PR is already merged)

After the branch passes the protected-branch bail-out, check whether the current branch already has an associated pull request that has been **merged**. Adding new commits onto a branch whose PR is already merged is almost always unintended — the commits would pile up on a dead branch that no longer flows into its base, and a later `submit-pr` would try to reopen / update a merged PR.

Run (gh CLI; degrade gracefully when `gh` is missing, unauthenticated, or there is no remote — in that case skip this check and continue):

```sh
gh pr view --json number,state,mergedAt,baseRefName,headRefName,url 2>/dev/null
```

Interpret the result:

- **No PR found, or `gh` unavailable** → continue normally (no action).
- **`state` is `OPEN`** → normal "existing PR branch" case. Continue; Step 7 already enforces the ask-before-push rule for PR branches.
- **`state` is `MERGED`** (or `mergedAt` is non-null) → STOP before committing and use `AskUserQuestion` to recommend cutting a new branch from the (latest) base:
  - Question: 「現在のブランチ `<headRefName>` は PR #`<number>` が既にマージ済みです。このままコミットすると、base に流れない死んだブランチに積み増しになります。新しいブランチを切って作業しますか？」
  - Options:
    - 「新しいブランチを切る（推奨）」 — propose a branch name derived from the pending change (e.g. `feature/<topic>`), confirm it, then refresh the base and switch:

      ```sh
      BASE=$(make -s base-branch)
      test -n "$BASE" || { echo "ベースブランチを解決できませんでした"; exit 1; }
      git fetch origin "$BASE"
      git switch -c <new-branch> "origin/$BASE"
      ```

      The base here is the **current** release line, which `make base-branch` resolves from `origin`'s live state — not the merged PR's `baseRefName`. That field records the line the old work merged into, and a release line may well have opened since; branching off it would start the new work one generation behind. This is also why `gh repo view --json defaultBranchRef` is not the answer: the GitHub default branch can lag behind the current line too. Note that `git switch -c … origin/release/*` sets the new branch's upstream to the **protected** base, so the eventual push must use an explicit refspec (`git push -u origin <new-branch>`), never a bare `git push` (which would target the protected base). The uncommitted working-tree changes carry over to the new branch; continue the normal flow (Step 2 onward) on it. **Exception:** under `--dry-run`, do not switch branches — only surface the warning and the recommended command, then proceed with the dry-run proposal.
    - 「このブランチのまま続ける」 — the user accepts committing on the merged branch; continue on the current branch.
- **`state` is `CLOSED`** (closed without merge) → not blocked, but note it to the user once (the branch's PR was closed) and continue.

Read `.lefthook.yaml` (if present) and extract the list of `pre-commit:` command entries. The list is used in two places: (a) displayed in Step 4 so the user knows what is being skipped during the split, and (b) executed directly in Step 6 as the post-commit verification gate. If `.lefthook.yaml` is absent, note that and continue (Step 6 will fall back to running only `pnpm fix`).

Parse `$ARGUMENTS`:

| Flag | Effect |
| --- | --- |
| `--dry-run` | Produce the grouping proposal but do not stage or commit. |
| `--scope=staged` | Only consider currently-staged changes. |
| `--scope=all` | Consider both staged and unstaged (default). |

## Step 2. Inspect Changes

Collect detailed diffs to understand the nature of each change:

```sh
git diff --staged                     # full staged diff
git diff                              # full unstaged diff
git diff --staged --name-only
git diff --name-only
```

Treat the following as **rider files** — they never form their own commit, but ride along with the source change that produced them:

- Lockfile: `pnpm-lock.yaml` rides with the `package.json` change that produced it ([0001](../../../docs/adr/0001-package-manager.md) — the lockfile must be committed, never on its own)
- Generated API artifacts: `src/adapters/gen/**` and the imported `openapi.gen.yaml` ([0072](../../../docs/adr/0072-api-type-generation.md) — do-not-edit, regenerated from the backend spec) <!-- skill-lint-ignore -->
- Next.js-managed types: `next-env.d.ts`

Example: a `package.json` dependency change brings the regenerated `pnpm-lock.yaml` with it in the same commit. Re-importing the backend `openapi.gen.yaml` brings its `src/adapters/gen/**` outputs in the same commit. <!-- skill-lint-ignore -->

Some of these paths do not exist yet (the generation pipeline lands with [0072](../../../docs/adr/0072-api-type-generation.md)'s implementation PR). Treat an absent path as "no rider", not as an error.

## Step 3. Prefix Reference

Use exactly **one** of the following prefixes per commit (capitalized, English, colon-suffixed):

| Prefix | Purpose | Examples |
| --- | --- | --- |
| `Feat:` | New feature, new screen, new endpoint | New route segment under `src/app/`, new Route Handler, new component / hook |
| `Fix:` | Bug fix (correcting behavior that deviates from intent) | Error-handling fix, logic correction, a11y defect fix |
| `Refactor:` | Internal cleanup without changing external behavior | Function split, rename, responsibility move, layer reorganization |
| `Perf:` | Performance improvement | Re-render reduction, bundle-size reduction, needless client-boundary removal |
| `Docs:` | Documentation change | `README*`, `docs/`, `*.ja.md`, code comments, release notes |
| `Test:` | Adding or fixing tests | `*.test.ts` / `*.test.tsx`, test fixtures, test helpers |
| `Build:` | Build system, dependencies, tooling | `package.json` / `pnpm-lock.yaml`, `mise.toml`, `next.config.ts`, `tsconfig.json`, `Makefile`, `.makefiles/**` |
| `CI:` | CI/CD configuration | `.github/workflows/**`, `.lefthook.yaml`, GitHub Actions related |
| `Chore:` | Miscellaneous chores | `.gitignore`, editor settings, `.claude/**`, other small tasks |
| `Style:` | Formatting-only changes that do not affect logic | Output of `pnpm fix` / `pnpm format` (biome) |
| `Revert:` | Undoing an existing commit | Output of `git revert`, or an equivalent manual revert |

Do not invent prefixes outside this list. When ambiguous, choose the closest match (most cases are one of `Feat` / `Fix` / `Refactor`).

### Path-based hints

| Path pattern | Candidate prefix |
| --- | --- |
| `src/**/*.ts`, `src/**/*.tsx` (non-test) | `Feat` / `Fix` / `Refactor` / `Perf` (judge from the diff) |
| `src/**/*.test.ts`, `src/**/*.test.tsx` | `Test` |
| `src/**/*.stories.*` | `Docs` (catalog entry) / `Feat` when it ships with a new component |
| `src/app/**` (new route segment, `page.tsx` / `layout.tsx` / `route.ts`) | `Feat` (new screen or endpoint) |
| `src/adapters/gen/**`, `openapi.gen.yaml` | rider only — never its own commit (see Step 2) <!-- skill-lint-ignore --> |
| `src/**/*.css`, design tokens | `Style` when formatting-only, otherwise `Feat` / `Fix` |
| `env/**`, `*.env*` | `Feat` / `Chore` (judge from the diff; never commit secrets) |
| `docs/**/*.md`, `README*.md`, `*.ja.md` | `Docs` |
| `package.json`, `pnpm-lock.yaml`, `mise.toml`, `next.config.ts`, `tsconfig.json`, `biome.json`, `postcss.config.mjs`, `Makefile`, `.makefiles/**`, `scripts/**` | `Build` |
| `.github/workflows/**`, `.lefthook.yaml` | `CI` |
| `.gitignore`, `.claude/**`, `.markdownlint*`, editor settings | `Chore` |

## Step 4. Propose Grouping

Build a list of proposed commits with appropriate granularity. Each item:

```txt
[N] <Prefix>: <short Japanese title>
    files:
      - path/to/file1
      - path/to/file2
    rationale: <why these belong in one commit>
```

### Granularity guidance

- **One semantic change = one commit.** Do not mix feature + refactor + fix into a single commit.
- **Tests may co-locate with the implementation they cover** (a new handler and its tests belong together). If you are only adding tests for existing code, that goes into a standalone `Test:` commit.
- **Generated artifacts co-locate with their source change.** When a dependency in `package.json` changes, the regenerated `pnpm-lock.yaml` belongs in the same commit. When the imported `openapi.gen.yaml` changes, the regenerated `src/adapters/gen/**` belongs in the same commit ([0072](../../../docs/adr/0072-api-type-generation.md)). <!-- skill-lint-ignore -->
- **Formatting-only changes are standalone `Style:` commits.** Output produced by Step 0's `pnpm fix` may be folded into the appropriate existing group when it is clearly part of the same change; if it is unrelated, surface it as a separate `Style:` commit.
- **`Docs:` is standalone by default.** Exception: when documentation is part of a new feature (e.g., a README added alongside a new package), they may co-locate.
- **One prefix per commit.** If you feel the urge to write two, the grouping is wrong.

### Lefthook notice

Along with the grouping proposal, display the lefthook commands that will be **skipped** during the commit phase but **executed directly in Step 6** as a verification gate. Read them dynamically from `.lefthook.yaml` (the list is configuration, not hardcoded). Example output matching the config as it currently stands:

```txt
This command will run `git commit --no-verify` on every commit.
The following lefthook pre-commit commands will be SKIPPED during commits but
EXECUTED automatically in Step 6 (verification) after all commits succeed:
  - lint     (pnpm lint:ci)
  - md-lint  (pnpm md-lint)   ※ glob: *.md
Plus `pnpm fix` as a final formatting pass.
```

`pre-push` commands (currently `pnpm typecheck`) are **not** part of this gate — they stay on the push path, which this command never triggers.

### Confirmation

Confirm the proposal via `AskUserQuestion`:

- Question: 「提案したコミット分割でよいですか？」
- Options: 「この提案で進める」 / 「修正したい箇所を指摘する」

When `--dry-run` is set, print the proposal and stop. Do not stage or commit.

## Step 5. Execute Each Commit

For each approved group, run the following in order:

```sh
# Stage only the files belonging to this group (never use -A / .)
git add path/to/file1 path/to/file2

# HEREDOC is required (preserves the title / blank line / body / footer layout).
# --no-verify is intentional: lefthook is bypassed by design (see Step 4 notice).
git commit --no-verify -m "$(cat <<'EOF'
<Prefix>: <short Japanese title>

<Optional body: what changed and why>

Co-Authored-By: <running model name> <noreply@anthropic.com>
EOF
)"
```

### Commit message rules

- **Title**: `<Prefix>: <Japanese title>`, aim for 50 characters or fewer.
- **Body**: Optional. If present, leave one blank line after the title and wrap around 72 characters. Prefer "why" over "what".
- **Language**: Japanese (per the output rule in `CLAUDE.md`).
- **`Co-Authored-By` footer**: Required, in the form `Co-Authored-By: <running model name> <noreply@anthropic.com>` — e.g. `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`. Use the identifier of the model actually producing the commit, as given by the environment / `CLAUDE.md`. Do not copy a model name hardcoded in this document: it goes stale at every model release, and a wrong name misattributes the commit.
- **`Refs:` footer (review-applied commits only)**: when a commit applies a finding from `full-apply` / `impl-review` / `code-review`, add a `Refs: tmp/reviews/mod_*.md (<severity>)` line in the footer so the commit links to the finding. Omit it for ordinary commits.
- **HEREDOC**: Required (keeps the title + blank line + body + footer layout intact).
- **`--no-verify`**: Required for every commit produced by this command. This is an explicit, command-scoped carve-out from the project-wide rule; the rationale is documented in Step 4 (lefthook is run once manually before push, not N times during the split).
- **Never use `-a`, `git add -A`, or `git add .`.** Always stage files by name (avoids sweeping in `.env` or credentials).
- **`--no-gpg-sign` and `--amend` remain prohibited.**

### Error handling

If `git add` or `git commit` fails for any group (file-path typo, mid-operation state that slipped through pre-flight, GPG signing failure, etc.):

1. Stop further commits immediately. Do not continue with the next group.
2. Report to the user:
   - Which group failed (`[k]` index and proposed title)
   - The captured stderr from the failed command
   - The commits already created in this session: `git log --oneline <ORIGINAL_HEAD>..HEAD`
3. Use `AskUserQuestion` to ask how to recover:
   - Question: 「ここまでに作成したコミットをどうしますか？」
   - Options:
     - 「ロールバックする (`git reset --mixed <ORIGINAL_HEAD>`)」 — rewinds HEAD to the saved `ORIGINAL_HEAD`, leaves all changes in the working tree, clears the index
     - 「そのまま残して停止する」 — keep the partial commits and hand control back to the user
4. If the user chooses rollback, run `git reset --mixed <ORIGINAL_HEAD>` and confirm with `git status` and `git log --oneline -n 3`. Never use `--hard`.

## Step 6. Verification

After all commits succeed, run a verification gate composed of (a) each command defined under `pre-commit:` `commands:` in `.lefthook.yaml` and (b) `pnpm fix` as a final formatting pass. Do NOT run `lefthook run pre-commit` itself — lefthook skips registered commands when nothing is staged (which is the post-commit state), so it would report "no matching staged files" and exit without checking anything. Instead, execute each command directly.

### Procedure

1. Re-read `.lefthook.yaml` and enumerate `pre-commit.commands.*.run` values. Skip this step if `.lefthook.yaml` is absent.
2. Run each command **sequentially** (clearer output than parallel; the user sees which step failed if any). For each, capture the exit status and a short tail of the output.
3. After all lefthook-defined commands finish, run `pnpm fix`. If `pnpm fix` modifies any tracked file, surface the diff to the user — it indicates the committed state was not fully formatted, and the user must decide whether to stage and commit those fixes.
4. Summarize results to the user using a table format:

   ```txt
   検証コマンドの実行結果:
     - pnpm lint:ci   → OK / FAIL
     - pnpm md-lint   → OK / FAIL
     - pnpm fix       → no changes / changes detected
   ```

5. If any command **fails**, report the failure summary (exit code + last lines of output) and stop. Do NOT roll back commits — the failure is informational; the user decides whether to add fix-up commits or amend. Tell the user explicitly:

   ```txt
   検証で失敗があります。push 前に修正してください。
   失敗したコマンド: <name> (<command>)
   ```

6. If all commands **pass** and `pnpm fix` produced no changes, proceed to Step 7.

### Skipping verification

If the user passes `--no-verify` to `/commit` itself (a future-compatible flag), or if `.lefthook.yaml` is absent, skip this step entirely and note it in the Step 7 report. The default behavior is to run verification.

## Step 7. Push Policy and Final Reminder

- **Do not auto-push** (per `CLAUDE.md` git rules).
- After Step 6 finishes (whether all checks passed or not), report to the user. The template depends on the verification outcome:

  When all checks passed:

  ```txt
  N 件のコミットを作成し、検証コマンドも全て成功しました。
  プッシュは手動で実行してください: `git push`
  ```

  When some checks failed:

  ```txt
  N 件のコミットを作成しましたが、Step 6 の検証で失敗があります。
  失敗内容を修正してから push してください。
  ```

  When verification was skipped (no `.lefthook.yaml` or explicit skip):

  ```txt
  N 件のコミットを作成しました（検証はスキップしました）。
  push 前に手動で動作確認してください。
  ```

- When working on an existing PR branch, follow `CLAUDE.md` and ask before pushing:
  「変更はローカルにコミット済みです。これらの変更をプルリクエストにプッシュしますか？」

## Constraints (Summary)

- ❌ Direct commits to `production` / `develop` / `staging` / `release/*` branches
- ❌ Auto-running `git push` / `git push --force` / `git reset --hard` / `git checkout --` / `git clean -f`
- ❌ `--no-gpg-sign` / `--amend`
- ❌ `git add -A` / `git add .` / `git commit -a` (always name files explicitly)
- ❌ Mixing multiple prefixes in one commit
- ❌ Committing without `--no-verify` (would run lefthook N times)
- ✅ Japanese commit messages
- ✅ HEREDOC for the message
- ✅ `Co-Authored-By` footer
- ✅ `--no-verify` on every commit produced by this command
- ✅ Stage only the files in the current group
- ✅ `pnpm fix` once at Step 0 before inspection
- ✅ Capture `ORIGINAL_HEAD` at Step 1 for safe rollback
- ✅ At Step 1, detect a current branch whose PR is already merged (`gh pr view`) and recommend cutting a fresh branch from the base before committing (degrade gracefully when `gh` is unavailable)
- ✅ On failure, propose `git reset --mixed <ORIGINAL_HEAD>` via `AskUserQuestion`
- ✅ Step 6 runs each lefthook-defined command + `pnpm fix` directly (never `lefthook run pre-commit`)
- ❌ Do NOT invoke `lefthook run pre-commit` — it skips commands when nothing is staged, which is the post-commit state

## Checklist

Before reporting completion, confirm:

- [ ] `pnpm fix` ran successfully at Step 0
- [ ] `ORIGINAL_HEAD` captured before any commit
- [ ] Commits were made on a non-protected branch
- [ ] Checked whether the current branch's PR is already merged; if so, recommended cutting a fresh branch (and acted on the user's choice)
- [ ] Repository was not mid-merge / mid-rebase / mid-cherry-pick
- [ ] The user approved the proposed grouping (unless `--dry-run`)
- [ ] Lefthook skip notice was shown to the user with the dynamic command list
- [ ] Each commit has a single prefix
- [ ] Each commit message is in Japanese and includes the `Co-Authored-By` footer
- [ ] Each commit used `--no-verify` and was passed via HEREDOC
- [ ] `git add` named files explicitly (no `-A` / `.`)
- [ ] Generated artifacts co-located with their source change
- [ ] Step 6 verification ran each lefthook-defined command plus `pnpm fix` (or was explicitly skipped)
- [ ] Verification results (OK / FAIL / no changes) were surfaced to the user
- [ ] No automatic push was performed
