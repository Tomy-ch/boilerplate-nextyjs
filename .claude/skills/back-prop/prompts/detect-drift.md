# Drift detection criteria

The single source of truth for what counts as drift. The `drift-detector` agent and `back-prop`'s
`SKILL.md` both read this file; neither restates it. When these criteria change, they change here.

**You are read-only.** Surface findings with their reasoning and candidate options. Never write, never
call `AskUserQuestion`. The integrator runs the approval and the writes.

## What you are given

| Input | Meaning |
| --- | --- |
| `layer` | The kernel under examination, e.g. `adapters` — or `docs` for the prose-only categories |
| `files` | The pre-resolved in-scope file list. Do not re-resolve it from git |
| `categories` | The subset of `A` / `B` / `C` / `E` selected for this run |
| `baseRef` | The base branch, for history questions only |

## Read these first, at runtime

- The layer's own `README.md`, **including its frontmatter** (`imports-allowed` / `forbidden` /
  `test-requirement`). The frontmatter is machine-readable and is the strongest statement the README
  makes.
- `architecture.ts` — the dependency matrix. It, not the README prose, is the authority on what may
  import what.
- `docs/rules.md` — the constraints enforced day to day.
- For category `C`, the `SKILL.md` of any skill that names this layer.
- For category `E`, `docs/spec/glossary.md`.

**Do not hardcode any of it.** A rule you carry in your head is a rule that drifted the day the
README changed.

## Category A — README → Code drift

The README states something the code no longer does.

| Shape | Example of the finding |
| --- | --- |
| A declared responsibility is not there | The README says this layer owns X; nothing here does |
| A declared prohibition is violated | The README forbids Y; a file does Y |
| A named file or symbol moved or vanished | The README points at something that no longer exists |
| Frontmatter contradicts the tree | `imports-allowed` omits a package this layer actually imports |

**Frontmatter findings outrank prose findings.** The frontmatter is what `architecture.ts` and the
ESLint boundary rules read; prose is what a human reads. When they disagree with each other, that is
itself a finding.

**Report the code as the drift and the README as the governing side**, unless the README is
demonstrably describing something that never existed. Which one is wrong is the human's call; your
job is to show both.

## Category B — Code → README undocumented pattern

The code does the same thing in several places and the README never says so.

**The threshold is three.** Two occurrences are a coincidence; three is a convention that a reader
cannot discover from the README. Below three, say nothing — a finding at two teaches the next author
a rule nobody adopted.

Look for: a repeated file-naming shape, a repeated export shape, a repeated error-handling move, a
repeated placement decision, a repeated test structure.

State the three (or more) sites by path and symbol. **A B finding without its sites is not
reviewable.**

## Category C — Skill ↔ README duplication

A skill's body restates what a README already says.

This matters because the copy is the one that rots: a reader who follows the skill gets the old rule
and never learns it moved. It also matters here specifically because this repository's skills are
written to **read their criteria at runtime** — a skill carrying a restated rule has stopped doing
that.

| Shape | What to report |
| --- | --- |
| Verbatim or near-verbatim restatement | Both sites, and which one should keep it |
| A rule list that the README owns | The skill should read the README instead |
| A path or target list the tree already carries | The skill should enumerate at runtime |

**Do not report a skill quoting a README to make its own step concrete** when the quote is one clause
and the skill names the README as the source. That is a pointer, not a copy.

## Category E — Business vocabulary leaking out of its home

Business vocabulary lives in `docs/spec/`. A layer README and an ADR describe structure and decisions.
A business term that has grown into a layer README has left its home, and the same word then gets
defined again somewhere nobody is looking.

`docs/spec/glossary.md` states what it holds and what it deliberately does not: it carries the screen
vocabulary that the contract does not, and **business vocabulary is not its subject either**. Read it
for what counts as at home before you report anything.

**Split every E finding into two kinds, and label them:**

- **E1** — the leak is in a layer `README.md`. Inside the integrator's write scope.
- **E2** — the leak is in an ADR or `docs/rules.md`. **Report only.** Those are decision records and
  the governing document; rewriting one to satisfy a detector would invert who decides.

**Never propose editing `docs/spec/glossary.md` to resolve an E finding.** Deleting a term to silence
a detector destroys the definition rather than moving it, and the vocabulary is `glossary`'s to
maintain.

## What is not a finding

- **A README and a general-purpose part's own doc saying the same thing.** Both are entry points and
  neither may assume the other was read.
- **Sample-only surface.** Files the sample purge removes are not the reader's problem after the
  template is used. Say when a finding sits only there.
- **Anything you inferred without opening the file.** Cite the path and the symbol, never a line
  number.

## What to return

Findings grouped by category, in Japanese, each with:

```text
[<category>] <一行の要約>
  該当: `<path>` の `<symbol / 節>`（B は 3 件以上すべて）
  正本: `<path>` の `<節>`（A / C / E1）
  理由: <なぜ drift か。1〜2 文>
  選択肢: <コード修正 / README 更新 / 規則の緩和 / スキルの簡略化 / 無視>
  確度: high | medium | low
```

Then a one-line count per category. **If a category found nothing, say so explicitly** — a silent
category is indistinguishable from one that was not run.
