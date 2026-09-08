---
name: context-map
description: >-
  Maintain `docs/design/context-map.md` — the one-page table of every place this presentation layer touches something outside it — by enumerating the contact points from the code and recording two things per edge: who owns the boundary, and whether a translation layer sits in between. The two are recorded together and decided apart, and that split is the skill: whether a wire type is translated before it leaves `adapters` is settled by the dependency matrix and has no human judgment in it, while who owns the boundary — whether this project can negotiate with that counterpart or can only follow — is an organisational fact that no amount of code reading supplies. So it proposes ownership as evidenced candidates and lets a human choose, and never writes an ownership label on its own authority. Use it when a new outbound call, inbound entry point, or third-party mount appears, or when the map should be brought up to date after a batch of work — 「外部との接点を整理して」「この口は地図に載ってる？」. It writes only the map; the mechanism of each edge stays in the subject reference that owns it, and the map points there rather than restating it. Do NOT use it to check the map against reality (`context-map-audit`), to describe how an edge works (that belongs to the subject reference under `docs/design/`), or to add a configuration value (`new-env`).
argument-hint: '[--scope=changed|full]'
---

# Context Map

Enumerate what this layer touches outside itself, and record two things per edge — **one the machine
decides, one only a person can.**

A Japanese reference translation lives at `SKILL.ja.md` in this directory (for human reference only;
not loaded as a skill).

## When to Use

- A new outbound call, inbound entry point, or third-party mount appeared.
- The map should be brought up to date after a batch of work.
- `context-map-audit` reported an edge that exists in code but not on the map.

## Contract

| | |
| --- | --- |
| **Owns** | 接触点の列挙、辺ごとの「境界の所有」と「翻案の有無」の記録、所有の候補提示 |
| **Never** | 所有のラベルを自分の権限で書く / 各辺の仕組みをここへ書く / 主題ごとの design 文書を書き換える |
| **Starts when** | 外部との接点が増減した、あるいは地図を最新化するとき |
| **Stops when** | 所有が人に確認され、地図が書かれたとき |

## Do NOT use this skill for

- **Checking the map against reality** — `context-map-audit`. This one writes; that one only reads.
- **Describing how an edge works.** That belongs to the subject reference under `docs/design/` that
  owns it. The map points there.
- **Adding a configuration value** — `new-env`.

## The one thing this skill must not do

**It must not decide who owns a boundary.**

The map records two axes per edge, and they are recorded together because a reader needs both — but
**they are decided in completely different ways**, and conflating them is how a map acquires labels
nobody can defend:

- **翻案の有無 is decided by the machine.** Types generated from a contract live in the `adapters-gen`
  area of [`architecture.ts`](../../../architecture.ts), and only `adapters` may reach it — so a
  generated type is necessarily translated before it leaves. **Read the dependency matrix; there is
  no judgment here.**
- **境界の所有 does not come out of the code at all.** Whether this project can negotiate with that
  counterpart, or can only follow what it publishes, is a fact about people and agreements. **A
  repository cannot tell you which, however carefully you read it.**

So for ownership: **gather the evidence, present the candidates, and let a human choose.** Writing a
label on your own authority produces a map that looks authoritative and is not — and the next reader
has no way to tell which labels were established and which were guessed.

## Step 0 — Confirm the scope

One `AskUserQuestion`:

- 「地図のスコープを選んでください」
  - 「変更で触れた口のみ」 — the entry points and outbound calls in the diff
  - 「全体」 — re-enumerate every contact point
  - 「1 つの辺」 — one counterpart, added or revised

## Step 1 — Enumerate the contact points from the code

**Enumerate; do not recall.** The map is only worth its enumeration.

| Where to look | What it yields |
| --- | --- |
| `src/config/` | The purpose-scoped modules. **Each one that names an outside destination is an edge**, and its module is where the address actually lives ([0030](../../../docs/adr/0030-environment-variable-management.md)) |
| `src/adapters/` | The outbound clients and the transport, and whether a generated type is involved |
| `src/app/api/**` | The inbound entry points this repository owns |
| `src/app` metadata / `robots` / `sitemap` | The inbound edges that are standards rather than callers |
| `src/proxy.ts` | What is intercepted before any of the above runs |

**Separate the edges the sample purge removes from the ones that survive.** A counterpart that only
exists because the sample does is not part of the map a template user receives — the range is
[`scripts/setup/remove-sample/sample-manifest.ts`](../../../scripts/setup/remove-sample/sample-manifest.ts).

