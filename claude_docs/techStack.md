# Technology Stack

## Core Technologies

### Backend Framework
**FastAPI (Python 3.9+)**
- *Why:* Modern async framework, automatic API docs, type hints
- *Version:* 0.104+
- *Key Features:* WebSocket support, OAuth integration, async/await
- *Setup:* `pip install fastapi uvicorn[standard]`

### Database
**PostgreSQL 15+ with pgvector**
- *Why:* Robust RDBMS with vector search capabilities
- *Extensions:* pgvector for embeddings, pg_trgm for text search
- *Setup:*
```bash
docker run -d \
  --name targetvision-db \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  ankane/pgvector
```

### AI/ML Services
**Anthropic Claude API**
- *Why:* Superior image understanding, structured output
- *Model:* Claude 3 Sonnet/Haiku
- *Usage:* Photo description generation
- *Cost:* ~$0.003 per image

**CLIP (OpenAI)**
- *Why:* Industry standard for image embeddings
- *Model:* ViT-B/32
- *Usage:* Generate searchable vectors
- *Setup:* `pip install torch torchvision open-clip-torch`

### External APIs
**SmugMug API v2**
- *Why:* User's photo source
- *Auth:* OAuth 1.0a
- *Rate Limit:* 100 requests/minute
- *Key Endpoints:* /user, /album, /image

### Frontend
**Vanilla JavaScript (ES6+)**
- *Why:* No build step, maximum simplicity for MVP
- *Features:* Fetch API, async/await, modules
- *Compatibility:* Chrome 90+, Firefox 88+, Safari 14+

**Tailwind CSS**
- *Why:* Rapid UI development, responsive by default
- *Version:* 3.0+ (via CDN for MVP)
- *Setup:* `<script src="https://cdn.tailwindcss.com"></script>`

## Development Tools

### Python Dependencies
```txt
# requirements.txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
python-dotenv==1.0.0
httpx==0.25.0
pillow==10.1.0
anthropic==0.7.0
psycopg2-binary==2.9.9
pgvector==0.2.3
sqlalchemy==2.0.23
alembic==1.12.1
python-jose[cryptography]==3.3.0
python-multipart==0.0.6
oauthlib==3.2.2
torch==2.1.0
open-clip-torch==2.23.0
```

### Database ORM
**SQLAlchemy 2.0**
- *Why:* Mature ORM, async support, type hints
- *Features:* Migrations with Alembic, connection pooling
- *Models:* User, Photo, AIMetadata, Embedding

### Testing
**pytest**
- *Why:* Simple, powerful, great plugin ecosystem
- *Setup:* `pip install pytest pytest-asyncio pytest-cov`
- *Run:* `pytest tests/ --cov=backend`

### Development Environment
**Visual Studio Code**
- Extensions: Python, Pylance, Black formatter
- Settings: Format on save, type checking

**Docker & Docker Compose**
- *Why:* Consistent development environment
- *Services:* PostgreSQL, pgvector, Redis (future)
```yaml
# docker-compose.yml
version: '3.8'
services:
  db:
    image: ankane/pgvector
    environment:
      POSTGRES_DB: targetvision
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
```

## Infrastructure (Deployment)

### Hosting Options

#### MVP/Development
**Local Machine**
- FastAPI: `uvicorn backend.main:app --reload`
- PostgreSQL: Docker container
- Frontend: Served by FastAPI

#### Production Option 1: DigitalOcean
**Droplet ($20/month)**
- 2GB RAM, 50GB SSD
- Ubuntu 22.04 LTS
- Nginx reverse proxy
- Let's Encrypt SSL

**Managed Database ($15/month)**
- PostgreSQL 15
- 1GB RAM, 10GB storage
- Automated backups

#### Production Option 2: Railway
**Platform ($5-20/month)**
- Auto-deploy from GitHub
- Built-in PostgreSQL
- Environment management
- SSL included

### Monitoring & Logging
**Sentry**
- Error tracking
- Performance monitoring
- Free tier: 5k events/month

**LogDNA/Datadog**
- Centralized logging
- Metrics dashboard
- Alerting

## Security Considerations

### Authentication
- OAuth 1.0a for SmugMug
- JWT tokens for sessions
- Secure cookie storage
- HTTPS only in production

### API Security
- Rate limiting with FastAPI
- Input validation
- SQL injection prevention (ORM)
- CORS configuration

### Secrets Management
```bash
# .env file (never commit!)
SMUGMUG_API_KEY=xxx
SMUGMUG_API_SECRET=xxx
ANTHROPIC_API_KEY=xxx
DATABASE_URL=postgresql://...
SECRET_KEY=<generated-secret>
```

## Performance Optimization

### Caching Strategy
**In-Memory (Python dict)**
- Session data
- Recent searches
- API responses (5 min TTL)

**Database**
- Processed images
- Embeddings
- Search results

### Image Processing
- Resize before upload (2200px max)
- Progressive JPEG encoding
- Lazy loading in frontend
- CDN for static assets (future)

### Database Optimization
- Indexes on frequently queried columns
- pgvector HNSW index for fast similarity search
- Connection pooling
- Query optimization

## Cost Analysis

### Monthly Estimates (1000 users)

#### API Costs
- Claude API: $300 (100k images @ $0.003)
- SmugMug API: Free
- Total: $300

#### Infrastructure
- Hosting: $20-50
- Database: $15-30
- CDN: $10-20
- Monitoring: $0-20
- Total: $45-120

#### Total Monthly Cost
- MVP: $85
- Production: $345-420
- Per User: $0.35-0.42

## Migration Path

### From MVP to Production
1. Add user authentication
2. Implement caching layer
3. Set up CDN for images
4. Add background job queue
5. Implement rate limiting
6. Add monitoring/alerting

### Scaling Considerations
- Horizontal scaling with load balancer
- Read replicas for database
- Redis for session/cache
- S3 for processed images
- Kubernetes for orchestration

## Alternative Technologies Considered

### Backend
- ❌ Django: Too heavy for MVP
- ❌ Flask: Less modern than FastAPI
- ❌ Node.js: Less ML ecosystem

### Database
- ❌ MongoDB: No native vector search
- ❌ Pinecone: Additional complexity
- ❌ Weaviate: Overkill for MVP

### Frontend
- ❌ React: Build step complexity
- ❌ Vue: Not needed for MVP
- ✅ Vanilla JS: Perfect for MVP

### AI/ML
- ❌ OpenAI Vision: More expensive
- ❌ Local LLM: Too slow
- ✅ Claude: Best quality/cost ratio