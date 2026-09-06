# Release process

L5E releases are triggered by pushing a `v*` git tag. Every tag publishes
three packages to npm under the matching dist-tag (`alpha`, `beta`, `next`,
or `latest`). Stable tags also build and deploy the docs site: the Docker image
is pushed to the GitHub Container Registry (ghcr.io), the Swarm service
`l5e_docs` is rolled onto the new image, and the Cloudflare cache tag `global`
is purged. Prerelease tags do not change the production docs deployment.

Both release jobs are gated by a `test` job that mirrors `ci.yml` — no
publish or stable deploy happens if `pnpm build / test / typecheck` fails.

The actual workflow lives at [`.github/workflows/release.yml`](./.github/workflows/release.yml).

## 1.0.0-alpha.0 migration notes

Version `1.0.0-alpha.0` moves the framework peer dependency to Vite 8, adopts Vite 8's
supported Node.js range, and replaces Rollup with Rolldown for L5E's runtime
bundling. L5E owns the direct Rolldown dependency; application packages only need
to upgrade L5E and Vite. Existing application configs that list `rollup` in
`ssr.external` must replace it with `rolldown`. The framework still uses `esbuild`
intentionally. The standalone templates therefore include a `pnpm-workspace.yaml`
with `packages: []` and `allowBuilds.esbuild: true`; pnpm 11 ignores the former
`package.json` `pnpm.onlyBuiltDependencies` setting. Existing monorepos must merge
that allowlist into their real workspace root without replacing package globs. The
release checks use pnpm 11.0.9 with Node.js 22; local consumer validation used
Node.js 22.23.2. The same `allowBuilds` schema is available in pnpm 10.26+ for
Node.js 20.19 consumers, but pnpm 10.26 is not part of this release's tested matrix.
Before releasing or upgrading an existing application, follow
[Migrating an L5E app to Vite 8](./docs-site/content/28-migrating-to-vite-8.md).

## What gets bumped — 5 files

| File | Field |
|---|---|
| `packages/core/package.json` | `version` |
| `packages/richtext-payload/package.json` | `version` and `peerDependencies["@withl5e/l5e"]` → `^<new>` |
| `packages/create-l5e/package.json` | `version` |
| `packages/create-l5e/templates/basic/package.json` | `dependencies["@withl5e/l5e"]` → `^<new>` |
| `packages/create-l5e/templates/minimal/package.json` | `dependencies["@withl5e/l5e"]` → `^<new>` |

The three packages must share the same version (the release workflow
verifies this before publishing). The richtext adapter and two templates
pin the framework dependency, so end users running `npm create l5e` (or `@alpha`,
`@beta`, depending on which channel the release lands on) get the
version that was just published.

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
            ┌─ publish-npm ────────────────┐
test ──────→│                              ├──→ done
            └─ deploy-docker (stable only) ┘
