# MVP Development Guide

## MVP Objective
Build a minimal viable product in 2 weeks that demonstrates:
1. ✅ SmugMug OAuth authentication works
2. ✅ Can sync and display user's photos (limit 100 for MVP)
3. ✅ AI generates meaningful descriptions via Claude Vision
4. ✅ Vector search returns relevant results
5. ✅ Basic web interface is functional

## Phase 1: Foundation (Days 1-2)

### 1.1 Project Setup
```bash
# Create project structure
mkdir -p targetvision/{backend,frontend,database,tests}
cd targetvision

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install core dependencies
pip install fastapi uvicorn python-dotenv httpx pillow
pip install psycopg2-binary pgvector sqlalchemy alembic
pip install anthropic
# Note: CLIP installation separate due to size
pip install torch torchvision open-clip-torch --index-url https://download.pytorch.org/whl/cpu
```

### 1.2 Environment Configuration

#### Prerequisites - Get API Keys:
1. **SmugMug API**: Register at https://api.smugmug.com/api/developer/apply
2. **Anthropic Claude**: Get key from https://console.anthropic.com/

Create `.env` file:
```bash
# SmugMug OAuth (from SmugMug developer portal)
SMUGMUG_API_KEY=your_api_key_here
SMUGMUG_API_SECRET=your_api_secret_here
SMUGMUG_CALLBACK_URL=http://localhost:8000/auth/callback

# Claude Vision API
ANTHROPIC_API_KEY=your_anthropic_key_here

# Database (adjust for your PostgreSQL setup)
DATABASE_URL=postgresql://postgres:password@localhost:5432/targetvision

# Application
SECRET_KEY=your-secret-key-generate-with-openssl-rand-hex-32
DEBUG=true
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

## Phase 2: SmugMug Integration (Days 3-4)

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

## Phase 3: AI Processing (Days 5-6)

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

## Phase 4: Search API (Days 7-8)

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

## Phase 5: Minimal Frontend (Days 9-10)

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

### Week 1 Deliverables
- [ ] FastAPI server running locally
- [ ] PostgreSQL with pgvector configured
- [ ] SmugMug OAuth flow working
- [ ] Can fetch user's photos from SmugMug
- [ ] Photos stored in database

### Week 2 Deliverables  
- [ ] Claude Vision API integrated
- [ ] AI descriptions generated for photos
- [ ] Vector embeddings created and stored
- [ ] Search endpoint returning results
- [ ] Basic HTML/JS interface working

### Essential API Endpoints
```
POST /auth/smugmug/request   - Start OAuth flow
GET  /auth/smugmug/callback  - OAuth callback
GET  /photos                  - List synced photos
POST /photos/sync             - Sync from SmugMug
POST /photos/{id}/process     - Process single photo
GET  /search?q={query}        - Search photos
```

### Minimal UI Pages
- `index.html` - Landing page with "Connect SmugMug" button
- `gallery.html` - Photo grid after authentication
- `search.html` - Search interface and results

## MVP Success Criteria

### Technical Success
✅ SmugMug OAuth completes without errors
✅ Successfully sync 100 photos from user account
✅ AI generates descriptions for 90%+ of photos
✅ Vector search returns relevant results
✅ Search response time < 1 second
✅ No critical errors in 1-hour test session

### User Experience Success
✅ User can connect SmugMug in < 3 clicks
✅ Photos display within 10 seconds of sync
✅ Search finds relevant photos on first try
✅ Interface works on Chrome/Firefox/Safari

### Cost Success
✅ Processing 100 photos costs < $1 in API fees
✅ Can run on single $20/month server

## Next Steps After MVP
- Add metadata editing interface
- Implement incremental sync
- Add export functionality
- Optimize for mobile
- Add user session management