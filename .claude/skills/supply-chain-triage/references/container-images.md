# Container images

Covers the image references pinned in `docker/images-pin.toml`. **This is the thinnest evidence of
the three**, and the honest outcome here is often `?` on two axes.

Images are used by CI here; this repository does not ship the application in a container
(ADR 0011). Judge the exposure accordingly — a workflow image still runs with the job's credentials.

**Never pull and run a quarantined image.** Reading a manifest and a config does not execute
anything; `docker run` does.

## Axis P — publisher

```bash
crane manifest <image>:<tag> | jq '.'                 # or: docker buildx imagetools inspect --raw
crane config  <image>:<tag> | jq '.config.Labels'
```

The useful labels are the OCI ones: `org.opencontainers.image.source`, `.revision`, `.vendor`. When a
publisher is not named anywhere in the config, the axis is `?` — say that, rather than assuming
continuity from the registry namespace.

## Axis A — attestation

```bash
cosign verify-attestation --type slsaprovenance <image>@<digest>   # when the publisher signs
crane config <image>:<tag> | jq '.config.Labels["org.opencontainers.image.revision"]'
```

When the image carries a provenance attestation, this axis is answerable and strong. When it carries
only a `revision` label, the label is a claim by the builder rather than evidence — treat it as `?`
unless the source commit can be independently confirmed.

## Axis D — diff

```bash
crane config <image>:<tag>@<candidate-digest> | jq '.history[].created_by'
crane config <image>:<tag>@<baseline-digest>  | jq '.history[].created_by'
```

**For a rebuild of the same tag there is no source diff**, which is why a routine hold on a mutable
tag usually cannot be discharged. The layer history is the only comparison available: a new
`created_by` step that fetches something from the network, or a new layer with no corresponding
upstream change, is the finding to look for.

When the image publishes an SBOM, diff the package sets:

```bash
cosign download sbom <image>@<candidate-digest> > "$SCRATCH/candidate.sbom.json"
```

Otherwise this axis is `?`.

## Axis S — surface

```bash
crane config <image>@<candidate-digest> | jq '.config | {Entrypoint, Cmd, User, Env, ExposedPorts}'
```

A changed `Entrypoint`, a drop to `User: root`, a new `Env` carrying a credential-shaped name, or a
newly exposed port are all scoreable here without running anything.

## Reading this ecosystem honestly

Two `?` is the normal outcome for a mutable-tag rebuild, and two `?` means
**INSUFFICIENT-EVIDENCE**: the window stands. That is the correct answer, not a failure of the run.
