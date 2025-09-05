#!/bin/bash

# Database backup script for TargetVision
# This script creates timestamped backups of the PostgreSQL database

set -e

# Configuration
BACKUP_DIR="/backups"
DB_HOST="${DB_HOST:-database}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-targetvision}"
DB_USER="${POSTGRES_USER:-targetvision}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/backup_${DB_NAME}_${TIMESTAMP}.sql.gz"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Logging functions
log_info() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

# Perform backup
log_info "Starting backup of database '${DB_NAME}'..."

if pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
    --no-password --verbose --format=plain --no-owner --no-acl \
    | gzip > "${BACKUP_FILE}"; then
    
    log_info "Backup completed successfully: ${BACKUP_FILE}"
    
    # Get file size
    SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
    log_info "Backup size: ${SIZE}"
    
    # Clean up old backups
    log_info "Cleaning up backups older than ${RETENTION_DAYS} days..."
    find "${BACKUP_DIR}" -name "backup_${DB_NAME}_*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete
    
    # List current backups
    log_info "Current backups:"
    ls -lh "${BACKUP_DIR}"/backup_${DB_NAME}_*.sql.gz 2>/dev/null || log_warn "No backups found"
    
else
    log_error "Backup failed!"
    exit 1
fi

log_info "Backup process completed"