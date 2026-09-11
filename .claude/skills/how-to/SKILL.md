---
name: how-to
usage-class: situational
description: >-
  Find the sanctioned way to carry out an operational goal in this repository and hand it back as a runnable
  procedure — prerequisites, the exact commands, how to tell it worked, how to undo it, and what is
  destructive about it. Use whenever someone wants to DO something and does not know the blessed route:
  「この検証はどのコマンド？」「リリースはどうやる」「基準画像を撮り直したい」「サンプルを消すには」「環境変数を足すには」「ベースを取り込みたい」. Goal-driven, which separates it
  from `repo-ops` (symptom-driven). It never invents a command to close a gap: an absent procedure is reported
  as UNDEFINED with the frontier searched. Read-only by default. Do NOT use it for a symptom or a failing gate
  (`repo-ops`), to explain how something works (`repo-truth`), to compare undecided options (`research`), or
  to carry out a code change.
argument-hint: '[goal] [--mode=lookup|run] [--dry-run]'
---

# How To

Answer "what is the sanctioned way to do this here" with a procedure that can actually be run.

A Japanese reference translation lives at `SKILL.ja.md` in this directory (for human reference only;
not loaded as a skill).

## When to Use

- Someone wants to perform an operation and does not know the blessed route.
- Someone has a command in mind and wants to know whether it is the sanctioned one.
- Someone needs the prerequisites, the success signal, or the rollback for a procedure they already
  know the command for.

## Contract

| | |
| --- | --- |
| **Owns** | 目標 → 正規手順（前提 / 成功判定 / 復旧 / 警告つき）、および所有スキルへの routing |
| **Never** | コマンドの発明 / 所有スキルの手順の再記述 / 破壊的操作の無断実行 / ツールの独断インストール / ゲートの実行 |
| **Starts when** | 実行したい操作があり、正規経路が不明なとき |
| **Stops when** | 索引を通読しても手順が無い（UNDEFINED）、候補が複数で決着しない（AMBIGUOUS）、権限超過（BLOCKED） |

## Do NOT use this skill for

- A symptom or a failing gate — `repo-ops`.
- Explaining how something works rather than how to do it — `repo-truth`.
- Comparing options nobody has chosen between — `research`.
- Carrying out a code change.

## Why this exists, and why it is not `repo-ops`

The two are different doors, and merging them breaks both.

`repo-ops` is **symptom-driven**: something behaved unexpectedly, you match it against a curated index
of known gotchas, and a section is the fix. Its value is that everything in it was actually hit by
someone. **It cannot conclude "no procedure exists"**, and teaching it to would make its silence
indistinguishable from an answer.

This skill is **goal-driven**: you know what you want to achieve and not how it is done here. There
are reverse indexes for parts of that question — `docs/playbook.md`, `AGENTS.md` § Recommended
Commands, `.makefiles/README.md` — but each covers its own slice, and none of them carries the
envelope a procedure needs: what must hold first, how you know it worked, what undoes it.

The failure this skill is shaped around is specific: **a plausible command is indistinguishable from
a documented one.** `make test-unit` is exactly the kind of target that ought to exist, reads as <!-- skill-lint-ignore -->
authoritative once written down, and will be run by whoever asked — and it does not exist. That the
sentence had to be marked as a deliberate non-reference for this repository's own lint to accept it
is the point. Producing the sanctioned command or producing nothing are the only acceptable outcomes.

## Arguments, and the door check

| Argument | Effect |
| --- | --- |
| `--mode=lookup` *(default)* | Produce the procedure. Run nothing |
| `--mode=run` | Carry the operation out, confirming each destructive step individually |
| `--dry-run` | Prefer the `DRY_RUN=1` form of every step that offers one |

`--mode` exists for safety, not convenience. Without it, "did they want this run or explained?" is
inferred from phrasing — and the phrasing that means *do it* and the phrasing that means *show me*
differ by a particle. That inference is acceptable for a read; for `make baseline-push` it is not.
Absent the flag, assume `lookup`: showing a command to someone who wanted it run costs one more turn,
and the reverse pushes a baseline nobody approved.

**`--mode=run` never runs a gate.** `pnpm lint` / `pnpm lint:ci` / `pnpm test` / `pnpm build` /
`pnpm typecheck` and the `make` targets that wrap them are excluded from what this skill will execute,
whatever the flag says — the hooks and CI own them and CI is the authority (`AGENTS.md`). Show the
command; do not spend the run twice.

**Then check you are the right door.** The neighbouring skills take the same nouns and differ only in
what the user is describing:

| The user is describing | Door |
| --- | --- |
| something that broke, or a gate that failed | `repo-ops` |
| how something works, what the rule is, whether it exists | `repo-truth` |
| a choice nobody has made yet | `research` |
| an operation they want to perform | here |

