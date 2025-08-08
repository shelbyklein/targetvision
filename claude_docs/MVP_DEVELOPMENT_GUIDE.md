# MVP Development Guide

## Objective
Build a minimal viable product that can:
1. Connect to SmugMug account via OAuth
2. Sync photo metadata from SmugMug
3. Process photos with Claude Vision API
4. Enable basic search functionality

## Phase 1: Foundation (Days 1-3)

### 1.1 Project Setup
```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install core dependencies
pip install fastapi uvicorn python-dotenv httpx pillow
pip install psycopg2-binary pgvector sqlalchemy
pip install anthropic openai-clip-torch
```

### 1.2 Environment Configuration
Create `.env` file:
```
SMUGMUG_API_KEY=your_key
SMUGMUG_API_SECRET=your_secret
ANTHROPIC_API_KEY=your_claude_key
DATABASE_URL=postgresql://user:pass@localhost/targetvision
```

### 1.3 Database Setup
```sql
CREATE DATABASE targetvision;
CREATE EXTENSION vector;

CREATE TABLE photos (
    id SERIAL PRIMARY KEY,
    smugmug_id VARCHAR(255) UNIQUE,
    image_url TEXT,
    title VARCHAR(255),
    caption TEXT,
    keywords TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ai_metadata (
    id SERIAL PRIMARY KEY,
    photo_id INTEGER REFERENCES photos(id),
    description TEXT,
    ai_keywords TEXT[],
    embedding vector(512),
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Phase 2: SmugMug Integration (Days 4-6)

### 2.1 OAuth Implementation
```python
# backend/smugmug_auth.py
- Implement OAuth 1.0a flow
- Request token endpoint
- Authorization redirect
- Access token exchange
- Token storage in session
```

### 2.2 Photo Sync Service
```python
# backend/smugmug_sync.py
- Fetch user albums
- Retrieve photos with pagination
- Store metadata in PostgreSQL
- Handle rate limiting (max 100 requests/minute)
```

### Testing Checkpoint
- [ ] OAuth flow completes successfully
- [ ] Photos appear in database
- [ ] Pagination works for large albums

## Phase 3: AI Processing (Days 7-9)

### 3.1 Image Processor
```python
# backend/ai_processor.py
- Download image from SmugMug URL
- Resize for Claude API (2200px max dimension)
- Send to Claude Vision API
- Parse description and keywords
- Generate embeddings with CLIP
```

### 3.2 Batch Processing
```python
# backend/queue_manager.py
- Process photos in batches of 10
- Handle API rate limits
- Store results in ai_metadata table
- Track processing status
```

### Testing Checkpoint
- [ ] Single image processing works
- [ ] Descriptions are meaningful
- [ ] Embeddings stored correctly
- [ ] Batch processing completes

## Phase 4: Search API (Days 10-11)

### 4.1 Search Endpoints
```python
# backend/main.py FastAPI routes
POST /auth/smugmug/callback
GET  /photos/sync
POST /photos/process/{photo_id}
POST /photos/process/batch
GET  /search?q={query}
```

### 4.2 Vector Search
```python
# backend/search.py
- Text embedding generation
- Cosine similarity search
- Hybrid text + vector search
- Return ranked results
```

## Phase 5: Minimal Frontend (Days 12-14)

### 5.1 Basic HTML Interface
```html
<!-- frontend/index.html -->
- SmugMug connect button
- Photo grid display
- Search bar
- Results view
```

### 5.2 JavaScript Integration
```javascript
// frontend/app.js
- OAuth redirect handling
- Fetch API calls to backend
- Dynamic photo loading
- Search functionality
```

## MVP Deliverables Checklist

### Core Features
- [ ] SmugMug OAuth connection
- [ ] Photo metadata sync
- [ ] AI description generation
- [ ] Vector search functionality
- [ ] Basic web interface

### Essential Endpoints
- [ ] `/auth/smugmug` - OAuth flow
- [ ] `/photos/sync` - Trigger sync
- [ ] `/photos/process/batch` - Process photos
- [ ] `/search` - Search photos

### Minimal UI
- [ ] Connect account button
- [ ] Photo gallery view
- [ ] Search bar
- [ ] Results display

## Success Criteria
1. User can authenticate with SmugMug
2. System syncs at least 100 photos
3. AI processes photos at 1 photo/second
4. Search returns relevant results in <500ms
5. UI is functional on desktop browsers

## Next Steps After MVP
- Add metadata editing interface
- Implement incremental sync
- Add export functionality
- Optimize for mobile
- Add user session management