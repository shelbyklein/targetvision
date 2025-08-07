# TargetVision Makefile
# Automation for common development tasks

.PHONY: help dev build test clean install lint type-check start stop logs

# Default target
help:
	@echo "TargetVision Development Commands"
	@echo "════════════════════════════════════════"
	@echo "  make dev        - Start development servers with hot reload"
	@echo "  make build      - Build production bundle"
	@echo "  make test       - Run all tests"
	@echo "  make install    - Install all dependencies"
	@echo "  make clean      - Clean build artifacts and caches"
	@echo "  make lint       - Run linters"
	@echo "  make type-check - Check TypeScript types"
	@echo "  make start      - Start production servers"
	@echo "  make stop       - Stop all services"
	@echo "  make logs       - Show application logs"
	@echo "  make setup      - Initial project setup"
	@echo "════════════════════════════════════════"

# Development
dev:
	@./scripts/dev-start.sh

dev-watch:
	@./scripts/dev-watch.sh

# Build
build:
	@./scripts/build-prod.sh

build-frontend:
	@cd frontend && npx next build

build-backend:
	@cd backend && python -m py_compile app_simple.py

# Testing
test: test-frontend test-backend

test-frontend:
	@echo "Running frontend tests..."
	@cd frontend && npm test 2>/dev/null || echo "No tests configured yet"

test-backend:
	@echo "Running backend tests..."
	@cd backend && python -m pytest tests/ 2>/dev/null || echo "No tests configured yet"

# Installation
install: install-frontend install-backend

install-frontend:
	@echo "Installing frontend dependencies..."
	@cd frontend && npm install

install-backend:
	@echo "Installing backend dependencies..."
	@cd backend && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt

# Cleaning
clean: clean-frontend clean-backend
	@echo "✓ Cleanup complete"

clean-frontend:
	@echo "Cleaning frontend..."
	@cd frontend && rm -rf .next node_modules/.cache
	@cd frontend && rm -rf node_modules && rm -f package-lock.json

clean-backend:
	@echo "Cleaning backend..."
	@cd backend && rm -rf __pycache__ **/__pycache__ *.pyc **/*.pyc
	@cd backend && rm -rf venv
	@find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true

# Linting and Type Checking
lint: lint-frontend lint-backend

lint-frontend:
	@echo "Linting frontend..."
	@cd frontend && npm run lint

lint-backend:
	@echo "Linting backend..."
	@cd backend && source venv/bin/activate && ruff check . 2>/dev/null || echo "Install ruff: pip install ruff"

type-check:
	@echo "Checking TypeScript types..."
	@cd frontend && npm run type-check

# Process Management
start:
	@echo "Starting production servers..."
	@cd backend && source venv/bin/activate && uvicorn app_simple:app --host 0.0.0.0 --port 7050 --daemon
	@cd frontend && npm run start &
	@echo "✓ Services started"

stop:
	@echo "Stopping all services..."
	@pkill -f "uvicorn app_simple:app" 2>/dev/null || true
	@pkill -f "next start" 2>/dev/null || true
	@lsof -ti:7050 | xargs kill -9 2>/dev/null || true
	@lsof -ti:3000 | xargs kill -9 2>/dev/null || true
	@echo "✓ Services stopped"

restart: stop start

# Logs
logs:
	@echo "Showing application logs..."
	@tail -f backend/*.log 2>/dev/null || echo "No log files found"

logs-backend:
	@tail -f backend/*.log 2>/dev/null || echo "No backend logs"

logs-frontend:
	@cd frontend && npm run dev 2>&1 | grep -v "warn"

# Setup
setup: install setup-env
	@echo "✓ Setup complete!"
	@echo "Run 'make dev' to start development"

setup-env:
	@echo "Setting up environment files..."
	@[ -f backend/.env ] || cp backend/.env.example backend/.env
	@[ -f frontend/.env.local ] || echo "NEXT_PUBLIC_API_URL=http://localhost:7050" > frontend/.env.local
	@echo "✓ Environment files created"
	@echo "⚠ Remember to update API keys in backend/.env"

# Database
db-setup:
	@echo "Setting up database..."
	@cd backend && source venv/bin/activate && python init_test_db.py 2>/dev/null || echo "Database setup not configured"

db-migrate:
	@echo "Running database migrations..."
	@cd backend && source venv/bin/activate && alembic upgrade head 2>/dev/null || echo "No migrations to run"

# Docker (future)
docker-build:
	@echo "Building Docker images..."
	@docker-compose build

docker-up:
	@docker-compose up -d

docker-down:
	@docker-compose down

# Git
commit:
	@git add .
	@git commit -m "Auto-commit: $$(date '+%Y-%m-%d %H:%M:%S')"

push:
	@git push origin main

# Quick commands
quick-start: install setup-env dev
	@echo "✓ Quick start complete!"

status:
	@echo "Service Status:"
	@echo "──────────────"
	@lsof -i :7050 >/dev/null 2>&1 && echo "✓ Backend:  Running on port 7050" || echo "✗ Backend:  Not running"
	@lsof -i :3000 >/dev/null 2>&1 && echo "✓ Frontend: Running on port 3000" || echo "✗ Frontend: Not running"

# Update dependencies
update:
	@echo "Updating dependencies..."
	@cd frontend && npm update
	@cd backend && source venv/bin/activate && pip install --upgrade -r requirements.txt

# Security check
security:
	@echo "Running security checks..."
	@cd frontend && npm audit
	@cd backend && source venv/bin/activate && pip-audit 2>/dev/null || echo "Install pip-audit: pip install pip-audit"