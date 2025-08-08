# Quick Start Guide - TargetVision MVP

## 🚀 UPDATE: SmugMug Integration WORKING!
The backend and SmugMug photo sync are now fully functional. You can skip directly to the "Run the Working System" section if you want to test the existing implementation.

## Before You Begin (30 minutes)

### 1. Get Required API Keys

**SmugMug API (Required)**
1. Go to https://api.smugmug.com/api/developer/apply
2. Fill out the application:
   - Application Name: "TargetVision Development"
   - Application URL: "http://localhost:8000"
   - Callback URL: "http://localhost:8000/auth/callback"
   - Purpose: "Personal photo management with AI"
3. Save your API Key and API Secret (usually approved within 24 hours)

**Anthropic Claude API (Required)**
1. Sign up at https://console.anthropic.com/
2. Add a payment method (required, but has free credits)
3. Generate an API key immediately
4. Save your API key securely

### 2. Install Prerequisites

**Python 3.9+**
```bash
# Check Python version
python3 --version

# Mac: Install with Homebrew
brew install python@3.11

# Ubuntu/Debian
sudo apt update && sudo apt install python3.11 python3.11-venv

# Windows: Download from python.org
```

**PostgreSQL with pgvector**
```bash
# Option 1: Docker (Recommended - requires Docker Desktop)
docker run -d --name targetvision-db \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=targetvision \
  -p 5432:5432 \
  ankane/pgvector

# Option 2: Local PostgreSQL (Mac)
brew install postgresql@15
brew services start postgresql@15
# Then install pgvector extension manually
```

## Day 1: Project Setup (2 hours)

### Step 1: Create Project Structure
```bash
# Create project directory
mkdir targetvision && cd targetvision

# Create folder structure
mkdir -p backend frontend database tests

# Initialize git repository
git init
echo "venv/" >> .gitignore
echo ".env" >> .gitignore
echo "__pycache__/" >> .gitignore
echo "*.pyc" >> .gitignore
```

### Step 2: Setup Python Environment
```bash
# Create virtual environment
python3 -m venv venv

# Activate it
source venv/bin/activate  # Mac/Linux
# OR
venv\Scripts\activate     # Windows

# Upgrade pip
pip install --upgrade pip
```

### Step 3: Install Core Dependencies
```bash
# Create requirements.txt
cat > requirements.txt << 'EOF'
fastapi==0.104.1
uvicorn[standard]==0.24.0
python-dotenv==1.0.0
httpx==0.25.0
oauthlib==3.2.2
psycopg2-binary==2.9.9
pgvector==0.2.3
sqlalchemy==2.0.23
alembic==1.12.1
anthropic==0.7.0
pillow==10.1.0
python-multipart==0.0.6
EOF

# Install dependencies
pip install -r requirements.txt

# Install PyTorch for CLIP (CPU version for development)
pip install torch torchvision open-clip-torch --index-url https://download.pytorch.org/whl/cpu
```

### Step 4: Configure Environment
```bash
# Create .env file
cat > .env << 'EOF'
# SmugMug OAuth (replace with your actual keys)
SMUGMUG_API_KEY=your_api_key_here
SMUGMUG_API_SECRET=your_api_secret_here
SMUGMUG_CALLBACK_URL=http://localhost:8000/auth/callback

# Claude Vision API (replace with your actual key)
ANTHROPIC_API_KEY=your_anthropic_key_here

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/targetvision

# Application
SECRET_KEY=development-secret-key-change-in-production
DEBUG=true
PORT=8000
EOF

# Create .env.example for git
cp .env .env.example
# Then edit .env.example to remove actual keys
```

### Step 5: Setup Database
```bash
# Connect to PostgreSQL
psql -h localhost -U postgres -d targetvision -p 5432
# Password: password (if using Docker)

# Run this SQL to create tables and enable pgvector:
```
```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create photos table
CREATE TABLE photos (
    id SERIAL PRIMARY KEY,
    smugmug_id VARCHAR(255) UNIQUE NOT NULL,
    smugmug_uri VARCHAR(500),
    image_url TEXT,
    title VARCHAR(255),
    caption TEXT,
    keywords TEXT[],
    album_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create AI metadata table
CREATE TABLE ai_metadata (
    id SERIAL PRIMARY KEY,
    photo_id INTEGER REFERENCES photos(id) ON DELETE CASCADE,
    description TEXT,
    ai_keywords TEXT[],
    embedding vector(512),
    confidence_score FLOAT,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved BOOLEAN DEFAULT FALSE
);

-- Create indices for performance
CREATE INDEX idx_photos_smugmug_id ON photos(smugmug_id);
CREATE INDEX idx_ai_metadata_photo_id ON ai_metadata(photo_id);
CREATE INDEX idx_embedding_vector ON ai_metadata USING ivfflat (embedding vector_cosine_ops);

-- Exit psql
\q
```

