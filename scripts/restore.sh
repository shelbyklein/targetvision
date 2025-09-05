#!/bin/bash

# Database restore script for TargetVision
# This script restores PostgreSQL database from backup files

set -e

# Configuration
BACKUP_DIR="/backups"
DB_HOST="${DB_HOST:-database}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-targetvision}"
DB_USER="${POSTGRES_USER:-targetvision}"

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

# Function to list available backups
list_backups() {
    log_info "Available backups:"
    local i=1
    for backup in $(ls -t "${BACKUP_DIR}"/backup_${DB_NAME}_*.sql.gz 2>/dev/null); do
        local size=$(du -h "${backup}" | cut -f1)
        local date=$(stat -c %y "${backup}" | cut -d' ' -f1,2)
        echo "  ${i}) $(basename ${backup}) - ${size} - ${date}"
        ((i++))
    done
    
    if [ $i -eq 1 ]; then
        log_warn "No backups found in ${BACKUP_DIR}"
        exit 1
    fi
}

# Main restore function
restore_backup() {
    local backup_file=$1
    
    if [ ! -f "${backup_file}" ]; then
        log_error "Backup file not found: ${backup_file}"
        exit 1
    fi
    
    log_warn "WARNING: This will replace all data in database '${DB_NAME}'"
    read -p "Are you sure you want to continue? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        log_info "Restore cancelled"
        exit 0
    fi
    
    log_info "Starting restore from: ${backup_file}"
    
    # Drop and recreate database
    log_info "Dropping existing database..."
    psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -c "DROP DATABASE IF EXISTS ${DB_NAME};" postgres
    
    log_info "Creating new database..."
    psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -c "CREATE DATABASE ${DB_NAME};" postgres
    
    # Enable pgvector extension
    log_info "Enabling pgvector extension..."
    psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c "CREATE EXTENSION IF NOT EXISTS vector;"
    
    # Restore from backup
    log_info "Restoring data..."
    if gunzip -c "${backup_file}" | psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" --no-password; then
        log_info "Restore completed successfully!"
    else
        log_error "Restore failed!"
        exit 1
    fi
}

# Main script
if [ "$1" == "--list" ] || [ "$1" == "-l" ]; then
    list_backups
    exit 0
elif [ "$1" == "--file" ] || [ "$1" == "-f" ]; then
    if [ -z "$2" ]; then
        log_error "Please specify a backup file"
        exit 1
    fi
    restore_backup "$2"
elif [ -z "$1" ]; then
    # Interactive mode
    list_backups
    echo
    read -p "Select backup number to restore (or 'q' to quit): " selection
    
    if [ "$selection" == "q" ]; then
        log_info "Restore cancelled"
        exit 0
    fi
    
    # Get the selected backup file
    backup_file=$(ls -t "${BACKUP_DIR}"/backup_${DB_NAME}_*.sql.gz 2>/dev/null | sed -n "${selection}p")
    
    if [ -z "${backup_file}" ]; then
        log_error "Invalid selection"
        exit 1
    fi
    
    restore_backup "${backup_file}"
else
    # Assume first argument is backup filename
    restore_backup "${BACKUP_DIR}/$1"
fi

log_info "Restore process completed"