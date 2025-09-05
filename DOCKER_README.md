# TargetVision Docker Deployment Guide

## Quick Start

### 1. Prerequisites
- Docker Engine 20.10+
- Docker Compose 2.0+
- 4GB+ available RAM
- 10GB+ available disk space

### 2. Initial Setup

```bash
# Clone the repository (if not already done)
git clone <repository-url>
cd targetvision

# Run the setup script
./scripts/docker-setup.sh

# Or manually:
cp .env.template .env
# Edit .env with your API keys and configuration
docker-compose build
docker-compose up -d
```

### 3. Access the Application
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs
- Database Admin (dev only): http://localhost:8080

## Configuration

### Environment Variables
Edit the `.env` file to configure:
- **Database**: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- **API Keys**: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `SMUGMUG_API_KEY`, `SMUGMUG_API_SECRET`
- **Ports**: `BACKEND_PORT`, `FRONTEND_PORT`, `DB_PORT`
- **CORS**: `CORS_ORIGINS` (comma-separated list)

### Development vs Production

#### Development Mode
```bash
# Start with hot-reloading and debugging enabled
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Access services:
# - Frontend: http://localhost:3000
# - Backend: http://localhost:8000
# - Database: localhost:5432
# - Adminer: http://localhost:8080
# - Redis: localhost:6379
```

#### Production Mode
```bash
# Start with optimizations and security hardening
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Services are optimized with:
# - Resource limits
# - Health checks
# - Automatic restarts
# - SSL support (configure nginx-ssl service)
# - Database backups
```

## Service Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│   Backend   │────▶│  Database   │
│   (Nginx)   │     │  (FastAPI)  │     │ (PostgreSQL)│
└─────────────┘     └─────────────┘     └─────────────┘
                           │                    │
                           ▼                    ▼
                    ┌─────────────┐      ┌─────────────┐
                    │    Redis    │      │  pgvector   │
                    │   (Cache)   │      │ (Embeddings)│
                    └─────────────┘      └─────────────┘
```

### Container Details

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| frontend | nginx:alpine | 3000 | Serves static files, reverse proxy |
| backend | python:3.11-slim | 8000 | FastAPI application |
| database | pgvector/pgvector:pg15 | 5432 | PostgreSQL with vector extensions |
| redis | redis:7-alpine | 6379 | Caching and sessions |

## Common Operations

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f database
```

### Database Management

#### Backup
```bash
# Manual backup
docker-compose exec database pg_dump -U targetvision targetvision | gzip > backup_$(date +%Y%m%d).sql.gz

# Automated backup (production)
# Backups run daily via postgres-backup service
```

#### Restore
```bash
# Restore from backup
gunzip -c backup_20240101.sql.gz | docker-compose exec -T database psql -U targetvision targetvision

# Or use the restore script
docker-compose exec database /restore.sh backup_20240101.sql.gz
```

### Scaling
```bash
# Scale backend workers
docker-compose up -d --scale backend=3
```

### Updates and Maintenance

#### Update Application
```bash
# Pull latest changes
git pull

# Rebuild images
docker-compose build

# Restart services
docker-compose down
docker-compose up -d
```

#### Database Migrations
```bash
# Run migrations
docker-compose exec backend alembic upgrade head

# Create new migration
docker-compose exec backend alembic revision --autogenerate -m "description"
```

## Troubleshooting

### Container Won't Start
```bash
# Check logs
docker-compose logs backend
docker-compose logs database

# Verify configuration
docker-compose config

# Check health status
curl http://localhost:8000/health
```

### Database Connection Issues
```bash
# Test database connection
docker-compose exec database pg_isready -U targetvision

# Check database logs
docker-compose logs database

# Verify environment variables
docker-compose exec backend env | grep DATABASE
```

### Reset Everything
```bash
# Stop and remove all containers, volumes, and images
docker-compose down -v --rmi all

# Fresh start
docker-compose build --no-cache
docker-compose up -d
```

## Performance Tuning

### Backend Optimization
- Adjust `WORKER_CONCURRENCY` in .env
- Configure `DB_POOL_SIZE` and `DB_MAX_OVERFLOW`
- Enable Redis caching: `ENABLE_REDIS_CACHE=true`

### Database Optimization
See production configuration in `docker-compose.prod.yml`:
- Shared buffers: 256MB
- Effective cache size: 1GB
- Connection pool: 200 max connections

### Frontend Optimization
- Static assets cached for 30 days
- GZIP compression enabled
- HTTP/2 support (with SSL)

## Security Considerations

### Production Deployment
1. **Change default passwords** in .env
2. **Use secrets management** (Docker Secrets or external vault)
3. **Enable SSL/TLS** (configure nginx-ssl service)
4. **Restrict database access** (remove exposed ports)
5. **Regular security updates** (rebuild images monthly)

### SSL Configuration
```bash
# Generate SSL certificates with Let's Encrypt
docker-compose run certbot certonly --webroot --webroot-path=/var/www/certbot \
    --email your-email@example.com \
    --agree-tos \
    --no-eff-email \
    -d yourdomain.com
```

## Monitoring

### Health Checks
```bash
# Backend health
curl http://localhost:8000/health

# Service status
docker-compose ps

# Resource usage
docker stats
```

### Logs Aggregation
For production, consider integrating with:
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Grafana Loki
- CloudWatch (AWS)
- Stackdriver (GCP)

## Support

For issues or questions:
1. Check service logs: `docker-compose logs`
2. Verify environment configuration: `.env` file
3. Review Docker documentation
4. Create an issue in the repository

## License
See LICENSE file in the repository root.