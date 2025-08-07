#!/bin/bash

echo "Setting up PostgreSQL database for TargetVision..."

# Database configuration
DB_NAME="targetvision"
DB_USER="postgres"
DB_HOST="localhost"
DB_PORT="5432"

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "PostgreSQL is not installed. Please install PostgreSQL first."
    echo "On macOS: brew install postgresql"
    echo "On Ubuntu: sudo apt-get install postgresql postgresql-contrib"
    exit 1
fi

# Check if PostgreSQL service is running
if ! pg_isready -h $DB_HOST -p $DB_PORT &> /dev/null; then
    echo "PostgreSQL service is not running. Starting..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew services start postgresql
    else
        sudo service postgresql start
    fi
    sleep 2
fi

# Create database if it doesn't exist
echo "Creating database '$DB_NAME' if it doesn't exist..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -c "CREATE DATABASE $DB_NAME"

# Install pgvector extension
echo "Installing pgvector extension..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS vector"

echo "Database setup complete!"
echo ""
echo "Next steps:"
echo "1. Copy .env.example to .env and update the DATABASE_URL"
echo "2. Run migrations: cd backend && alembic upgrade head"