### Step 6: Create Minimal FastAPI App
```bash
# Create backend/main.py
cat > backend/main.py << 'EOF'
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Create FastAPI app
app = FastAPI(title="TargetVision MVP", version="0.1.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "TargetVision MVP API", "status": "running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "database": "pending", "smugmug": "pending"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
EOF
```

### Step 7: Test the Setup
```bash
# Start the FastAPI server
python backend/main.py

# In another terminal, test the API
curl http://localhost:8000/
# Should return: {"message":"TargetVision MVP API","status":"running"}

# Check API documentation
# Open browser to: http://localhost:8000/docs
```

## Day 2-3: SmugMug OAuth Implementation

See `MVP_DEVELOPMENT_GUIDE.md` for detailed implementation steps.

## Quick Commands Reference

### Start Development Environment
```bash
# Terminal 1: Start PostgreSQL (if using Docker)
docker start targetvision-db

# Terminal 2: Start FastAPI server
cd targetvision
source venv/bin/activate
python backend/main.py
```

### Check Status
```bash
# API health check
curl http://localhost:8000/health

# PostgreSQL connection
psql -h localhost -U postgres -d targetvision -c "SELECT version();"

# Python dependencies
pip list | grep -E "fastapi|anthropic|pgvector"
```

### Common Issues & Solutions

**Issue: PostgreSQL connection refused**
```bash
# Check if PostgreSQL is running
docker ps | grep targetvision-db
# If not running:
docker start targetvision-db
```

**Issue: Module not found errors**
```bash
# Make sure virtual environment is activated
which python  # Should show path in venv folder
# Reinstall dependencies
pip install -r requirements.txt
```

**Issue: SmugMug OAuth not working**
- Ensure API key and secret are correct in .env
- Check callback URL matches exactly
- Verify application is approved on SmugMug

## Next Steps

Once basic setup is working:
1. Implement SmugMug OAuth flow (Day 3-4)
2. Add photo sync endpoint (Day 5-6)
3. Integrate Claude Vision API (Day 7-8)
4. Add vector search (Day 9-10)
5. Build minimal frontend (Day 11-12)
6. Test end-to-end (Day 13-14)

## Getting Help

- SmugMug API Docs: https://api.smugmug.com/api/v2/doc
- FastAPI Docs: https://fastapi.tiangolo.com/
- Anthropic Claude Docs: https://docs.anthropic.com/
- pgvector Docs: https://github.com/pgvector/pgvector

## Run the Working System (NEW!)

### Quick Start with Existing Implementation
```bash
# 1. Start PostgreSQL (if not running)
docker start targetvision-db  # Or your local PostgreSQL

# 2. Activate Python environment
cd targetvision
source venv/bin/activate

# 3. Start the FastAPI server
cd backend
uvicorn main:app --reload --port 8000

# 4. Test SmugMug sync (already configured with USA Archery account)
curl -X POST "http://localhost:8000/photos/sync?limit=10"

# 5. View synced photos
curl http://localhost:8000/photos | python -m json.tool

# 6. Access API documentation
# Open browser to: http://localhost:8000/docs
```

### Current Working Features
- ✅ SmugMug OAuth with USA Archery account
- ✅ Fetch 50+ albums from SmugMug
- ✅ Sync photos with metadata and URLs
- ✅ Store in PostgreSQL database
- ✅ REST API for photo management
- ✅ All timeout and OAuth issues fixed

## Success Checklist

### Already Completed (Day 1):
- [✅] Backend fully implemented with FastAPI
- [✅] SmugMug OAuth working with real account
- [✅] Photo sync fetching real data
- [✅] Database storing photos successfully
- [✅] All integration issues resolved

### Next Steps:
- [ ] Add Anthropic API key for AI descriptions
- [ ] Build frontend web interface
- [ ] Implement search functionality