---
name: interpretation-audit
description: Re-check this repository's decisions against the external sources they were derived from, and refresh the ledger at docs/reference/upstream-interpretations.md. Fire when an upstream moves (a major dependency bump, a spec revision, a framework release), when an ADR that cites an external source is revised, or when the user asks 「原典と食い違っていないか」「standards conformance を確かめて」「upstream に追随できているか」. Produces a three-valued verdict per pairing — 差異なし / 差異あり / 逸脱宣言あり — and records the premise the verdict rested on so a human can refute it. Do NOT fire for reviewing a change (/impl-review), for README-vs-code drift (/back-prop), for dependency version policy (/tools-upgrade), or to decide which side should move — this skill never adjudicates.
usage-class: lifecycle
---

# Interpretation Audit

Check whether the decisions this repository derived from **external sources** still match what those
sources say, and refresh [the ledger](../../../docs/reference/upstream-interpretations.md).

A Japanese reference translation of this skill lives at `SKILL.ja.md` in this directory (for human
reference only; not loaded as a skill).

## When to Use

- An upstream moved: a major dependency bump, a framework release, a spec revision.
- An ADR that cites an external source was revised — the pairing changed on our side.
- A new decision was derived from an external source and has no row yet.
- A periodic pass, when nobody can say when the ledger was last true.

## Do NOT use this skill for

- **Reviewing a change** — `/impl-review`.
- **README ↔ code drift** — `/back-prop`. That asks whether our declarations match our tree; this
  asks whether our declarations match somebody else's.
- **Dependency version policy** — `/tools-upgrade` decides whether to take an upgrade. This skill
  reads what the upgrade *says*, after the fact.
- **Deciding which side should move.** See below — that is the one thing this skill must not do.

## Contract

| | |
| --- | --- |
| **Owns** | The pairing of an external source with the decision derived from it, and the three-valued verdict over that pairing |
| **Never** | Adjudicates. Never edits an ADR, never proposes conforming to the source, never proposes declaring a deviation |
| **Starts when** | An upstream or one of our decisions moved, or a pairing has no verdict |
| **Stops when** | Every audited pairing has a verdict and a premise, and the unaudited ones are named as unaudited |

## Step 0. Resolve the scope

`AskUserQuestion`, one question:

```text
質問: どの対を確かめますか？
選択肢:
  - 目録に在る対をすべて  ← 既定
  - 特定の原典（依存の major 更新で動いたものなど）
  - 特定の決定（改訂した ADR から辿る）
  - 新しい対を足す（原典を読んで決めたが、まだ載っていないもの）
```

## Step 1. Read both sides, this run

Never judge from memory. **The premise you write down is the thing a human will use to refute you**,
so it has to come from something you actually opened.

1. **The source.** Prefer a copy that ships with the repository — `node_modules/<pkg>/dist/docs/`,
   a bundled schema, a vendored spec — because it is pinned to the version this repository actually
   runs. When the source is only online, `WebFetch` it and record the URL and the date.
2. **Our side.** The ADR / design document / configuration file the ledger row names, in full.
3. **The ledger row**, including its existing premise. A premise that no longer holds is itself the
   finding — the verdict may not have changed while the reason for it evaporated.

**When you cannot reach the source, the verdict is not 差異なし.** Report the row as unread, say what
you tried, and leave the previous verdict with its date. An unread source is not an agreeing one
([0157](../../../docs/adr/0157-inspection-declaration-discipline.md)).

## Step 2. Give each pairing one of three verdicts

| Verdict | When |
| --- | --- |
| **差異なし** | The source, as it reads now, says what our decision assumed |
| **差異あり** | They disagree, **and nothing of ours says so** |
| **逸脱宣言あり** | They disagree, **and either a decision or the enforcement point states why we depart** |

**The split between the last two is the whole point of the ledger.** Departing from a standard is
not a defect — ADR [0010](../../../docs/adr/0010-standards-and-non-lockin.md) exists precisely
because conformance is a judgment, not an obligation. The defect is departing without anyone knowing.

So when you land on 差異あり, check once more whether the declaration exists somewhere you did not
look — the configuration file's comment, a neighbouring ADR, `docs/rules.md`.

**The declaration belongs where a reader meets the constraint, and that is often not an ADR.** When
the thing that rejects the non-conforming form is a lint, its configuration is where the person who
got rejected will look; a sentence there reaches them, and a paragraph in an ADR does not. Say where
the declaration is. A decision is required only when the *manner* of departing had alternatives worth
recording — `docs/README.md`'s first routing question.

**A comment that states only the mechanism is not a declaration.** "We do not enforce type-case
because our prefixes mix cases" says what the tool does; it does not say that the scheme departs from
a standard. The repair is usually one clause in that same comment, not a new section elsewhere.

## Step 3. Write the premise before the verdict

For each row, write the premise **first**, then read your own verdict against it. The order matters:
a verdict written first recruits a premise to support it.

A premise must let a reader disagree without repeating your work:

- **Quote or locate.** The sentence the source actually contains, or the exact file and heading.
- **Name the version.** Which release of the source you read — the pinned copy's version, or the
  fetch date for an online one.
- **Say which part of our side you matched it against.** A decision usually says several things;
  the verdict is about one of them.

A pairing whose premise you cannot write **does not get a row**. It goes into the report as a
pairing that could not be audited, with what was missing.

## Step 4. Update the ledger

Edit [`docs/reference/upstream-interpretations.md`](../../../docs/reference/upstream-interpretations.md)
and nothing else. Specifically:

- **Do not edit the ADR, the design document, or the configuration** the row points at. Those are the
  subject of the audit. Changing them here would mean the audit and the fix arrive in the same
  breath, with nobody having chosen the fix.
- Update the verdict, the premise, and the date **together**. A refreshed date beside a stale premise
  claims a check that did not happen.
- Rows whose source you could not reach keep their previous verdict **and their previous date**.

Then run the gate over the shape:

```bash
pnpm exec vitest run --config vitest.scripts.config.ts scripts/interpretations.gate.test.ts
```

## Step 5. Report

```text
## 原典との突合（<N> 対）

差異なし: <n> / 逸脱宣言あり: <n> / 差異あり: <n>
確かめられなかった対: <n>（<原典> —— <何が届かなかったか>）

### 差異あり（宣言の無い食い違い）
- <原典> ↔ <こちらの決定>
  - 原典: <前提。逐語または位置>
  - こちら: <該当する記述>
  - **どちらを動かすかは決めない。** 選べるのは 3 つ —— 原典へ合わせる / 逸脱を宣言する / 対そのものを外す

### 逸脱宣言あり（宣言が在る食い違い）
- <原典> ↔ <こちらの決定> —— 宣言の場所: <path>

### 未判定として残るもの
- <原典を読んで導いた決定のうち、まだ対になっていないもの>
```

**The 差異あり block never carries a recommendation.** Naming the three moves is not choosing among
them; if you find yourself explaining why one of them is better, you have left this skill's scope.

## Constraints

- ✅ Read both sides this run, from something you opened
- ✅ Premise before verdict, every row
- ✅ Three values only — never invent a fourth to soften a finding
- ✅ Write only the ledger
- ❌ Never edit an ADR, a design document, or a configuration file
- ❌ Never recommend which side moves
- ❌ Never let an unreachable source become 差異なし
