---
name: supply-chain-triage
description: >-
  Gather direct supply-chain evidence about ONE artifact version that a cooldown window has caught, and score how likely it is to be a compromised publish (0–12 over four evidence axes) so a human can decide adopt-now vs wait from evidence rather than from a day count alone. Use this whenever a version is held, deferred, or classified pending by `tools-upgrade`, `actions-pin`, or `images-pin`; whenever `make tools-cooldown-check` blocks a `mise.toml` pin and someone must judge whether waiting is protective or merely inconvenient; whenever a Dependabot security update wants to skip the window; whenever the user asks 「このバージョン安全？」「なぜ検疫されている、取っていいのか」; and before any deliberate window override. It reads the artifact — the registry tarball, the Actions commit range, the image config — and never executes it, answers the four questions the security ADR records (did the publisher change, does the artifact match its source, what actually changed, did new dependencies appear), reports an axis as unanswerable rather than as a pass when the evidence cannot be obtained, and is strictly report-only: it never edits a lockfile, a pin, `package.json`, `pnpm-workspace.yaml`, or `mise.toml`, never lowers a window, and never applies an upgrade — the calling skill or the user makes that call. Do NOT use it to perform the upgrade itself (`tools-upgrade` / `actions-pin` / `images-pin` / a Dependabot PR), or as a malware scanner for first-party code (`impl-review` and the SAST gates).
argument-hint: '[<ecosystem>:<name>@<candidate-version>] [baseline=<version>] [days=<N>]'
---

# Supply-chain Triage

This skill answers one question about one artifact version: **is there direct evidence that this
release is a compromised publish?** It produces a scored, cited verdict and changes nothing.

It exists because of a property the security ADR records: **the window is a proxy, and a proxy can be
discharged by direct evidence.** Waiting N days is a cheap stand-in for four questions. Answering
them beats counting days — **skipping both does not.**

[0110](../../../docs/adr/0110-security-operations.md) is the **source of truth** for that reasoning.
Read it at runtime rather than trusting this paragraph: the policy lives there, and this skill is
only its instrument.

That last clause is the design constraint that shapes everything here: **an axis you could not answer
is not a passing grade.** A verdict is a claim about evidence obtained, so this skill reports
「未回答」 explicitly and refuses to launder silence into a low score.

A Japanese reference translation lives at `SKILL.ja.md` in this directory (for human reference only;
not loaded as a skill). The per-ecosystem procedures under `references/` are English only — they are
command recipes, not prose for human readers.

## When to Use

- A cooldown window caught a candidate and someone must decide whether to wait: `tools-upgrade`
  classified a release pending, `actions-pin` had to step back or hold, `images-pin` held on a tag.
- `make tools-cooldown-check` fails on a `mise.toml` pin. That gate **fails the build**, so the
  question is not whether an override slipped through but whether waiting is protective.
- A Dependabot security update wants to skip the window, and someone must decide whether taking a
  same-day publish is worth it.
- Before any deliberate window override. **Overriding without evidence is the one combination
  [0110](../../../docs/adr/0110-security-operations.md) rules out.**
- The user asks, in any phrasing, whether a specific release is safe to take.

## Contract

| | |
| --- | --- |
| **Owns** | 1 つの版についての直接証拠の収集と採点、未回答軸の明示、判断者への引き渡し |
| **Never** | lockfile / pin / 窓の編集 / 版の採用 / 成果物の実行 / 取れなかった証拠を `0` に数えること |
| **Starts when** | 窓が候補を捕まえ、待つべきかを人が決める必要があるとき |
| **Stops when** | 4 軸を試み終えたとき。採点を渡して終わる —— 採用の判断はしない |

## Do NOT use this skill for

- Performing the upgrade — `tools-upgrade` / `actions-pin` / `images-pin`, or the Dependabot PR.
  This skill only reports.
- Scanning first-party code for defects — `impl-review` and the SAST gates.
- **A routine image hold.** For a mutable tag two of the four axes are usually unanswerable (there is
  no source diff for a rebuild), so triage will normally confirm the hold rather than discharge it.
  Run it there only when the decision actually needs it.

## Hard limits

These are what make the skill safe to invoke on a possibly-malicious artifact.

