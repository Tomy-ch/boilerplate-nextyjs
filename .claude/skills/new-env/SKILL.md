---
name: new-env
usage-class: situational
description: Add a new environment variable end-to-end, keeping the env files, purpose-scoped typed config modules, and documentation in sync. Targets ADR 0030's config kernel: `env/.env.{local,ci,dev,stg,prd}` and `env/README.md` always, plus `src/config/<purpose>/<purpose>.schema.ts`, the corresponding server or client module, `src/config/environment.ts`, and `src/config/README.md` when the app reads the value through config. The skill derives the purpose inventory, schema library, type mapping, and naming conventions from live `src/config/` contents. It confirms the variable specification before writing, refuses secrets behind `NEXT_PUBLIC_`, and verifies with `pnpm lint:ci`, `pnpm typecheck`, and `pnpm build`.
---

# New Env

Adds a new environment variable to the project end-to-end: set in each per-environment env file and listed in the env variable table, and — when the app reads it through config — declared in the schema of **one purpose-scoped config module**, exposed through that module's immutable typed object, and explained in the config kernel README.

The two documentation sides own different things ([0030](../../../docs/adr/0030-environment-variable-management.md) §6). **`env/README` is the authority on which variables exist**, placeholder-only and config-less variables included. **The config kernel README is the authority on the config values themselves** — those validated at build time and injected into the purpose modules at construction. What config covers is a subset of what exists in env; never write the same content into both.

The design this skill implements is [0030](../../../docs/adr/0030-environment-variable-management.md) (env management / config kernel); the naming form comes from [0028](../../../docs/adr/0028-naming-convention.md). Those ADRs are authoritative — this skill only automates the mechanics.

A Japanese reference translation of this skill is available at `SKILL.ja.md` in the same directory (not loaded as a skill; for human reference only).

## Precondition: the config kernel must exist

This skill assumes `src/config/` is already in place. Before anything else:

```sh
ls src/config/ 2>/dev/null
```

If `src/config/` does not exist, **stop immediately** and tell the user that the config kernel has not landed yet, so there is nothing to add a variable to. Do **not** scaffold the kernel, the schema, the validation call sites, or `env/` from a variable-addition request — building the kernel is its own change and requires the library selection that [0030](../../../docs/adr/0030-environment-variable-management.md) leaves to it.

## When to Use

Use this skill when:

- A new env var is needed (external service URL, tunable timeout, public site URL, etc.).
- Several files must stay in sync and you want them updated consistently.

Do NOT use this skill for:

- Renaming an existing env var (different workflow — rename across all places at once).
- Removing an existing env var (reverse direction; safer by hand).
- Adding a whole new **purpose** (a new `src/config/<purpose>/` directory). This skill assumes the purpose module already exists. For a new purpose, write the first variable manually — a new module also needs its import-boundary placement decided ([0030](../../../docs/adr/0030-environment-variable-management.md) §3) — then use this skill for subsequent additions.
- Moving a value out of env because it must change without a redeploy — that belongs behind the BFF runtime config ([0071](../../../docs/adr/0071-bff-api-integration.md)), not here.

## What This Skill Reads / Writes

**Reads (always)** — everything below is discovered at runtime; nothing about the inventory is hardcoded:

- `src/config/*/*.schema.ts` and the corresponding server or client modules — the purpose inventory, schema-validator style, and config getter style.
- `src/config/environment.ts` — the explicit environment schema and the purpose-validator imports.
- `env/README.md` — the variable table and its per-subsystem sections. This is the authority on **which variables exist**.
- `src/config/README.md` — the config kernel README. This is the authority on **the config values themselves** — the ones validated at build time and supplied to purpose modules.
- `env/.env.local`, `.env.ci`, `.env.dev`, `.env.stg`, `.env.prd` — per-environment value placement and section-comment layout.
- `package.json` — which verification scripts exist (`lint:ci` / `typecheck` / `build`, and a test script if one has been added).

**Writes (only after confirmation)**:

- The env files and `env/README.md` — always; every variable exists in env.
- The purpose schema, its corresponding config module, `src/config/environment.ts`, and `src/config/README.md` — only when the variable is read by the app through config.

**Never touches**:

- `next.config.ts` / `instrumentation.ts` — the build-time and server-start validation points ([0030](../../../docs/adr/0030-environment-variable-management.md) §1) import the schema module wholesale, so adding a field to an existing purpose schema is already covered. If a change there looks necessary, that means the purpose module is not wired in — stop and report it instead of editing.
- `biome.json` — the `noProcessEnv` override belongs to the config kernel, not to a variable addition.
- Anything outside `env/` and `src/config/`.

## Step 0. Gather the Spec