**Count contact points by counterpart, not by resource.** Ten endpoints against one backend are one
edge; the map is about who this layer talks to, not about what it asks them.

## Step 2 — Settle 翻案 from the dependency matrix

For each edge, read [`architecture.ts`](../../../architecture.ts) and answer: **can the outside
vocabulary reach the inside without being rewritten?**

- A generated wire type confined to the `adapters-gen` area, reachable only from `adapters` →
  **翻案あり**. It is structurally impossible for the outside shape to arrive unchanged.
- An external format carried through as-is because a standard says so — a signal envelope forwarded
  without being read, a URL composed and handed on → **翻案なし**.

**Cite the rule, not the impression.** This axis is a fact about the matrix, and a reader must be
able to check it without trusting you.

## Step 3 — Gather the evidence for 所有, then ask

For each edge, assemble what is actually knowable and present it:

- **Who publishes the contract** — a standard body, the counterpart, or this repository.
- **What happens here when it changes** — does this side have to follow, or is the shape ours?
- **Whether a version or a negotiation exists** — a versioned contract, or a moving target.

Then ask. Phrase the options as **readings of the relationship**, not as labels:

```text
質問: <相手> との境界は、どちらが決めますか？
選択肢:
  - 相手が決める（こちらは追従する）
  - こちらが決める（口の形をこのリポジトリが持つ）
  - 標準が決める（どちらも仕様に従う）
  - どれでもない / まだ分からない
```

**Include the last option.** An edge whose ownership nobody can state yet is a real answer, and
recording it as 未確定 is more useful than a label that was picked to fill the cell.

## Step 4 — Write the map, and only the map

Write [`docs/design/context-map.md`](../../../docs/design/context-map.md). Per edge: the counterpart,
the ownership, the translation, where the contract comes from, and **which document owns the
mechanism**.

**Do not write the mechanism here.** How the edge is connected, what is sent, how failure is folded —
each of those belongs to the subject reference that already owns it. **A map that restates them goes
stale in two places at once**, and the map is the copy that nobody re-reads.

**Do not edit those subject references.** When the mechanism has changed, that is their maintainer's
change, not this skill's.

The document is Japanese on the suffix-less path with **no `.ja.md` pair**
([0140](../../../docs/adr/0140-documentation-operations.md)). Then format only what was written:

```bash
pnpm exec markdownlint-cli2 --no-globs --fix docs/design/context-map.md
```

## Step 5 — Closing report (Japanese)

State the edges added, revised, and removed; which ownerships the user settled and which are 未確定;
and **which edges were sample-only and therefore not recorded**. Name the scope.

## AI Modification Scope

Invoking this skill relaxes `AGENTS.md`'s modification scope to `docs/design/context-map.md` alone,
for the duration of this run. The subject references, the ADRs, and `src/config/` stay protected.

## Do / Do NOT

- ✅ Enumerate contact points from the code, never from memory.
- ✅ Count by counterpart, not by resource.
- ✅ Separate the sample-only edges from the ones that survive.
- ✅ Settle 翻案 from the dependency matrix and cite the rule.
- ✅ Present ownership as evidenced candidates and let a human choose.
- ✅ Offer 「どれでもない / まだ分からない」 and record 未確定 when it is chosen.
- ✅ Point at the document that owns each mechanism.
- ✅ Report in Japanese.
- ❌ Write an ownership label on your own authority.
- ❌ Infer ownership from the code — it is not in there.
- ❌ Restate a mechanism the subject reference owns.
- ❌ Edit a subject reference, an ADR, or `src/config/`.
- ❌ Use the relationship vocabulary of a modelling method this repository does not adopt.
- ❌ Create a `.ja.md`; run a gate.

## Checklist

- [ ] Scope confirmed.
- [ ] Contact points enumerated from `src/config/`, `src/adapters/`, `src/app/api/**`, the metadata
      surface, and `src/proxy.ts`.
- [ ] Counted by counterpart; sample-only edges separated and named.
- [ ] 翻案 settled from `architecture.ts`, with the rule cited.
- [ ] 所有 presented as evidenced candidates and chosen by the user; 未確定 recorded where chosen.
- [ ] Map written with the owning document named per edge; no mechanism restated.
- [ ] No subject reference, ADR, or config touched; no `.ja.md` created.
- [ ] Only the written file formatted; no gate run.
- [ ] Closing report names the scope and the unsettled edges.