A symptom arriving here is the case worth catching: assembling a procedure for a system already in a
broken state produces steps whose prerequisites do not hold. Say so and point at `repo-ops` instead
of proceeding.

## Step 1 — Route to the owning skill first

Before assembling anything, check whether a skill already owns this procedure. Many do.

```bash
ls .claude/skills/                                  # what exists
grep -l "<goal keywords>" .claude/skills/*/SKILL.md # who claims it
```

**Read the inventory at runtime; do not trust a list written here.** A list in this file would be
wrong the first time a skill is added, and the whole point of this step is to find the owner rather
than to re-derive its steps.

When one owns it, **say so and stop.** A procedure that exists in two places diverges, and the copy
is the one that rots. Run `/tool-map` when the inventory itself is the question.

## Step 2 — Assemble from the registries, by concern

When no skill owns it, the procedure lives in one of these. Read the **index**, not a keyword search:
a target is named for what it does, not for how the goal was phrased.

| Registry | What it holds | Index |
| --- | --- | --- |
| make targets | tooling, security scans, release and branch operations, baselines | [`.makefiles/README.md`](../../../.makefiles/README.md), `make help` |
| `package.json` scripts | the app-side commands — dev, build, lint, typecheck, codegen | `package.json` |
| git hooks | what runs at commit / push time | `.lefthook.yaml` |
| CI | what runs on a PR, and with what env | [`.github/workflows/README.md`](../../../.github/workflows/README.md) |
| first-time setup | what a fresh clone or a fresh repository needs | [`docs/get-started/setup-repository.md`](../../../docs/get-started/setup-repository.md) |
| reverse index | 「X をやりたい」→ where it lives | [`docs/playbook.md`](../../../docs/playbook.md) |

**The app-side commands are `pnpm` scripts, not make targets** — `make help` will not list them, and
a goal phrased as "run the build" resolves in `package.json`. Checking only one of the two registries
is the most common way to reach a false UNDEFINED here.

`repo-ops`'s sections are worth scanning even for a goal question — a known gotcha attached to the
procedure belongs in 注意.

Keyword search comes last, as a net for what the indexes missed. `graphify` indexes code and docs,
not the make graph, so for this skill it supplements the registries rather than replacing them.

## Step 3 — Establish the operational envelope

A command alone is not a procedure. Each of these is a separate question, and each has a source:

- **Prerequisites.** Does the toolchain need installing (`make install-tools`)? Does it need a built
  app, a generated artifact, a specific branch, or `gh` authentication? Read the target's recipe, not
  its name.
- **Expected result.** How does the caller know it worked — exit status, a file that changes, a check
  that turns green? A procedure whose success cannot be recognized will be declared successful.
- **Recovery.** What undoes it, and is undoing it even possible? Say plainly when it is not.
- **Warnings.** Destructive, environment-dependent, slow, or touching a shared surface.

Three properties of this repository make the envelope non-obvious and are worth checking every time:

- **Shared surfaces reach past this checkout.** The baseline store is a submodule with a remote, so
  `make baseline-push` and the `*-retake` targets advance state other branches read. `make setup-repo`
  writes GitHub settings for the whole repository. Neither is local, and the person who asked was
  usually thinking only about their own tree.
- **Other worktrees share the host.** Ports and heavy runs collide across checkouts; a server started
  here answers on a port another window may already hold.
- **A dry-run convention exists.** Several targets honour `DRY_RUN=1` ([`.makefiles/README.md`](../../../.makefiles/README.md)).
  Its only truthy value is `1`. When a target offers it, put it in the procedure — it converts an
  irreversible step into an inspectable one.

## Step 4 — Answer in this contract

Always this shape, in Japanese. Omit a field only when it genuinely does not apply, and say so rather
than dropping it silently.

````markdown
## 状態
FOUND | AMBIGUOUS | UNDEFINED | BLOCKED

## 手順
<何をする手順か、1 行>

## 出典
- `<path>` の `<target / script / 節 / job 名>`

## 前提条件
- <満たしていなければならないこと、必要な権限>

## コマンド
```bash
<正規に定義されたコマンド。存在するものだけ>
```
<UNDEFINED のときは「なし」と書き、なぜ近そうなコマンドを出さないのかを 1 行添える>

## 近いもの
- `<target / 手順>` — <ただし〜の点で目的が異なる>   ← FOUND 以外のときに書く

## 成功の判定
<どうなれば成功か>

## 復旧 / 切り戻し
<既存資料に定義されたもの。無いなら「定義なし」と書く>

## 注意
- <破壊性 / 環境差 / 共有面への影響 / 未検証の点>

## 探索範囲
<通読したレジストリ / 確認した所有スキル / 検索した glob / 回さなかった掃引とその理由>
← UNDEFINED / AMBIGUOUS のときは必須

