---
name: readme-review
description: Review a single canonical README and judge whether it has "manual-worthy" characteristics for inclusion in the portal manifest curated per ADR 0141. The evaluation criteria are derived from patterns observed in currently-registered manifest entries (役割と境界 / 設計判断 / 規約 / 実行機序 / 索引 / 運用 / substantive prose), and exclude the two shapes that are deliberately not portal content: the per-component reference READMEs Storybook and TSDoc already carry, and feature slices graded by their own required-section check. Produces a scorecard with strengths, gaps, concrete improvement suggestions, and a final classification (manual-worthy / borderline / not-yet-manual-grade / out-of-scope-for-portal). Read-only by default; never edits the README or the manifest. For a README under `src/features/`, it additionally grades the required sections a feature README must carry (route + contract, state-to-story map, kernel dependencies, Server Action contract, test viewpoints), reading that list from `docs/templates/feature-readme.md` at runtime and resolving every story id, operationId, spec link and Action name the README asserts; a missing or thin required section caps the verdict at `borderline`. When the result is manual-worthy, the skill suggests chaining into `portal-manifest-sync` (curation flow) as the natural next step; it does not perform the addition itself.
---

# Readme Review

This skill evaluates a single README against the patterns that define "manual-worthy" content in this repo's portal, then produces a structured scorecard the user can act on (improve the README, add it to the manifest, or leave it out of the portal entirely).

A Japanese reference translation of this skill is available at `SKILL.ja.md` in the same directory (not loaded as a skill; for human reference only).

## When to Use

Use this skill when:

- You wrote a new README and want to know whether it's polished enough for the portal manual.
- `portal-manifest-sync` surfaced a README under `borderline` or `not-yet-manual-grade` and you want a deeper, per-criterion read before deciding to add or improve.
- You suspect a README is documenting a component's surface, which Storybook and its TSDoc already carry, rather than something the portal should expose.
- You want a checklist of what's missing from a thin README before extending it.

Do NOT use this skill for:

- Mass-reviewing the entire repo — use `portal-manifest-sync` for the high-level four-class classification (which applies the same criteria defined here, batched, after filtering out the component references and routing feature slices to Step 2b). Use this skill for individual deep dives on borderline cases.
- Editing the README content — use `sync-readme` (drift fixes) or hand-edit.
- Adding to the manifest — chain into `portal-manifest-sync` (curation flow) after this skill's verdict.

## Source-of-Truth Role for Other Skills

The criteria defined below (Step 2: P1–P7 / N1–N4 / four-class thresholds) are referenced by `portal-manifest-sync` at runtime to perform batch classification. **Do not duplicate the criteria there.** If the criteria need to evolve (e.g., a new positive observation pattern emerges from manifest entries), edit this SKILL.md and the change propagates automatically.

This skill remains the canonical place to invoke for **deep-dive single-file analysis** — full scorecard with strengths, gaps, concrete improvement suggestions, and the recommended next action. `portal-manifest-sync` produces only a per-file one-line rationale to keep the batch report readable.

## How the Criteria Were Derived

The evaluation pattern is not hardcoded from theory — it was read off the entries currently in
`docs/portal/manifest.yaml`, which are the only worked examples of "this belongs in the manual" that
this repository has. What those 16 entries have in common:

- The headings are Japanese, and most of them state a claim rather than name a category —
  「値の分類は取得の口が宣言する」「なぜ別パッケージなのか」「面と文字で明度を分ける」
- Top H2 frequencies: 運用 (12), 受け入れないもの (10), 受け入れるもの (10), 構成 (4),
  テストの責務 (2), モジュール (2), 実行機序 (2)
- 15/16 use tables; **0/16 use a Mermaid diagram**, so a diagram is a bonus here, not an expectation
- Prose length: median 1462 characters, min 399, max 15737 (measured in characters, not words — the
  prose is Japanese)
- 6.7 H2 headings on average

Re-derive these numbers when the manifest changes materially; ADR
[0141](../../../docs/adr/0141-portal-operations.md) makes the registered set the reference for what
manual-worthy means, so the criteria follow the manifest rather than the other way round.

### The two shapes that are deliberately not manual-worthy

Both are large enough that mistaking them for candidates makes any repo-wide report unreadable.

