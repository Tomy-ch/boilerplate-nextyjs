---
name: resolve-merge
usage-class: situational
description: >-
  Land a merge correctly by classifying every conflicted path into a resolution class and applying the mechanical resolution each class already has — regenerate generated artifacts from their source of truth rather than picking a side, re-resolve pin lockfiles through their resolvers, union append-only registries, retake baseline images rather than choosing one — then hand back only what genuinely needs a human. Use it whenever a merge reports conflicts, and equally whenever one reports none: several committed artifacts here are derived rather than authored and go stale from the other side's changes without ever conflicting textually, which is why this skill is named for the merge and not for the conflicts. Most conflict markers in this repository land in files nobody should be hand-editing at all — the generated API types and mock handlers, the bundled contract, `pnpm-lock.yaml`, the pin lockfiles, the marker baseline, the baseline-image gitlink — and choosing a side in one of those produces a file that looks resolved, passes review, and no longer reproduces from its generator. Takes the base from the pull request's own `baseRefName` and merges rather than rebases, via `make base-merge`. It ends in exactly one of two states: anything non-mechanical left means it stops there with the markers intact, commits nothing and offers nothing, because a merge commit carrying conflict markers is a broken tree that reads as resolved; a fully clean integration means it asks whether to commit and push rather than assuming, since a branch can take a release line in without that merge being ready to leave the machine. Do NOT use it to resolve a semantic conflict in implementation code — that is a human's judgment and it hands those back untouched — to rebase or squash anything, to decide which of two colliding registry keys wins, or to sync a branch nobody asked to sync.
argument-hint: '[--base=<ref>] [--class=<csv>] [--dry-run]'
---

# Resolve Merge

Land a merge by routing each conflicted path to the resolution its class already has, and handing
back the rest.

A Japanese reference translation lives at `SKILL.ja.md` in this directory (for human reference only;
not loaded as a skill).

## When to Use

- A merge reported conflicts.
- A merge reported **no** conflicts — the derived artifacts still need regenerating.
- A merge was resolved by hand and a check is now failing in files nobody edited.

## Contract

| | |
| --- | --- |
| **Owns** | 衝突パスのクラス分けと、クラスごとの機械的解決（再生成 / resolver 再実行 / 和集合 / 撮り直し） |
| **Never** | 実装の意味的衝突を解く / 生成物の片側を選ぶ / rebase・squash・force-push / レジストリの鍵衝突をどちらか採用する |
| **Starts when** | ベースを取り込んだ直後（衝突の有無を問わず） |
| **Stops when** | 機械的に解けないものが 1 つでも残ったとき —— その場でマーカーを残して打ち切り、コミットしない |

## Do NOT use this skill for

- A semantic conflict in implementation code — that is a human's reading.
- Rebasing, squashing, or force-pushing anything.
- Deciding which of two colliding registry keys wins.
- Syncing a branch nobody asked to sync.

## Why this exists

**Most conflict markers in this repository land in files nobody should be editing.** The generated
API types and the mock handlers built from the same contract, the bundled contract itself,
`pnpm-lock.yaml`, the pin lockfiles, the marker baseline, the design-token output — every one of them
has a generator or a resolver, and **none of them has a correct "side"**.

Picking a side there produces the worst available outcome: a file with no markers, that reviews
clean, and that no longer reproduces from its source. The check that catches it runs later, on
someone else's pull request, as a failure in code they never touched.

The second reason is quieter. **A clean merge is not a finished merge.** A derived artifact goes
stale from the *other* side's changes, not from a textual conflict with them: two branches can each
add an endpoint, conflict on nothing, and leave the mock handlers regenerable but not regenerated. A
skill named for conflicts would be skipped in exactly that case, which is why this one is named for
the merge.

## Arguments

| Argument | Effect |
| --- | --- |
| `--base=<ref>` | Use this base instead of resolving one. Required when a hotfix line is in play |
| `--class=<csv>` | Restrict to the named classes; the rest are reported and left untouched |
| `--dry-run` | Classify and report the plan; change nothing |

## Step 1 — Take the base in

`make base-merge` owns this. It resolves the base — `--base` first, then the pull request's own
`baseRefName`, then the latest release line from `origin` — refuses to run on a protected branch or a
dirty tree, merges without rebasing, and prints the unresolved paths on stdout while leaving the tree
in its merging state.

```bash
make base-merge            # 衝突が残れば exit 1 で未解決のパスを 1 行 1 件
```

