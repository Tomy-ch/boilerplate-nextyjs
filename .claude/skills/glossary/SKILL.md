---
name: glossary
description: >-
  Maintain `docs/spec/glossary.md` — the table of screen-side vocabulary the backend contract does not carry — by settling what a machine can settle and handing the rest to a human. It extracts the candidate terms deterministically from the documents that actually use them (the spec prose, the layer READMEs, the design references, `docs/rules.md`) and reports four findings kept apart: a term the prose uses with no row, a row whose term appears nowhere, a row whose pointer no longer resolves to a real document or section, and a term defined in two places. Use it when a screen specification introduces a word nobody defined, when a term seems to mean different things in two documents, or as a periodic sweep — 「この語どこで定義されてる？」「用語表とずれてない？」. It never chooses which of two names wins and never declares two words synonymous: an identifier collision is a string comparison, but whether the two definitions actually differ is a reading, and which name the team will use is a decision no amount of scanning supplies. It never resolves a broken pointer by deleting the row, because a table that can only ever agree with the documents it points at can never tell anyone a document is wrong. Writes `docs/spec/glossary.md` and nothing else; creates no `.ja.md` pair. Do NOT use it to define business vocabulary (that lives in the backend contract and the types generated from it), to fix a document the glossary points at, or to review a diff.
argument-hint: '[--scope=changed|full] [term]'
---

# Glossary

Keep the screen vocabulary honest: find what a machine can find, and hand the judgment over.

A Japanese reference translation lives at `SKILL.ja.md` in this directory (for human reference only;
not loaded as a skill).

## What this skill decides and what it does not

It settles what a machine can settle: **which terms the prose uses, which have no row, which rows
point at something that no longer exists, which are defined in two places.** It never chooses the
canonical name and **never declares two words synonymous**.

The split is not caution, it is **where the evidence stops.** A term appearing in two documents is a
string comparison; whether the two definitions actually *differ* is a reading of prose. Two different
words naming one concept leaves **no mechanical trace at all** — it surfaces only when a person reads
both and recognises them. And which name wins is a decision about how the team will talk, which no
amount of scanning supplies.

**Report the finding, propose wording, and hand the decision over.**

## When to Use

- A screen specification introduces a word nobody defined.
- A term seems to mean different things in two documents.
- A periodic sweep, or after a batch of spec writing.

## Contract

| | |
| --- | --- |
| **Owns** | `docs/spec/glossary.md` の保守。機械で決着する 4 種の所見の抽出と提示 |
| **Never** | 正名を選ぶ / 2 語を同義と宣言する / 指し先の文書を書き換える / 行を消して壊れた参照を「解決」する |
| **Starts when** | 定義の無い語が現れた、語が 2 か所で定義されている、あるいは定期の掃き取り |
| **Stops when** | 4 種の所見を提示し、承認された行を書いたとき |

## Do NOT use this skill for

- **Defining business vocabulary.** Its source is the backend contract and the types generated from
  it ([0070](../../../docs/adr/0070-backend-role-separation.md) /
  [0072](../../../docs/adr/0072-api-type-generation.md)). The glossary says so itself; read it.
- **Fixing a document the glossary points at.** The pointer is this skill's; the target is not.
- Reviewing a diff.

## Step 0 — Confirm the scope

One `AskUserQuestion`, skipped when the argument already answers it.

- 「用語表のスコープを選んでください」
  - 「変更で触れた文書のみ」 — the spec and README files in the diff
  - 「全体」 — the whole prose corpus
  - 「特定の語」 — one term, all four findings for it alone

## Step 1 — Read the table as the baseline (deterministic — do not delegate)

Read [`docs/spec/glossary.md`](../../../docs/spec/glossary.md) in full, and read **what it says it
holds and does not hold** before anything else. That page states its own boundary: it carries the
screen-side concepts the contract does not, it points at owners rather than restating definitions,
and it names four places a term might belong instead. **A finding that ignores that boundary is not a
finding** — it is a proposal to change what the page is, which is a different conversation.

Build the baseline from the table itself:

- every 語, and its stated **定義を持つ文書** (a path, and often a section)
- every term the page defines **itself**, in its own section

## Step 2 — Extract the inventory deterministically

**The extraction must not be a judgment call**, or the findings become a function of how hard you
looked. Collect from the documents that actually use or own this vocabulary:

| Source | What it supplies |
| --- | --- |
| `docs/spec/**/*.md` | The prose that *uses* the vocabulary — the reason the table exists |
| `src/*/README.md` | Layer-side usage, and where a term may have grown a second home |
| `docs/design/*.md` | The subject references, several of which own a 用語 section |
| `docs/rules.md` | The constraints, which carry the vocabulary of the constraints themselves |
| `docs/adr/*.md` | Where a name is decided rather than described |

Two exclusions, both mechanical:

- **`SKILL.ja.md` is a translation.** It duplicates every term in its canonical, so counting it
  doubles every match and turns a single definition into a collision.
- **Purged surface.** A term that lives only in files the sample purge removes is not the reader's
  problem after the template is used. Say when a finding sits only there
  ([`scripts/setup/remove-sample/sample-manifest.ts`](../../../scripts/setup/remove-sample/sample-manifest.ts)
  is the range).

