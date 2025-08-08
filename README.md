# TargetVision MVP

SmugMug-integrated RAG application with AI-powered photo metadata generation and intelligent search.

## Quick Setup

### 1. Prerequisites
- Python 3.9+
- PostgreSQL 15+ with pgvector extension
- SmugMug API credentials
- Anthropic API key

### 2. Install Dependencies
```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install Python packages
pip install -r requirements.txt

# Install PyTorch and CLIP (CPU version)
pip install torch torchvision open-clip-torch --index-url https://download.pytorch.org/whl/cpu
```

### 3. Setup Database
```bash
# Option 1: Using Docker (recommended)
docker run -d --name targetvision-db \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=targetvision \
  -p 5432:5432 \
  ankane/pgvector

# Option 2: Local PostgreSQL
# Install PostgreSQL 15+ and pgvector extension
# Create database: createdb targetvision

# Apply schema
psql -h localhost -U postgres -d targetvision -f database/schema.sql
```

### 4. Configure Environment
```bash
# Copy template
cp .env.example .env

# Edit .env with your API keys:
# - SMUGMUG_API_KEY
# - SMUGMUG_API_SECRET
# - ANTHROPIC_API_KEY
```

### 5. Run the Application
```bash
# Start FastAPI server
python backend/main.py

# API will be available at: http://localhost:8000
# API docs at: http://localhost:8000/docs
```

## API Endpoints

### Authentication
- `POST /auth/smugmug/request` - Start OAuth flow
- `GET /auth/smugmug/callback` - OAuth callback
- `GET /auth/status` - Check auth status

### Photos
- `POST /photos/sync` - Sync photos from SmugMug
- `GET /photos` - List photos
- `GET /photos/{id}` - Get single photo
- `DELETE /photos/{id}` - Delete photo

## Project Structure
```
targetvision/
├── backend/          # Python FastAPI backend
├── database/         # SQL schemas
├── frontend/         # Web interface (coming soon)
├── tests/           # Test files
└── claude_docs/     # Development documentation
```

## Development Status
Week 1 Foundation ✅ Complete:
- FastAPI backend setup
- SmugMug OAuth 1.0a implementation
- Photo sync from SmugMug to PostgreSQL
- Database models with pgvector support

Week 2 (Next Steps):
- Claude Vision API integration
- CLIP embeddings generation
- Vector similarity search
- Basic web interface

## Documentation
See `claude_docs/` for detailed development guides and roadmap.