Two rules decide correctness here, and both live outside this skill:

- **A pull request's `baseRefName` wins.** It is what the branch is already merging into. Merging
  whatever resolves as newest today **retargets** the branch instead of catching it up.
- **Merge, never rebase.** Beyond the Git Rules in `AGENTS.md`, a rebase actively breaks append-only
  files: the same content re-lands under a different hash on both sides and reads as two independent
  additions.

**When a hotfix line is in play, resolve nothing — ask.** The release-line resolver considers
`release/*` only and will not name a hotfix, and inferring a base from branch names is guessing at
the moment guessing is most expensive. Require `--base=<ref>` from the human.

## Step 2 — Classify every conflicted path

```bash
git diff --name-only --diff-filter=U
```

| Class | Paths | Resolution |
| --- | --- | --- |
| Generated — contract | `openapi/api.gen.yaml`, `src/adapters/gen/**`, `mocks/api/**` | Discard both sides. Settle `openapi/sources.yaml` first if it conflicted, then `make gen-api` <!-- skill-lint-ignore --> |
| Generated — design tokens | the build output under `tokens/` | Settle `tokens/primitives.json` and the theme inputs, then `pnpm gen:tokens` |
| Dependency lockfile | `pnpm-lock.yaml` | Never pick lines. Settle `package.json` first, then `pnpm install` |
| Pin lockfile | `.github/actions-pin.toml`, `docker/images-pin.toml` | Never pick lines. `make actions-pin-resolve` + `make actions-pin-apply`; `make images-pin-resolve` + `make images-pin-apply` |
| Version stamp | the `version` field in `package.json` | The branch name is the source. Settle it there, then `make version-stamp-check` |
| Baseline images | the `baseline/images` gitlink | Never pick a side of a submodule pointer. Retake and push through the baseline targets |
| Marker baseline | `scripts/marker-baseline/baseline.json` | Never merge counts. Settle the marked files first, then `pnpm exec tsx scripts/marker-baseline --write` <!-- boilerplate-only:line --> |
| Append-only registry | the tables in `docs/adr/README.md`, `docs/spec/glossary.md`, `.github/settings/labels.json` | Union both sides' entries — unless a key appears on both, which Step 5 hands back |
| Translation pair | `**/SKILL.ja.md` | Resolve the canonical `SKILL.md` first, then bring the translation back to a 1:1 heading structure. **Never resolve the translation directly** |
| Implementation | everything else | **Not mechanical.** Leave the markers in place and hand it back |

Classify before resolving anything. **A path that matches no row is implementation by default** — the
safe direction, since the cost of handing back a mechanical case is one message and the cost of
mechanically "resolving" a semantic one is a silent wrong merge.

## Step 3 — Apply, class by class

Resolve in dependency order, because several classes feed each other: the contract source before
`gen-api`, `package.json` before `pnpm install`, the marked files before the marker baseline, the
token inputs before the token build.

For every generated class the move is the same and it is worth stating plainly: **do not merge the
file, delete the conflict and rebuild it.** Take the source of truth from both sides — the contract
source, `package.json`, the token inputs — resolve *that* if it conflicted, then run the generator
and let it produce the artifact.

For a pin lockfile, run the resolver rather than reconciling entries. The lockfile is a cache of
tag → SHA; hand-merging it can leave an entry whose SHA never corresponded to its tag, which every
check downstream then treats as authoritative.

**Stage by explicit path.** `git add -A` is forbidden here for the reason it is forbidden everywhere,
and doubly so mid-merge: it stages a submodule pointer you did not decide.

## Step 4 — Regenerate what did not conflict

Run this whether or not Step 2 found anything, and **say that you did**:

```bash
make gen-api                                       # 契約から生成したもの
pnpm gen:tokens                                    # デザイントークンの生成物
pnpm exec tsx scripts/marker-baseline              # 差分が出たら --write で数え直す
```

A derived artifact goes stale from the *other* side's changes, not from a textual conflict with them.
**This is the step whose absence produces a green local merge and a red CI on the next unrelated PR.**

## Step 5 — Verify what the resolvers themselves check

```bash
make actions-pin-check
make images-pin-check
make version-stamp-check
```

**Do not run the gates here.** `pnpm lint:ci` / `pnpm lint:md` / the test suites belong to the hooks
and CI, and CI is the authority (`AGENTS.md`). What runs above is narrower and different in kind:
each one is the resolver's own consistency check, and it is the only thing that can tell you whether
*this skill's* mechanical resolution actually reproduced. Say which of them you ran.

