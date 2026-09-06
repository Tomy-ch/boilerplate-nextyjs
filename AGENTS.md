<!-- BEGIN:nextjs-agent-rules -->
# Agents Documentation

Repository rules for **AI coding agents** (Claude Code / Codex / Copilot / Gemini, etc.) working in this repo.

## Project Overview

This repository is a **Next.js / React presentation-layer boilerplate**.

- **Role**: Frontend presentation layer
- **Target deployment**: PaaS (Vercel / Netlify / AWS Amplify / Cloudflare Pages) or static CDN
- **Backend** (DB / authentication / business logic) is operated as a separate repository / service

See [docs/adr/0011-no-docker.md](docs/adr/0011-no-docker.md) for details.

### This is NOT the Next.js you know

This project adopts Next.js 16 / React 19, so APIs, conventions, and file structure may differ from your training data. Before writing any code, read the relevant guide under `node_modules/next/dist/docs/` and heed deprecation notices.

The rendering model is where stale assumptions do the most damage — `"use client"` is a bundle boundary, not a "render on the client" instruction, and Client Components are still server-rendered. [docs/design/rendering.md](docs/design/rendering.md) collects the terms and the mistakes they cause, with commands to verify each claim yourself. Subject-scoped design references live under [docs/design/](docs/design/README.md).

## Temporary Operating Rules until v1.0.0

> **TEMPORARY SECTION — delete it when v1.0.0 ships** (このセクションは v1.0.0 時には消すこと)
>
> Process source of truth: [docs/plan/v1-implementation-plan.md](docs/plan/v1-implementation-plan.md) §2.

While the repository sits below v1.0.0, the constraints below are **temporarily lifted**. The reason is that v1 implementation concretizes the whole design, and taking per-change approval would stall the process.

- **Direct edits to Protected Documentation are allowed** — `AGENTS.md` (this file) / Accepted ADR bodies / `LICENSE` may be edited without per-change user approval
- **The protected paths under AI Modification Scope are lifted** — `package.json` / `tsconfig.json` / `next.config.ts` / `mise.toml` / `biome.json` / `Makefile` / `.makefiles/` / `.github/` / `.claude/` may be edited directly
- **ADRs stay living documents and are overwritten in place** — ADR [0140](docs/adr/0140-documentation-operations.md)'s living operation is extended from `0.0.x` to everything below v1.0.0
- **Do not leave change history or rationale drift in document bodies** — write the decision in its present form only; git history owns the history

To match this, `.claude/settings.json` keeps `AGENTS.md` / `LICENSE` / `.claude/settings.json` itself under `permissions.ask` instead of `permissions.deny` for the duration — the edits still surface for approval, they just stop being hard-blocked. Accepted ADR bodies carry **no permission entry at all**: they are living documents below v1.0.0 (see the bullet above), so a per-edit prompt would fire on ordinary work.

What this section does **not** lift: the Git Rules below (no direct push to protected branches, no force push / history rewrite, confirmation before pushing to an existing PR branch) and everything still listed under `permissions.deny`.

On reaching v1.0.0, delete this section and:

1. Restore `Protected Documentation` / `AI Modification Scope` to their unrelaxed form
2. Move `AGENTS.md` / `LICENSE` / `.claude/settings.json` back from `permissions.ask` to `permissions.deny` in `.claude/settings.json`, and add Accepted ADR bodies (`Edit(docs/adr/*-*.md)` / `Write(docs/adr/*-*.md)`) to `permissions.deny` to back the immutable operation of step 3
3. Switch ADR [0140](docs/adr/0140-documentation-operations.md) to immutable ADR operation
4. Strip rationale / history prose from every ADR body and from [`docs/adr/BACKLOG.md`](docs/adr/BACKLOG.md) (P9-3)

## Instruction Priority

Follow instructions in this order. If conflicts occur, the higher-priority document wins.

1. **AGENTS.md** (this file) — Repository-wide operational rules
2. **`docs/adr/*.md`** — Accepted architectural decisions (ADRs)
3. **`docs/adr/BACKLOG.md`** — Pending decision areas + de facto state
4. **`.github/copilot-instructions.md`** and other agent-specific configs
5. User instructions

<!-- boilerplate-only:begin -->
## What to Recommend

