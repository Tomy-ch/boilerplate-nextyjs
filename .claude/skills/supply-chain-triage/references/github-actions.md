# GitHub Actions references

Covers every `uses:` in `.github/workflows/**` and `.github/actions/**`. This ecosystem gives the
richest evidence of the three, because **a real commit range is available** — you can read exactly
what changed between the pinned SHA and the candidate.

The pins themselves live in `.github/actions-pin.toml`; ADR 0153 owns that mechanism. This file only
says how to judge one candidate.

## Axis P — publisher

```bash
gh api repos/<owner>/<repo>/commits/<candidate-sha> --jq '.author.login, .committer.login, .commit.author.date'
gh api repos/<owner>/<repo>/commits/<baseline-sha>  --jq '.author.login, .committer.login'
gh api repos/<owner>/<repo> --jq '.owner.login, .archived, .disabled'
```

Check whether the repository changed hands or was transferred — a rename redirects silently, and the
`uses:` reference keeps working while pointing at a different owner.

`3` when the account is new to this repository, or when the repository was transferred without an
announcement.

## Axis A — attestation

```bash
gh api repos/<owner>/<repo>/git/refs/tags/<tag> --jq '.object.sha'   # does the tag still resolve to what we trust?
gh api repos/<owner>/<repo>/commits/<candidate-sha> --jq '.commit.verification'
```

**A moved tag is the classic finding here.** A tag is mutable; a SHA is not. If a tag this repository
already trusts now resolves to a different commit, that is axis A at `3` regardless of what the diff
shows.

## Axis D — diff

```bash
gh api repos/<owner>/<repo>/compare/<baseline-sha>...<candidate-sha> --jq '.files[].filename'
gh api repos/<owner>/<repo>/compare/<baseline-sha>...<candidate-sha> --jq '.commits[].commit.message'
```

Then read the patch for the files that matter. For a JavaScript action, `dist/` is what runs:

```bash
gh api repos/<owner>/<repo>/compare/<baseline-sha>...<candidate-sha> --jq '.files[] | select(.filename|test("^dist/")) | .patch'
```

**A `dist/` change with no corresponding `src/` change is the single strongest signal in this
ecosystem.** Score it `3` and say so.

Also read `action.yml` in the diff: a composite action gaining a `run:` step, or a change of `runs.main`,
is code that executes with the job's credentials.

## Axis S — surface

```bash
gh api repos/<owner>/<repo>/contents/action.yml?ref=<candidate-sha> --jq '.content' | base64 -d
```

Compare `inputs`, `runs`, and any `permissions` the action documents against the baseline. A new
network call in a composite action's `run:` block belongs here as well as in D.

## Exposure

Always the highest band: an Action executes in CI with the job's credentials **before this
repository's own code runs**. Say so on the exposure line.
