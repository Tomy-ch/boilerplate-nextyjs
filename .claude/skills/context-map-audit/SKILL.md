---
name: context-map-audit
usage-class: lifecycle
description: >-
  Read-only audit of `docs/design/context-map.md` against the code, reporting three kinds of divergence and editing nothing — a contact point that exists in the tree with no edge on the map, an edge whose counterpart no longer exists in the tree, and an edge whose recorded translation no longer matches what the dependency matrix enforces. Use it before a release, after work that added or removed an outward-facing entry point, or as a periodic sweep — 「地図と実物が合ってる？」「この口は載ってる？」. It does not edit, because a divergence reads two ways and the audit cannot tell them apart: the map may be stale, or the code may have drifted from a decision, and choosing between those is the reader's. It also never writes an ownership label, since ownership is an organisational fact the code does not carry; when an edge is new, the audit reports it and hands the ownership question to `context-map`. Every run states how many edges it checked and how many it could not, because an audit that reports "no divergence" without saying what it swept is indistinguishable from one that swept nothing. Do NOT use it to update the map (`context-map`), to review a diff (`impl-review`), or to judge whether an edge should exist at all.
argument-hint: '[--scope=changed|full]'
---

# Context Map Audit

Compare the recorded map against the tree, report what diverged, **and change nothing.**

A Japanese reference translation lives at `SKILL.ja.md` in this directory (for human reference only;
not loaded as a skill).

## When to Use

- Before a release, or after work that added or removed an outward-facing entry point.
- A periodic sweep.
- Someone doubts that the map still describes reality.

## Contract

| | |
| --- | --- |
| **Owns** | 地図と実物の突合、3 種の乖離の報告、検査できた辺と**できなかった辺**の申告 |
| **Never** | 地図の編集 / コードの編集 / 所有ラベルの決定 / 乖離のどちらが正しいかの決定 |
| **Starts when** | 外向きの口が増減した後、リリース前、あるいは定期の掃き取り |
| **Stops when** | 3 種の乖離を報告したとき。修正は `context-map` か実装側の仕事 |

## Do NOT use this skill for

- **Updating the map** — `context-map`. This one is read-only, by design.
- **Reviewing a diff** — `impl-review`.
- **Judging whether an edge should exist at all.** That is a design question, not an audit finding.

## Why it does not edit

**A divergence reads two ways, and the audit cannot tell them apart.** An edge in the code with no
row on the map might mean the map is stale — or it might mean something was added that a decision
said would not be. **Both look identical from here**, and only one of them is fixed by writing a row.

So the audit reports and stops. `context-map` writes, after asking. That split is not ceremony: an
auditor that silently records the code's current state converts every drift into a fait accompli, and
**the map stops being able to say the code is wrong.**

## Step 0 — Confirm the scope

One `AskUserQuestion`:

- 「監査のスコープを選んでください」
  - 「変更で触れた口のみ」 — the entry points and outbound calls in the diff
  - 「全体」 — every edge on the map, and every contact point in the tree

## Step 1 — Enumerate both sides

**Enumerate the tree the same way `context-map` does**, so the two cannot disagree about what counts
as an edge — `src/config/`, `src/adapters/`, `src/app/api/**`, the metadata surface, `src/proxy.ts`.
Count by counterpart, not by resource. Separate the sample-only edges.

Then read [`docs/design/context-map.md`](../../../docs/design/context-map.md) and take its rows as the
recorded side.

**Neither side is authority over the other.** That is the whole reason this run produces findings
rather than fixes.

## Step 2 — Three divergences

- **接触点はあるが辺が無い** — the tree touches a counterpart the map does not record. Report the
  code site, and **do not propose the ownership** — that question belongs to `context-map`, and
  answering it here would settle an organisational fact by inspection.
- **辺の相手が消えた** — the map records a counterpart nothing in the tree reaches any more. Report
  which paths were searched, so the claim is falsifiable.
- **記録された翻案が依存表と食い違う** — the map says 翻案あり where the matrix no longer forces a
  translation, or the reverse. **This is the one axis with a mechanical answer**, so state the rule
  in [`architecture.ts`](../../../architecture.ts) that decides it and let the reader check.

**Ownership is not audited.** It is not in the code, so there is nothing here to compare it against —
saying otherwise would be inventing a comparison. When an ownership entry is 未確定, say so as an
open item rather than as a divergence.

## Step 3 — Report, and state what was not checked

```text
context-map 監査（scope: <X>）

検査した辺: <N> / 地図の辺: <M>
検査できなかった辺: <K> — <理由。1 行ずつ>

[接触点はあるが辺が無い] <n>
  - <counterpart> — `<path>`（所有は未判定。context-map が問う）
[辺の相手が消えた] <n>
  - <counterpart> — 探索した範囲: <paths>
[記録された翻案が依存表と食い違う] <n>
  - <counterpart> — 地図: <翻案あり|なし> / 依存表: <rule>

所有が未確定のまま残っている辺: <n>

本スキルは何も変更していません。地図の更新は context-map、実装側の修正は user が行います。
```

**The counted lines are not decoration.** An audit that reports 「乖離なし」 without saying how many
edges it checked is indistinguishable from one that fanned out over nothing — and this map's edge
count is small and stable, so **a run that quietly checks two of them looks exactly like a clean
sweep.**

**Report an edge you could not check as unchecked, never as clean** — an edge whose counterpart is
configured but not reachable from this checkout is not evidence of anything.

## Do / Do NOT

- ✅ Enumerate the tree the same way `context-map` does.
- ✅ Count by counterpart; separate the sample-only edges.
- ✅ Report the code site for a missing edge, and leave its ownership to `context-map`.
- ✅ State the searched paths when claiming a counterpart is gone.
- ✅ Cite the dependency rule when reporting a translation mismatch.
- ✅ State how many edges were checked, and how many could not be.
- ✅ Report in Japanese.
- ❌ Edit the map, the code, or anything else.
- ❌ Decide which side of a divergence is correct.
- ❌ Assign or audit an ownership label.
- ❌ Report an unchecked edge as clean.
- ❌ Run a gate.

## Checklist

- [ ] Scope confirmed.
- [ ] Both sides enumerated; the tree side enumerated the way `context-map` does.
- [ ] Counted by counterpart; sample-only edges separated.
- [ ] Three divergences reported separately; empty kinds stated as empty.
- [ ] Ownership left unaudited and unassigned; 未確定 entries listed as open items.
- [ ] Checked / unchecked edge counts stated, with a reason per unchecked edge.
- [ ] Nothing edited; the no-op stated explicitly.
