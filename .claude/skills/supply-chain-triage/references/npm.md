# npm registry packages

Covers anything resolved from the npm registry: a `package.json` dependency, a Dependabot PR, or a
`mise` pin on the `npm:` backend.

**`npm` is not installed and must not be used** — ADR 0001 adopts pnpm and forbids npm. Query the
registry with `pnpm view` and fetch the tarball with `curl`. **Never `pnpm add`, `pnpm install`, or
`pnpm dlx` the candidate**: an install script is the attack.

Work in the session scratchpad, never in the working tree.

## Axis P — publisher

```bash
pnpm view <name>@<candidate> _npmUser maintainers dist.integrity
pnpm view <name>@<baseline>  _npmUser maintainers
pnpm view <name> time --json          # publish cadence: is a 2-year-dormant package publishing twice today?
```

`3` when the publishing account is one that has never published this package before and the project
has not announced a maintainer change. `1` when a known co-maintainer publishes for the first time.

## Axis A — attestation

```bash
pnpm view <name>@<candidate> dist.attestations repository.url gitHead
```

An attestation ties the tarball to a workflow run and a source commit. When present, confirm that the
commit is on the upstream default branch. When absent — common — the axis is `?` unless `gitHead`
resolves to a real commit whose tree matches the tarball, which is what axis D ends up establishing
instead.

**An attestation proves the artifact was not swapped after publication. It does not prove the
publication was benign.**

## Axis D — diff

```bash
TARBALL=$(pnpm view <name>@<candidate> dist.tarball)
curl -fsSL "$TARBALL" -o "$SCRATCH/candidate.tgz"
tar -xzf "$SCRATCH/candidate.tgz" -C "$SCRATCH/candidate"
# same for the baseline, then:
diff -ru "$SCRATCH/baseline/package" "$SCRATCH/candidate/package" | less
```

Read the diff, do not skim it. Search for the compromise signatures by name:

```bash
grep -rnE 'preinstall|postinstall|child_process|eval\(|new Function|atob\(' "$SCRATCH/candidate/package"
grep -rnE 'process\.env|NPM_TOKEN|GITHUB_TOKEN|\.npmrc|id_rsa' "$SCRATCH/candidate/package"
grep -rnE 'https?://[0-9]{1,3}\.[0-9]{1,3}\.' "$SCRATCH/candidate/package"
```

**A built output that changed with no corresponding source change is the highest-signal finding
available here** — the bundle is what runs and the source is what gets reviewed. Compare the
published tree against the upstream repository at `gitHead` when one is available.

## Axis S — surface

```bash
pnpm view <name>@<candidate> dependencies bin files scripts engines
pnpm view <name>@<baseline>  dependencies bin files scripts engines
```

Score on the delta: a new dependency, a new `bin` entry, a new `scripts` hook, a widened `files` glob.
A package that gains an executable entry point in a patch release is `3`.
