---
name: submit-pr
usage-class: frequent
description: Push the current feature branch to `origin` and create or update its GitHub pull request. Detects whether a PR already exists for the current branch via `gh pr view` and automatically chooses between "create" and "update", then merges the up-to-date base branch into the current branch before anything is reviewed or pushed, so the local review and CI both judge the state that will actually land. The PR body is filled from `.github/pull_request_template.md` (sections `概要` / `変更内容` / `動作確認方法`) using the commit history and diff. Title and body are written in Japanese per `CLAUDE.md`. The skill confirms with the user before any push, with the exact wording required by `CLAUDE.md` for the update path.
---

# Submit PR

This skill pushes the current branch to `origin` and ensures a GitHub pull request exists for it. It handles two cases automatically:

- **Create**: no PR exists for the current branch → push (with `-u` if no upstream) and open a new PR.
- **Update**: an open PR already exists → confirm with the user, then push (the PR's diff auto-updates).

Before either, it brings the base branch into the current branch so that what gets reviewed and pushed is the state that will actually land.

The PR body is filled from `.github/pull_request_template.md`. The skill never auto-pushes, never overwrites an existing PR's title/body, and never force-pushes.

A Japanese reference translation of this skill is available at `SKILL.ja.md` in the same directory (not loaded as a skill; for human reference only).

## Preconditions

- `gh` CLI is installed and authenticated (`gh auth status` succeeds).
- Current branch is not a protected branch (`production` / `develop` / `staging` / `release/*`).
- Working tree is clean. If there are uncommitted changes, the skill aborts and suggests running `/commit` first.

## Step 0. Pre-flight Checks

Run in parallel:

```sh
git rev-parse --abbrev-ref HEAD                          # current branch
git status --porcelain                                   # working-tree state
git rev-parse --verify '@{u}' 2>/dev/null                # upstream existence
git log '@{u}'..HEAD --oneline 2>/dev/null               # unpushed commits (if upstream)
gh auth status
```

Bail out if any of the following:

- Branch matches `^(production|develop|staging|release/.+|hotfix/.+)$` → tell the user to switch to a feature branch.
- `git status --porcelain` is non-empty → tell the user to run `/commit` (or stash) first.
- `gh auth status` fails → tell the user to run `gh auth login`.

These checks come first because the later steps depend on them: a merge cannot run against a dirty tree, and nothing should operate on a protected branch.

The four valid working states going into Step 1:

| Upstream | Unpushed commits | Meaning |
| --- | --- | --- |
| none | n/a | First push case |
| set | > 0 | Subsequent push case |
| set | 0 | Nothing to push; PR may still need to be created |
| set | 0 + PR open | Nothing to do (decided at the end of Step 2, because the merge can change the count) |

## Step 1. Detect Existing PR and Base Branch

```sh
gh pr view --json number,state,baseRefName,headRefName,url,title,body 2>/dev/null
make -s base-branch
```

Branch on the result:

- **PR exists and state is `OPEN`** → "update" path. Base branch is fixed (`baseRefName` from the result). The PR's own base is what the pull request is already merging into; nothing may re-resolve it.
- **PR exists but state is `MERGED` / `CLOSED`** → ask the user via `AskUserQuestion`:
  - Question: 「このブランチには `<state>` 状態の PR #N があります。新規 PR を作成しますか？」
  - Options: 「新規 PR を作成する」 / 「キャンセル」
- **No PR exists** → "create" path. The base is the branch `make base-branch` resolves: the latest release line, read from `origin`'s live state. Do not use `gh repo view --json defaultBranchRef` — the GitHub default branch can lag behind the current release line, and a PR opened against it targets a generation-old base.

If `make base-branch` fails, stop and report it rather than guessing a base; opening a pull request against the wrong branch is not something the user can undo by editing the PR.

For the "create" path, confirm the resolved base via `AskUserQuestion` — a backport or a deliberate hotfix target is the case the resolver cannot know about:

- Question: 「ベースブランチをこれで作成しますか？」
- Options: 「`<resolved-base>` を使う」 / 「別のブランチを指定する」

The base branch has to be decided here because the next step merges it.

## Step 2. Sync with the Base Branch

Bring `<base>` — the branch decided in Step 1 — into the current branch, so the review, the pre-push hook, and CI all judge the state that will actually land.

```sh
git fetch origin --prune
git merge origin/<base> --no-edit
```

**Never check out or push the base branch.** `release/**` and the other protected branches are push-forbidden by `CLAUDE.md`; merging `origin/<base>` updates the current branch only, which is all this step needs. `git fetch` is what "updating the base" means here — it refreshes the remote-tracking ref.

Handle the outcomes:

- **Already up to date** → say so and continue. Do not create an empty commit.
- **Merge succeeded** → report how many commits came in. The resulting merge commit is part of what gets pushed at Step 7, so re-read the unpushed commit count after this step rather than reusing Step 0's.
- **Conflict** → **stop here and hand it to the user.** This skill never resolves conflicts itself. Print the conflicting paths and:

  > ベースの取り込みでコンフリクトしました。`/resolve-merge` が機械的に解けるクラス（生成物・lockfile・pin・追記専用のレジストリ）を解決し、残りを返します。確定してから改めて `/submit-pr` を実行してください。

  **Leave the working tree in its merging state** and do not offer `git merge --abort` — that tree is
  `resolve-merge`'s input, and discarding it throws away the classification it is about to do.

Now apply the early exits that depend on the post-merge commit count:

- "update" path with 0 unpushed commits → tell the user there is nothing to push and stop. Print the existing PR URL.
- "create" path with 0 unpushed commits but the remote branch exists → continue (we will create a PR for whatever is already on the remote).

## Step 3. Pre-push Local Review Gate (confirm)

With the base merged in and **before composing anything or pushing**, ask whether to run a local review. Reviewing belongs before the change leaves the machine, and this is the one place all three review skills are shown together: none of them offers the others, so a step that names only one is a step through which the other two are silently forgotten. Do NOT auto-run any of them.

| Skill | Subject | Typical return |
| --- | --- | --- |
| `/impl-review` | the change itself — correctness / security / architecture / cohesion / runtime gap | High when `src/**` behavior moved, a request-time seam or a kernel boundary was touched |
| `/test-review` | the tests that pin the change down | High when tests were written or rewritten; low when the diff left them untouched |
| `/comment-sweep` | the comment stock the touched files carry | Moderate when doc comments moved or grew; low for a mechanical change |

**Price each one from the diff rather than listing all three unpriced.** 「三つとも回しますか」 hands the cost back to the user with no estimate, which is what `AGENTS.md`'s Review Phase Protocol forbids: say which pass you expect to pay off, which you expect to return nothing, and why.

Placing it after Step 2 is deliberate — reviewing the pre-merge state would judge a tree that never reaches CI.

`AskUserQuestion`:

- Question: 「push 前にローカルレビューを実行しますか？（実装者とは別モデルの独立・敵対レビュー。見込みは上表のとおり）」
- Options (multi-select; state the estimate for each on the option):
  - 「`/impl-review` を実行する（submit-pr はキャンセル）」
  - 「`/test-review` を実行する（submit-pr はキャンセル）」
  - 「`/comment-sweep` を実行する（submit-pr はキャンセル）」
  - 「実行済み / 不要（このまま進める）」 — continue to Step 4.
  - 「キャンセル」 — abort.

**On any review choice, cancel submit-pr and guide the user to review — do NOT chain a review skill inline and do NOT try to resume this run.** Print the chosen skills in the order they should run:

> submit-pr をキャンセルします。<選ばれたスキル> を実行し、指摘を修正してから `/commit` で確定し、改めて `/submit-pr` を実行してください。（clean tree でないと push できないため、レビュー修正の commit を先に済ませる必要があります。次回はこの Step 3 で「実行済み」を選べばそのまま進みます。ベースの取り込みは済んでいるので、次回の Step 2 は「Already up to date」で通ります。）

Why a clean cancel rather than a pause-and-resume: a local review commonly produces fixes, which must be committed *before* submit-pr can run at all (the clean-tree precondition in Step 0, and the push in Step 7). Since the working tree will change anyway, there is nothing to "resume" — the next `/submit-pr` is a fresh, cheap run that flows straight through once the fixes are committed.

**Depth by change type** — scale the recommendation to what the diff touches, on the scale *Depth by change type* under Step 10 defines; the same scale drives both asks.

## Step 4. Gather Context and Read Template

Collect the inputs needed to compose title and body. `<base>` is the base branch decided in Step 1.

```sh
git log <base>..HEAD --pretty=format:'%h %s'                # commit titles
git log <base>..HEAD --pretty=format:'%h%n%s%n%b%n---'      # commit titles + bodies
git diff <base>...HEAD --shortstat                          # diff summary
git diff <base>...HEAD --name-only                          # changed files
```

Read `.github/pull_request_template.md` and identify sections by `#` / `##` headers. The current template defines:

- `# 概要`
- `## 変更内容`
- `## 動作確認方法`

Strip the HTML comment placeholders. If the template is absent, fall back to the same three-section structure inline.

## Step 5. Compose Title and Body

### Title

- Derive from the most significant change. Single-commit PR → use that commit's title (strip the leading `<Prefix>:` only if redundant). Multi-commit PR → summarize the overall intent in Japanese.
- ≤ 70 characters.
- If the branch name embeds an issue number (`feature/1234-...`, `bugfix/5678-...`), include `#1234` in the title naturally.
- For the "update" path: keep the existing PR title unchanged unless the user explicitly asks to change it.

### Body

Fill each template section in Japanese:

- **概要**: 1–3 sentences summarizing the PR's intent. Use commit messages as the primary source.
- **変更内容**: Bullet list grouped by area (API / DB / 内部ロジック / テスト / ドキュメント など). Reference changed files and commit titles. Group meaningfully — do not paste a raw file list. A merge commit produced by Step 2 is not a change of this PR; do not list it.
- **動作確認方法**: Concrete verification steps. Adapt to what actually changed: `pnpm dev` plus the screens to open for UI changes, `pnpm build` when the change can break the production build, `pnpm lint:ci` / `pnpm typecheck` for the rest.

If the branch name encodes an issue number, append `closes #N` at the bottom of the body (or fold it into 概要 if natural).

## Step 6. Confirm with the User

Local review was already decided at Step 3 — do not ask again here.

Display the resolved title, base branch, push command, and full body. If Step 2 merged anything, say so, so the user knows the push includes a merge commit.

### Create path

`AskUserQuestion`:

- Question: 「以下の内容で PR を作成しますか？」
- Options:
  - 「この内容で作成する」
  - 「draft で作成する」
  - 「title / body を修正したい」
  - 「キャンセル」

If the user chooses "修正したい", collect free-text feedback, regenerate the relevant section, and re-confirm.

#### Offer the `baseline-retake` label when the diff changes rendering

Judge from the diff whether the change can alter how a story renders — a `.tsx` under `src/components/**` or a feature's `ui/`, a design token, a Tailwind class, a new or renamed story. When it can, ask in the same confirmation round:

- Question: 「見た目が変わる変更ですか？（`baseline-retake` ラベルを付けて PR を作成します）」
- Options: 「付ける」 / 「付けない」

Attach it with `gh pr create --label baseline-retake`. The label is a condition on the VRT Retake workflow, not its trigger: the workflow fires when VRT completes, so attaching the label up front means the baselines are retaken without anyone waiting for the run and labelling afterwards. It also survives a deferral — while another check is failing, the retake is skipped and the label stays on, so fixing that check resumes it on the next run.

Do NOT present this as approving the visual change. The retake only turns the diff into a reviewable image diff; the user still has to look at the store's compare view before approving the PR. Say that when reporting at Step 9.

### Update path

Display the unpushed commit list and diff summary. Then ask with the wording required by `CLAUDE.md`:

- Question: 「変更はローカルにコミット済みです。これらの変更をプルリクエストにプッシュしますか？」
- Options: 「push する」 / 「キャンセル」

## Step 7. Push

After the pull request exists, stamp the boundary this step crossed: `.agents/closed-loop/marks.sh prOpenedAt`.

```sh
# First push (no upstream)
git push -u origin <branch>

# Subsequent push
git push
```

A branch cut from `origin/release/*` (the merged-PR recovery flow in `commit`) has its upstream pointing at that **protected** base, so a bare `git push` would target the protected branch. Always do the first push with the explicit refspec `git push -u origin <branch>` to repoint the upstream at the feature branch; only after that is a bare `git push` safe.

Never use `--force` or `--force-with-lease` unless the user has explicitly requested it.

On push failure (non-fast-forward, permission denied, network error, etc.), report the error verbatim to the user and stop. Do not attempt automatic recovery.

### The pre-push hook is the verification step — do not pre-empt it

`pre-push` runs the heavy gates (`pnpm typecheck` / `make test-full` / `make secret-scan`) through lefthook. Let the hook make that call.

Do **not** run `pnpm lint:ci` / `make test-full` by hand before pushing to "make sure" — with several windows open that is minutes of saturated host to rediscover what CI runs identically, and the saturation itself makes unrelated gates fail (`repo-ops` §7). **Pushing *is* the verification step.**

**When the hook fails for a reason outside this change** — an uncommitted file another session is mid-edit on, two Vitest runs colliding over the same `coverage/` directory, a tool missing from `PATH` — the failure is not about the change being pushed. `repo-ops` §7 covers the `--no-verify` carve-out and its conditions. Report which gate failed and why it is outside the change, and let the user decide; never take the carve-out silently.

## Step 8. Create or Update the PR

### Create the PR

```sh
gh pr create \
  --base "<base-branch>" \
  --title "<title>" \
  --body "$(cat <<'EOF'
<body>
EOF
)" [--draft] [--label baseline-retake]
```

### Update the PR

Step 7's push already updated the PR's diff. Do NOT touch the PR's title or body by default.

Only if the user explicitly asked to update them, run:

```sh
gh pr edit <number> [--title "<new-title>"] [--body "$(cat <<'EOF'
<new-body>
EOF
)"]
```

## Step 9. Report

Print the PR URL and a brief summary in Japanese.

For the create path:

```text
PR を作成しました: <url>
ベース: <base-branch>
タイトル: <title>
コミット数: N
```

For the update path:

```text
PR を更新しました: <url>
追加コミット数: N
```

If Step 2 merged the base in, add one line stating how many commits were taken in.

## Step 10. Post-PR Review (confirm)

After the PR URL is reported, **always ask the user whether to run a review** — do not skip this, and do not auto-run a review. Use `AskUserQuestion`:

- Question: 「PR を作成/更新しました。コードレビューを実行しますか？」
- Options (offer the ones that apply):
  - 「`/impl-review` を実行」 — local diff, different-model adversarial review of the change itself (strong on auth / IDOR / boundary / runtime gaps that mocked tests miss); posts its surviving findings as inline PR comments by default (`--no-comment` to suppress)
  - 「`/test-review` を実行」 — the tests that pin the change down; a separate skill with its own subject
  - 「`/comment-sweep` を実行」 — the comment stock the touched files carry
  - 「`/code-review <PR#>` を実行」 — PR-based review (can post inline comments with `--comment`)
  - 「ultrareview を案内」 — cloud multi-agent review; **user-triggered and billed**, so the skill cannot launch it — only surface the command for the user to run
  - 「レビューしない」

### Depth by change type

Scale the recommended depth to what changed (if a full source review is 10):

- **Behavior-affecting code** (`src/**` の `.ts` / `.tsx`、Server Action、Route Handler、`adapters`) → full depth (10); recommend a review by default.
- **Docs / tooling-dominant changes** (`docs/**`、`*.md`、`.claude/**`、`AGENTS.md`、CI 設定 — 本番の振る舞いを変えない) → shallower is acceptable (~7–8/10). Still ask, but note the lower ROI so the user can decide quickly.

Judge the dominant nature of the diff (changed file paths / commit prefixes) to pick the default recommendation, but the user's choice always wins.

## Constraints

- ❌ Push to protected branches (`production` / `develop` / `staging` / `release/*`)
- ❌ Check out a protected branch to update it — merge `origin/<base>` into the current branch instead
- ❌ Resolve a base-merge conflict here, or discard the merging tree (hand it to the user and stop; `resolve-merge` owns the mechanical classes)
- ❌ `git push --force` / `--force-with-lease` (only with explicit user instruction)
- ❌ Auto-update an existing PR's title or body (only on explicit user request)
- ❌ Push while the working tree has uncommitted changes
- ❌ Create a PR without user confirmation
- ❌ Push to an existing PR branch without re-confirming with the exact wording required by `CLAUDE.md`
- ✅ Merge the base branch in before reviewing and pushing
- ✅ Use `.github/pull_request_template.md` as the body skeleton
- ✅ Japanese title and body
- ✅ HEREDOC for the body when calling `gh pr create` / `gh pr edit`
- ✅ Detect issue number from branch name and surface it in title / body
- ✅ Offer the `baseline-retake` label at creation when the diff can change how a story renders
- ❌ Present the `baseline-retake` label as approving the visual change (it only makes the diff reviewable)

## Checklist

Before reporting completion, confirm:

- [ ] Current branch is not a protected branch
- [ ] Working tree was clean before the push
- [ ] `gh auth status` passed
- [ ] Step 2 でベースを取り込んだ（または「Already up to date」を確認した）。保護ブランチは checkout も push もしていない
- [ ] PR template was read and reflected in the body
- [ ] Title and body are Japanese
- [ ] Title ≤ 70 characters
- [ ] Step 3 で push 前のローカルレビュー 3 本の実行可否を、見込み付きで確認した（レビューを選んだ場合は submit-pr をキャンセルして案内した）
- [ ] User confirmation was obtained before the push (mandatory for update path per `CLAUDE.md`)
- [ ] 見た目が変わりうる差分なら `baseline-retake` ラベルの要否を確認した（承認ではないことを添えて）
- [ ] PR URL was reported to the user
- [ ] (必須) PR 作成/更新後にレビュー実行可否を確認した（深さは変更種別でスケール）
- [ ] No `--force` was used
