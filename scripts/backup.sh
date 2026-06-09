#!/bin/bash

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
DOCKER_COMPOSE_FILE="docker-compose.prod.yml"

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "Starting database backup..."

# Backup PostgreSQL
BACKUP_FILE="$BACKUP_DIR/postgres_$(date +%Y%m%d_%H%M%S).sql.gz"
docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T postgres pg_dump -U webrtc webrtc_prod | gzip > "$BACKUP_FILE"
echo "✓ PostgreSQL backup: $BACKUP_FILE"

# Backup Redis
REDIS_BACKUP_FILE="$BACKUP_DIR/redis_$(date +%Y%m%d_%H%M%S).rdb"
docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T redis redis-cli --rdb "$REDIS_BACKUP_FILE"
if [ -f "$REDIS_BACKUP_FILE" ]; then
    gzip "$REDIS_BACKUP_FILE"
    echo "✓ Redis backup: ${REDIS_BACKUP_FILE}.gz"
fi

# Clean old backups
echo "Cleaning old backups (keeping last $RETENTION_DAYS days)..."
find "$BACKUP_DIR" -name "*.gz" -mtime +$RETENTION_DAYS -delete
echo "✓ Old backups cleaned"

echo "Backup completed successfully!"