- **Report-only.** Never edit `mise.toml`, `.github/actions-pin.toml`, `docker/images-pin.toml`,
  `package.json`, `pnpm-workspace.yaml`, or a lockfile. Never re-run a caller's resolve / apply.
  Never lower a window yourself. **A low score is evidence handed to a decision-maker, not a
  decision.**
- **Never execute the artifact.** Download and read; do not install, build, or run it. **Running an
  install script *is* the attack** for a registry package, so fetch the tarball and unpack it — never
  `pnpm add` / `pnpm install` the candidate, and never `pnpm dlx` it. Never run a downloaded binary,
  and never pull-and-run a quarantined image.
- **`npm` is not available here.** [0001](../../../docs/adr/0001-package-manager.md) adopts pnpm and
  forbids npm outright, so the registry is queried with `pnpm view` and the tarball is fetched with
  `curl`. The recipes under `references/` use those.
- **Work outside the repo tree.** Extract artifacts into the session scratchpad, never into the
  working tree, so nothing you fetched can be committed by accident.
- **Cite or drop.** Every axis score carries the command and the observation it rests on. **An
  unsupported hunch is reported as unanswerable, not as a score.**

## The four evidence axes

Score each axis `0`–`3`, or mark it `?` when the evidence is not obtainable for this ecosystem or
artifact. **Higher is worse.** The per-ecosystem recipes in `references/` say how to obtain each one.

| Axis | Question | What a `0` looks like |
| --- | --- | --- |
| **P** — Publisher | Did the publisher change? | Same maintainer / committer / owner as the baseline, with a publishing cadence in line with history |
| **A** — Attestation | Does the artifact match its source? | Provenance or transparency-log evidence ties the artifact to a named source commit, and that commit is on the upstream default branch |
| **D** — Diff | What actually changed? | The diff against the baseline is read in full, is proportionate to the release notes, and contains none of the signatures below |
| **S** — Surface | Did new dependencies or capabilities appear? | No new dependency, no new `bin` / entrypoint / packaged path, no widened permissions |

Score on what the evidence says, not on how it feels:

- `0` — answered, and the answer is continuity or benign change.
- `1` — answered and benign overall, but one detail is unexplained.
- `2` — answered, and something is off in a way the release notes do not account for.
- `3` — a compromise signature below is present, or the axis is answered adversely (the publisher
  changed to an unknown account; the artifact does not match the tag; a tag already trusted now
  resolves to a different commit).
- `?` — not obtainable. Say why in one clause. **Never substitute `0`.**

**The baseline is the version the caller would otherwise keep** — the currently-pinned SHA, the
locked version, the installed one — not simply the previous release in the registry. The question
being answered is 「移ることで何を引き受けるのか」, so the diff has to span exactly the move under
consideration.

### Compromise signatures (the teeth of axis D)

These are what a malicious publish has actually looked like. **Read for them specifically; a diff
skimmed for 「妥当そうか」 catches nothing.**

- **Install / lifecycle hooks** added or altered — `preinstall` / `install` / `postinstall`, an
  `action.yml` gaining a `run:` step. Code that executes before anyone reviews it.
- **Credential and secret access** — `process.env`, the npm auth file, cloud credential paths,
  `GITHUB_TOKEN`, `ACTIONS_RUNTIME_TOKEN`, SSH keys, the runner's memory.
- **New outbound network calls**, particularly to a raw IP, a URL shortener, a paste service, a
  webhook sink, or any domain unrelated to the project's own infrastructure.
- **Obfuscation** — packed or minified source in a package that otherwise ships readable code, long
  base64 / hex literals, `eval` / `new Function`, string-array decoders, code hidden behind an
  unusual platform check.
- **Shelling out** — `child_process`, `curl | sh`, in something with no reason to spawn a process.
- **A bundled artifact that outruns its source** — for a JS action or a package shipping a build
  output, **a bundle diff with no corresponding source change is the highest-signal finding
  available**, because the bundle is what runs and the source is what gets reviewed.
- **Widened packaging or capability surface** — new `files` / `bin` entries, a new entrypoint, added
  `permissions`, a new binary or blob.
- **Disproportion** — a 「typo 修正」 release carrying a 400-line diff, or a package dormant for two
  years publishing twice in a day.

