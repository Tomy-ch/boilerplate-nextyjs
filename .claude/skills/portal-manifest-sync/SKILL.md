---
name: portal-manifest-sync
description: >-
  Audit `docs/portal/manifest.yaml` against the READMEs that actually exist, and against the two
  generators that consume it (`pnpm portal:guides` / `pnpm portal:docs`). The manifest is a curated
  reading list, not a mirror of the disk, so an unregistered README is a candidate awaiting human
  judgment — never drift to be auto-fixed. Use this skill when a README moved or was deleted and the
  portal build now fails on a stale `src`; when an entry was added but does not appear in the
  sidebar; before cutting a release, to confirm the portal still builds; or as a periodic hygiene
  pass over what the portal exposes. Japanese triggers apply: 「portal の manifest を同期して」
  「manifest の drift を見て」「portal に載っていない README を洗い出して」「portal のビルドが src で落ちる」.
  It surfaces four things the generators cannot: entries whose section is missing from `meta.groups`,
  entries that silently fall into the `Other` subgroup, per-component reference READMEs that belong
  to Storybook rather than the portal, and the curation candidates that remain after those are
  filtered out. It edits `docs/portal/manifest.yaml` and nothing else — never `docs/portal/guides/**`
  (generated), never the source READMEs, and it never commits. The manual-worthiness criteria are NOT
  defined here: `readme-review` owns them and this skill reads them at runtime. Do NOT use it to
  generate the portal (that is `pnpm portal:site`), to bulk-add unregistered READMEs, to rewrite a
  README (`sync-readme`), or to deep-dive a single README (`readme-review`).
argument-hint: '[--dry-run]'
allowed-tools: Bash, Read, Edit, Glob, Grep, AskUserQuestion
---

# Portal Manifest Sync

This skill audits [`docs/portal/manifest.yaml`](../../../docs/portal/manifest.yaml) — the single
source of the documentation portal's structure ([ADR 0141](../../../docs/adr/0141-portal-operations.md))
— against the READMEs on disk and against the generators that read it.

A Japanese reference translation of this skill is available at `SKILL.ja.md` in the same directory
(not loaded as a skill; for human reference only).

## When to Use

- The portal build fails with `manifest が指す src が見つかりません` — a README moved or was deleted.
- An entry was added to the manifest but does not show up where it was expected in the sidebar.
- You want to know which on-disk READMEs the portal does **not** expose, as input to a curation
  decision — not to mass-add them.
- Before a release, as a check that the portal still assembles from the current tree.
- Periodically, as a hygiene pass.

## Do NOT use this skill for

- **Generating the portal** — that is `pnpm portal:site` (or `pnpm portal:preview` to serve it).
- **Mass-adding unregistered READMEs.** The manifest is a curated manual; adding is an editorial
  decision a human makes per file.
- **Rewriting a README's content** — `sync-readme` owns README ↔ disk drift.
- **Deep-diving one README** — `readme-review` produces the full scorecard for a single file.
- **Creating a missing translation** — `canonicalize-doc` owns the pair.

## Key Assumptions

### 1. The manifest is a manual, not a dictionary

The portal is a curated narrative for humans. An on-disk README that is not registered is **not
drift** — it is a candidate awaiting curation judgment (ADR 0141). Bulk additions destroy the
curation and bury the conceptual flow under per-component noise.

### 2. Two generators already own part of the answer

Do not re-implement what they check. Run them and read what they print:

| Command | What it decides |
| --- | --- |
| `pnpm portal:guides` | Copies every `src` to its `dst`. **Exits non-zero** when a `src` is missing, when a `dst` escapes `docs/portal/guides/`, or when a `src` escapes the repository |
| `pnpm portal:docs` | Builds `docs/portal/docs.json`. Prints `⚠` lines for a section absent from `meta.groups`, a `meta.subgroups` guide id that does not exist, a `meta.reference_links` section id that does not exist, and duplicate paths within a section |

Both write only into gitignored paths (`docs/portal/guides/` and `docs/portal/docs.json`), so
running them leaves no diff to clean up.

### 3. What the generators do **not** catch is this skill's job

- **A registered entry that lands in `Other`.** When a section has `meta.subgroups`, every guide id
  not listed under one of them is swept into an auto-generated `Other` subgroup. No warning is
  printed. An entry added to `layers` without a matching `subgroups` item is live but misfiled.
- **Per-component reference READMEs.** They document one component's API surface; the portal's
  answer for that is Storybook (already a `meta.reference_links` entry) plus the component's own
  TSDoc. Reporting all of them as candidates makes the report unreadable.