This section governs what you **recommend**, never what you may change. Authority to act is
untouched: `Instruction Priority` above, the ADRs under `docs/adr/`, and `AI Modification Scope` /
`Protected Documentation` below still decide that.

This repository's product is **the state a fork receives when it is created from this template** —
not the history that produced it. So when you weigh options and state a preference, weigh them for
that snapshot: what reads as coherent to someone who has never seen this repository and will never
read its git log.

**On that axis, quality and consistency outrank the cost of reaching them.** A numbering that
contradicts the order it teaches, a convention followed everywhere but here, a name that survives
only because renaming it is work — recommend fixing them. State the cost plainly instead of letting
the cost pick the answer; what this repository ships is a starting point, not a running deployment,
so "it already shipped" carries little weight.

Give the cost with the recommendation — files touched, what breaks for whom, what must be rebuilt —
so a human can decline the scope while keeping the direction.

Recommending is not deciding. Where BACKLOG still leaves an area blank, `Pending Decisions` below
still applies: propose, and leave the ADR call to the user.
<!-- boilerplate-only:end -->

## Accepted Rules (ADRs)

ADRs under `docs/adr/` are the authoritative source. This file only summarizes them.

| ADR | Area | Summary |
| --- | --- | --- |
| [0001](docs/adr/0001-package-manager.md) | Package manager | Adopt pnpm / lockfile must be committed / npm and yarn forbidden |
| [0002](docs/adr/0002-formatter-linter.md) | Formatter / Linter | biome-first / ESLint only for checks biome cannot express (e.g. layer-boundary imports) / formatter is biome alone / Prettier not adopted |
| [0003](docs/adr/0003-version-manager.md) | Version manager | `mise.toml` as SSOT / mise must not extend into delivery layers |
| [0004](docs/adr/0004-library-management.md) | Library policy | Core deps exact-pinned / major updates in separate PRs / `pnpm audit` required |
| [0010](docs/adr/0010-standards-and-non-lockin.md) | Design principle | Standards conformance & non-lock-in (permanent meta judgment axes) |
| [0011](docs/adr/0011-no-docker.md) | Delivery / Role | Next.js as presentation layer / no Docker for app delivery / environment definitions (stand-alone vs cloud) |
| [0020](docs/adr/0020-adopted-architecture.md) | Architecture pattern | Adopted architecture / inward dependency / structural boundary types / no type leakage |
| [0021](docs/adr/0021-frontend-responsibility.md) | Frontend responsibility | Layer responsibilities / kernel naming discipline / import boundaries |
| [0022](docs/adr/0022-capabilities-kernel.md) | `capabilities` kernel | Cross-cutting client-hook kernel |
| [0023](docs/adr/0023-stores-kernel.md) | `stores` kernel | cross-cutting client-state kernel |
| [0024](docs/adr/0024-adapters-server-client-split.md) | adapters split | server/client split / client-side external-connection boundary |
| [0025](docs/adr/0025-app-layer-elements.md) | app layer elements | Route Handler / metadata element composition |
| [0026](docs/adr/0026-layout-shell-mount.md) | Layout shell mount | cross-cutting UI / Provider mount (app shell composition) |
| [0027](docs/adr/0027-directory-structure.md) | Directory structure | Physical layout under `src/` / co-location policy |
| [0028](docs/adr/0028-naming-convention.md) | Naming convention | All-source kebab-case files / identifier casing / route segments / env `{SUBSYSTEM}_{NAME}` |
| [0029](docs/adr/0029-type-design-discipline.md) | Type design | Discriminated union / parse at the boundary / branded id / `satisfies` |
| [0030](docs/adr/0030-environment-variable-management.md) | Env variables | `env/` structure / typed config loader / `NEXT_PUBLIC_` boundary / secrets |
| [0031](docs/adr/0031-policy-state-supply.md) | Policy state supply | consent / feature-flag state supply policy |
| [0040](docs/adr/0040-routing-rendering-strategy.md) | Routing / rendering | App Router / Server vs Client Components / CSR-SSR-SSG-ISR / Server Actions |
| [0041](docs/adr/0041-cache-components-decision.md) | Cache Components (PPR) | enablement decision |
| [0042](docs/adr/0042-react19-rendering-api.md) | React 19 rendering API | rendering API conventions |
| [0043](docs/adr/0043-middleware-policy.md) | Middleware (proxy) | Middleware policy |
| [0044](docs/adr/0044-seo-metadata-strategy.md) | SEO / metadata | metadata API strategy |
| [0045](docs/adr/0045-fonts-and-images.md) | Fonts / images | `next/font` / `next/image` policy |
| [0050](docs/adr/0050-styling-strategy.md) | Styling strategy | Tailwind v4 + design tokens / `cn()` helper / CSS Modules limited allowance |
| [0051](docs/adr/0051-styling-system.md) | Styling system | design tokens / responsive / motion (Framer Motion) / print |
| [0052](docs/adr/0052-ui-component-policy.md) | UI component policy | shadcn/ui + lucide adopted |
| [0053](docs/adr/0053-ui-component-interaction-seam.md) | UI interaction seam | UI component policy + interaction a11y seam |
| [0054](docs/adr/0054-ui-catalog-storybook.md) | UI catalog | Storybook policy |
| [0060](docs/adr/0060-state-management.md) | State management | react-hook-form / Zustand adopted / server-state policy |
| [0061](docs/adr/0061-form-mutation-ux.md) | Form submission UX | `<form action>` + `useActionState` + `useFormStatus` canonical mechanism |
| [0062](docs/adr/0062-form-input-validation.md) | Form validation UX | client validation / generated-zod reuse boundary |
| [0063](docs/adr/0063-mutation-result-notification.md) | Mutation notification | inline / toast / redirect + live-region UX |
| [0070](docs/adr/0070-backend-role-separation.md) | Backend role | Next.js responsibility line / backend contract / domain-logic placement |
| [0071](docs/adr/0071-bff-api-integration.md) | BFF / API integration | `/api/*` scope / external API clients / fetch wrapper |
| [0072](docs/adr/0072-api-type-generation.md) | API type generation | Generated from OpenAPI/GraphQL / generated-artifact "do not edit" rules |
| [0073](docs/adr/0073-pagination-fetch-boundary.md) | Pagination fetch | pagination / infinite-scroll data-fetch boundary |
| [0074](docs/adr/0074-runtime-communication-seam.md) | Realtime comm seam | WebSocket / SSE seam |
| [0075](docs/adr/0075-file-upload-seam.md) | File upload seam | presigned direct PUT default / multipart proxy exception |
| [0076](docs/adr/0076-payment-ui-seam.md) | Payment UI seam | mount seam & PCI boundary |
| [0077](docs/adr/0077-bff-abuse-protection-boundary.md) | BFF abuse protection | infra / edge seam boundary |
| [0078](docs/adr/0078-dynamic-feature-flag-seam.md) | Feature-flag seam | dynamic feature flag / staged rollout (A-B) seam |
| [0079](docs/adr/0079-auth-frontend-seam.md) | Auth frontend seam | authentication front-side seam / relay credentials without verifying or knowing the IdP, own the sign-in screens |
| [0080](docs/adr/0080-error-handling.md) | Error handling | `error.tsx`/`not-found.tsx` responsibilities / backend-error normalization |
| [0081](docs/adr/0081-observability-logging.md) | Observability / logging | OTLP / OTel vendor-neutral (Sentry not adopted) / structured logs |
| [0082](docs/adr/0082-client-observability.md) | Client observability | Web Vitals RUM / client error collection / analytics seam |
| [0090](docs/adr/0090-testing-strategy.md) | Testing strategy | Framework selection / per-layer responsibilities / co-location |
| [0091](docs/adr/0091-test-verification-methods.md) | Test verification | async RSC test placement / a11y automated-test integration |
| [0100](docs/adr/0100-accessibility-target.md) | Accessibility target | Target conformance level |
| [0101](docs/adr/0101-performance-budget.md) | Performance budget | Core Web Vitals budget |
| [0102](docs/adr/0102-browser-support.md) | Browser support | Support matrix |
| [0110](docs/adr/0110-security-operations.md) | Security ops | Dependabot + cooldown / gitleaks secret scan (fail-closed) / vulnerability scan is report-only / suppression-policy format |
| [0111](docs/adr/0111-csp-security-headers.md) | CSP / security headers | runtime CSP & security headers |
| [0112](docs/adr/0112-data-classification-cache-boundary.md) | データ分類 / キャッシュ境界 | PII・user-scoped・secret の置き場 / 分類は取得の口が持つ / 段ごとの関所 |
| [0120](docs/adr/0120-locale-aware-formatting.md) | Locale formatting | date/number formatting + date-fns date arithmetic |
| [0121](docs/adr/0121-i18n-strategy.md) | i18n (exclusion) | i18n not adopted (negative decision) |
| [0130](docs/adr/0130-pwa-strategy.md) | PWA (exclusion) | PWA not adopted (negative decision) |
| [0131](docs/adr/0131-cookie-consent.md) | Cookie consent (exclusion) | Consent management not adopted (negative decision) |
| [0140](docs/adr/0140-documentation-operations.md) | Documentation ops | Japanese canonical on suffix-less paths below v1.0.0 / EN canonical + `.ja.md` mirror from v1.0.0 |
| [0141](docs/adr/0141-portal-operations.md) | Portal ops | `docs/portal/manifest.yaml` curation |
| [0142](docs/adr/0142-license.md) | License | MIT / OSS contribution policy / `private` flag alignment |
| [0150](docs/adr/0150-git-workflow.md) | Git workflow | Branch strategy / commit convention / PR operations / release process |
| [0151](docs/adr/0151-git-hooks.md) | Git hooks | pre-commit / pre-push via lefthook |
| [0152](docs/adr/0152-agents-md-policy.md) | AGENTS.md policy | File placement / language / 13-section structure / Instruction Priority / `## [TODO]` convention |
| [0153](docs/adr/0153-ci-configuration.md) | CI configuration | GitHub Actions job partitioning / workflow-definition lint (actionlint / zizmor) / hooks mirror CI / required checks / caching |
| [0154](docs/adr/0154-claude-skills-operations.md) | Claude skills (operations) | Operational skill placement / naming / frontmatter / commercial-action confirmation |
| [0155](docs/adr/0155-claude-skills-development.md) | Claude skills (development) | Development skill placement / subagent pattern / `new-env` target structure |
| [0156](docs/adr/0156-browser-observation-tooling.md) | Browser observation tooling | Three lanes (see / measure / dig) / CLI only, no MCP registration / no real-profile access / gates untouched |