- **Per-component reference** — the READMEs under `src/components/**` share a fixed section shape
  (用途 / 役割と公開 component / 利用ケース / 責務境界 / Storybook とテスト). They document one component's
  surface, and this repository answers that with Storybook (a standing `meta.reference_links` entry
  in the manifest) plus the component's own TSDoc. That is this repo's reading of N1.
- **Feature slice** — a README under `src/features/` is graded by the required-section check in
  Step 2b instead, against the sections `docs/templates/feature-readme.md` declares.

### Keyword evolution log

The keyword sets in Step 2 are extended when a run of `portal-manifest-sync` shows a false negative.
Add a heading to a P-criterion's list when:

- A genuinely manual-quality README uses a wording that wasn't in the list.
- That wording appears in at least one currently-registered manifest entry, OR in a README the user
  explicitly judges manual-worthy.

Do NOT expand the lists to admit clearly low-quality READMEs; the goal is to capture the spectrum of
legitimate phrasings, not to inflate scores. Match by content in any case — this repository writes
the claim itself as the heading, so a criterion whose wording is absent may still be satisfied by a
section that answers it.

## Step 0. Confirm Target

This skill **MUST call `AskUserQuestion` immediately after invocation** to confirm:

1. **Target README path** — the canonical README to review. Below v1.0.0 the canonical file is the Japanese one on the suffix-less path (ADR 0140), so `README.md` is the target and a `.ja.md` sibling is the exception, not the rule. If the user supplied a path in skill arguments or the recent message, present it as the default candidate.
2. **Output verbosity** — concise scorecard (default) or full per-pattern breakdown.

If the user provided a `*.ja.md` path, ask whether to review the Japanese file directly (rare) or switch to the canonical sibling.

Do NOT read any files for evaluation until the target is confirmed.

## Step 1. Read the Target

Read the full README. Capture:

