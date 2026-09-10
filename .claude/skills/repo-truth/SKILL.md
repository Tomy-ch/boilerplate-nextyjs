---
name: repo-truth
usage-class: situational
description: >-
  Answer "how does this repository actually work right now" from its own primary sources, separating what the
  code and the governing documents state from what you inferred, and naming the gap instead of filling it. Use
  whenever someone asks where something is implemented, what the rule or convention is, why a design is the
  way it is, or whether a rule exists at all — 「このリポジトリではどうなってる？」「どこで判定してる？」「この規約の正本はどれ？」「そもそも決まってる？」「ADR
  ある？」. It searches index-first, because a document here is named for the concern it owns rather than its
  words, and reports a conflict or an absence as the answer. Read-only. Do NOT use it for a general Next.js
  question, a known symptom (`repo-ops`), an operation (`how-to`), or an undecided choice (`research`).
argument-hint: '[question] [--depth=quick|full] [--kind=fact|rule|rationale|procedure|vocabulary|history]'
---

# Repo Truth

Answer what is true of this repository *right now*, from its own primary sources, with the reasoning
visible.

A Japanese reference translation lives at `SKILL.ja.md` in this directory (for human reference only;
not loaded as a skill).

## When to Use

- Someone asks where something is implemented, or how a path actually behaves.
- Someone asks what the rule, convention, or authoritative document is here.
- Someone asks why a design is the way it is.
- Someone asks whether a rule, procedure, or term exists at all.

## Contract

| | |
| --- | --- |
| **Owns** | このリポジトリの現状の事実回答、根拠と推論の分離、**未定義 / 確認できず** の判定 |
| **Never** | リポジトリ外の一般論を主根拠にした将来設計 / 未決の採択 / 変更 / 見つけた drift の修復 |
| **Starts when** | 現状・規約・根拠・語義・存在有無を問われたとき |
| **Stops when** | 同格の権威が食い違ったとき（両方を出して停止）、索引を通読しないまま断定を求められたとき |

## Do NOT use this skill for

- A general Next.js / React question with no repository-specific answer.
- A known operational symptom with a documented fix — `repo-ops`.
- An operation you want to perform — `how-to`.
- An undecided design question that needs options compared — `research`.
- Reviewing a diff — `impl-review` / `test-review` / `comment-sweep`.
- Filing what was found — `new-issue`.

## Why this exists

Two failure modes produce almost every wrong answer about this repository, and neither is fixed by
reading harder.

**The first is answering from memory.** A layer rule, a make target's behavior, a status code — each
feels recallable and each is decided in a file that changed since. An answer stated in a confident
register is acted on; being approximately right is worse than saying you have not checked.

**The second is locating the wrong file.** `AGENTS.md` says why in as many words: **a document here is
named for the concern it owns**, so searching an index for your feature's words is not enough. The
file that governs your question is routinely one whose name contains no word in it. Locating the
governing file is therefore a separate step from reading it — and it is the step that decides whether
the answer is right.

That is why the output separates 根拠 from 推論. The point is not politeness about uncertainty; it is
that a reader can only overturn a claim whose basis is visible.

## Arguments, and the door check

This skill asks nothing before starting. A modal confirming scope would cost more than most answers
are worth. What varies is expressed as arguments instead, so a chained caller states it rather than
letting this skill infer it:

| Argument | Effect |
| --- | --- |
| `--depth=quick` *(default)* | Skim the owning indexes. **未定義 is unavailable** — an absence can only be reported as 確認できず |
| `--depth=full` | Read the owning indexes in full, which is what earns the right to report 未定義 |
| `--kind=<kind>` | Skip the Step 1 classification; the caller already knows which corpus governs |

`--depth` is deliberately the price of an authoritative absence: reading the ADR index end to end and
walking a README chain costs real time, and nobody should pay it for a question that only needs a
pointer. Escalate to `full` on your own when the answer turns out to hinge on something not
existing — and say that you did.

**Then check you are the right door.** Four skills sit next to each other here and the distinguishing
signal is intent, not vocabulary — the same nouns appear in all of them:

| The user is describing | Door |
| --- | --- |
| something that broke, or a gate that failed | `repo-ops` |
| an operation they want to perform | `how-to` |
| a choice nobody has made yet | `research` |
| how something works, what the rule is, whether it exists | here |
| something that could be read as more than one of the above | `question` — the router, which asks |