> **ADR numbering is finalized (2026-07-14): topical decade-bands.** Numbers are grouped by subject into decade bands (e.g. `002x` architecture, `004x` routing/rendering, `005x` styling/UI, `007x` data/BFF, `008x` error/observability, `015x` process/dev-ops); the former `Toolchain-` / `Dev-` prefixed ADRs were folded into the numeric sequence (`0150`+). Gaps between bands are reserved for future insertion. Each ADR body remains authoritative.

## Pending Decisions

The major design decisions are now settled as ADRs (`0001`–`0156` across topical bands; the A / B / C / D groups are all authored, including the negative "exclusion" decisions). The `## [TODO]` placeholder sections that this file used to carry — one per undecided area, each with its own "provisional behavior" — have been removed because the corresponding ADRs are now authoritative. The remaining blank slots and not-yet-written design seams are tracked in [`docs/adr/BACKLOG.md`](docs/adr/BACKLOG.md); the ADR bodies are the source of truth and this file only summarizes them.

When a change forces you into an area that BACKLOG still leaves blank (no accepted ADR yet):

1. **Do not introduce new conventions, patterns, or libraries on your own**. Defer the ADR decision to the user
2. If a provisional implementation is unavoidable, explicitly tell the user it is a "provisional implementation" before starting work

