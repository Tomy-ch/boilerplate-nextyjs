---
name: manage-skill
description: >-
  Create, update, evaluate, and optimize skills under this repository's `.claude/skills/`, wrapping Anthropic's official `skill-creator` methodology and layering this repo's own conventions on top (ADR 0154 / 0155 placement, naming, frontmatter and body structure; English-canonical `SKILL.md` plus a mandatory `SKILL.ja.md` translation pair per ADR 0140; read-only sonnet subagents; eval artifacts kept under the gitignored `tmp/`). This is the single entry point for ANY change to a skill under `.claude/skills/`; ALWAYS use it before hand-editing a `SKILL.md` or `SKILL.ja.md`. Use this WHENEVER the user wants to create / update / modify / change / edit / fix / improve / refactor / rename / extend / adjust / tune a skill — its steps, `description`, frontmatter, or behavior — or to author a `/<name>` command, turn a repeated workflow into a skill, tune a skill's triggering description, or run evals on a skill, even if they never say "skill-creator". Japanese triggers apply too, e.g. 「スキルを作りたい」「スキルを更新して」「このスキルの手順 / description / 挙動を変えて」. Do NOT use it for canonical docs under `docs/**` or READMEs (`sync-readme` / `canonicalize-doc` / `readme-review` own those), for subagent definitions alone under `.claude/agents/`, or for other AI tools' configs (`.cursor/`, `.gemini/`, `.github/copilot-instructions.md`).
argument-hint: '[skill-name] [--new|--update|--optimize]'
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, AskUserQuestion, Skill
---

# Manage Skill

You have been invoked via `/manage-skill`. Argument string: `$ARGUMENTS`.

This skill authors and maintains the skills under `.claude/skills/` for **this** repository. It is a
thin wrapper: the *methodology* (draft → test → review → improve → optionally optimize the
description) comes from Anthropic's official `skill-creator` skill, and this file layers the
repository's own conventions on top so the produced skill fits alongside `commit`, `new-env`,
`canonicalize-doc`, and the rest.

A Japanese reference translation of this skill is available at `SKILL.ja.md` in the same directory
(not loaded as a skill; for human reference only).

## When to Use

- Create a brand-new skill / `/<name>` command, or turn a repeated workflow from the current
  conversation into one.
- Update, modify, improve, refactor, rename, extend, or fix an existing skill under
  `.claude/skills/` — this is the entry point for any such change, used **before** hand-editing a
  `SKILL.md` / `SKILL.ja.md`.
- Optimize a skill's `description` for better triggering, or run evals on a skill.
- Repair a broken translation pair (a `SKILL.md` whose `SKILL.ja.md` is missing or stale).

## Do NOT use this skill for

- **Canonical docs** — `docs/**` and per-directory `README.md` belong to `sync-readme` (README ↔
  disk drift), `canonicalize-doc` (EN / JA pair), and `readme-review` (portal-worthiness).
- **Subagent definitions on their own** — a `.claude/agents/<slug>.md` edited without a
  corresponding skill change is out of scope. When a skill's subagent wiring changes, both are in
  scope together (see "Subagents" below).
- **Other AI tools' configs** — `.cursor/`, `.gemini/`, `.github/copilot-instructions.md` are out of
  scope per `AGENTS.md`.
- **ADR authoring** — a skill that would introduce a new convention needs the ADR first (see
  "Deciding where a new skill belongs").

## AI Modification Scope

`AGENTS.md` treats `.claude/**` as an agent configuration path that its owning agent must not touch
on its own. **Invoking this skill is the explicit user instruction that relaxes that** — scoped to
`.claude/skills/**`, `.claude/agents/**` (only alongside the skill that wires them), and `scripts/**`
(only for a script this skill owns), and only for the duration of this run.

These stay protected even during this skill's execution:

- `AGENTS.md`
- `LICENSE`
- Accepted ADR bodies. Step 5 appends a row to the coverage table of ADR
  [0154](../../../docs/adr/0154-claude-skills-operations.md) or
  [0155](../../../docs/adr/0155-claude-skills-development.md); that is possible today only because
  `AGENTS.md`'s "Temporary Operating Rules until v1.0.0" lift the approval requirement on ADR
  bodies. Once those rules are removed, the row addition needs the user's explicit approval like any
  other ADR edit — the ADRs' own "adding a row is a minor edit" clause does not by itself override
  `AGENTS.md`.
- `.claude/settings.json` — the plugin bootstrap writes it through the `claude` CLI (Step 0); never
  hand-edit it here.
- Anything listed under `permissions.deny` in `.claude/settings.json`.

## Step 0. Ensure and load the official methodology

The official `skill-creator` is the source of truth for the *how*. Ensure it is present:

```bash
pnpm exec tsx scripts/bootstrap-plugins
```

The bootstrap declares the `claude-plugins-official` marketplace and enables the official plugins
this repo depends on (`skill-creator`) at **project scope**, so the declaration lands in this repo's
`.claude/settings.json` and any trusted clone gets it without per-developer setup. It is idempotent;
re-running is a no-op. Newly enabled plugins load on the *next* session, when `skill-creator` also
becomes invocable as `/skill-creator` — but this wrapper does not depend on that, because it reads
the file by path and therefore works in the same session.