If this is the wrong door, say so in one line and name the right one. Answering anyway is worse than
mis-triggering, because the answer will be shaped like a knowledge answer for someone who needed a
procedure.

The row that matters most is the last one. A bare 「今どうなってる」 can mean the industry outside, this
repository as it stands, or the diff in this window, and no amount of code reading settles which —
the ambiguity is in the asker. Send it to `question` rather than picking a reading, because picking
one produces a confident answer to a question nobody asked.

## Step 1 — Classify what is being asked

The classification decides what counts as an answer, and — more importantly — what an absence
*means*. Do this before searching.

| Kind | What answers it | What an absence means |
| --- | --- | --- |
| Fact — how does it behave | the implementation on the path in question | the path does not exist; say so rather than describing a plausible one |
| Rule — what should be done here | the governing document | **the rule may be undefined** — a finding in its own right, but only once Step 2 has exhausted the owning index |
| Rationale — why is it this way | `docs/adr/`, `docs/design/` | the decision was made implicitly and never recorded |
| Procedure — how is it done here | `.makefiles/**`, `package.json` scripts, `.lefthook.yaml`, `.github/workflows/`, `docs/get-started/` | **no canonical procedure may exist** — same bar; never invent a command to close the gap |
| Vocabulary — what does this term mean | [`docs/spec/glossary.md`](../../../docs/spec/glossary.md), `docs/spec/README.md`, the layer READMEs | the term has no home yet, or it is business vocabulary whose source is the backend contract |
| History — when and why did it change | `git log`, merged PRs | — |

A question often carries an unstated assumption about which kind it is. 「この検証はどのコマンド？」 is a
Procedure question; 「なぜこの検証は CI 側なのか」 is a Rationale question, and they resolve in different
corpora.

## Step 2 — Establish the search frontier, then locate the source

This is the step the skill exists for, and the one that decides whether the answer is trustworthy.

**You cannot conclude anything from a file you never opened.** Whatever you read, most of the corpus
stayed unread, so *absence of a hit is not absence of an answer*. Count what you are up against by
reading the indexes, not by trusting a number written here — a number in this file would be false the
week after it was written.

### Search index-first, by concern

Read the indexes and pick entries by *what concern they own*, not by keyword match:

| Index | Covers |
| --- | --- |
| [`docs/README.md`](../../../docs/README.md) | **which document owns a given judgment** — the four classes and the routing. Read this first when you do not know which corpus governs |
| [`docs/adr/README.md`](../../../docs/adr/README.md) | why a decision was made, and which are deliberate exclusions |
| [`docs/design/README.md`](../../../docs/design/README.md) | how a subject that spans layers works |
| [`docs/rules.md`](../../../docs/rules.md) | the constraints enforced day to day, each with its Rationale link |
| [`.makefiles/README.md`](../../../.makefiles/README.md) | every make target, grouped by area |
| [`docs/playbook.md`](../../../docs/playbook.md) | the reverse index — "I want to do X" → where it lives |
| the README chain from the path in question up to `src/<kernel>/README.md` | responsibilities, prohibitions, `imports-allowed` / `test-requirement` frontmatter |
| [`architecture.ts`](../../../architecture.ts) | the dependency matrix itself — the only authority on what may import what |

Keyword search comes **last**, as a net for what the indexes missed — never as the primary method.

### Two things that look authoritative and are not

The corpus here is small and mostly honest, which makes the two exceptions easy to miss:

- **`SKILL.ja.md` is a translation, not a source.** Hitting one is useful as a *locator* — it proves
  the topic is documented — but cite the canonical `SKILL.md` beside it. Below v1.0.0 these are the
  only `*.ja.md` in the repository ([0140](../../../docs/adr/0140-documentation-operations.md)).
- **Generated views are not authority.** `docs/portal/` is built from the sources it lists, and
  `graphify-out/` is a derived index. Cite what they were built from.

### Record the frontier before concluding

Keep track of what was actually covered: which indexes were read in full, which README chain was
walked, which globs were searched — **and which sweeps you decided not to run, with the reason**. A
frontier listing only what was covered reads identically whether the rest was ruled out or forgotten,
and only one of those is a finding about the repository. This is what makes an absence falsifiable,
and it draws a line this skill must not blur:

| Verdict | Requires |
| --- | --- |
| **未定義** — no rule / procedure exists | the owning indexes read **in full**, and the README chain walked |
| **確認できず** — could not establish it | anything less |

