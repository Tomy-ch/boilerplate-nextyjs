---
name: sync-readme
usage-class: situational
description: Update a specified canonical README so it matches the actual files and directories beneath its location. Detects drift between what the README documents and what exists on disk (missing files, renamed files, removed entries, outdated descriptions) and rewrites the README to reflect reality. For child directories that have their own README, includes only a short digest plus a reference link rather than recursing into their contents. After updating the canonical README, automatically chains into the `canonicalize-doc` skill to re-sync any sibling translation file. Confirms the target README path and update scope with the user via AskUserQuestion before writing.
---

# Sync README

This skill reconciles a README document with the actual file/directory layout under its directory. It rewrites the README to fix drift while respecting nested README boundaries: when a subdirectory has its own README, that subdirectory is summarized via a one-line digest and a reference link, not recursively expanded.

A Japanese reference translation of this skill is available at `SKILL.ja.md` in the same directory (not loaded as a skill; for human reference only).

## When to Use

Use this skill when:

- A README has fallen out of sync with its directory (files added/removed/renamed, descriptions outdated).
- You want a single directory's README refreshed without touching nested READMEs.
- You need to surface "documented but missing" or "exists but undocumented" entries before deciding what to fix.

Do NOT use this skill to recursively rewrite every README in a tree. It operates on exactly one README per invocation. To refresh a whole tree, invoke it once per directory.

## Step 0. Confirm Input

This skill **MUST call `AskUserQuestion` immediately after invocation** to confirm:

1. **Target README path** — the canonical README to update. If the user supplied a path in skill arguments or the recent message, present it as a candidate.
2. **Scope confirmation** — confirm the directory boundary (the directory containing the target README) and the depth limit (default: only direct children; nested directories are summarized via their own README if present).

Do NOT read the file tree or write any file until these are confirmed.

This skill always operates on the **canonical** README — and below v1.0.0 that is the **Japanese**
file on the suffix-less path. ADR [0140](../../../docs/adr/0140-documentation-operations.md) keeps
Japanese canonical there and forbids creating a `*.ja.md` beside it until the v1.0.0 boundary, so a
README in this repository has **no translation sibling**: `find src docs -name '*.ja.md'` returns
nothing. Do not create one, and do not chain into `canonicalize-doc` to "re-sync" a file that must
not exist.

If a `README.ja.md` ever does turn up next to a `README.md`, that is a finding to report, not a pair
to sync — 0140 decides which side survives, and this skill does not.

## How the Sync Works

### Scope

- The README's directory is the **scope root**.
- The skill enumerates entries directly inside the scope root.
- For each entry:
  - **File**: include it in the README listing with a one-line description.
  - **Directory without its own README**: list it and (optionally, if shallow) summarize its immediate notable children.
  - **Directory with its own README**: include only a one-line digest + a reference link to that nested README. Do NOT recurse into its contents.

### Detecting drift

Compare the README's documented entries against the actual entries:

