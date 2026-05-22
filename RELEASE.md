# Release process

L5E releases are triggered by pushing a `v*` git tag. A single tag fires
two automated flows:

1. **Publish to npm** — three packages go out under their matching
   dist-tag (`alpha`, `beta`, `next`, or `latest`).
2. **Build & deploy the docs site** — Docker image is pushed to the
   GitLab Container Registry and rolled onto the Docker Swarm running
   on the docs VPS.

Both flows are gated by a `test` job that mirrors `ci.yml` — neither
publish nor deploy happens if `pnpm build / test / typecheck` fails.

The actual workflow lives at [`.github/workflows/release.yml`](./.github/workflows/release.yml).

## What gets bumped — 5 files

| File | Field |
|---|---|
| `packages/core/package.json` | `version` |
| `packages/richtext-payload/package.json` | `version` |
| `packages/create-l5e/package.json` | `version` |
| `packages/create-l5e/templates/basic/package.json` | `dependencies["@withl5e/l5e"]` → `^<new>` |
| `packages/create-l5e/templates/minimal/package.json` | `dependencies["@withl5e/l5e"]` → `^<new>` |

The three packages must share the same version (the release workflow
verifies this before publishing). The two templates pin the framework
dependency, so end users running `npm create l5e@alpha` get the version
that was just published.

> **Why not `examples/basic` or `docs-site`?** They use
> `workspace:*` (linked locally) or are private — they don't ship to
> npm and don't need to follow the release version.

## Bump CLI

A small Node script handles all five files in one shot.

```sh
pnpm bump <version|keyword>
```

### Forms

| Command | Behavior | Example (current `0.1.1-alpha.2`) |
|---|---|---|
| `pnpm bump 0.1.2-alpha.0` | Set everything to the exact version | → `0.1.2-alpha.0` |
| `pnpm bump prerelease` | Bump the prerelease counter | → `0.1.1-alpha.3` |
| `pnpm bump patch` | Strip prerelease, bump patch | → `0.1.2` |
| `pnpm bump minor` | Strip prerelease, bump minor | → `0.2.0` |
| `pnpm bump major` | Strip prerelease, bump major | → `1.0.0` |
| `pnpm bump alpha` | Switch label to `alpha`, reset counter to 0 | → `0.1.2-alpha.0` |
| `pnpm bump beta` | Switch to `beta` | → `0.1.2-beta.0` |
| `pnpm bump rc` | Switch to `rc` (publishes under `next` dist-tag) | → `0.1.2-rc.0` |

### Safety rails

- Keyword forms (`prerelease`, `patch`, …) **fail** if the three
  publishable packages currently disagree on version — the script
  needs a single base to compute "next".
- Exact-version form **proceeds even when packages disagree** — that's
  how you resync after a mistake. The script logs the mismatch as a
  warning and forces all packages onto the target.
- Setting the target to the current version (no change) exits with an
  error.
- Templates with no `@withl5e/l5e` dependency are skipped, not failed.

## Full release flow

```sh
# 1. Bump (touches 5 files)
pnpm bump prerelease

# 2. Refresh the lockfile because the template dep range changed
pnpm install --frozen-lockfile=false

# 3. Commit + push the version bump
git add packages/ pnpm-lock.yaml
git commit -m "chore: bump to <version>"
git push

# 4. Tag with the matching `v` prefix and push the tag
git tag v<version>
git push origin v<version>
```

Once the tag is pushed, `.github/workflows/release.yml` runs:

```
            ┌─ publish-npm ──┐
test ──────→│                ├──→ done
            └─ deploy-docker ┘
```

The two release jobs run in parallel after the test gate. Watch the
progress on the **Actions** tab of the GitHub repo.

## Picking a version

