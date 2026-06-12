#!/usr/bin/env bash
# Daily backup of the RelatiV Postgres data volume + outputs.
# Runs on the Hetzner box via cron, keeps last 7 days of backups locally.
# For off-host backup, sync to Hetzner Storage Box (€3/mo) or S3.
#
# Cron entry (run at 3am IST = 21:30 UTC):
#   30 21 * * * /app/RelatiV/backend/scripts/backup.sh >> /var/log/relativ-backup.log 2>&1
#
# Restore:
#   gunzip -c /app/RelatiV/backups/relativ-db-YYYYMMDD.sql.gz | \
#     docker exec -i relativ-db-1 psql -U relativ_admin -d relativ_db
#   tar -xzf /app/RelatiV/backups/relativ-outputs-YYYYMMDD.tar.gz -C /

set -euo pipefail

BACKUP_DIR="/app/RelatiV/backups"
DATE=$(date +%Y%m%d)
RETENTION_DAYS=7
DB_CONTAINER="relativ-db-1"
DB_USER="relativ_admin"
DB_NAME="relativ_db"
OUTPUTS_DIR="/app/outputs"

mkdir -p "$BACKUP_DIR"

# ── Database dump ────────────────────────────────────────────────────────────
echo "[$(date)] Dumping Postgres..."
docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" \
  | gzip > "$BACKUP_DIR/relativ-db-$DATE.sql.gz"
DB_SIZE=$(stat -c%s "$BACKUP_DIR/relativ-db-$DATE.sql.gz" 2>/dev/null || echo "?")
echo "[$(date)] DB dump: $DB_SIZE bytes"

# ── Outputs archive ──────────────────────────────────────────────────────────
if [ -d "$OUTPUTS_DIR" ] && [ -n "$(ls -A "$OUTPUTS_DIR" 2>/dev/null)" ]; then
  echo "[$(date)] Archiving outputs..."
  tar -czf "$BACKUP_DIR/relativ-outputs-$DATE.tar.gz" -C "$(dirname "$OUTPUTS_DIR")" \
    "$(basename "$OUTPUTS_DIR")" 2>/dev/null || echo "[$(date)] (outputs archive failed, continuing)"
  OUT_SIZE=$(stat -c%s "$BACKUP_DIR/relativ-outputs-$DATE.tar.gz" 2>/dev/null || echo "?")
  echo "[$(date)] Outputs archive: $OUT_SIZE bytes"
fi

# ── Retention ────────────────────────────────────────────────────────────────
echo "[$(date)] Pruning backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -type f -mtime +$RETENTION_DAYS -name "relativ-*" -delete
REMAINING=$(ls -1 "$BACKUP_DIR" 2>/dev/null | wc -l)
echo "[$(date)] Remaining backups: $REMAINING"

# ── Disk space check ─────────────────────────────────────────────────────────
DISK_PCT=$(df /app --output=pcent 2>/dev/null | tail -1 | tr -d ' %')
if [ "$DISK_PCT" -gt 80 ] 2>/dev/null; then
  echo "[$(date)] ⚠️  DISK WARNING: $DISK_PCT% full"
fi

echo "[$(date)] Backup complete."
