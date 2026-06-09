#!/bin/bash

set -e

BACKUP_FILE="${1:-}"
DOCKER_COMPOSE_FILE="docker-compose.prod.yml"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file>"
    echo ""
    echo "Available backups:"
    ls -lh ./backups/postgres_*.sql.gz 2>/dev/null || echo "No backups found"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "⚠️  WARNING: This will restore the database from backup"
echo "Backup file: $BACKUP_FILE"
read -p "Are you sure? (type 'yes' to confirm): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Rollback cancelled"
    exit 0
fi

echo "Starting rollback..."

# Stop backend to disconnect from database
docker-compose -f "$DOCKER_COMPOSE_FILE" stop backend

# Restore PostgreSQL
echo "Restoring PostgreSQL..."
zcat "$BACKUP_FILE" | docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T postgres psql -U webrtc webrtc_prod

# Start backend again
docker-compose -f "$DOCKER_COMPOSE_FILE" start backend

echo "✓ Rollback completed"
echo ""
echo "Please verify the application is working correctly."