## Step 3 — Four findings, kept apart

They ask for different things, so **do not merge them into one list.**

- **新出用語** — the prose uses a term, no row, and no other document defines it either. Propose a
  row with wording drafted from the prose that uses it, and **let the human rewrite it**. The
  definition is the part that must not read like generated text.
- **孤児** — a row whose term appears in no spec and no README. **This is the finding that catches
  what nobody reads**: everything else starts from usage, so a row nobody uses is invisible to them.
  It resolves one of three ways — the term is still right and the prose should use it, the term
  belongs to a document that already owns it, or the row outlived its subject.
- **解決しない参照** — a row's 定義を持つ文書 no longer resolves: the path is gone, or the section it
  names has been renamed away. **Deterministic — settle it with a path check and a heading grep,
  never with a judgment call.** This is the finding that matters most and the one nobody was
  checking: **the page claims to say where each term is defined, and a claim never compared against
  the thing it claims about is decoration.**
- **二重定義** — one term defined in two documents. Report both side by side and **ask whether they
  are actually the same concept. Never answer that question here.**

## Step 4 — Decide per finding

**Group the variants of one word into one finding before asking.** A term, its adjectival form and
its plural are one concept, and asking three times about them is not thoroughness — it is the same
question spread thin enough that nobody answers the third. Name the variants inside the finding so
the grouping is visible and can be disputed.

`AskUserQuestion`, batched, at most four findings per call. Options follow what the finding supports —
for an orphan: 「表に残す（散文が使うべき）」/「既に所有する文書へ寄せて行を削除」/「主題ごと消えたので削除」/「保留」.

For a new term, present the drafted definition and **make rewriting it the easy path. A definition
nobody edited is a definition nobody agreed to.**

For an unresolved pointer the options are **ordered, and the order is the whole point**:

1. 「指し先の改名が誤り。文書側を戻す」
2. 「定義の家が正しく動いた。**行の指し先を新しい場所へ改める**」
3. 「その語の定義そのものが消えた。行を削除する」
4. 「保留」

**Never offer 「使われ方に合わせて行を書き換える」 as an option of its own.** It is the cheapest fix on
the table at the exact moment the page is most vulnerable, and taking it turns the glossary into an
index of whatever the prose happens to say this week. **An index cannot contradict what it indexes**,
and a vocabulary that cannot contradict the documents can never tell anyone a document is wrong.

## Step 5 — Write

Write `docs/spec/glossary.md` **and nothing else**. The spec tree is Japanese on the suffix-less path
and has **no `.ja.md` pair** ([0140](../../../docs/adr/0140-documentation-operations.md)) — do not
create one, and do not chain `canonicalize-doc`.

**Do not edit the document a row points at.** When the finding is that the target moved, the fix on
this side is the pointer; the target belongs to whoever owns it.

Then format only what was written:

```bash
pnpm exec markdownlint-cli2 --no-globs --fix docs/spec/glossary.md
```

## Step 6 — Closing report (Japanese)

State the counts per finding kind, what was written, and — explicitly — **what was deferred and what
was reported without an option**. A finding the user held is a finding that will come back; a finding
nobody mentioned reads as one that never existed.

Name the scope. **A clean run that does not say what it swept is indistinguishable from one that
swept nothing.**

## AI Modification Scope

Invoking this skill relaxes `AGENTS.md`'s modification scope to `docs/spec/glossary.md` alone, for
the duration of this run. Everything else stays protected — the documents the table points at
included.

## Do / Do NOT

- ✅ Read the table's own statement of what it holds before judging anything against it.
- ✅ Extract deterministically from the listed sources; exclude translations and purged surface.
- ✅ Keep the four findings apart.
- ✅ Group a word's variants into one finding, and name them.
- ✅ Draft a definition and make rewriting it the easy path.
- ✅ Settle an unresolved pointer with a path check and a heading grep.
- ✅ Report a two-place definition side by side and ask whether they are the same concept.
- ✅ Say what was deferred and what was reported without an option.
- ✅ Report in Japanese.
- ❌ Choose which of two names wins, or declare two words synonymous.
- ❌ Offer 「使われ方に合わせて行を書き換える」 as an option.
- ❌ Edit a document the table points at.
- ❌ Add business vocabulary; its source is the contract and the generated types.
- ❌ Create a `.ja.md`, or chain `canonicalize-doc`.
- ❌ Run a gate.

## Checklist

- [ ] Scope confirmed.
- [ ] The table read in full, including its own statement of boundary.
- [ ] Inventory extracted deterministically; translations and purged surface excluded.
- [ ] Four findings produced and kept apart; empty kinds stated as empty.
- [ ] Variants of one word grouped into one finding and named.
- [ ] Unresolved pointers settled by path and heading, not by judgment.
- [ ] Two-place definitions reported side by side, with the same-concept question left open.
- [ ] Options for an unresolved pointer offered in order; 「使われ方に合わせる」 never offered.
- [ ] Only `docs/spec/glossary.md` written; no `.ja.md`; the pointed-at documents untouched.
- [ ] Only the written file formatted; no gate run.
- [ ] Closing report names the scope, the deferrals, and the report-only findings.
