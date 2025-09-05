# Feature Request: Docker Containerization

## Overview
Prepare the TargetVision SmugMug-integrated RAG application for deployment using Docker containers to enable consistent, scalable, and portable deployments across different environments.

## Current Architecture
- **Backend**: Python FastAPI server with PostgreSQL + pgvector
- **Frontend**: Vanilla JavaScript served as static files
- **Database**: PostgreSQL 15+ with pgvector extension
- **External APIs**: SmugMug OAuth, Anthropic Claude Vision, OpenAI CLIP

## Implementation Requirements

### 1. Multi-Container Setup
- **App Container**: Python FastAPI backend
- **Database Container**: PostgreSQL with pgvector extension
- **Web Server Container**: Nginx for serving frontend static files and reverse proxy
- **Redis Container** (optional): For caching and session management

### 2. Backend Container (Python FastAPI)
- Base image: `python:3.9-slim` or `python:3.11-alpine`
- Install dependencies from `requirements.txt`
- Configure environment variables for:
  - Database connection (PostgreSQL)
  - API keys (Anthropic, OpenAI, SmugMug)
  - CORS settings
  - Security settings
- Health check endpoint
- Non-root user for security
- Volume mounts for persistent data if needed

### 3. Database Container (PostgreSQL + pgvector)
- Base image: `postgres:15` with pgvector extension
- Environment variables for database credentials
- Persistent volume for data storage
- Initialize pgvector extension on startup
- Database migration scripts
- Backup strategy consideration

### 4. Frontend Container (Nginx)
- Base image: `nginx:alpine`
- Serve static JavaScript/HTML/CSS files
- Reverse proxy configuration to backend API
- GZIP compression for static assets
- Security headers configuration
- SSL/TLS termination ready

### 5. Docker Compose Configuration
```yaml
# Example structure needed:
services:
  backend:
    # FastAPI app container
  database:
    # PostgreSQL with pgvector
  frontend:
    # Nginx serving static files
  redis: # optional
    # Caching layer
```

### 6. Environment Configuration
- `.env` file template with required variables
- Separate configurations for development/staging/production
- Secret management best practices
- Environment-specific overrides

### 7. Development Workflow
- Docker Compose for local development
- Hot reloading for backend development
- Volume mounts for frontend development
- Database seeding scripts
- Easy setup instructions

### 8. Production Considerations
- Multi-stage builds for optimized image sizes
- Security scanning integration
- Resource limits and constraints
- Logging configuration (structured logging)
- Monitoring and health checks
- Graceful shutdown handling

### 9. CI/CD Integration
- Dockerfile optimization
- Image tagging strategy
- Automated builds
- Security scanning
- Deployment scripts

## Files to Create/Modify

### New Files Needed
- `Dockerfile` (backend)
- `docker-compose.yml` (multi-service orchestration)
- `docker-compose.dev.yml` (development overrides)
- `docker-compose.prod.yml` (production optimizations)
- `.dockerignore` (exclude unnecessary files)
- `nginx.conf` (Nginx configuration)
- `docker/nginx/Dockerfile` (custom Nginx image)
- `docker/postgres/init.sql` (database initialization)
- `.env.template` (environment variables template)
- `scripts/docker-setup.sh` (setup automation)

### Existing Files to Modify
- Add Docker-related instructions to main README
- Update `backend/main.py` for containerized environment
- Modify database connection handling for Docker networking
- Update CORS settings for containerized frontend

## Technical Specifications

### Backend Container Requirements
- Python 3.9+ with FastAPI
- PostgreSQL client libraries
- Image processing libraries (Pillow, etc.)
- API client libraries (anthropic, openai, requests-oauthlib)
- Health check on `/health` endpoint
- Graceful shutdown signal handling

### Database Container Requirements
- PostgreSQL 15+ with pgvector extension pre-installed
- Persistent volume mounting
- Backup-friendly configuration
- Connection pooling ready
- Migration script execution

### Frontend Container Requirements
- Nginx with optimized static file serving
- Reverse proxy to backend API
- CORS headers configuration
- Security headers (CSP, HSTS, etc.)
- Compression enabled (gzip/brotli)

### Networking Requirements
- Internal Docker network for service communication
- Exposed ports: 80/443 (frontend), 5432 (database, dev only)
- Environment-based port configuration
- Service discovery via Docker DNS

## Security Considerations
- Non-root containers
- Secrets management (Docker secrets or external vault)
- Network segmentation
- Regular security updates
- Minimal base images
- Read-only filesystems where possible

## Performance Optimizations
- Multi-stage builds for smaller images
- Layer caching optimization
- Resource limits and requests
- Connection pooling
- Static file caching headers

## Deployment Scenarios
- Local development (docker-compose)
- CI/CD testing environments
- Production deployment (Docker Swarm or Kubernetes ready)
- Cloud provider container services (AWS ECS, Google Cloud Run, etc.)

## Success Criteria
- [ ] Application runs identically across all environments
- [ ] One-command local development setup (`docker-compose up`)
- [ ] Production-ready containers with security best practices
- [ ] Documented deployment process
- [ ] Health checks and monitoring integration
- [ ] Database migrations work in containerized environment
- [ ] All existing functionality preserved
- [ ] Performance comparable to non-containerized deployment

## Priority: High
This containerization will enable consistent deployments, easier scaling, and simplified development environment setup for the TargetVision application.