On the run that actually declares something, the `claude` CLI **rewrites `.claude/settings.json`
wholesale** rather than appending — key ordering inside `permissions` can move. Expect more diff
noise than the two added keys, review it, and commit it as part of the change.

Read that `SKILL.md` in full (discover the path with the glob below):

```bash
ls ~/.claude/plugins/marketplaces/*/plugins/skill-creator/skills/skill-creator/SKILL.md
```

Everything it says about **Creating a skill**, **Running and evaluating test cases**, **Improving
the skill**, **Description Optimization**, blind comparison, and packaging applies verbatim. Its
bundled resources live next to it and are used as-is — `scripts/` (benchmark aggregation, the
description optimizer loop, packaging), the eval viewer, and its own agents and schema references.
Run them from the official skill's directory; do not reimplement them.

If the bootstrap fails (no network, `claude` CLI missing), report the failure to the user and ask
whether to proceed with the methodology summarized inline (draft → test → review → improve) rather
than aborting.

## Step 1. Confirm the operation

Call `AskUserQuestion` before writing anything, per ADR
[0154](../../../docs/adr/0154-claude-skills-operations.md)'s rule that inputs are confirmed
explicitly rather than inferred from arguments:

1. **Which operation** — new / update / optimize-description / repair-translation-pair.
2. **Which skill** — for update / optimize / repair, the `.claude/skills/<slug>/` to act on.
3. **Which family** — for a new skill, operational (ADR 0154) or development (ADR 0155). See below.

Do not silently adopt a slug or operation from `$ARGUMENTS`; put it forward as the recommended
option and let the user confirm it.

### Deciding where a new skill belongs

| Family | ADR | Definition |
| --- | --- | --- |
| Operational | [0154](../../../docs/adr/0154-claude-skills-operations.md) | Operations that advance the development process — Git / GitHub, release, dependency and tool audits, `.claude/` meta inventory. Not primarily generating or editing code |
| Development | [0155](../../../docs/adr/0155-claude-skills-development.md) | Generating, editing, or reviewing code / docs / configuration |

The current members of each family are the coverage table of that ADR — read it this run rather
than a list kept here.