Downgrading to 確認できず is always available and costs nothing. Reporting 未定義 off a partial sweep is
worse than having no answer, because it reads as a settled fact and the next person builds on it.

### Use the graph where structure beats text

Keyword search fails on exactly the questions this section opened with — a governing document named
for its concern, a caller that shares no vocabulary with the callee. `graphify` indexes **structure**,
so it reaches what text search cannot ([`.claude/README.md`](../../README.md) carries what it is and
how it is installed). **Reach for it rather than merely guarding against it:**

- **`graphify affected <symbol>` is the paying command, and it is what a scope claim requires.**
  Reverse traversal returns each call site with a relation label and `file:line` — the
  exhaustive-search evidence that 「ここだけが〜」 needs, and which `grep` cannot supply because a
  caller need not share vocabulary with the callee. A scope claim made without it is narrowed to
  what was actually covered.
- **Ignore `god-nodes`.** It ranks by edge count, and this repository's 1:1 test-mapping rule puts
  test scaffolding above production code — it answers a question nobody asked.
- **A node or an edge is never the evidence.** It is how you reached the file; open that file and
  cite it. A graph answer not confirmed in source stays 推論.
- **State freshness.** The graph is built from a commit; say which. **It is blind to uncommitted
  work** — for a question about the working tree, rebuild it or use `grep`, which for a small diff is
  cheaper anyway.
- **If the graph is not there, the structural sweep did not happen.** Fall back to index reading,
  search and direct reading, and **record that in the frontier** — an absence reported without a
  structural sweep is 確認できず, not 未定義.

## Step 3 — Read the primary sources, and mark the seam

Open what you cite. A path you did not read is not evidence.

As you go, keep two piles apart, because they merge the moment they are written into one paragraph:

- **根拠** — a sentence the source actually contains, or behavior the code actually expresses.
- **推論** — anything concluded by combining sources, by absence, or by analogy with a sibling.
  Inference is legitimate and often the whole value of the answer. Presenting it in the same register
  as evidence is not.

The most common leak is a claim of *scope*: 「ここだけがこれをやっている」 is a claim about absence, and
absence is established by an exhaustive search or not at all. Reverse-traverse the graph, or run an
exhaustive search; if neither was run, narrow the claim to what was actually covered.

## Step 4 — Check currency and conflict

- **Currency.** A governing file may have moved this week. Check history for the paths you cite
  (`git log --oneline -10 -- <paths>`) when the answer depends on being current.
- **Conflict.** Most disagreements here are already settled: `AGENTS.md` § Instruction Priority ranks
  the authorities, and [0140](../../../docs/adr/0140-documentation-operations.md) puts the ADR above
  `rules.md` and `docs/design/` when they disagree. **Apply that ranking rather than reporting a
  conflict that the repository has already decided.** What you stop on is a disagreement *between
  peers* — two ADRs, two layer READMEs, a rule and its own Rationale link — where nothing ranks them.
  Report both with their freshness and stop.
- **Drift is a finding, not a task.** When code and its governing document disagree, the document is
  the governing side and the code is the drift; say so and stop. Repairing it belongs to `back-prop`.

## Step 5 — Answer in this contract

Always this shape, in Japanese. Keep 回答 short enough to be read first.

```markdown
## 回答
<結論を 1〜3 文で>

## 根拠
- <主張> — `<path>` の `<symbol / target / 節>`
- <主張> — `<path>` の `<symbol / target / 節>`

## 推論
- <根拠から導いたこと。断定と区別できる書き方で>

## 矛盾 / 欠落
- <食い違う出典と、それぞれの鮮度> / <未定義 または 確認できず> / <古い可能性のある記述>
- 探索範囲: <通読した索引 / 辿った README 連鎖 / 検索した glob / 回さなかった掃引とその理由>
  ← 欠落を報告するときは必須

## 確度
High | Medium | Low — <そう判断した理由>

## 次にできること
<追加確認 / research / new-issue / back-prop / repo-ops など。実行はしない>
```

Cite **symbols and paths, never line numbers** — a line number is stale by the next refactor, and a
reader who follows one to the wrong place trusts what they find there.

Confidence is judged on the sources, not on how sure you feel:

