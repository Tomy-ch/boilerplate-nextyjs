---
name: adr-scan
usage-class: lifecycle
description: >-
  PROVISIONAL / one-off. Read-only full-repository scan that discovers decisions this repository already makes
  in fact — in `AGENTS.md`, the config files, the `src/` structure, `.github/`, and code comments — but does
  not yet track as a frame in `docs/adr/BACKLOG.md`. Classifies each as decision (frame-worthy) / exclusion
  (frame-worthy negative decision) / rule (stays in `docs/rules.md`) / inventory (living reference), and proposes
  which Tier and frame ID it belongs to. Use it when the ADR board should be checked for gaps rather than when
  a single decision needs writing. Read-only: it produces a candidate inventory, writes no ADR file, and does
  not edit `BACKLOG.md`. Delete or archive it once the discovered gaps are folded into the board.
---

# adr-scan (provisional)

**Status: temporary / one-off.** Built to sweep the repo for architectural decisions that are *real but
untracked* — deciding whether each deserves a slot on `docs/adr/BACKLOG.md`. Read-only: it emits a
**candidate inventory** only. It never writes `docs/adr/**`, never edits `BACKLOG.md`, never edits
source. Remove or archive it once the discovered gaps have been reconciled into the BACKLOG.

## Why the job here is discovery, not migration

This repository already has a formal ADR set (`docs/adr/<NNNN>-*.md`, numbered in topical decade-bands)
and a live board (`docs/adr/BACKLOG.md`) that tracks every decision area across Tiers 0–6 with
frame IDs (`G` / `T` / `R` / `A` / `B` / `C` / `D`) and a 選定済み / 実装済み status pair. **Collecting
scattered decisions into a set is therefore already done**, and a scan that re-does it finds only what
the board already holds.

What the board cannot show is what it never received. So the useful job is **gap discovery**: find decisions that are being made *de facto* — encoded in
`AGENTS.md`, config files, the `src/` layout, `.github/`, or code comments — but are **not represented
by any BACKLOG frame** (or are represented but mis-tiered / mis-classified). The output feeds the
BACKLOG運用ルール flow: *新しい意思決定領域に気付いたら該当 Tier への追加 → 内容合意 → ADR 化*.

## Classification taxonomy (the core judgment)

Each candidate is exactly one of:

- **decision** — a choice among alternatives with lasting consequences (X over Y). BACKLOG-frame-worthy.
- **exclusion** — a deliberate "we intentionally do NOT do X" with rationale. Frame-worthy (negative
  decision; the BACKLOG "明示的に boilerplate では決めない (out of scope)" section is the home for some
  of these).
- **rule** — a day-to-day constraint/consequence (e.g. "use the `@/*` alias", "commit prefixes"). Stays
  in [`docs/rules.md`](../../../docs/rules.md), never in `AGENTS.md`
  ([0140](../../../docs/adr/0140-documentation-operations.md) 決定 3); may *reference* an ADR but is not
  itself a new decision area.
- **inventory** — a catalog that drifts with code (dependency list, script list). Stays in a living
  reference doc / README, never an ADR.

A candidate is frame-worthy only if: it has (or implies) considered alternatives, it is cross-cutting or
hard to reverse, and it is not merely restating an existing rule/inventory or an already-tracked frame.

## Scan surfaces (fan out one read-only worker each)

Fan these out in parallel via the Agent tool (read-only); each returns candidates in the output shape
below. Then the orchestrator dedups against the existing BACKLOG frames.

1. **Existing ADR + board** — `docs/adr/*.md` + `docs/adr/BACKLOG.md`. Build the baseline set of
   *already-tracked* frames (so discoveries can be diffed against it). Note any ADR whose Status or
   BACKLOG status pair looks inconsistent with reality.
2. **AGENTS.md** — the *Where You May Stop* stopping-point table (the undecided areas it points at live in
   BACKLOG — confirm each maps to a frame), the "AI Modification Scope" / "Protected Documentation" /
   "Git Rules" / "Language Rules" sections. Separate genuine decisions from rules.
3. **Config & tooling (latent decisions)** — `package.json` (deps, scripts, `packageManager`),
   `tsconfig.json`, `next.config.ts`, `biome.json`, `postcss.config.mjs`, `mise.toml`, `.makefiles/**`,
   `.github/**`. A pinned tool, an enabled compiler flag, a CI job, a `browserslist` — each may be a
   decision made in config but never elevated to an ADR/frame.
4. **`src/` de-facto structure** — the actual directory layout, `"use client"` placement, route
   conventions, styling approach (Tailwind usage), any state/data-fetch pattern. These are the A-tier /
   B-tier de-facto states; check each is reflected (as ⚠️ de-facto) in BACKLOG and not silently
   hardening into an unrecorded convention.
5. **Latent in prose/comments** — `README*`, code `// TODO` / `// why` comments, `.github/copilot-instructions.md`.
   Decisions or exclusions stated in passing but never tracked.

## Output (per candidate)

```text
- title:         short decision title (imperative, ADR-style)
  type:          decision | exclusion | rule | inventory
  frame_worthy:  yes | no
  source:        file:line (evidence)
  alternatives:  present | implied | none
  backlog_state: tracked <frameID> | untracked | mis-tiered <current→proposed> | mis-classified
  proposed_tier: Tier N + letter (e.g. "Tier 4 / B") — existing frame ID if one fits, else "new"
  note:          one line — why worthy / why not / what's inconsistent
```

Aggregate into:

- **(A) Untracked decisions/exclusions** — frame-worthy but absent from BACKLOG, with a proposed Tier +
  frame ID. *This is the primary deliverable.*
- **(B) Tracked-but-drifted** — frames whose BACKLOG status pair (選定済み / 実装済み) or Tier looks wrong
  vs the observed reality.
- **(C) Stays-a-rule list** — belongs in `docs/rules.md` ([0140](../../../docs/adr/0140-documentation-operations.md) 決定 3), not a new frame and not `AGENTS.md`.
- **(D) Stays-inventory list** — belongs in a living reference, never an ADR.

The orchestrator presents these to the user as *candidates only*. Folding any of them into
`BACKLOG.md` (or filing an ADR) is a **separate, user-approved step** — this skill does not perform it
(`BACKLOG.md` is AI-editable per `AGENTS.md`, but the 運用ルール requires 内容合意 before a frame is added).

## Constraints

- ✅ Read-only. Emit a candidate inventory only. Never write `docs/adr/**`, never edit `BACKLOG.md` or
  source, never file an ADR.
- ✅ Respect the Instruction Priority: AGENTS.md > ADRs > BACKLOG > agent configs. A "decision" that
  contradicts an Accepted ADR is a finding, not something to normalize.
- ✅ Provisional: delete or archive this skill once the discovered gaps are reconciled into BACKLOG.md.
- ❌ Do not invent decisions to fill perceived gaps — only surface what has real evidence (file:line).