- **Curation candidates.** The remainder, classified by `readme-review`'s criteria.

### 4. The criteria live in `readme-review`

The definition of manual-worthy is **not duplicated here**. Read
[`.claude/skills/readme-review/SKILL.md`](../readme-review/SKILL.md) at runtime and apply its Step 2
(the positive and negative criteria plus the four-class thresholds) and, for a README under
`src/features/`, its Step 2b required-section check. If the criteria evolve, only that file changes
and this skill follows.

## Step 0. Confirm the mode

Call `AskUserQuestion` before reading anything else:

- 「manifest 同期のモードを選んでください」
  - 「検出 + 適用（差分を提示して、承認後に manifest.yaml を更新）」
  - 「検出のみ（dry-run、書き込みなし）」
  - 「キャンセル」

`--dry-run` in the arguments is a recommendation for the second option, not a substitute for asking.

## Step 1. Run the generators

```bash
pnpm portal:guides
pnpm portal:docs
```

If `portal:guides` exits non-zero, the `src` list it prints **is** the stale set — carry it to
Step 5 and skip the disk comparison for stale detection. If it succeeds, there is no stale entry.

Collect every `⚠` line `portal:docs` printed. Each one is a confirmed structural finding; report it
verbatim rather than paraphrasing.

## Step 2. Check the placements no warning covers

Parse the manifest. For each section that has an entry in `meta.subgroups`:

1. Take the guide id of every registered `dst` in that section — the basename with `.md` (or
   `.ja.md`) removed, the same rule `scripts/portal/docs-json.ts` applies.
2. Take the union of the `items` lists across that section's subgroups.
3. Report every guide id in (1) that is absent from (2). Those land in `Other`.

Also confirm that every section key in the manifest appears in exactly one
`meta.groups[].sections` list, and that each `meta.section_titles` key names a section that exists.
`portal:docs` warns on the first; the second is silent and leaves a title that titles nothing.

## Step 3. Enumerate the disk

```bash
git ls-files '*README*.md'
```

`git ls-files` is used rather than `find` so that ignored and untracked files stay out without
maintaining a second exclusion list. From the result, drop:

- `docs/**` — files under `docs/<dir>/` are discovered by the FS scan in
  `scripts/portal/gen-docs-json.ts`, so they are already in the portal. Registering one would
  publish it twice.
- `.claude/**` — agent configuration, not portal content.

The remainder is the candidate universe. Subtract the registered `src` set to get the uncurated set.

## Step 4. Filter and classify the uncurated set

Apply the filters in order. Each one has to be re-derived from the tree rather than assumed, because
the shapes below are conventions that can change.

### 4a. Per-component reference

Apply `readme-review`'s N1 as it is written there — the section shape it names, and the caveat that
substantial role / design / mechanism content lifts a README out of the class. Do not restate the
shape here or re-derive it from the tree: N1 is where it is defined, and a second derivation would
make the same file classify differently depending on which skill the user entered through.

Report the matches **as a count only**, naming Storybook and the component's TSDoc as where that
content lives. The content is not weak; it belongs to a different surface.

### 4b. Feature slice

A README under `src/features/` (other than the layer README `src/features/README.md`) is graded by
`readme-review`'s Step 2b against the required sections declared in
[`docs/templates/feature-readme.md`](../../../docs/templates/feature-readme.md). A missing or thin
required section caps it at `borderline`. Do not hardcode the section list — read the template.

### 4c. Everything else

Apply `readme-review`'s Step 2 criteria to each remaining file and record the verdict plus a
one-line rationale naming the criterion that decided it. Read the file; do not judge from the path.

Do not skip this by calling everything `manual-worthy`. The classification is the report's value.

## Step 5. Derive the group and dst for the candidates worth adding

For `manual-worthy` and `borderline` only, and for the report only — this is not an addition
proposal.

1. For each manifest section, take the longest common path prefix of its `src` values.
2. Match each candidate against the longest matching prefix to infer its section; tag it
   `unmatched` when nothing matches, since a new section is a human decision (it needs a
   `meta.groups` entry and a `section_titles` entry to be visible at all).
3. Read how that section already names its `dst` values and follow it literally. Do not invent a
   mechanical rename for a section that uses bespoke names.

## Step 6. Report

Japanese output. Three parts: what is broken, what is a candidate, what is only a count.

