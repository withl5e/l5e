#!/usr/bin/env bash
#
# Reference copy of the deploy script that lives at ~/deploy-l5e.sh on the
# Docker Swarm manager node. The release workflow
# (.github/workflows/release.yml) SSHs in and invokes this script after
# pushing a new image to GitLab Container Registry.
#
# Strategy: a rolling `docker service update` on an existing Swarm service.
# This requires the service to exist already — see the one-time setup
# block at the bottom of this file.
#
# Optional env from the workflow:
#   VERSION — the semver from the tag (e.g. 0.1.2-alpha.0). Not used yet;
#             the script always rolls to `:latest`. Switch to the pinned
#             tag if you ever want to deploy a specific build.

set -euo pipefail

IMG=registry.gitlab.com/ducmaster-group/l5e:latest
SERVICE=l5e-docs

echo "→ pulling $IMG on the manager …"
docker pull "$IMG"

if ! docker service inspect "$SERVICE" >/dev/null 2>&1; then
  cat >&2 <<EOF

❌ Service "$SERVICE" does not exist yet on this swarm.

Bootstrap it once before re-running this script. See the
"One-time setup" block at the bottom of $0.
EOF
  exit 1
fi

echo "→ rolling service $SERVICE → $IMG …"
# --with-registry-auth forwards the manager's auth so worker nodes can
# pull from a private registry. --force redeploys even when only the
# image digest behind :latest changed.
docker service update \
  --image "$IMG" \
  --with-registry-auth \
  --force \
  "$SERVICE"

echo "→ pruning dangling images …"
docker image prune -f >/dev/null || true

echo "✓ done. Service state:"
docker service ps --filter desired-state=running --no-trunc "$SERVICE" \
  --format "table {{.Name}}\t{{.Image}}\t{{.CurrentState}}\t{{.Node}}"

# ─── One-time setup (run once on the swarm manager) ────────────────────
#
# Before the very first deploy you have to (a) log in to the registry so
# the manager has credentials to push down to workers, and (b) create the
# service. After that, this script's `service update` keeps it rolling.
#
#   docker login registry.gitlab.com
#
#   docker service create \
#     --name l5e-docs \
#     --replicas 1 \
#     --publish published=8180,target=8080 \
#     --restart-condition any \
#     --update-parallelism 1 \
#     --update-order start-first \
#     --update-failure-action rollback \
#     --with-registry-auth \
#     registry.gitlab.com/ducmaster-group/l5e:latest
#
# Optional tweaks:
#   --update-delay 10s        gap between task replacements during a roll
#   --health-cmd 'curl -fsS http://localhost:8080/ || exit 1'
#   --health-interval 30s --health-timeout 5s --health-retries 3
#                             only roll once the new task answers HTTP
#   --constraint node.role==manager       pin to a specific node if needed