If the proposed skill would establish a new convention, pattern, or library in an area `BACKLOG.md`
still leaves undecided, **stop and defer the ADR decision to the user** (`AGENTS.md`, "Pending
Decisions"). Do not let a skill become the place a convention gets decided implicitly.

Prefer extending an existing skill over adding a near-duplicate. Granularity is
"one invocation = one operation" (ADR 0154).

## Step 2. Apply the repository overlay

Follow the official process, but where it differs from the rules below, **these win** — a skill that
ignores them does not fit this repo.

### Placement and structure

- `.claude/skills/<slug>/SKILL.md`, `<slug>` kebab-case and verb-based, equal to the `name`
  frontmatter and to the directory name. No spaces, uppercase, or Japanese in the slug.
- Bundled resources (`scripts/`, `references/`, `prompts/`, `assets/`) follow the official anatomy
  when needed. Keep `SKILL.md` under ~500 lines and push detail into `references/` with pointers.
- Bundled **scripts** are TypeScript run through `pnpm exec tsx`, matching `scripts/*.ts` and
  `scripts/bootstrap-plugins`. The one exception is a headless driver that must run standalone before
  dependencies are installed (`full-verify/run.sh` is the existing case) — shell is allowed there.

### Frontmatter (ADR 0154)

| Key | Required | Use |
| --- | --- | --- |
| `name` | ✓ | kebab-case, equal to the directory name |
| `description` | ✓ | One dense English paragraph. Must state **when to fire**, not just what it does |
| `argument-hint` | optional | Argument shape for a `/command` that takes args |
| `allowed-tools` | optional | Explicit tool allowlist |

`description` follows the official "pushy" triggering guidance: what it does, concrete when-to-use
contexts including Japanese trigger phrases, and an explicit *when NOT* to fire. Study `commit` and
`new-env` for the density and tone this repo uses, and match it.

### Body structure (ADR 0154)

1. `# <Skill Name>` and a one-paragraph summary
2. A pointer to `SKILL.ja.md`
3. **When to Use**
4. **Do NOT use this skill for**
5. **Step N. <title>** — numbered procedure, starting at Step 0 when there is a prerequisite
6. Verification / wrap-up

### Language (`AGENTS.md`)

- `SKILL.md` is **English canonical**. Never write the canonical body in Japanese.
- The skill's *runtime behavior* must obey the Japanese output rule: everything the skill emits or
  writes to the repository — responses, commit and PR text, code comments, generated docs — is
  **Japanese**. Bake that requirement into the skill's own instructions.

### Confirmation before outward-facing actions (ADR 0154)

A skill that pushes, tags, releases, edits a PR, rewrites `mise.toml`, or performs any destructive
operation must confirm with the user first, via `AskUserQuestion` or the exact wording `AGENTS.md`
mandates for the PR-push case. Never let a skill perform those unattended.

### Subagents (ADR 0155)

Only reach for subagents when there is a reason the ADR recognizes: avoiding single-agent bias,
running independent lenses in parallel, or a finder → verifier two-stage structure. When you do:

- Define them at `.claude/agents/<slug>.md` and reuse existing types rather than inventing new ones.
- Subagents are **read-only on source** and return findings; the orchestrating skill does the writes.
- Default model is `sonnet`; state the intent explicitly in `SKILL.md` when reviewer ≠ implementer
  matters, and say which model each subagent runs on.
- Do not add subagents "just in case" — the ADR forbids it on cost grounds.

### Read the source of truth at runtime

Skills read the relevant `README.md` / `docs/` / ADR **at runtime** instead of hardcoding rules that
will drift, and detect inventories (purposes, env files, layers) from the live tree. `new-env` and
`full-verify` are the models for this. A skill that hardcodes a list it could have discovered is a
drift source.

### Eval artifacts stay out of version control

The official process writes a `<skill-name>-workspace/` with iteration and eval directories,
benchmarks, and viewer output. A sibling of the skill directory would land inside the tracked
`.claude/skills/**`. **Override the location**: put the workspace under the repo's gitignored
`tmp/` (e.g. `tmp/manage-skill/<skill-name>-workspace/`). Never commit eval runs, benchmarks,
feedback JSON, or viewer HTML, and never force them in with `git add -f`.

## Step 3. Create or update

### Creating a new skill

Run the official **Creating a skill** flow (Capture Intent → Interview → Write SKILL.md → Test
Cases), then apply the overlay: correct placement, ADR-conformant frontmatter and body structure,
English-canonical body, and the eval workspace under `tmp/`.

### Updating an existing skill

- Preserve the existing `name` and directory unchanged unless the user explicitly asked for a
  rename. A rename means moving the directory and updating every cross-reference to it.
- Unlike an *installed* plugin skill, repo skills are writeable in place — **edit them directly**
  under `.claude/skills/<slug>/`; there is no read-only copy-to-`tmp` dance.
- For an eval baseline, snapshot the pre-edit skill under `tmp/` per the official guidance, so
  before / after can be compared.
- Check whether the change invalidates statements made elsewhere: the ADR coverage tables, other
  skills that chain into this one, and `tool-map`'s dependency map.

## Step 4. Sync the Japanese translation pair

Every skill in this repo ships a `SKILL.ja.md` next to `SKILL.md` (ADR
[0140](../../../docs/adr/0140-documentation-operations.md) / 0154). This is not optional. After the
canonical `SKILL.md` is finalized or changed:

- Chain the `canonicalize-doc` skill to produce or sync `SKILL.ja.md` from the canonical
  `SKILL.md`.
- `SKILL.ja.md` carries **no YAML frontmatter** and begins with the blockquote note saying it is a
  translation, must not be edited directly, and that updates flow from `SKILL.md`.
- Confirm the pair is in sync — matching heading structure and section count — before considering
  the task done. A changed `SKILL.md` with a stale Japanese side is drift.

## Step 5. Register the skill in its ADR

A new skill is not done until it appears in the coverage table of its family's ADR — 0154 for
operational, 0155 for development. Both ADRs state that adding a row is a minor edit requiring no
ADR revision, so append the row directly: slug, role, and coverage, in the same style as the
existing rows. If the new skill introduces a subagent, add it to 0155's subagent diagram too.

Update the row when an existing skill's coverage materially changes.

## Step 6. Verify

- `pnpm lint:ci` and `pnpm typecheck` — required whenever a bundled or `scripts/` TypeScript
  file was added or changed. Run `pnpm fix` first for autofixable findings.
- `pnpm md-lint` — required whenever any Markdown was touched, including `.claude/**`. It runs three
  stages: markdownlint (layout), mermaid-lint (diagram syntax), and `skill-lint`, which checks the
  frontmatter keys, the `SKILL.md` / `SKILL.ja.md` pair's heading structure, and the existence of
  every `make` target and path the body references. What `skill-lint` cannot judge stays this skill's
  responsibility: whether the translation says the same thing, and whether the body is still correct.
- Confirm no eval artifact is staged (`git status`), and that no protected path was touched.

## Definition of Done

- The official `skill-creator` methodology was resolved and loaded (Step 0).
- `.claude/skills/<slug>/SKILL.md` exists, its frontmatter and body matching Step 2's *Frontmatter*
  table and *Body structure* list.
- `SKILL.ja.md` synced per Step 4 (via `canonicalize-doc`, 1:1 with `SKILL.md`).
- The skill is registered in the coverage table of ADR 0154 or 0155.
- Bundled scripts are TypeScript run through `tsx`, unless the standalone-before-install exception
  applies.
- No eval artifacts committed; no protected path touched.
- Verification commands run and reported honestly, including what was **not** machine-checked.