| Level | When |
| --- | --- |
| High | Multiple current primary sources agree, and they govern the question asked |
| Medium | A single primary source, an implicit one, or one whose currency is unverified |
| Low | Mostly inference, sources conflict, or the deciding source could not be reached |

When only part of the question could be answered, return the verified part and name the rest as a
gap. A precise partial answer beats a complete-looking one.

## Gaps are an answer

「正規の手順は無い」 is a finding this skill owns, and it exists because the alternative is worse: an
invented-but-plausible command reads exactly like a documented one, and the next person runs it.

State it as a result, and publish the frontier with it, so the absence is falsifiable:

> 正規手順は**未定義**。`.makefiles/README.md`（全 target）と `package.json` の scripts を通読し、
> `.lefthook.yaml` / `.github/workflows/` を確認したが該当なし。近いのは `<target>`（ただし〜の点で
> 目的が異なる）。

If the indexes were not read in full, the verdict is **確認できず**, and it says which index was left
unread. The two are not interchangeable: one is a finding about the repository, the other is a
finding about how far this run got.

`repo-ops` deliberately carries neither verdict — it is a lookup table of known symptoms, and
teaching it to conclude "undefined" would turn it into a general search skill. When a symptom is not
in its index, the question comes here.

## Standalone by design

This skill is invoked in its own right and chains into nothing. It reports what 次にできること would
be — `research` for an undecided design question, `new-issue` to file what it found, `back-prop` for
drift, `repo-ops` for a known symptom — and the user decides whether to run it.

That is the same reason the three review skills are peers under the Review Phase Protocol in
`AGENTS.md`: a skill that runs the next one for you removes that decision from the user, and a drift
in this skill's judgment would then silently redirect every flow that passed through it.

## Do / Do NOT

- ✅ Say so and redirect when this is the wrong door, instead of answering anyway.
- ✅ Search index-first by concern; keep keyword search as the last net, never the first move.
- ✅ Record the frontier — indexes read in full, README chain walked, globs searched.
- ✅ Say 確認できず whenever the owning indexes were not exhausted; reserve 未定義 for when they were.
- ✅ Open every source you cite; cite symbols and paths.
- ✅ Keep 根拠 and 推論 in separate sections.
- ✅ Apply `AGENTS.md` § Instruction Priority to a ranked disagreement; stop only on a peer conflict.
- ✅ Report an absence as the answer, with what was searched.
- ✅ Reach for the graph where structure beats text, confirm what it pointed at in source, and state
  its freshness — or record in the frontier that it was not run.
- ✅ Record a sweep you deliberately did **not** run, with its reason.
- ✅ Answer in Japanese.
- ❌ Answer from memory about anything the repository decides.
- ❌ Cite a `SKILL.ja.md` or a generated view as authority.
- ❌ Treat a skill body as authority over a governing document, or a code fact over one.
- ❌ Resolve a conflict between two peer authorities on your own.
- ❌ Report 未定義 from a keyword search, or from indexes that were not read in full.
- ❌ Invent a command, a rule, or a rationale to close a gap.
- ❌ Edit anything, run a gate, or repair the drift you found.
- ❌ Claim a scope (「ここだけが〜」) from a partial search.
- ❌ Write line numbers into the answer.

## Checklist

- [ ] Door check done — a symptom goes to `repo-ops`, an operation to `how-to`, an open choice to `research`.
- [ ] `--depth` resolved; 未定義 claimed only under `full`, and any escalation to `full` stated.
- [ ] Question classified; what an absence would mean is settled before searching.
- [ ] Indexes read by concern before any keyword search; `docs/README.md`'s routing consulted.
- [ ] Frontier recorded — which indexes in full, which README chain, which globs.
- [ ] No `SKILL.ja.md` or generated view cited as authority.
- [ ] Every cited source actually opened; symbols and paths, no line numbers.
- [ ] 根拠 and 推論 separated; scope claims backed by exhaustive search.
- [ ] Currency checked where the answer depends on it; a peer conflict reported with both sources.
- [ ] Graph accounted for either way — used with its output confirmed in source and its freshness
      stated, or deliberately not run with that stated in the frontier.
- [ ] Contract emitted in full, in Japanese, with 確度 and its reason.
- [ ] 未定義 used only on exhausted indexes; otherwise 確認できず, naming what was left unread.
- [ ] Gaps stated as results with the frontier attached; nothing invented to fill one.
- [ ] Nothing edited, no gate run, no chained skill invoked.
