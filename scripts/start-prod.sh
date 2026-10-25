#!/usr/bin/env sh
# Production start (Render free plan / any single-instance host):
# creates the SQLite schema, seeds demo data if the DB is empty, then serves on $PORT.
set -e
export DATABASE_URL="${DATABASE_URL:-file:/tmp/kerem/kerem.db}"
export UPLOAD_DIR="${UPLOAD_DIR:-/tmp/kerem/uploads}"
mkdir -p "$UPLOAD_DIR"
node node_modules/tsx/dist/cli.mjs scripts/seed.ts --if-empty
exec node node_modules/next/dist/bin/next start -H 0.0.0.0 -p "${PORT:-3000}"
