#!/bin/bash
set -e

# Flumenx BOS Automated Weekly MongoDB Backup Script
# Creates a compressed, timestamped MongoDB archive and prunes backups older than retention policy.

BACKUP_DIR="${BACKUP_DIR:-/home/flumenx-erp/backups/mongodb}"
DB_NAME="${DB_NAME:-flumenx_portal}"
MONGODB_URI="${MONGODB_URI:-mongodb://127.0.0.1:27017/${DB_NAME}}"
RETENTION_DAYS=30

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_backup_${TIMESTAMP}.gz"

mkdir -p "${BACKUP_DIR}"

echo "================================================================================"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting MongoDB backup for database: ${DB_NAME}"
echo "================================================================================"

if command -v mongodump >/dev/null 2>&1; then
    mongodump --uri="${MONGODB_URI}" --archive="${BACKUP_FILE}" --gzip
    FILE_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup successfully created: ${BACKUP_FILE} (${FILE_SIZE})"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: mongodump utility not found on PATH. Attempting /usr/bin/mongodump..."
    if [ -x "/usr/bin/mongodump" ]; then
        /usr/bin/mongodump --uri="${MONGODB_URI}" --archive="${BACKUP_FILE}" --gzip
        FILE_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup successfully created: ${BACKUP_FILE} (${FILE_SIZE})"
    else
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: mongodump is not installed. Please install mongodb-database-tools."
        exit 1
    fi
fi

# Retention cleanup (older than 30 days)
find "${BACKUP_DIR}" -name "${DB_NAME}_backup_*.gz" -type f -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Pruned database backups older than ${RETENTION_DAYS} days."
echo "================================================================================"