Convention is [SemVer](https://semver.org). L5E is in alpha right now,
so the common bump is `prerelease`:

| When you… | Run | Becomes |
|---|---|---|
| Fix a bug during the current alpha cycle | `pnpm bump prerelease` | `0.1.1-alpha.2` → `0.1.1-alpha.3` |
| Start a new alpha cycle on a new patch | `pnpm bump alpha` | `0.1.1-alpha.3` → `0.1.2-alpha.0` |
| Promote alpha → beta | `pnpm bump beta` | `0.1.2-alpha.5` → `0.1.2-beta.0` |
| Cut the first stable release | `pnpm bump patch` | `0.1.0-rc.4` → `0.1.0` |

## NPM dist-tags

The `publish-npm` job auto-derives the dist-tag from the version's
prerelease suffix. You don't pass it manually.

| Version pattern | npm dist-tag | Install command |
|---|---|---|
| `x.y.z-alpha.N` | `alpha` | `npm i @withl5e/l5e@alpha` |
| `x.y.z-beta.N` | `beta` | `npm i @withl5e/l5e@beta` |
| `x.y.z-rc.N` | `next` | `npm i @withl5e/l5e@next` |
| `x.y.z` (no suffix) | `latest` | `npm i @withl5e/l5e` |

## CI/CD jobs (what runs on tag push)

### `test` (gate)

Same trio as `.github/workflows/ci.yml`:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm typecheck
```

If any step fails, neither `publish-npm` nor `deploy-docker` runs.

### `publish-npm`

1. Re-run `pnpm install --frozen-lockfile`.
2. Verify `${GITHUB_REF_NAME#v}` matches `version` in all three
   publishable packages. Fail if any disagrees.
3. Derive npm dist-tag from the prerelease suffix.
4. `pnpm -r build`.
5. `pnpm -r publish --no-git-checks --access public --tag <dist>` with
   `NODE_AUTH_TOKEN=${secrets.NPM_TOKEN}`.

### `deploy-docker`

1. `docker buildx` builds `Dockerfile.docs-site` from the repo root.
2. Push two tags to `registry.gitlab.com/ducmaster-group/l5e`:
   - `:<version>` (e.g. `0.1.2-alpha.0`)
   - `:latest`
3. SSH into the swarm manager and run `~/deploy-l5e.sh`, which does a
   rolling `docker service update --force` on the `l5e-docs` service.

The deploy script lives in this repo at
[`scripts/deploy-l5e.sh`](./scripts/deploy-l5e.sh) as a versioned
reference. The copy on the VPS is updated manually by `scp` when the
script changes — the workflow does not re-upload it on each run.

## Required GitHub secrets

Configure under **Settings → Secrets and variables → Actions**.

| Name | Used by | How to get it |
|---|---|---|
| `NPM_TOKEN` | `publish-npm` | npmjs.com → Access Tokens → granular automation token, publish scope on `@withl5e/*` and `create-l5e` |
| `GITLAB_REGISTRY_USER` | `deploy-docker` | GitLab Deploy Token username |
| `GITLAB_REGISTRY_TOKEN` | `deploy-docker` | GitLab Deploy Token with `read_registry` + `write_registry` |
| `VPS_HOST` | `deploy-docker` | Public IP / domain of the swarm manager |
| `VPS_USER` | `deploy-docker` | SSH user on the manager |
| `VPS_SSH_KEY` | `deploy-docker` | Private key (PEM block) whose public half lives in the manager's `~/.ssh/authorized_keys` |
| `VPS_PORT` *(optional)* | `deploy-docker` | SSH port if not `22` |

## One-time setup on the swarm manager

Before the first `deploy-docker` run, bootstrap the service manually on
the swarm:

```sh
# Log in so the manager has registry credentials to push down to workers.
docker login registry.gitlab.com

# Create the service. After this, the deploy script just rolls it.
docker service create \
  --name l5e-docs \
  --replicas 1 \
  --publish published=8180,target=8080 \
  --restart-condition any \
  --update-parallelism 1 \
  --update-order start-first \
  --update-failure-action rollback \
  --with-registry-auth \
  registry.gitlab.com/ducmaster-group/l5e:latest
```

After bootstrap, the deploy script (`scripts/deploy-l5e.sh`) takes
over: it pulls the latest image, then `docker service update --force`
rolls the running tasks.

## Troubleshooting

### "Cannot use a keyword bump while publishable packages disagree"

The three packages have different `version` fields right now. Fix by
running the script with an exact target version — it sets all three
to the same value and clears the mismatch:

```sh
pnpm bump 0.1.1-alpha.2          # whichever value you want them aligned at
```

After this, keyword forms work again.

> **Current state:** `packages/richtext-payload` is at `0.1.0-alpha.0`
> while the other two are `0.1.1-alpha.2`. The first bump you do
> should be an exact-version sync.

### "Tag … does not match" in CI

The workflow's verify step found a version mismatch with the tag. Two
common causes:

1. You ran `git tag vX.Y.Z` without first running `pnpm bump X.Y.Z`.
2. You bumped only some packages by hand. Use `pnpm bump` to keep all
   five files in lockstep.

Delete the bad tag, fix the versions, retag:

```sh
git tag -d v0.1.2-alpha.0
git push origin :refs/tags/v0.1.2-alpha.0
pnpm bump 0.1.2-alpha.0
git add packages/ pnpm-lock.yaml
git commit --amend --no-edit   # or a fresh commit
git tag v0.1.2-alpha.0
git push origin v0.1.2-alpha.0
```

### npm "You cannot publish over the previously published version"

npm forbids re-publishing the same version. Pick a higher version and
re-tag. If you ran the publish step locally during testing, `pnpm bump
prerelease` will pick the next prerelease counter cleanly.

### `deploy-docker` fails at the SSH step

- Verify `VPS_SSH_KEY` is the **private** key, including
  `-----BEGIN OPENSSH PRIVATE KEY-----` header/footer.
- `cat ~/.ssh/authorized_keys` on the manager must contain the matching
  public key.
- If using a non-default SSH port, set the `VPS_PORT` secret.

### `service "l5e-docs" does not exist yet on this swarm`

You skipped the one-time setup above. Run the `docker service create
…` block on the manager, then re-trigger the workflow (push a new tag,
or re-run the failed job from the Actions UI).

## Out of scope (for now)

- **Automated version bumping** (Changesets, release-please). Manual
  `pnpm bump` is enough at the current velocity.
- **Multi-arch images** (`linux/arm64`). The VPS is x86. Add buildx
  QEMU + multi-platform push when needed.
- **Rollback automation**. To roll back manually:
  ```sh
  ssh user@vps
  docker service update --rollback l5e-docs
  ```
- **Release notifications** (Slack, Discord). Add later if the team
  wants noisier feedback than the GitHub Actions email.