## Bands and the two overrides

Sum the answered axes:

| Sum | Band |
| --- | --- |
| 0–2 | **LOW** |
| 3–5 | **MEDIUM** |
| 6–8 | **HIGH** |
| 9–12 | **CRITICAL** |

Two rules override the sum, because **averaging is the wrong operation for this data**:

1. **Any axis at `3` floors the band at HIGH.** One confirmed red flag is not diluted by three clean
   axes — **a compromised publish is usually clean everywhere except the payload.**
2. **Unanswered axes cap the claim.** Two or more `?` → report **INSUFFICIENT-EVIDENCE** with no
   band: the proxy was not discharged, so the window simply stands. Exactly one `?` → compute the
   band but cap it at MEDIUM, because LOW asserts positive evidence on all four questions and you
   have three.

### Exposure is reported next to the score, never folded into it

The score measures **how likely this publish is malicious**. How much damage it would do is a
different quantity, and [0110](../../../docs/adr/0110-security-operations.md) is explicit that window
length tracks upstream detection latency rather than blast radius — **mixing them corrupts both
numbers.** Report exposure as a separate line:

- **Executes in CI with the job's credentials before our code does** — a GitHub Action, a container
  image used by a workflow, a package with an install script. Highest; a compromise here reaches
  secrets directly.
- **Shipped to the browser or linked into the running server** — a runtime dependency.
- **Build / dev-time only** — a generator, a linter, a `mise`-managed CLI. **A tool that distributes
  agent skills sits above this line rather than on it**: it runs with the developer's privileges on a
  workstation holding repository write access, and it decides for itself what leaves the machine
  ([0110](../../../docs/adr/0110-security-operations.md) §1.1).

## Procedure

### 1. Establish the candidate

Fix these before gathering anything, from the arguments, the calling skill's context, or by asking:

| Field | Note |
| --- | --- |
| ecosystem | `npm` / `github-actions` / `container-image` — selects the reference file. A `mise` pin routes to its backend's ecosystem |
| name + candidate version | The exact thing under consideration (tag, version, digest) |
| baseline version | What the caller keeps if this is declined; the diff's other end |
| window `N` and how it was caught | Which disposition fired, and when the candidate ages out |
| urgency | Is a CVE forcing the move, or is this a routine bump? **This does not change the score** — it changes what the recommendation is worth to the reader |

If the baseline cannot be determined (a first-ever pin), say so — **axis D loses its other end** and
is `?` unless the ecosystem offers another comparison.

### 2. Read the matching reference

Read only the one that applies. Each gives the commands per axis and states which axes that ecosystem
cannot answer.

- [`references/npm.md`](references/npm.md) — packages from the npm registry, whether they arrive
  through `package.json`, a Dependabot PR, or a `mise` pin on the `npm:` backend
- [`references/github-actions.md`](references/github-actions.md) — `uses:` references. The richest
  evidence here, because a real commit range is available
- [`references/container-images.md`](references/container-images.md) — image digests. The thinnest

Also read [0110](../../../docs/adr/0110-security-operations.md) §1.1 for the window that applies —
what the toolchain already guarantees decides whether an axis is free or absent.

### 3. Gather, score, band

Work axis by axis, recording the command and what it showed. Then score, apply both override rules,
and derive the band. **Resist scoring before all four axes are attempted** — a `3` on D found early
tempts you to skip P, and **the publisher answer is what tells the maintainer whether to report the
account upstream.**

### 4. Report in Japanese and stop

Print the report below, then hand back to the calling skill (which runs its own confirmation) or end.
**Make the no-op explicit** — the reader must not have to wonder whether a file moved.

```text
供給網トリアージ: <ecosystem>:<name> <baseline> → <candidate>
  捕捉理由: <disposition>（窓 <N> 日 / 公開 <publish-date>, <age> 日 / 解除 <clear-date>）
  緊急度  : <CVE 等 / 定期更新>

スコア: <sum>/12 → <BAND>
  P 発行者     : <0-3|?>  <根拠を1行、コマンド名を添える>
  A 出所の一致 : <0-3|?>  <同>
  D 変更内容   : <0-3|?>  <同>
  S 依存/権限面: <0-3|?>  <同>
  <override が効いた場合はその旨: 「D=3 のため HIGH で下限」「? が 2 つのため INSUFFICIENT-EVIDENCE」>

暴露面: <CI 資格情報 / 実行時 / ビルド時のみ>（スコアとは別軸）

所見:
  - <検出した具体物、または「該当署名なし」>

推奨: <下記の対応表に従う>

本スキルは何も変更していません（報告のみ）。採用の判断は <呼び出し元 / 利用者> が行います。
```