```

The applicable release jobs run in parallel after the test gate. Watch the
progress on the **Actions** tab of the GitHub repo.

## Picking a version

Convention is [SemVer](https://semver.org). From `1.0.0` onward, breaking changes
start a new major line, backward-compatible features bump the minor version, and
compatible fixes bump the patch version. Use prerelease keywords when validating an
alpha, beta, or release candidate:

| When you… | Run | Becomes |
|---|---|---|
| Change a required peer or runtime in a breaking way | `pnpm bump major` | `1.0.0` → `2.0.0` |
| Ship a backward-compatible feature | `pnpm bump minor` | `1.0.0` → `1.1.0` |
| Ship a compatible fix | `pnpm bump patch` | `1.0.0` → `1.0.1` |
| Fix a bug during the current alpha cycle | `pnpm bump prerelease` | `0.1.1-alpha.2` → `0.1.1-alpha.3` |
| Start a new alpha cycle on a new patch | `pnpm bump alpha` | `0.1.1-alpha.3` → `0.1.2-alpha.0` |
| Promote alpha → beta | `pnpm bump beta` | `0.1.2-alpha.5` → `0.1.2-beta.0` |
| Cut the first stable release | `pnpm bump 1.0.0` | `1.0.0-rc.4` → `1.0.0` |

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

If any step fails, neither `publish-npm` nor the stable-only `deploy-docker` job runs.

### `publish-npm`

1. Re-run `pnpm install --frozen-lockfile`.
2. Verify `${GITHUB_REF_NAME#v}` matches `version` in all three
   publishable packages. Fail if any disagrees.
3. Derive npm dist-tag from the prerelease suffix.
4. `pnpm -r build`.
5. `pnpm -r publish --no-git-checks --access public --tag <dist>` with
   `NODE_AUTH_TOKEN=${secrets.NPM_TOKEN}`.

### `deploy-docker`

This job runs only for stable tags without a prerelease suffix. Alpha, beta,
and release-candidate tags publish packages to npm and skip the production docs
image, Swarm deployment, and Cloudflare purge.

1. `docker buildx` builds [`docs-site/Dockerfile`](./docs-site/Dockerfile)
   from the repo root.
2. Push two tags to `ghcr.io/<owner>/<repo>` (lowercase):
   - `:<version>` (e.g. `0.1.2-alpha.0`)
   - `:latest`

   Auth uses the auto-provided `GITHUB_TOKEN`; the job declares
   `permissions: packages: write` to enable it.
3. SSH into the Swarm manager and run a single
   `docker service update --image <version-tag> --with-registry-auth
   --force l5e_docs` — Swarm rolls the running tasks with `start-first`,
   rolling back automatically if the new task fails to come up.
4. POST to Cloudflare `purge_cache` with `{"tags":["global"]}` so
   edge caches re-fetch the new docs immediately.

The stack definition lives at
[`docs-site/docker-compose.yml`](./docs-site/docker-compose.yml) and is
used for the one-time bootstrap only — the workflow doesn't re-apply
it on each release.

## Required GitHub secrets

Configure under **Settings → Secrets and variables → Actions**.

| Name | Used by | How to get it |
|---|---|---|
| `NPM_TOKEN` | `publish-npm` | npmjs.com → Access Tokens → granular automation token, publish scope on `@withl5e/*` and `create-l5e` |
| `VPS_HOST` | `deploy-docker` | Public IP / domain of the Swarm manager |
| `VPS_USER` | `deploy-docker` | SSH user on the manager |
| `VPS_SSH_KEY` | `deploy-docker` | Private key (PEM block) whose public half lives in the manager's `~/.ssh/authorized_keys` |
| `VPS_PORT` *(optional)* | `deploy-docker` | SSH port if not `22` |
| `CF_ZONE_ID` | `deploy-docker` | Cloudflare Zone ID (Cloudflare dashboard → zone → Overview, right sidebar) |
| `CF_TOKEN` | `deploy-docker` | Cloudflare API token with `Zone.Cache Purge` permission, scoped to that zone |

> **ghcr.io auth** uses the auto-provided `GITHUB_TOKEN` — no manual
> secret needed. The Swarm manager needs its own `docker login ghcr.io`
> (see below) so it can pull the image.

## One-time setup on the Swarm manager

Before the first `deploy-docker` run, initialize Swarm (if not already)
and deploy the stack from the committed compose file:

```sh
# 1. Init swarm if this node isn't a manager yet.
docker swarm init   # or --advertise-addr <vps-ip> if it asks

# 2. Create a classic PAT (https://github.com/settings/tokens) with the
#    `read:packages` scope. Then log in so the manager (and any worker
#    nodes via --with-registry-auth) can pull from ghcr.io.
echo <PAT> | docker login ghcr.io -u <github-username> --password-stdin

# 3. Copy the compose file (one time, or whenever it changes).
scp docs-site/docker-compose.yml <user>@<vps>:~/l5e-docs.yml

# 4. Deploy the stack. Stack name `l5e` + service key `docs` →
#    Swarm service `l5e_docs` (the name the workflow updates).
ssh <user>@<vps> "docker stack deploy -c ~/l5e-docs.yml l5e --with-registry-auth"
```

> If the docs image is **public** on ghcr.io (recommended for open
> source docs), step 2 is optional — workers can pull without auth.
> Publish visibility once after the first push: GitHub → your profile
> → Packages → `l5e` → Package settings → Change visibility → Public.

After bootstrap, each stable release runs
`docker service update --image … --with-registry-auth --force l5e_docs`
— no need to re-deploy the stack unless the compose file
itself changes (ports, healthcheck, resource limits, etc).

## Cloudflare cache-tag setup

The release workflow purges `{"tags":["global"]}` on every deploy. For
that to do anything, every docs response served through Cloudflare
must carry the `Cache-Tag: global` header. Either:

- Set the header from the docs-site server (a middleware that adds it
  to every response), **or**
- Add a Cloudflare Transform Rule that injects `Cache-Tag: global`
  on responses for the docs hostname.

Without the header, the purge call returns 200 but has no effect.
Tag-based purge requires a Cloudflare Pro / Business / Enterprise
plan — on the Free plan, swap the workflow body to
`{"purge_everything": true}`.

## Troubleshooting

### "Cannot use a keyword bump while publishable packages disagree"

The three packages have different `version` fields right now. Fix by
running the script with an exact target version — it sets all three
to the same value and clears the mismatch:

```sh
pnpm bump 0.1.1-alpha.2          # whichever value you want them aligned at
```

After this, keyword forms work again.

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

### `service "l5e_docs" not found` in the SSH step

The stack wasn't bootstrapped yet. Run the `docker stack deploy …`
block in "One-time setup" once, then re-run the failed job.

## Out of scope (for now)

- **Automated version bumping** (Changesets, release-please). Manual
  `pnpm bump` is enough at the current velocity.
- **Multi-arch images** (`linux/arm64`). The VPS is x86. Add buildx
  QEMU + multi-platform push when needed.
- **Rollback automation**. To roll back manually:
  ```sh
  ssh user@vps
  docker service update --rollback l5e_docs
  # or pin to a specific older tag:
  docker service update --image ghcr.io/withl5e/l5e:0.1.1-alpha.2 \
    --with-registry-auth --force l5e_docs
  ```
- **Release notifications** (Slack, Discord). Add later if the team
  wants noisier feedback than the GitHub Actions email.