This skill **MUST call `AskUserQuestion` immediately after invocation** — adding an env variable requires user confirmation ([0030](../../../docs/adr/0030-environment-variable-management.md) §6). Ask in batches to collect the spec.

### Question 1: Variable name and purpose

- Question: 「環境変数名を入力してください(`{SUBSYSTEM}_{NAME}` の UPPER_SNAKE_CASE。ブラウザへ出す変数は `NEXT_PUBLIC_{SUBSYSTEM}_{NAME}`)。例: `APP_API_BASE_URL` / `NEXT_PUBLIC_ANALYTICS_SITE_ID`」
- Free-text. Then:
  1. Strip a leading `NEXT_PUBLIC_` if present (that prefix marks the client side, not the subsystem) and split at the first `_` to get the subsystem.
  2. Match the subsystem against the purposes discovered under `src/config/`.
  3. If matched, show the inferred module (e.g. 「推定 purpose: `api` (`src/config/api/api.server.ts`)」) and ask for confirmation.
  4. If unmatched, surface the available purposes and ask the user to pick one, or stop so a new purpose module can be added by hand.
  5. **Standard-name exception** ([0028](../../../docs/adr/0028-naming-convention.md)): names fixed by an external spec that a third-party SDK reads (`OTEL_EXPORTER_OTLP_ENDPOINT`, `PORT`, …) keep the standard name and are exempt from `{SUBSYSTEM}_{NAME}`. Only apply this when an external tool reads the variable — not when the app reads it itself.

### Question 2: Is the variable read through a config module?

- Question: 「この変数はアプリが config モジュール経由で読みますか？」
- Options:
  - 「はい(config 経由で読む)」 — the normal path: schema entry + getter in a purpose module, and a `src/config/README` entry
  - 「いいえ(外部ツール / SDK が `process.env` から直接読む)」 — e.g. a standard-named variable such as `OTEL_EXPORTER_OTLP_ENDPOINT`, or a value consumed by the platform rather than the app

