# Spec validation criteria

The single source of truth for what a spec review checks. The `spec-validator` agent and
`verify-spec`'s `SKILL.md` both read this file; neither restates it.

**You are read-only.** Surface findings with their evidence. Never write, never call
`AskUserQuestion`.

## What you are given

| Input | Meaning |
| --- | --- |
| `route` | One route's spec directory, e.g. `docs/spec/route/auth/login` |
| `specs` | The spec files in it — a `*.screen.md`, and a `*.function.md` when one exists |
| `implementation` | The `src/app` entry the route maps to, and the files it reaches |

## Read these first, at runtime

- `docs/spec/README.md` — how the two files divide, where they live, and **what a spec deliberately
  does not say**.
- The `layout.*.md` specs **above** this route. A layout's promise applies to everything beneath it,
  and each screen writes only its difference from that.
- The implementation the route maps to.

## What the existence check already covers — do not repeat it

A gate settles whether every route has a screen spec and whether any spec outlived its route. **Do
not re-derive that**; if you find yourself checking whether a file exists, you are doing the gate's
job with worse tools. Your subject is what the files *say*.

## The four findings

### 1. 約束と実装の食い違い

The spec states an observable promise the implementation does not keep, or keeps differently.

**State which side you believe is wrong and why — but do not decide.** `docs/adr/0143` settles the
direction: if the promise changed, the spec is what moves; if it did not, the implementation is.
Which of those happened is not visible from the diff, so report both readings.

**Only observable promises count.** A spec describes what a user can observe, not how the code
reaches it. A mechanism that differs while the observable behaviour matches is not a finding here.

### 2. 振り分けの誤り

A statement sits in the wrong one of the two files. Settle it with `docs/spec/README.md`'s own
question:

> バックエンドの契約と利用者の目的が同じまま、その記述だけが違う画面があり得るか。
> あり得る → 画面要件。あり得ない → 機能要件。

This is why both files of a route are read together: **a misfiled statement is invisible from either
file alone.**

### 3. 上位 layout の書き直し

The screen restates something a `layout.*.md` above it already promises, instead of writing only its
difference.

Report the layout spec and the section it duplicates. A restatement is not merely redundant — **the
two copies drift, and the screen's copy is the one that gets read.**

### 4. 書かないものが書かれている

`docs/spec/README.md` names what a spec does not carry — a component's name, a number with a unit, a
convention that spans layers, an implementation procedure, an operation not specific to this screen.
Read that list at runtime; do not carry it here.

For each, report the sentence and **where it belongs instead**, since every item on that list has a
home.

## What is not a finding

- **A promise you could not check.** When the implementation is not reachable from what you were
  given, say the promise was unchecked. **An unchecked promise reported as kept is the failure this
  review exists to prevent.**
- **A wording preference.** The spec's job is to let someone rebuild the screen; if it does, its
  phrasing is not yours.
- **A missing `*.function.md`.** A screen with no functional requirement deliberately has none.
- **Sample-only surface**, beyond noting that it is sample-only.

## What to return

```text
[<finding kind>] <一行の要約>
  該当: `<path>` の `<節>`
  実装: `<path>` の `<symbol>`（1 のときのみ）
  理由: <なぜ食い違うか / なぜ置き場が違うか。1〜2 文>
  どちらが動くべきか: 仕様書 | 実装 | 判断が要る —— <根拠>
  確度: high | medium | low
```

Then a one-line count per kind, and **the promises you could not check, with why**. A review that
lists only what it verified is indistinguishable from one that verified everything.