## AI Modification Scope

By default, AI agents may modify code only in the following scope. All other paths require an explicit user instruction.

> Below v1.0.0 the protected paths in this section are lifted — see "Temporary Operating Rules until v1.0.0" above.

### Allowed

- Under `src/`
- `public/` (asset additions)
- `docs/adr/BACKLOG.md` (progress tracking / adding new slots; ADR file creation requires a prior user instruction)

### Do not touch without user instruction

- Repository-root config files: `package.json` / `pnpm-workspace.yaml` / `tsconfig.json` / `next.config.ts` / `mise.toml` / `biome.json` / `postcss.config.mjs` / `Makefile`, etc.
- `.makefiles/` (release / branch operation make targets)
- `.github/` (workflows / settings / issue and PR templates)
- `LICENSE`
- Accepted ADR bodies (`docs/adr/0001-*.md` and onward, with Status: Accepted)

### Agent configuration file protection

Each agent's configuration must not be touched even by that agent itself. Modification requires an explicit user instruction:

- Claude Code: `.claude/` (`.claude/skills/` / `.claude/settings.json` / `.claude/settings.local.json`, etc.)
- OpenAI Codex CLI: `.agents/skills/`
- Cursor: `.cursor/` (including `.cursor/rules/*.mdc`) / `.cursorrules`
- GitHub Copilot: `.github/copilot-instructions.md` / `.github/instructions/` / `.github/prompts/`
- Gemini CLI / Code Assist: `.gemini/` / `GEMINI.md`

