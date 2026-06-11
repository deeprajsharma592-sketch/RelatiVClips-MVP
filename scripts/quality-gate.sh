#!/usr/bin/env bash
# Pre-PR quality gate. Run from /app/RelatiV (or any worktree).
# Exits 0 only if backend + frontend pass.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

red()  { printf '\033[31m%s\033[0m\n' "$*"; }
grn()  { printf '\033[32m%s\033[0m\n' "$*"; }
hdr()  { printf '\n\033[1;34m== %s ==\033[0m\n' "$*"; }

PY=backend/.venv/bin/python
fail=0

# --- backend ---
hdr "backend: tests"
if [ ! -x "$PY" ]; then
  red "venv missing: $PY — run: python3 -m venv backend/.venv && backend/.venv/bin/pip install -r backend/requirements.txt"
  fail=1
else
  if ! $PY -m pytest backend/tests/ -q --tb=line 2>&1 | tail -8; then
    fail=1
  fi
fi

# --- frontend ---
hdr "frontend: typecheck"
if [ -d frontend-next/node_modules ]; then
  if ! (cd frontend-next && npx --no-install tsc --noEmit 2>&1 | tail -10); then
    fail=1
  fi
  hdr "frontend: lint"
  if ! (cd frontend-next && npx --no-install eslint src 2>&1 | tail -15); then
    fail=1
  fi
else
  red "frontend-next/node_modules missing — run: cd frontend-next && npm install"
  fail=1
fi

hdr "result"
if [ "$fail" -eq 0 ]; then
  grn "✓ all gates passed"
  exit 0
else
  red "✗ gates failed — fix before pushing"
  exit 1
fi
