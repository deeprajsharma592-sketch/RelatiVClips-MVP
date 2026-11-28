#!/usr/bin/env bash
# Hello render: scaffold a Hyperframes project on the 5s fixture, open the
# preview, render it once, and report what came out. Repeatable and idempotent.
#
#   ./scripts/hello_render.sh              # scaffold if needed, preview, render
#   KEEP_PREVIEW=1 ./scripts/hello_render.sh   # leave the studio running
#
# Uses the pinned CLI so a render today matches a render next month.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
VERSION="${EDIT_HYPERFRAMES_VERSION:-0.9.104}"
HF=(npx -y "hyperframes@${VERSION}")
PROJECT="$ROOT/blocks/_sandbox"
SAMPLE="$ROOT/data/fixtures/sample_5s.mp4"
OUT="${OUT:-$ROOT/data/renders/sandbox_hello.mp4}"

echo "== 0. fixtures"
"$ROOT/.venv_edit/bin/python" scripts/make_fixtures.py >/dev/null 2>&1 || python3 scripts/make_fixtures.py >/dev/null
test -f "$SAMPLE" || { echo "missing $SAMPLE"; exit 1; }

echo "== 1. scaffold (hyperframes init)"
if [ ! -f "$PROJECT/index.html" ]; then
  "${HF[@]}" init "$PROJECT" \
    --video "$SAMPLE" \
    --skip-transcribe \
    --skip-skills \
    --non-interactive
else
  echo "   reusing $PROJECT"
fi

echo "== 2. preview (background studio)"
"${HF[@]}" preview "$PROJECT" --background --no-open >/dev/null 2>&1 || true
"${HF[@]}" preview "$PROJECT" --status || true

echo "== 3. render"
mkdir -p "$(dirname "$OUT")"
START=$(date +%s)
"${HF[@]}" render "$PROJECT" --output "$OUT" --fps 30 --quality draft --workers 1 --quiet
END=$(date +%s)
echo "   rendered in $((END - START))s -> $OUT"

echo "== 4. verify"
ffprobe -v error \
  -show_entries format=duration,size \
  -show_entries stream=codec_name,width,height,r_frame_rate \
  -of default=nw=1 "$OUT"

if [ "${KEEP_PREVIEW:-0}" != "1" ]; then
  "${HF[@]}" preview "$PROJECT" --stop >/dev/null 2>&1 || true
  echo "== preview stopped (KEEP_PREVIEW=1 to keep it)"
fi

echo "== done"
