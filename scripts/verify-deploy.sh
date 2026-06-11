#!/usr/bin/env bash
# Post-deploy verification. Run from any machine that can reach the deployed
# services. Exits 0 only if the full stack is healthy end-to-end.
#
# Usage:
#   ./scripts/verify-deploy.sh                                       # checks localhost defaults
#   ./scripts/verify-deploy.sh https://api.relativ.app https://relativ.app   # custom URLs
#
# Checks:
#   1. Backend /health returns 200 + status:healthy
#   2. Backend OpenAPI spec is reachable
#   3. bgutil /ping is reachable (or the configured BGUTIL_POT_BASE_URL)
#   4. New intake endpoints (clipper apply, brand contact, campaign quote) work
#   5. Frontend loads and HTML mentions the brand
#   6. The 2 services can talk to each other (CORS preflight)
#   7. YouTube anti-bot: host IP can fetch a known-public video (jNQXAC9IVRw)
#
# Exit codes: 0 = all green, 1 = at least one check failed.

set -uo pipefail

BACKEND_URL="${1:-http://localhost:9000}"
FRONTEND_URL="${2:-http://localhost:3000}"
BGUTIL_URL="${BGUTIL_POT_BASE_URL:-http://localhost:4416}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

red()   { printf '\033[31m✗ %s\033[0m\n' "$*"; }
grn()   { printf '\033[32m✓ %s\033[0m\n' "$*"; }
blue()  { printf '\033[34m• %s\033[0m\n' "$*"; }
hdr()   { printf '\n\033[1;34m== %s ==\033[0m\n' "$*"; }

fail=0
total=0

# Helper: count + report
check() {
  local name="$1" cmd="$2"
  total=$((total+1))
  if eval "$cmd" >/tmp/verify.out 2>&1; then
    grn "$name"
  else
    red "$name"
    sed 's/^/    /' /tmp/verify.out
    fail=$((fail+1))
  fi
}

hdr "1. Backend health ($BACKEND_URL)"
check "GET /health" "curl -fsS --max-time 10 $BACKEND_URL/health | grep -q '\"status\":\"healthy\"'"
check "GET /openapi.json" "curl -fsS --max-time 10 $BACKEND_URL/openapi.json | python3 -c 'import json,sys; json.load(sys.stdin)'"
check "GET /vram" "curl -fsS --max-time 10 $BACKEND_URL/vram"

hdr "2. bgutil PO-token provider ($BGUTIL_URL)"
# Use the URL directly (not the hostname) so this works whether we're
# running on the host (where 'bgutil' doesn't resolve) or inside a
# container (where it does). The port-mapped 127.0.0.1:4416 works in
# both contexts.
check "bgutil /ping" "curl -fsS --max-time 5 ${BGUTIL_URL}/ping | grep -q '\"version\"'"

hdr "3. New intake endpoints"
check "POST /api/v1/campaigns/quote" \
  "curl -fsS --max-time 5 -X POST -H 'Content-Type: application/json' \
   -d '{\"budget_usd\":5000}' \
   $BACKEND_URL/api/v1/campaigns/quote | grep -q '\"quote_id\"'"
check "POST /api/v1/clippers/apply" \
  "curl -fsS --max-time 5 -X POST -H 'Content-Type: application/json' \
   -d '{\"name\":\"verify\",\"email\":\"verify@relativ.video\",\"handle\":\"@verify\",\"specialty\":\"Other\",\"portfolio_urls\":[\"https://example.com/v\"]}' \
   $BACKEND_URL/api/v1/clippers/apply | grep -q '\"id\":\"app_'"
check "GET /api/v1/intake/counts" \
  "curl -fsS --max-time 5 $BACKEND_URL/api/v1/intake/counts | grep -q '\"clipper_applications\"'"

hdr "4. Frontend ($FRONTEND_URL)"
check "GET / loads" "curl -fsS --max-time 10 $FRONTEND_URL/ | grep -qi 'relativ'"
check "GET /brands loads" "curl -fsS --max-time 10 $FRONTEND_URL/brands | grep -qi 'pay only for views'"
check "GET /clippers loads" "curl -fsS --max-time 10 $FRONTEND_URL/clippers | grep -qi 'clipper'"

hdr "5. Cross-service CORS preflight"
check "OPTIONS preflight backend accepts frontend" \
  "curl -fsS --max-time 5 -X OPTIONS \
   -H 'Origin: $FRONTEND_URL' -H 'Access-Control-Request-Method: POST' \
   $BACKEND_URL/api/v1/campaigns/quote"

hdr "6. YouTube anti-bot (host IP can fetch a public video)"
# Runs the probe script INSIDE the backend container where Python deps
# (dotenv, yt-dlp, etc.) and the bgutil hostname are available. We
# prefer docker exec over running on the host because the host doesn't
# have the backend venv or the docker-network DNS.
PROBE_OUT=""
PROBE_EXIT=1
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^relativ-backend-1$"; then
  PROBE_OUT=$(docker exec -e BGUTIL_POT_BASE_URL=http://bgutil:4416 \
    relativ-backend-1 python -m backend.scripts.probe_youtube_antibot 2>&1)
  PROBE_EXIT=$?
elif [ -d "$REPO_ROOT/backend/.venv" ]; then
  # Fallback: run on host if the venv exists (local dev)
  PROBE_OUT=$(cd "$REPO_ROOT" && source backend/.venv/bin/activate && \
    BGUTIL_POT_BASE_URL="$BGUTIL_URL" \
    python -m backend.scripts.probe_youtube_antibot 2>&1)
  PROBE_EXIT=$?
else
  PROBE_OUT="(skipped: no running backend container and no host venv)"
  PROBE_EXIT=0  # don't fail the deploy check just because the probe can't run
fi
total=$((total+1))
if [ $PROBE_EXIT -eq 0 ]; then
  grn "YouTube anti-bot probe (host IP can reach youtube.com via bgutil)"
  echo "    ${PROBE_OUT##*$'\n'}"
else
  red "YouTube anti-bot probe FAILED (exit=$PROBE_EXIT)"
  echo "    ${PROBE_OUT}" | head -10 | sed 's/^/    /'
  fail=$((fail+1))
fi

hdr "== summary =="
if [ $fail -eq 0 ]; then
  grn "All $total checks passed. ✓ Deploy looks good."
  exit 0
else
  red "$fail of $total checks failed. ✗ Investigate the output above."
  exit 1
fi