The answer decides how far the change reaches. `env/` and `env/README` are updated either way; `src/config/` and its README are touched **only** on the "はい" path (the ownership split between the two documentation sides is stated in this skill's opening paragraph).

On the "いいえ" path, skip Question 3 (which module side) and Question 4 (type / required vs code default) — both are schema concerns and there is no schema entry to write. The `NEXT_PUBLIC_` exposure rule and the secret label still apply. State plainly in the Step 2 plan that no config module is touched, so the reader is not left wondering why the getter is missing.

### Question 3: Server or client side

- Question: 「この変数はどちら側ですか？」
- Options:
  - 「server(secret を含み得る / runtime object)」 — goes into `<purpose>.server.ts`
  - 「client(`NEXT_PUBLIC_` / ブラウザに露出する公開定数)」 — goes into `<purpose>.client.ts`

Enforce the two invariants of [0030](../../../docs/adr/0030-environment-variable-management.md):

- A `NEXT_PUBLIC_`-prefixed name must go to the client module, and a non-prefixed name to the server module. If the answer contradicts the name, surface the mismatch and re-ask.
- **A secret must never be `NEXT_PUBLIC_`.** If the user later labels the variable as secret-managed (Question 5) while it is on the client side, stop and explain: `NEXT_PUBLIC_` values are inlined into the browser bundle as literals, so this leaks the secret. Offer the split (a public ID on the client, the secret key on the server) instead of proceeding.

### Question 4: Type, and required vs code default

- Question: 「型と、required / code default を選んでください」
- Options:
  - 「string, required」
  - 「string, code default あり(値を後で指定)」
  - 「number / boolean / enum, required(型は後で指定)」
  - 「number / boolean / enum, code default あり(型と値を後で指定)」

Follow up with free text for the concrete type and the default value where applicable. The choice rule from [0030](../../../docs/adr/0030-environment-variable-management.md) §4: a value that is project-specific or varies per environment is **required** (its absence fails the build / server start); a universal framework-level value gets a **code default** in the schema.

### Question 5: Secret label

- Question: 「Secret 管理ラベルを選んでください」
- Options:
  - 「なし(公開値 / 非機微)」
  - 「Secret management required(本番は secret store から供給。平文コミット禁止)」
  - 「Secret management recommended(定期ローテーション推奨)」

For either secret label, the value written into the committed env files is a **placeholder**, never the real secret — production values are supplied from the PaaS env / secret store ([0030](../../../docs/adr/0030-environment-variable-management.md) §5 / §6). Say this to the user rather than asking for the real value.

### Question 6: Description

Free text. The user provides EITHER English OR Japanese (or both); the skill fills in the missing side so both sides of the variable table stay in sync without the user writing it twice.

- 「説明(日本語または英語のどちらか)」
- Notes 欄(任意) — Secret 管理 / 環境依存等の注記。Provided in the same language as the description.

Resolution rules:

- Japanese only → write the Japanese row, translate for the English side.
- English only → the reverse.
- Both → use as-is, no translation.
- Keep translations short and direct, matching the register of surrounding rows. Surface any non-trivial translation in the Step 2 plan for review before writing.

### Question 7: Per-environment values

- Question: 「環境別の値を指定しますか？」
- Options:
  - 「全環境同じ値(または code default で OK)」
  - 「local だけ別の値を入れる」
  - 「prd だけ別の値を入れる」
  - 「環境ごとに個別指定する(追加質問)」

Collect the values per the choice. For `prd`, follow whatever placeholder convention the existing files use (typically a commented-out line) unless the user supplies an explicit value — and always for a secret-labelled variable.

## Step 1. Plan the Insertion Points

Compute each exact insertion point by reading the existing patterns rather than assuming a shape.

### The purpose config module

The purpose directory has a schema module and exactly one corresponding runtime module — `src/config/<purpose>/<purpose>.server.ts` **or** `<purpose>.client.ts`.

1. **Schema validator** — add or extend the named validator in `<purpose>.schema.ts`, using the schema library already used there. Required vs code default follows Question 4.
2. **Environment schema entry** — import and call that validator in the explicit `z.object({...})` declaration in `src/config/environment.ts`.
3. **Config value and getter** — add the typed value and getter in the corresponding runtime module, preserving its private constructor and existing style. Never add a setter or expose a constructor/factory.

Client-module specifics ([0030](../../../docs/adr/0030-environment-variable-management.md) §2): the value **must** be read as a static dot access — `process.env.NEXT_PUBLIC_ANALYTICS_SITE_ID` — literally spelled out. Dynamic indexing and destructuring are forbidden because the build-time literal substitution does not apply to them.

Server-module specifics: `import "server-only"` is already at the top of the file; if it is missing, report that as a defect rather than silently adding a variable to an unguarded module.

### env files

For each of `env/.env.local`, `.env.ci`, `.env.dev`, `.env.stg`, `.env.prd` (use the set that actually exists):

- Locate the section comment for the purpose and append the line under it, preserving the existing alignment and comment style.
- Secret-labelled variables get a placeholder (or a commented-out line), never a real value.

### `env/README.md` — the variable exists (always)

Append a row to the variable table in the matching subsystem section, preserving the column count and order:

```text
|APP_API_BASE_URL|<description>|<type>|<example>|<notes>|
```

Include the secret label in the Notes column when one was chosen. This row is written for **every** variable — including one that no config module reads and one whose value is only ever a placeholder.

### `src/config/README.md` — the config value (config-backed variables only)

Only on the Question-2 "はい" path. Describe the value the way the surrounding entries do: which purpose it belongs to, server or client side, required or code default, and how a consumer receives it. Do **not** restate the env row here (the ownership split is in this skill's opening paragraph). If the config README documents purposes rather than individual values, add nothing and say so in the plan rather than inventing a per-variable section that the file's structure does not have.

### `src/config/environment.fixture.ts` — the whole-set stub (config-backed variables only)

**Every config-backed variable is added here too.** The fixture holds the one list of variables that
passes validation, and it is typed `satisfies Record<keyof Environment, string>` — so a variable
added to `environment.ts` without a fixture entry does not fail where it was written, it fails the
type check of a file the author never opened. Add the key to both objects the fixture exports
(the raw stub set and the parsed result), using a value of the same shape as its neighbours.

Discover the fixture rather than assuming it: it is the file the purpose tests import
`stubValidEnvironment` from. If a future refactor moves or splits it, follow the import.

### Tests

The testing approach for config is **env stub + factory regeneration** (`vi.stubEnv`) — [0030](../../../docs/adr/0030-environment-variable-management.md) 周辺ルール / [0090](../../../docs/adr/0090-testing-strategy.md). If config tests exist in the purpose directory, extend them in lockstep with the production change: a case asserting the new getter, and — for a required variable — a case asserting that its absence fails validation. If no config test file exists yet, skip this and state so explicitly in the Step 2 plan.

## Step 2. Show the Plan and Confirm

Display the whole proposed change set as a Japanese summary — variable name, config-backed or env-only, purpose and target module, server/client side, type, required vs code default, secret label, both descriptions, per-environment values, the file list with what changes in each, and any auto-translation for review. On the env-only path, say explicitly that no config module and no config README entry are involved.

Confirm with `AskUserQuestion`:

- Question: 「以上の内容で適用しますか？」
- Options: 「適用する」 / 「修正したい箇所を指摘する」 / 「キャンセル」

## Step 3. Apply Changes

Use `Edit` with exact anchors derived from the read context (the last existing schema entry / field / getter / table row in the target section). Order:

1. `src/config/<purpose>/<purpose>.schema.ts`, its runtime module, and `src/config/environment.ts` (validator → environment-schema entry → getter) — config-backed path only
2. `src/config/environment.fixture.ts` — config-backed path only
3. The config test file, if one exists
4. env files (one edit per file)
5. `env/README.md`
6. `src/config/README.md` — config-backed path only

If any edit fails, stop and report; do not continue with the remaining files.

## Step 4. Verify

Run the scripts that exist in `package.json`:

```sh
pnpm fix        # absorb formatting
pnpm lint:ci    # includes noProcessEnv — catches process.env read outside src/config/
pnpm typecheck  # the new getter and its type
pnpm build      # build-time validation of the full schema (a missing required var fails here)
```

Run the test script too if the project has one. `pnpm build` is the meaningful gate for this skill: it is where [0030](../../../docs/adr/0030-environment-variable-management.md) §1's full-set validation actually executes.

If a command fails, surface the failure and stop. Do NOT roll back the edits — the user decides whether to fix forward.

## Step 5. Closing

- Print a one-line summary: `<VAR_NAME> を <purpose> に追加。<N> ファイル更新。build OK。`
- Remind the user when the variable is secret-labelled or `prd` was left as a placeholder: the real value must be set in the PaaS env / secret store, which this skill does not touch.
- The skill does NOT commit. Use `/commit` after reviewing.

## AI Modification Scope

Per the "Exception: Skill Execution" clause in `CLAUDE.md` / `AGENTS.md`, the AI modification scope is relaxed during this skill's run, scoped to:

- The env files and `env/README.md`; on the config-backed path also the purpose schema, its runtime module, `src/config/environment.ts`, `src/config/environment.fixture.ts`, its co-located test file, and `src/config/README.md` — or the subset the user confirmed.

Remains protected:

- `next.config.ts` / `instrumentation.ts` / `biome.json` and everything else outside `src/config/` + `env/`.
- Accepted ADR bodies, `AGENTS.md`, `LICENSE`.

## Constraints

- ❌ Run at all when `src/config/` does not exist (report instead — building the kernel is a separate change)
- ❌ Hardcode the purpose list, the schema library, or the env-file set — always derive them from the live tree
- ❌ Put a secret behind `NEXT_PUBLIC_`
- ❌ Write a real secret value into a committed env file
- ❌ Add a setter to a config object, or create a facade that aggregates purposes
- ❌ Use dynamic access or destructuring for `NEXT_PUBLIC_` values in a client module
- ❌ Spread one variable across more than one purpose module
- ❌ Skip the `env/README` row because the variable has no config module — env owns existence, config-less variables included
- ❌ Duplicate the env variable-table content into the config README (or the reverse) — the two documents own different things
- ❌ Skip the spec-confirmation `AskUserQuestion`, or apply changes without showing the plan first
- ✅ Japanese user-facing output
- ✅ Preserve formatting in env files (alignment, comment style) and README tables (column count and order)
- ✅ Run `pnpm fix` + `pnpm lint:ci` + `pnpm typecheck` + `pnpm build` after the writes
- ✅ Surface any verification failure; do not auto-rollback

## Checklist

Before reporting completion, confirm:

- [ ] `src/config/` exists and the purpose inventory was read from it (not assumed)
- [ ] Variable name confirmed and validated against `{SUBSYSTEM}_{NAME}` (or a justified standard-name exception)
- [ ] Config-backed vs env-only confirmed, and the reach of the change matches it
- [ ] Server / client side confirmed, and consistent with the presence or absence of `NEXT_PUBLIC_`
- [ ] Secret label confirmed; no secret was placed behind `NEXT_PUBLIC_`, and no real secret value was written to a committed file
- [ ] Type and required-vs-code-default confirmed
- [ ] Description provided in one language; the other side was translated and surfaced in the plan for review
- [ ] Per-environment values resolved
- [ ] The full plan was displayed and the user approved it
- [ ] Config-backed path: exactly one purpose module updated (schema entry + private field + getter, no setter)
- [ ] Client-module values use static dot access only
- [ ] All existing env files updated under the matching section
- [ ] `env/README.md` got its variable-table row (always)
- [ ] `src/config/README.md` updated on the config-backed path, without restating the env row
- [ ] Config-backed path: the key was added to `src/config/environment.fixture.ts` as well
- [ ] Config tests updated, or their absence stated explicitly
- [ ] `pnpm fix` / `lint:ci` / `typecheck` / `build` were run and the results reported
- [ ] No commits / pushes were performed
- [ ] Final summary is in Japanese