- All H2 headings (lines starting with two hash marks and a space)
- Presence and count of ` ```mermaid ` blocks
- Presence of tables (`|...|` lines)
- Prose length in characters (text excluding code blocks, tables, headings)
- Cross-reference to translation (`README.ja.md`) — its existence and sync convention compliance

## Step 2. Evaluate Each Criterion

Score each of the following criteria. Match by content, not just exact heading text — the skill must read sections and judge whether they substantively address the criterion.

### Positive criteria (each +1 when present and substantive)

| # | 観点 | シグナル |
| --- | --- | --- |
| P1 | **Role / boundary** | The pair `受け入れるもの` / `受け入れないもの`, or `役割` / `境界` / `なぜ〜なのか` — and the "not" side names where the excluded work goes, rather than only saying it is excluded |
| P2 | **Design intent** | A section arguing a judgment: a claim written as the heading itself (「値の分類は取得の口が宣言する」), or `設計` / `トリガ戦略` / `切替の軸` / `この層が持つ判断`. Reasoning, not a list of rules |
| P3 | **Rules / conventions** | `規約` / `配置・命名` / `TSDoc の基準` / `Storybook の表示規約`, or a table pairing what is allowed against what is not — prescriptive guidance a reader can be held to |
| P4 | **Mechanism** | `実行機序` / `実行機序と評価タイミング` / `生成と検査` / `Config の配線` — when each part runs and what triggers it |
| P5 | **Index into the substructure** | `構成` / `モジュール` / `〜一覧` / `〜目録` / `置いている hook` — for a directory that has one |
| P6 | **Operations** | `運用` (the most frequent heading in the registered set) with non-trivial content: what to re-run after a change, what breaks, what to watch |
| P7 | **Substantive prose** | Prose ≥ 800 characters, excluding code blocks, tables and headings. Characters, not words — the prose is Japanese |

A Mermaid diagram is a bonus, not a criterion: no registered entry uses one.

### Negative criteria (each −2 when triggered)

| # | 兆候 | 判定 |
| --- | --- | --- |
| N1 | **Per-component reference** | The component-README shape (用途 / 役割と公開 component / 利用ケース / 責務境界 / Storybook とテスト), carrying nothing beyond it that speaks for anything larger than the one component. A section about that component's own behavior does not lift it out. → Storybook and the component's TSDoc own this — out-of-scope-for-portal |
| N2 | **Stub** | H2 count ≤ 1 AND prose < 200 characters |
| N3 | **Index-only** | The only H2 is `構成` (or an equivalent listing) and it enumerates without narrative |
| N4 | **Operational reference** | Command / flags / usage only — the invocation surface of a script, with no judgment recorded. Belongs next to the script |

Apply N1–N4 conservatively. If the README carries *any* substantial role, design, or mechanism
content, do not trigger N1 / N3 / N4 even when the listing or component headings are present —
`src/components/README.md` is registered precisely because it says far more than the shape.

### Classification thresholds

- **manual-worthy**: positive score ≥ 3 AND no negative trigger AND (for a feature README) every required section from Step 2b is present and substantive
- **borderline**: positive score 1–2 AND no negative trigger
- **not-yet-manual-grade**: positive score 0 (or any positive but with N2/N3 triggered)
- **out-of-scope-for-portal**: N1 (component reference) or N4 (script invocation reference) triggered

## Step 2b. Feature READMEs: Required-Section Check

**This step runs only when the target sits under `src/features/`** — a feature slice README, including
a nested one when a screen inside a slice carries its own. It does NOT apply to
`src/features/README.md` itself — that is the layer README, and the layer's own duties are graded by
P1–P7 like any other kernel README.

The required-section list is **not hardcoded here**. Read `docs/templates/feature-readme.md` and take
the `required-sections:` list its header comment declares. That template is the single source of
truth for what a feature README must carry; if it gains or loses a section, this check follows
without editing this skill. **Do not derive the set from the template's H2 headings** — the template
also carries sections that are deliberately optional (a design-rationale section whose heading name
is not fixed, and a fork-notes section that only some slices need), and treating those as required
would fail every README in the repository.

The table below explains what each currently-declared section means. It is a reading aid, not the
list: when the template's declaration and this table disagree, the template wins, and a section the
template declares but this table does not describe is still required.

For each required section, decide by content rather than exact heading text:

| Required section | Satisfied when |
| --- | --- |
| 受け入れるもの | The slice's own line — what it takes on — not a restatement of the layer README's acceptance criteria |
| 受け入れないもの | What it hands to a neighbour, naming the destination (`components` / `model` / another feature's facade) |
| Route と契約 | Every route this slice owns is listed with a link to its `docs/spec/route/**` pair, plus the operationIds it uses (or an explicit statement that it uses none, with the reason) |
| 状態とデザイン参照 | Each state the slice can show is mapped to a Storybook story id (`<title>/<export>`), or the absence of a story is stated with its reason |
| 構成 | A file/directory table covering what the slice owns |
| 依存カーネル | Each kernel it imports, with what it is used for |
| Action 戻り値契約 | Each Server Action with its placement, return type, success and failure behavior — or `なし` |
| テスト観点 | Viewpoints specific to THIS slice (not a restatement of ADR 0090's per-layer duties) |

Report each as present / thin / missing. **Thin** means the heading exists but the content does not
answer the question in the table above — an operationId table with no operationIds, a state table
that lists states without stories, a テスト観点 section that only repeats the layer's declaration.

**Verify the claims, do not trust them.** A feature README that names a story, an operationId, a
route, or an Action is asserting something checkable:

- story ids against the `title:` plus exported story names in the slice's `*.stories.tsx`
- operationIds against the repository's OpenAPI contract under `openapi/` <!-- skill-lint-ignore -->
- spec links against the files under `docs/spec/route/`
- Action names against the `export async function` declarations in modules carrying `"use server"`

A claim that does not resolve is a finding, and it outranks a missing section: a wrong pointer costs
the reader more than an absent one.

**A feature README that is missing or thin on any required section cannot be `manual-worthy`**,
whatever its P1–P7 score. Cap it at `borderline` and name the sections in the gap list.

## Step 3. Output Scorecard

Japanese output. Sections:

```text
README Review: <path>

[判定] manual-worthy | borderline | not-yet-manual-grade | out-of-scope-for-portal

[強み] (positive criteria met)
  ✓ P1 役割 / 境界: 「受け入れないもの」が渡し先（components / model）を名指ししている
  ✓ P4 実行機序: いつ評価されるかを起動境界と RSC の 2 経路で書き分けている
  ✓ P6 運用: 変更後に回すものが 3 点（生成 / 突合 / 撮り直し）
  ✓ P7 散文 1,462 字

[ギャップ] (positive criteria absent)
  ✗ P2 設計判断を述べた節が無い
  ✗ P3 規約 / 禁止の明文化が無い

[B1 必須節] (feature README のときだけ出す)
  ✓ Route と契約: 2 route と 4 operationId。spec への link も解決する
  △ テスト観点: 見出しはあるが層の宣言の再掲で、この slice 固有の観点が無い
  ✗ Action 戻り値契約: 節が無い

[アンチパターン] (negative triggers)
  なし
  ※（または該当する場合）
  ⚠ N1 部品リファレンス: 用途 / 役割と公開 component / 利用ケース / 責務境界 / Storybook とテスト の定型のみ → Storybook と TSDoc の領域

[補強提案]
  - 「この層が要る理由」を 1〜2 段落足すと、読み手が層を必要性から理解できる
  - 「受け入れないもの」に渡し先を書き足すと、境界が判断に使える形になる

[portal 適性]
  manual-worthy → /portal-manifest-sync を回し、レポートを見たうえでこのパスを名指しして追加する
  （または）borderline → README 補強後に再 review 推奨
  （または）not-yet-manual-grade → 内容拡充が先、または portal 対象外でよい
  （または）out-of-scope-for-portal → Storybook / TSDoc の領域、portal 不要
```

For verbose mode, additionally include the raw H2 list, prose character count, table count, and the detected H2 → criterion mapping.

## Step 4. Suggest Next Action

Print a one-line suggestion based on the verdict:

| Verdict | Suggestion |
| --- | --- |
| manual-worthy | "/portal-manifest-sync を回し、レポートを見たうえでこのパスを名指しして追加してください" |
| borderline | "P2/P3 等の不足 section を補ってから再 review を推奨" |
| not-yet-manual-grade | "/sync-readme で内容を拡充するか、portal 対象外として扱ってください" |
| out-of-scope-for-portal | "Storybook と TSDoc、あるいはスクリプトの隣で扱うべき内容です。portal manifest への追加は不要" |

## AI Modification Scope

This skill is strictly read-only.

- Reads: the confirmed target README and (optionally) its `*.ja.md` sibling
- Writes: nothing
- Does NOT edit, stage, commit, or push

If the user requests improvements based on the review, recommend running `sync-readme` (for structural drift) or hand-editing (for substantive prose additions). Do NOT auto-rewrite within this skill.

## Constraints

- ❌ Hardcode evaluation rules in a way that drifts from `docs/portal/manifest.yaml` reality. The criteria above were derived from the current manifest snapshot; if the manifest convention evolves, re-derive <!-- skill-lint-ignore -->
- ❌ Treat absence of all positive criteria as "the README is bad" — some READMEs are deliberately concise references and the right verdict is `out-of-scope-for-portal`, not "fix it"
- ❌ Auto-add the README to the manifest
- ❌ Edit the README itself
- ❌ Skip the target-confirmation `AskUserQuestion`
- ✅ Japanese user-facing output
- ✅ Cite specific sections / quotes from the README to justify each criterion check
- ✅ Distinguish "needs more content" (not-yet-manual-grade) from "belongs elsewhere" (out-of-scope-for-portal)
- ✅ Be honest when a README is intentionally minimal and that's fine — not every package needs to be in the manual

## Checklist

Before reporting completion, confirm:

- [ ] Target README path was confirmed via `AskUserQuestion`
- [ ] Full README content was read
- [ ] All H2 headings were enumerated and mapped to criteria
- [ ] Prose length was computed in characters (excluding code/tables/headings)
- [ ] Table presence was checked (and a Mermaid diagram noted as a bonus if present)
- [ ] Each positive criterion (P1–P7) was evaluated with a Yes/No + evidence
- [ ] Each negative criterion (N1–N4) was checked
- [ ] For a feature README, the required sections were read from `docs/templates/feature-readme.md` and each was graded present / thin / missing
- [ ] Story ids, operationIds, spec links and Action names asserted by the README were resolved against the source
- [ ] Final classification matches the thresholds
- [ ] Output is in Japanese with concrete evidence per criterion
- [ ] Next-action suggestion is included
- [ ] No file was edited / staged / committed
