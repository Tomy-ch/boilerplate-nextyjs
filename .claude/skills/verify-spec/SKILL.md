---
name: verify-spec
usage-class: lifecycle
description: >-
  Reconcile the screen specifications under `docs/spec/route/**` with the implementation they describe, by
  reading them. Four findings: a promise the implementation does not keep, a statement filed in the wrong one
  of the two documents, a screen restating what a layout above it already promises, and content the spec
  deliberately does not carry. It never decides which side moves — whether the promise changed or the
  implementation drifted is not visible from the diff, so both readings are reported and the human chooses.
  Use it before a release, after a screen's behaviour changed, or on 「仕様書と実装が合ってる？」「この約束まだ守られてる？」. Read-only;
  it writes nothing. Do NOT use it to check that specs exist (a gate does), to judge implementation quality
  (`impl-review`), or to write a specification (`new-feature`).
argument-hint: '[--scope=changed|full] [route]'
---

# Verify Spec

Read the promises against the implementation, and report where they no longer agree.

A Japanese reference translation lives at `SKILL.ja.md` in this directory (for human reference only;
not loaded as a skill).

## When to Use

- Before a release — the one point at which every screen is read against its promises.
- After a screen's observable behaviour changed.
- When a specification and the screen seem to disagree.

## Contract

| | |
| --- | --- |
| **Owns** | 仕様書の約束と実装の**読み合わせ**、4 種の所見の提示、確かめられなかった約束の申告 |
| **Never** | 存在の突合のやり直し / どちらが動くべきかの決定 / 仕様書と実装のどちらかへの書き込み |
| **Starts when** | リリース前、画面の観測可能な振る舞いが変わった後、あるいは食い違いが疑われたとき |
| **Stops when** | 所見を提示したとき。直すのは user、あるいは `new-feature` |

## Do NOT use this skill for

- **Checking that specs exist.** A gate settles that — see below.
- **Reviewing a diff's implementation quality** — `impl-review`.
- **Writing a specification** — `new-feature`.

## The two reconciliations, and which one this is

[0143](../../../docs/adr/0143-spec-driven-development.md) splits the reconciliation in two, and the
split is by **what a machine can reach**:

| | Who owns it |
| --- | --- |
| **存在の突合** — every route has a screen spec; no spec outlived its route | [`scripts/spec-routes.gate.test.ts`](../../../scripts/spec-routes.gate.test.ts), with the mapping in [`scripts/lib/spec-routes.ts`](../../../scripts/lib/spec-routes.ts) |
| **内容の突合** — the promises still hold | **This skill** |

**This skill does not re-derive the existence check.** It is settled deterministically, and redoing it
in prose would be the same check with worse tools — and a second implementation of the mapping, which
would follow the convention only until the day it did not.

**It uses that mapping rather than reimplementing it.** When a route's spec directory has to be
resolved, `toSpecDir` is the answer.

## Step 0 — Confirm the scope

One `AskUserQuestion`, skipped when the argument already answers it.

- 「読み合わせのスコープを選んでください」
  - 「変更で触れた画面のみ」 — the routes whose spec or implementation is in the diff
  - 「全画面」 — every route. **This is the release-time pass**
  - 「1 つのルート」 — one route, named

## Step 1 — Resolve the routes and their inputs

Resolve the base the way `commit` and `submit-pr` do — `gh pr view --json baseRefName -q .baseRefName`,
else `make -s base-branch`. **Stop when it cannot be resolved**: an empty route list fans out nothing
and reports nothing, which reads exactly like a clean pass.

For each route in scope, assemble:

- the spec files in its directory — the screen requirement, and the functional requirement when one
  exists
- the `src/app` entry it maps to, and the files that entry reaches
- **the `layout.*.md` specs above it.** A layout's promise applies to everything beneath, and each
  screen writes only its difference — so a validator that cannot see the layout cannot tell a
  restatement from an original

## Step 2 — Fan out the validators in parallel

Spawn [`spec-validator`](../../agents/spec-validator.md) with the **Agent tool**, **one invocation per
route**, all in a single message so they run concurrently. Pass `route`, `specs`, and
`implementation`.

**One route per invocation, and both of its files together.** A statement filed in the wrong document
is invisible from either file alone, which is the whole reason the unit is the route rather than the
file.

> If the agent cannot be spawned here, follow `prompts/validate-spec.md` inline instead.

## Step 3 — Aggregate and report

```text
仕様書と実装の読み合わせ（scope: <X>）

読んだルート: <N> / 対象: <M>
確かめられなかった約束: <K> — <理由。1 行ずつ>

[約束と実装の食い違い] <n>
  - <route> — 仕様書: `<path>` の <節> / 実装: `<path>` の <symbol>
    どちらが動くべきか: <仕様書 | 実装 | 判断が要る> —— <根拠>
[振り分けの誤り] <n>
[上位 layout の書き直し] <n>
[書かないものが書かれている] <n>

本スキルは何も変更していません。直すのは user、あるいは new-feature です。
```

**Report the unchecked promises as unchecked.** A review that lists only what it verified is
indistinguishable from one that verified everything — and at release time that difference is the
whole value of the pass.

**Never decide which side moves.** 0143 settles the *direction* — if the promise changed, the spec
moves; if it did not, the implementation does — but **which of those happened is not visible from
here.** Report both readings with the evidence and let the user choose.

## Step 4 — Hand off

This skill writes nothing, on either side. Name what comes next per finding:

| Finding | Next |
| --- | --- |
| The promise changed | The spec moves — `new-feature`'s spec step, or the user |
| The implementation drifted | The user fixes the screen |
| Filed in the wrong document | The user moves the sentence; both files are theirs |
| Content that does not belong in a spec | It has a home — `docs/spec/README.md` names it |

## Do / Do NOT

- ✅ Resolve the base the way `commit` and `submit-pr` do; stop when it cannot be resolved.
- ✅ Resolve each route's spec directory through the shared mapping, never a second implementation.
- ✅ Pass both of a route's spec files to one validator, together with the layouts above it.
- ✅ Fan the validators out in a single message.
- ✅ Report unchecked promises as unchecked, with the reason.
- ✅ Report both readings of a divergence and let the user choose.
- ✅ Report in Japanese.
- ❌ Re-derive the existence check, or reimplement the route → spec mapping.
- ❌ Decide which side moves.
- ❌ Write to a spec or to the implementation.
- ❌ Report a promise you could not check as kept.
- ❌ Run a gate.

## Checklist

- [ ] Scope confirmed; base resolved, or the run stopped.
- [ ] Route → spec directory resolved through the shared mapping.
- [ ] Both spec files and the layouts above passed to each validator.
- [ ] Validators fanned out in a single message, one per route.
- [ ] Four findings reported separately; empty kinds stated as empty.
- [ ] Unchecked promises listed with reasons; none reported as kept.
- [ ] Both readings given per divergence; no side chosen.
- [ ] Nothing written; the next step named per finding.