```text
Portal Manifest Sync 結果

== 修正対象 ==

[stale] N 件（portal:guides が非 0 で止まる）
  - [layers] src/foo/README.md

[構造] N 件
  - ⚠ どの group にも入っていない section (bar) を "Uncategorized" へまとめました
  - layers の baz が meta.subgroups のどの items にも無い → "Other" へ落ちる（警告は出ない）

== キュレーション候補 ==

[manual-worthy] N 件（自動追加はしません。追加は人の判断です）
  vrt/README.md → section=operations 推定, dst=docs/portal/guides/vrt.md
    根拠: 役割と境界 + 運用 + 索引。散文 10832 字

[borderline] N 件（あと 1 節で manual-worthy。/readme-review で個別に深堀できます）
[not-yet-manual-grade] N 件（README 側の充実が先）

== 情報のみ ==

[部品リファレンス] N 件 — Storybook と各 component の TSDoc が持つ領域
[feature slice] N 件 — 必須節の充足は /readme-review が個別に見ます
```

When nothing is found in any class, say so in one line and stop.

## Step 7. Confirm, then apply

Only the **stale** class is proposed for change on this skill's own initiative:

- 「manifest に残っているが実体のない N 件を削除しますか？」/「すべて削除」「一部のみ削除」「スキップ」

Stale removal is usually safe, but ask anyway — a file can be missing mid-refactor and the entry is
worth keeping.

Additions happen **only** when the user, after reading the report, names the files they want added.
Then, per file: present the inferred section and `dst`, confirm, and apply.

Edit the YAML **in place** — locate the section's last entry and insert the two lines after it, at
the same indentation. Never re-serialize the document; the manifest's comments carry ADR 0141's
reasoning and a round-trip drops them.

**An addition to a section that has `meta.subgroups` is not finished until the new guide id is
listed under one of that section's subgroups.** Otherwise the entry is published into `Other`, which
is exactly the silent misfiling Step 2 exists to catch. Ask which subgroup it belongs to rather than
guessing.

## Step 8. Verify

```bash
pnpm portal:guides
pnpm portal:docs
git diff docs/portal/manifest.yaml
git status --porcelain docs/portal
```

The first two must succeed with no new `⚠` line. The last must print nothing — the generated
`docs/portal/guides/**` tree and `docs/portal/docs.json` are gitignored (ADR 0141: the artifacts are
assembled at delivery and not tracked), so anything appearing there means something was written that
should not have been.

Show the manifest diff and stop. This skill does not commit; chain `/commit` if the user wants one.

## AI Modification Scope

Relaxed for the duration of this run, scoped to:

- `docs/portal/manifest.yaml` — the only file this skill writes.

Protected even during this run:

- `AGENTS.md` / `CLAUDE.md`
- Accepted ADR bodies and `LICENSE`
- Any path listed under `permissions.deny` in `.claude/settings.json`
- `docs/portal/guides/**` and `docs/portal/docs.json` (generated)
- The source READMEs
- Everything else

## Constraints

- ❌ Bulk-add candidates from any class — the manifest is curated, and adding is the user's call
- ❌ Frame an unregistered README as drift to fix
- ❌ Duplicate `readme-review`'s criteria here — read them at runtime
- ❌ Hardcode the section list, the `dst` naming, or the component-README shape — derive each from
  the tree
- ❌ Re-implement what `portal:guides` / `portal:docs` already decide
- ❌ Re-serialize the whole YAML, which drops the manifest's comments
- ❌ Add an entry to a subgrouped section without placing its guide id in a subgroup
- ❌ Touch `docs/portal/guides/**` or `docs/portal/docs.json`
- ❌ Skip the mode confirmation, or apply anything without confirmation
- ❌ Commit or push
- ✅ Japanese user-facing output
- ✅ Edit `manifest.yaml` in place, preserving indentation and comments
- ✅ Re-run both generators after writing

## Checklist

- [ ] Mode was confirmed via `AskUserQuestion`
- [ ] Both generators were run and their output was read, not assumed
- [ ] Subgroup placement was checked for every subgrouped section
- [ ] Disk enumeration used `git ls-files` and excluded `docs/**` and `.claude/**`
- [ ] The component-README shape was re-derived from the tree before filtering on it
- [ ] `readme-review`'s criteria were read at runtime and applied per file, with a rationale each
- [ ] Feature slices were graded against `docs/templates/feature-readme.md`, not a hardcoded list
- [ ] Section and `dst` were derived from the manifest, not invented
- [ ] Stale removals were confirmed; no candidate was auto-added
- [ ] The manifest was edited in place and its comments survived
- [ ] Both generators were re-run and `git status --porcelain docs/portal` printed nothing
- [ ] Nothing was committed or pushed
- [ ] The report is Japanese and carries the class breakdown
