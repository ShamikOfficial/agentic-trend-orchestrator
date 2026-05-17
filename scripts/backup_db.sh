#!/usr/bin/env bash
# Nightly Postgres backup to Railway Volume. Schedule via Railway Cron.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/data/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"

mkdir -p "$BACKUP_DIR"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set" >&2
  exit 1
fi

STAMP="$(date -u +%Y-%m-%d)"
OUT="$BACKUP_DIR/db-${STAMP}.sql.gz"

pg_dump "$DATABASE_URL" | gzip > "$OUT"
echo "Wrote $OUT"

find "$BACKUP_DIR" -name 'db-*.sql.gz' -type f -mtime +"$RETENTION_DAYS" -delete
echo "Pruned backups older than ${RETENTION_DAYS} days"