- **Documented but missing on disk** → remove the entry (or flag for user confirmation if the entry is load-bearing, e.g., links from elsewhere).
- **Exists on disk but undocumented** → add it.
- **Renamed** (likely: same description, similar path) → update the path.
- **Outdated description** (e.g., the file's role has changed) → infer the new role from the file's contents and update.

### Things NOT to touch

- Hidden files/dirs (`.git`, `.DS_Store`, `.gitkeep`, etc.) unless the README clearly documents them.
- Build artifacts and ignored files (anything matched by `.gitignore` at or above the scope root).
- Generated files (the paths `.gitattributes` marks `linguist-generated`).
- Nested directory internals when that directory has its own README.

## Repo Conventions

- The canonical README is `README.md`, written in **Japanese** below v1.0.0 (ADR 0140). There is no co-located translation, and this skill does not create one.
- Preserve existing section ordering and styling (tables vs lists vs prose) unless the user explicitly asks to restructure.
- Preserve existing prose that is still accurate. Do not rewrite for stylistic reasons — minimize churn.

## AI Modification Scope

Per the "Exception: Skill Execution" clause in AGENTS.md, the normal AI Modification Scope restrictions are relaxed during this skill's execution, scoped to:

- The confirmed target canonical README file.
- Sibling translation files are NOT modified by this skill directly; they are updated in the subsequent `canonicalize-doc` invocation (which runs under its own scope exception).

The following remain protected even during skill execution:

- `AGENTS.md` / `CLAUDE.md`
- Generated files (the paths `.gitattributes` marks `linguist-generated`, and the generated content under `docs/portal/`)
- Any path listed under `permissions.deny` in `.claude/settings.json`
- All other files and directories under the scope root (the skill reads them but never modifies them).

## Step 1. Read the target README

Read the target README in full to understand:

- Its existing section structure.
- The entries it currently documents (files, directories, links).
- Any custom conventions (e.g., a "Directory Layout" table, a "Subprojects" list).

## Step 2. Enumerate the actual file tree

List the entries directly inside the scope root. For each:

- Record its name, type (file / directory), and (for directories) whether it contains its own README.
- For files, read enough to determine the role/purpose (the file's package comment, top-level docstring, or first few lines).
- For directories with their own README, read only the first paragraph of that nested README to extract a digest.
- For directories without their own README, optionally list immediately-notable children (do not deep-recurse).

## Step 3. Compute the diff

Build three lists:

- **To add**: exists on disk, absent or outdated in the README.
- **To remove**: documented in the README, no longer exists on disk.
- **To update**: present in both but description/path is wrong.

If any item in **To remove** is referenced from elsewhere (links from other docs), surface that to the user before deletion.

## Step 4. Apply the update

Rewrite the README so it reflects reality:

- Insert new entries in the appropriate section, matching the existing format.
- Remove stale entries.
- Update outdated descriptions and paths.
- For child directories with their own README, ensure the entry is a one-line digest with a relative link to the nested README (e.g., `- [sub/](sub/README.md) — short digest`).
- Preserve unrelated sections (introduction, badges, license, etc.) verbatim.

## Step 5. Verify the canonical update

- Confirm every entry in the updated README maps to a real file or directory.
- Confirm no real entry (other than ignored ones) is missing.
- Confirm no nested README was inadvertently expanded.

## Step 6. Confirm there is no translation to sync

Below v1.0.0 there is nothing to chain into: the README just written **is** the canonical, and 0140
forbids a `*.ja.md` beside it. Check that the update did not produce one, and report the canonical as
updated standalone.

The one place this repository does keep a pair is `.claude/skills/<name>/SKILL.md` + `SKILL.ja.md`,
which exists because Claude Code parses the frontmatter in English (ADR 0154). That pair belongs to
`manage-skill`, not here.

## Step 7. Format the written files

After writing the canonical README (and after `canonicalize-doc` has produced any translation), run `pnpm exec markdownlint-cli2 --no-globs --fix <paths you wrote>` on the files this skill produced. Leave `pnpm lint:md` to the pre-commit hook and CI (AGENTS.md: do not pre-run the gates).

## Step 8. Final verification

- Confirm both files (canonical and translation) have parity if the translation was synced.
- Report which entries were added / removed / updated and which files were written.

## Checklist

Confirm the following before reporting completion:

- [ ] Target canonical README path confirmed with the user via `AskUserQuestion`
- [ ] Scope root and depth limit confirmed
- [ ] Drift computed (add / remove / update lists produced)
- [ ] Canonical README rewritten with correct entries and preserved structure
- [ ] Child directories with their own README represented as one-line digests + reference links (not expanded)
- [ ] If a sibling translation file exists, `canonicalize-doc` was invoked to re-sync it
- [ ] `markdownlint-cli2 --fix` was run on the written files only
- [ ] No file outside the canonical README (and the chained `canonicalize-doc` scope) modified

## Notes

- Do NOT recursively rewrite nested READMEs. Each invocation handles exactly one README's scope.
- Do NOT delete documented entries blindly. When an entry is removed from disk, confirm it isn't referenced from elsewhere before pruning the line.
- If the directory has no obvious convention to follow (e.g., a fresh README with no structure), ask the user whether to use a table, a bulleted list, or prose.
- If the README intentionally documents items outside its directory (e.g., a top-level README listing project-wide entries), confirm the scope with the user before treating those external references as drift.
