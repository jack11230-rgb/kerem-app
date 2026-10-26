#!/usr/bin/env sh
# Production start (Render or any single-instance host):
# creates the data directories and SQLite schema, seeds demo data ONLY if the DB has no users
# (seed.ts --if-empty never deletes anything), then serves on $PORT.
#
# Paths come from the environment. On a paid Render instance with a persistent disk mounted
# at /data, set DATABASE_URL=file:/data/kerem.db and UPLOAD_DIR=/data/uploads.
# The /tmp fallbacks are for the free plan only and are wiped on every restart.
set -e
export DATABASE_URL="${DATABASE_URL:-file:/tmp/kerem/kerem.db}"
export UPLOAD_DIR="${UPLOAD_DIR:-/tmp/kerem/uploads}"
case "$DATABASE_URL" in
  file:*)
    DB_FILE="${DATABASE_URL#file:}"
    mkdir -p "$(dirname "$DB_FILE")"
    case "$DB_FILE" in /tmp/*) echo "[start] WARNING: database is in /tmp ($DB_FILE); data will not survive restarts" ;; esac
    echo "[start] database: $DB_FILE ($( [ -f "$DB_FILE" ] && echo existing || echo new ))"
    ;;
esac
mkdir -p "$UPLOAD_DIR"
echo "[start] uploads: $UPLOAD_DIR"
node node_modules/tsx/dist/cli.mjs scripts/seed.ts --if-empty
exec node node_modules/next/dist/bin/next start -H 0.0.0.0 -p "${PORT:-3000}"