## Step 6 — Two ways this ends

The run ends in one of exactly two states. Which one is decided by whether anything non-mechanical is
left, **never by how much was resolved**.

### Anything left → stop there

Report what remains, with the conflict markers **still in place**, and end the run:

| Left to a human | Why |
| --- | --- |
| Implementation conflicts | Which behavior is correct is a reading, not a merge |
| The same key added on both sides — an ADR number, a glossary term, a label | Union is mechanical; deciding which definition survives is not |
| ADR renumbering | The numbering convention is `docs/adr/README.md`'s. Read it at runtime, and surface a disagreement rather than choosing |
| A base that could not be resolved to one ref | Guessing a base is how a branch silently merges the wrong line |

> 機械的に解けるところまで統合しました。残りはここからお願いします: `<path>`（実装の意味的衝突）…

**Do not commit in this state, and do not offer to.** A merge commit carrying conflict markers is a
broken tree in the history, and it is broken in a way that reads as resolved — the same failure this
skill exists to prevent, one level up. Leave the working tree as it stands so the human continues
from where you stopped, and do not re-run to "finish" it after they resolve the rest; that is their
commit.

`git merge --abort` is denied here for the same reason: the tree you are leaving behind **is** the
human's input.

### Nothing left → ask, then commit and push

Only when every conflict is resolved and Step 5's resolver checks are green:

```text
質問: ベースとの統合が完了しました。コミットしてプッシュしますか？
選択肢:
  - コミットしてプッシュ
  - コミットのみ（プッシュしない）
  - 何もしない（作業ツリーのまま）
```

**Ask every time; never push on the strength of the merge succeeding.** A branch can take a release
line in without that merge being ready to leave the machine, and this skill cannot tell those
apart — whether the result should reach the remote is about the branch's state, which is the author's
knowledge, not the merge's.

For the push half specifically, `AGENTS.md` requires this confirmation and its wording when the
branch already has a pull request:

> 変更はローカルにコミット済みです。これらの変更をプルリクエストにプッシュしますか？

Push goes `--no-verify`. Delegate the commit itself to `commit`, which splits and words it by this
repository's convention.

## Do / Do NOT

- ✅ Take the base in through `make base-merge`; require `--base` when a hotfix line is in play.
- ✅ Classify every conflicted path before resolving any of it.
- ✅ Rebuild generated artifacts from their source instead of choosing a side.
- ✅ Run resolvers for the pin lockfiles; settle `package.json` before the dependency lockfile.
- ✅ Regenerate the derived artifacts even when nothing conflicted, and say you did.
- ✅ Treat an unmatched path as implementation.
- ✅ Stage by explicit path.
- ✅ Run the resolvers' own checks, and say which ones ran.
- ✅ End in exactly one of the two states, and ask before committing when it is the clean one.
- ✅ Report in Japanese.
- ❌ Hand-edit or side-pick any generated artifact, lockfile, submodule pointer, or `SKILL.ja.md`.
- ❌ Rebase, squash, force-push, or take in a line other than the branch's own base.
- ❌ Run the gates — they belong to the hooks and CI.
- ❌ Use `git add -A`, or `git merge --abort`.
- ❌ Decide which of two colliding registry keys wins.
- ❌ Resolve a semantic conflict in implementation code.
- ❌ Commit while any conflict marker remains, or offer to.
- ❌ Push because the merge succeeded — the branch's readiness is the author's knowledge.

## Checklist

- [ ] Base taken in through `make base-merge`, or supplied via `--base`; merge used, never rebase.
- [ ] Every conflicted path classified; unmatched paths treated as implementation.
- [ ] Generated artifacts rebuilt from source, not side-picked.
- [ ] Pin lockfiles re-resolved through their resolvers; `package.json` settled before `pnpm install`.
- [ ] Registries unioned; colliding keys handed back rather than decided.
- [ ] Canonical resolved before any `SKILL.ja.md`, then the pair brought back to 1:1.
- [ ] Step 4 regeneration run regardless of conflict count, and stated.
- [ ] Resolver checks run and named; no gate run.
- [ ] Everything staged by explicit path.
- [ ] Ended in exactly one of the two states.
- [ ] Anything left → markers intact, nothing committed, nothing offered, run stopped.
- [ ] Nothing left → commit / push asked, never assumed; `commit` used for the commit itself.