## エスカレーション
<未定義・矛盾・権限超過のとき、誰が何を決めれば進むか>
````

The four states are not interchangeable:

| State | Meaning |
| --- | --- |
| `FOUND` | A sanctioned procedure exists and is reproduced above |
| `AMBIGUOUS` | Several candidates exist and the sources do not settle which governs — present all, pick none |
| `UNDEFINED` | The owning registries were read in full and no sanctioned procedure exists |
| `BLOCKED` | A procedure exists but the requested operation exceeds what was authorized here |

`UNDEFINED` carries the same bar as `repo-truth`'s: it requires the owning registries read **in
full** — both the make targets and the `pnpm` scripts — and the frontier published with it. Short of
that the state is `AMBIGUOUS`, or the answer is 確認できず naming which index was left unread.
Downgrading costs nothing; a wrong `UNDEFINED` reads as a fact about the repository.

Under `UNDEFINED` the `コマンド` field says **なし**, and says in one line why the obvious-looking
command is not being offered. Leaving the field empty invites the next reader to supply the command
themselves, which is the failure this skill exists to prevent, one step removed. What *does* belong is
the near miss — under `近いもの`, named together with the respect in which its purpose differs. A
reader told only "there is no procedure" will go looking, and the nearest thing they find is the one
this skill already examined and rejected.

## Step 5 — Running it

Under `--mode=lookup` this step does not happen: the procedure is the deliverable. Under
`--mode=run`, carry it out — and note that the flag authorizes the *procedure*, not each destructive
step inside it. Those are still confirmed one at a time. **Gates are never run here**, whatever the
flag says.

Before anything destructive, say what it will destroy and wait. Advancing the baseline store,
rewriting GitHub settings, or removing the sample surface reaches past this checkout, and the person
who asked was usually thinking only about their own tree.

Never install anything on your own initiative. A missing tool is a finding to report; this repository
usually already ships the capability behind a `make` target, and the toolchain itself is `mise`'s
(`make install-tools`).

## Standalone by design

This skill hands over a procedure and stops. It names what to run next — `repo-ops` when the
procedure fails on a known gotcha, `repo-truth` when the goal turned out to be a knowledge question,
`new-issue` when the gap is worth tracking — and the user decides.

It also does not absorb the skills it routes to. Routing to the owner is the whole answer; restating
that owner's steps here would create the second copy this skill exists to prevent.

## Do / Do NOT

- ✅ Treat a missing `--mode` as `lookup`; never infer authorization to run from phrasing.
- ✅ Check for an owning skill first, reading the inventory at runtime, and stop there when one exists.
- ✅ Read **both** registries — make targets and `pnpm` scripts — before concluding anything is absent.
- ✅ Establish prerequisites, success signal, recovery, and warnings as separate questions.
- ✅ Cite the file and the target / script / section each step came from.
- ✅ Check shared-surface impact and `DRY_RUN=1` availability every time.
- ✅ Report `UNDEFINED` with the frontier, or downgrade to `AMBIGUOUS` / 確認できず.
- ✅ Under `UNDEFINED`, write `なし` in `コマンド` with the reason, and name the near miss under
  `近いもの` — including the respect in which its purpose differs.
- ✅ Record a sweep you deliberately did **not** run, with its reason.
- ✅ Warn before anything destructive and wait.
- ✅ Answer in Japanese.
- ❌ Invent a command, a flag, or a target that you did not read in a registry.
- ❌ Restate the steps of a skill that owns the procedure.
- ❌ Enumerate the skill inventory in this file instead of reading it at runtime.
- ❌ Report `UNDEFINED` from a keyword search, or from one registry when there are two.
- ❌ Pick between conflicting sources — present both and escalate.
- ❌ Run a gate, whatever `--mode` says.
- ❌ Run a destructive command without saying what it destroys, or any command the user asked only to
  be shown.
- ❌ Install a tool because one is missing.

## Checklist

- [ ] Door check done — a symptom goes to `repo-ops`, a knowledge question to `repo-truth`.
- [ ] `--mode` resolved; absent the flag, treated as `lookup` and nothing was run.
- [ ] Owning skill checked from the live inventory; routed and stopped if one exists.
- [ ] Both registries read by index — make targets and `pnpm` scripts; keyword search used last.
- [ ] Prerequisites, expected result, recovery, and warnings each established from a source.
- [ ] Shared-surface impact and `DRY_RUN=1` availability checked.
- [ ] Contract emitted in full, in Japanese, with an explicit state.
- [ ] `UNDEFINED` only on exhausted registries, with the frontier published in `探索範囲`.
- [ ] Under `UNDEFINED`: `コマンド` says なし with a reason, and `近いもの` names the near miss.
- [ ] Nothing invented; every command traced to the file that defines it.
- [ ] No gate run. Destructive steps flagged and confirmed before running; nothing run that was only
      to be shown.
