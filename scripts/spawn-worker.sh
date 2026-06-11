#!/usr/bin/env bash
# Spawn an opencode worker worktree for a specific lane.
# Usage: spawn-worker.sh <lane-name> <opencode-prompt...>
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

LANE="${1:?lane name required (e.g. day2-hook-calibration)}"
shift
PROMPT="$*"
[ -z "$PROMPT" ] && { echo "PROMPT required"; exit 1; }

BRANCH="lane/${LANE}"
WT="../RelatiV-${LANE}"
echo "[spawn-worker] lane=$LANE branch=$BRANCH worktree=$WT"

if ! git show-ref --verify --quiet "refs/heads/${BRANCH}"; then
  git worktree add -b "${BRANCH}" "${WT}" main
else
  mkdir -p "${WT}" && git worktree add "${WT}" "${BRANCH}" 2>/dev/null || true
fi

cd "${WT}"
echo "[spawn-worker] hand-off prompt for opencode:"
echo "  cd ${WT} && opencode run \"${PROMPT}\""