Map the band to a recommendation:

| Band | Recommendation |
| --- | --- |
| LOW | 4 つの問いは直接証拠で答えられており、窓の趣旨は満たされている。採用の可否は判断者に委ねる |
| MEDIUM | 既定は窓を待つこと。急ぐ理由があるなら、未解決の点を明示したうえで判断者が決める |
| HIGH / CRITICAL | 採用しない。上流への報告と、当該バージョンを避ける代替（1 つ前の aged 版）を検討する |
| INSUFFICIENT-EVIDENCE | 証拠が取れていないため窓がそのまま効く。待つ |

Restate the walls whenever they apply — **a LOW score does not make a blocked install possible**:

- **`pnpm-workspace.yaml`'s release-age window** is enforced by the resolver, and the block extends to
  a frozen-lockfile replay — so it reaches CI and every other checkout, not only the machine doing
  the resolve. A per-version exemption exists, which makes adopt-or-wait a real choice: **report the
  score as the input to it and leave the decision with the caller.** Never suggest lowering the
  window or turning off its strict mode.
- **`make tools-cooldown-check` fails the build.** A blocked pin is blocked by a check this
  repository owns, and a LOW score does not clear it. The escape hatch is the exemption comment
  [0110](../../../docs/adr/0110-security-operations.md) §1.1 requires — **a triage verdict is the
  evidence that belongs in that comment's reason, not permission to write it.**
- **A first-ever pin has no aged fallback**, so a LOW score still leaves the choice between waiting
  and a deliberate bootstrap.

## Notes

- **A clean report is a real result.** Most quarantined versions are ordinary releases that happened
  to be recent. Saying so with citations is what lets a team act on a CVE inside the window instead
  of guessing.
- **`?` is not failure.** The ecosystems differ in what they can prove, **by construction** — that
  asymmetry is recorded in [0110](../../../docs/adr/0110-security-operations.md), not a gap in this
  skill. Reporting it honestly is what keeps the score meaningful.
- **A transparency log proves immutability, not benignity.** A publish attestation tells you the
  artifact was not swapped after publication. **A maliciously published version is faithfully,
  verifiably malicious.** Axis A answers a narrower question than it first appears to.
- **Score the move, not the package's reputation.** A widely-used package with a compromised release
  is the normal case for this skill; download counts and stars are not evidence about this version.
- **Attribution matters as much as the verdict.** When a score lands HIGH or CRITICAL, the publisher
  and commit identified on axes P and A are what makes an upstream report actionable. Include them.
- **This repository is public.** When a finding names a live indicator, describe it rather than
  reproducing it, and raise a confirmed compromise privately before it reaches an issue body.
- The skill never commits, stages, or pushes.

## Checklist

- [ ] [0110](../../../docs/adr/0110-security-operations.md) §1.1 and §1.2 read at runtime.
- [ ] Candidate fixed: ecosystem, name, candidate version, **the baseline the caller would keep**,
      window `N`, disposition, urgency.
- [ ] The one matching `references/` file read; its unanswerable axes honored.
- [ ] All four axes attempted; each score carries a command + observation, or an explicit `?` with a
      reason.
- [ ] Diff read against the baseline specifically, searched for the compromise signatures by name.
- [ ] Overrides applied: any `3` floors at HIGH; two or more `?` → INSUFFICIENT-EVIDENCE; exactly one
      `?` caps at MEDIUM.
- [ ] Exposure reported as a separate line, not folded into the score.
- [ ] Artifact never executed; extracted outside the repo tree; `npm` never invoked.
- [ ] Japanese report printed with band, recommendation, and the explicit statement that nothing was
      changed.
- [ ] The applicable walls restated.
- [ ] No file modified, no window lowered, no upgrade applied.