This file (`AGENTS.md`) is shared **Protected Documentation** across all agents (see the later "Protected Documentation" section).

### Exception: Skill Execution

When the user invokes a skill (e.g., Claude Code's `/<skill-name>`), the invocation itself counts as an **explicit instruction**. While the skill runs, AI Modification Scope is relaxed strictly within the scope the skill's `SKILL.md` declares.

Conditions:

- The relaxation applies **only for the duration of the skill execution**, only within the scope the skill declares
- The skill's `SKILL.md` user-confirmation instructions (e.g., confirm before editing specific paths) must still be honored
- The following remain protected **even during skill execution**:
  - `AGENTS.md` (this file)
  - Accepted ADR bodies
  - `LICENSE`
  - Paths listed under `.claude/settings.json`'s `permissions.deny`

Bypassing the spirit of these rules through a skill is forbidden. If a skill's procedure touches sensitive areas (e.g., `.github/workflows/`), the skill's `SKILL.md` must declare this so the user is aware when invoking it.

## Recommended Commands

Run every command below **bare. `mise exec -- <command>` is forbidden outright** — in what you type, in
`.lefthook.yaml`, in `.makefiles/` recipes, anywhere ([0003](docs/adr/0003-version-manager.md)). The
toolchain resolves through an activated mise on `PATH`, so a command has exactly one spelling and the
same one everywhere. A wrapper only hides a broken environment behind a per-call workaround, and it
takes the failure — a stale `PATH`, a missing `make install-tools` — with it, so the next caller who
forgets to wrap hits it instead.

If a bare command resolves to a tool outside mise, the fix is `PATH`, not a wrapper — a stray pnpm one
major ahead of the pin fails the script and rewrites the tracked `pnpm-workspace.yaml` on its own (see
the `repo-ops` skill).

### pnpm (ADR 0001)

```bash
pnpm install               # Install dependencies
pnpm add <pkg>             # Add a runtime dependency
pnpm add -D <pkg>          # Add a dev dependency
pnpm add -E <pkg>          # Add with exact pin (for core deps / main dev tools, 0004)

pnpm dev                   # Start the dev server
pnpm build                 # Production build
pnpm start                 # Start the production server

pnpm gen <kind> <name>     # Scaffold a feature / component / adapter (ADR 0027 / 0028)

pnpm lint                  # biome check, light profile (ADR 0002). biome だけ — ESLint は含まない
pnpm lint:ci               # biome (full profile) + ESLint + 境界の突合。pre-commit / CI が回すのはこちら
pnpm typecheck             # tsc --noEmit (pre-push)
pnpm fix                   # biome check --fix
pnpm format                # biome format --write
```

### make (Tool setup / security scans / release / branch operations)

```bash
make install-tools         # Install tools via mise (ADR 0003)
make help                  # List every make target (warns on undocumented ones)
make actionlint            # Lint .github/workflows with actionlint (ADR 0153)
make actions-zizmor        # Static-analyse the Actions definitions with zizmor (ADR 0153)
make actions-pin-resolve   # Resolve every `uses:` comment tag to a SHA into the lockfile (ADR 0153)
make actions-pin-apply     # Rewrite every `uses:` @<sha> from the lockfile
make actions-pin-check     # Verify the pins match the lockfile — fails on drift (pre-commit / CI)
make images-pin-resolve    # Resolve every container image tag to a digest into the lockfile (ADR 0011)
make images-pin-apply      # Rewrite every image reference from the lockfile
make images-pin-check      # Verify the image pins match the lockfile — fails on drift (pre-commit / CI)
make vrt                   # Compare every Storybook story against its baseline image (ADR 0091)
make vrt-review            # Open the stories CI flagged, in a throwaway worktree — the line the PR comment prints
make vrt-update            # Retake the story baselines locally — does NOT push them to the store
make vrt-retake            # Retake and push. The only local entry point; the `baseline-retake` label is the default path
make e2e                   # Drive the built app through its journeys and compare each screen (ADR 0090 / 0091)
make e2e-maintenance       # Boot with delivery stopped and check the stop mechanism holds (ADR 0043)
make e2e-metadata          # Build with indexing on and check the public surface holds — robots / sitemap / canonical / OG (ADR 0044)
make e2e-review            # Same, for the screens CI flagged — starts the production build, not the dev server
make review-clean          # Remove the throwaway worktrees the two review targets left under tmp/review/
make e2e-update            # Retake the screen baselines locally — same split as vrt-update
make e2e-retake            # Retake and push the screen baselines
make baseline-push         # Push retaken baselines to the store and advance the submodule pointer
make secret-scan           # gitleaks over the commits about to be pushed — fails on detection (ADR 0110)
make secret-scan-history   # gitleaks over the whole history — the weekly CI pass, never the hook
make trivy-fs              # Trivy dependency vulnerability scan — on demand, report only (ADR 0110)
make trivy-fs-release      # Same, strict (keeps unfixed findings). The promotion gate CI runs
make audit                 # Dependency audit gate — fails on a fixable high / critical (ADR 0110)
make sast                  # Opengrep over this repo's own source — zero-finding gate (ADR 0110)
make osv-scan              # Dependency vulnerabilities via the OSV database — report only
make osv-scan-release      # Same, as the promotion gate. Fails on a finding
make bearer-scan           # Where a value leaves the process, against what the value is
make dast                  # Drive HTTP at the running app with OWASP ZAP (ADR 0110 §3.5)
make test-cached           # Default. Same tests through Vitest's cache — the pre-commit variant
make test-full             # Full run with coverage against the 100% threshold (ADR 0090). The gate
                           #   itself — leave it to the hook and CI rather than running it by hand
make load-status           # Show the current gate band and why (ADR 0151)
make hotfix-patch          # Create a hotfix/v<patch> branch from production
make tag-patch             # Tag production HEAD and create a GitHub Release
make tag-minor             # Same (minor)
make tag-major             # Same (major)
```

For release branches, follow 0150 (`git switch -c release/v<X.Y.Z> origin/production`).

See [`.makefiles/README.md`](.makefiles/README.md) for details.

### Do not pre-run the gates

**The hooks and CI run these for you, and CI is the authority** ([0151](docs/adr/0151-git-hooks.md)).
`pre-commit` already runs the full lint profile and the cached tests; `pre-push` adds the type check,
the full test run, and the secret scan. Running the same commands by hand before committing does not
make the result more true — it only spends the time twice, and on a busy host the duplicate run is
itself a source of failures that have nothing to do with the change.

So: **commit, push, and read the verdict from the hook or CI.** Re-running a single file you just
edited is fine; sweeping the whole suite, or the whole lint, is not.

`make load-status` prints which gates run locally right now. When the host is loaded the band shifts
and the heavy gates are delegated to CI automatically — that decision is measured, not guessed, so
do not pre-empt it with `--no-verify`. Bypassing is governed by 0151's bypass policy, not by how
slow the gate feels.

## Git Rules

[0150](docs/adr/0150-git-workflow.md) is authoritative. Key points only.

### Critical Rules

1. **No direct push** to protected branches (`production` / `staging` / `develop` / `release/**` / `hotfix/**`)
2. **No force push / rebase / squash** unless the user explicitly instructs it
3. After amending commits on an existing PR branch, **confirm with the user before pushing**. Use this exact confirmation message: 「変更はローカルにコミット済みです。これらの変更をプルリクエストにプッシュしますか？」
4. History rewrites (`git commit --amend` + force push / `git rebase`) are forbidden. Stack fixes as **new commits**.

### Branch Naming

```text
feature/<issue-no>-<kebab-description>     e.g., feature/1234-add-login-form
bugfix/<issue-no>-<kebab-description>      e.g., bugfix/5678-fix-route-handler
hotfix/<issue-no>-<kebab-description>      e.g., hotfix/9012-cache-invalidation
release/v<X.Y.Z>                            e.g., release/v0.1.0
```

If no issue number exists, use only `<kebab-description>`.

### Commit Convention

All commit subjects start with one of the following prefixes:

```text
Feat | Fix | Refactor | Perf | Docs | Test | Build | CI | Chore | Style | Revert
```

Format: `<Prefix>: <Japanese subject>` (no trailing period `。` on the subject).

Examples:

```text
Docs: ADR 0011 を Type A / Type B 区別で補強
Build: Dockerfile を削除し pnpm 採用方針と整合させる
Fix: route handler の query 取得を Next.js 16 API に合わせる
```

### Pull Request

- Fill in `概要` / `変更内容` / `動作確認方法` of the template (`.github/pull_request_template.md`)
- Titles are in Japanese
- Default merge strategy is **merge commit** (`squash` is exceptional)
- A push to an existing PR auto-dismisses prior approvals — request re-review after pushing

### Cross-Repository Links

**Linking to another repository's issue / PR — always go through `redirect.github.com`.**
This repository is public, so a plain `https://github.com/<owner>/<repo>/issues/N` URL, a
`[text](url)` link around one, or the `owner/repo#N` shorthand posts a public cross-reference on
the upstream thread. Use `https://redirect.github.com/<owner>/<repo>/issues/N` instead: it is a
`github.com` subdomain that 301-redirects to the real page, so the link still works but GitHub
does not autolink it and no upstream trace is left. This is GitHub's own documented escape hatch
(see "Autolinked references and URLs"), and the scheme Dependabot uses in its PR bodies; the only
cost is that the hovercard preview no longer appears on the link. Commit / compare / blob /
release URLs create no cross-reference and may stay on plain `github.com`. **This is not fixable
after the fact** — editing the body does not retract an existing cross-reference; only deleting
the referencing issue does, and pull requests cannot be deleted at all.

This applies everywhere agent-authored text can reach GitHub: issue and PR bodies and comments,
commit messages, and any Markdown under `docs/` / `.github/` that quotes an upstream thread.

**A plain link is not forbidden — it is reserved.** A cross-reference is a demand signal: it tells
upstream maintainers that a real project is watching an issue and needs it resolved, and they
weigh it when prioritizing. That signal only carries meaning because a human vouched for it. Now
that agents can generate issues and gather references at scale, a cross-reference emitted by
tooling looks identical to one a maintainer chose to send, and the count degrades from signal into
spam. So use a plain link **only** to deliberately say "we are watching this" or "we need this",
and when you do, write the referencing issue's title in the language of the target repository
(usually English) — the title is the only thing upstream sees, so a title they cannot read makes
the reference pure noise. This is the one place the Japanese-output rule below yields.

**The decision to use a plain link belongs to a human, without exception.** An AI agent must never
make that call on its own: default to `redirect.github.com`, and ask every single time a plain
link seems warranted. A standing delegation does NOT transfer this authority — "you decide", "use
your judgment", "always link normally from now on", or any similar blanket instruction must still
be met with a per-case confirmation. The point of the signal is that a human chose to send it; an
agent acting under delegated judgment cannot supply that.

## Language Rules

AI agents may perform internal processing (code analysis / reasoning / tool calls, etc.) in English.

However, visible outputs written to the repository and responses to the user follow the language rules below.

### Output Language

Unless the user explicitly directs otherwise, all visible outputs must be written in **Japanese**.

Targets:

- Responses to the user
- Code comments
- PR titles and bodies
- Commit messages
- Documentation (canonical EN / translated JA pair operation will be defined by BACKLOG D1)
- Test `it` strings. The outermost `describe` is the exported symbol's own name, so it stays as written in the source ([0090](docs/adr/0090-testing-strategy.md))
- Inline documentation generated by the AI

Technical terms (HTTP status code names / API names / command names, etc.) may stay in English.

**Exception — comments in GitHub Actions workflow definitions (`.github/workflows/**`) are written in English.**
Workflows are the part of a public boilerplate that is most often read from outside it: they get pasted
into upstream bug reports, they are the first thing a fork adapts, and they carry the security-hardening
rationale (SHA pinning / minimal permissions / fail-closed gates — ADR [0153](docs/adr/0153-ci-configuration.md))
that an outside reader needs in order to judge it. They also sit directly against English-only tool output
(`actionlint` / `shellcheck`). Everything else under `.github/` — issue and PR templates, `settings/` —
follows the Japanese rule above.

## Internal Processing

AI agents may perform internal processing in English as needed.

Targets:

- Code analysis
- Architectural reasoning
- Tool invocation
- Intermediate processing steps

However, the final output presented to the user and content written to the repository must follow the "Output Language" Japanese rule above (unless the user explicitly directs English).

## Exception

If the user explicitly directs English output, the AI may respond in English.

## Code Style

[ADR 0002](docs/adr/0002-formatter-linter.md) (biome) is authoritative. Run before committing:

```bash
pnpm fix       # Auto-fix
pnpm lint:ci   # Check remaining errors (same as the pre-commit hook)
```

Fix items the auto-fixer could not handle by hand.

**`pnpm lint` は biome だけで、`lint:ci` はその後に ESLint と境界の突合を続けて回す。** react hooks の規則
（render 中の ref 書き込み・effect 内の setState）と型アサーションの禁止は **ESLint 側にしか無い**ため、
`pnpm lint` が通っても `lint:ci` は落ちうる。手元で確かめるなら、対象を絞って `pnpm exec eslint <path>` を
掛ける（[0002](docs/adr/0002-formatter-linter.md) の能力ベース分担）。

### Disallowed

- Using Prettier (the formatter is biome alone — ADR 0002)
- Adding ESLint rules that biome can express, applying preset bundles (`eslint:recommended` / `eslint-config-next`), or using ESLint as a formatter (ADR 0002: capability-based split — biome-first, ESLint only fills the checks biome cannot express, e.g. layer-boundary imports)
- Locally disabling biome's formatter / linter for case-specific reasons (require ADR revision and consensus instead)
- Heavy use of `biome-ignore` comments (consider scoped `overrides` first)

## Review Phase Protocol

A request to review work that has already been implemented — 「レビューして」 or any equivalent —
names **three** subjects this repository ships a skill for, not one:

| Skill | Subject |
| --- | --- |
| `/impl-review` | the change itself — correctness / security / architecture / runtime gap |
| `/test-review` | the tests that pin the change down |
| `/comment-sweep` | the comment stock carried by the files the change touched |

Do not silently pick one. **Estimate each skill's return from the context you already hold** — which
layers the change touched, whether tests or comments moved at all, what an earlier skill in this
session already covered — then **ask the user per skill whether to run it, stating that estimate and
its reason**, and run what they approve.

The estimate is the work. 「三つとも回しますか」 is not a question; it hands the cost back to the user
unpriced. Say which pass you expect to pay off, which you expect to return nothing, and why.

The three are **peers, and none of them invokes another.** Each is asked for, decided, and run beside
the others — one subject to one skill, and that skill is the only place its subject is audited.

A skill that offers to run the next one reads as convenience, and it costs more than it saves: the
subjects stop being independently answerable, a drift in the entry skill's question silently removes
the other two from every flow that went through it, and the user's decision about one subject arrives
buried inside a run they started for another. Keep the coupling in the *asking*, where this protocol
puts it, and out of the skills.

So `/impl-review` audits the change and nothing else — it owns no test lens and no comment lens, and
it hands nothing off. `/test-review` and `/comment-sweep` are invoked in their own right, whether or
not `/impl-review` runs.

## Protected Documentation

The following files require deliberate human review before modification:

- `AGENTS.md` (this file)
- Accepted ADR bodies (`docs/adr/0001-*.md` and onward, with Status: Accepted)
- `LICENSE`

When a change to one of these appears necessary:

1. Do not edit directly; present the proposed change to the user
2. Edit only after the user explicitly approves

> Below v1.0.0 this approval requirement is lifted — see "Temporary Operating Rules until v1.0.0" above.

Even when a new file appears necessary, **prefer modifying an existing file** if it suffices.
<!-- END:nextjs-agent-rules -->
