# Codebase Summary - TargetVision 

## ✅ COMPLETED: MVP + MAJOR REFACTORING ACHIEVEMENT

**Status**: Production-ready application with modular architecture
**Achievement**: 83% code reduction while maintaining full functionality
**Architecture**: Event-driven 17-component system

## Current Project Structure
```
targetvision/
├── backend/                 # Python FastAPI backend
│   ├── __init__.py         # Package init
│   ├── main.py             # FastAPI app & routes
│   ├── config.py           # Settings from environment
│   ├── database.py         # PostgreSQL connection
│   ├── models.py           # SQLAlchemy models
│   ├── smugmug_auth.py     # OAuth 1.0a implementation
│   ├── smugmug_service.py  # SmugMug API client
│   ├── ai_processor.py     # Claude Vision integration
│   ├── embeddings.py       # CLIP vectors (MVP: simple)
│   └── search.py           # Vector search with pgvector
│
├── frontend/               # Modular JavaScript Architecture
│   ├── index.html         # Main application interface
│   ├── app.js             # Main controller (426 lines - 83% reduction!)
│   ├── components/        # UI Components (11)
│   │   ├── AlbumBrowser.js    # Hierarchical navigation (552 lines)
│   │   ├── PhotoGrid.js       # Photo display & selection (463 lines)
│   │   ├── ModalManager.js    # Photo modals & metadata (984 lines)
│   │   ├── SearchManager.js   # Search functionality (492 lines)
│   │   ├── CollectionsManager.js # Photo organization (705 lines)
│   │   ├── ChatManager.js     # Natural language queries (280 lines)
│   │   ├── SettingsManager.js # Configuration (759 lines)
│   │   ├── ToastManager.js    # Notifications (444 lines)
│   │   ├── ProgressManager.js # Loading states (146 lines)
│   │   ├── NavigationManager.js # Page routing (143 lines)
│   │   └── DataManager.js     # Data validation (93 lines)
│   ├── managers/          # Core Managers (4)
│   │   ├── CacheManager.js    # localStorage operations (313 lines)
│   │   ├── StateManager.js    # App state & URL management (389 lines)
│   │   ├── SmugMugAPI.js      # OAuth & synchronization (461 lines)
│   │   └── PhotoProcessor.js  # AI processing & batching (442 lines)
│   ├── services/          # Services (2)
│   │   ├── EventBus.js        # Event communication (66 lines)
│   │   └── APIService.js      # HTTP client (297 lines)
│   ├── utils/             # Utilities (2)
│   │   ├── Constants.js       # Configuration constants (163 lines)
│   │   └── UIUtils.js         # DOM helpers (316 lines)
│   └── styles.css         # Tailwind CSS styling
│
├── database/              # Database setup
│   └── schema.sql         # Initial table definitions
│
├── tests/                # Integration tests
│   └── test_smugmug.py   # Test OAuth and sync
│
├── claude_docs/          # Documentation & Bug Tracking
│   ├── QUICK_START.md    # Getting started guide
│   ├── MVP_DEVELOPMENT_GUIDE.md # Now includes modular architecture guide
│   ├── techStack.md      # Updated with frontend architecture details
│   ├── codebaseSummary.md # This file - updated with achievements
│   ├── projectRoadmap.md # Includes completed refactoring milestone
│   ├── currentTask.md    # Task tracking
│   ├── AI_INTEGRATION_SUCCESS.md # AI integration documentation
│   └── bugs/            # Bug tracking system
│       ├── README.md    # Bug tracking guidelines
│       ├── open/        # New bugs awaiting triage
│       ├── in-progress/ # Bugs currently being worked on
│       └── resolved/    # Fixed bugs for reference
│
├── .env                  # API keys (never commit)
├── .env.example          # Template for .env
├── .gitignore            # Exclude sensitive files
├── requirements.txt      # Python dependencies
└── README.md            # Project overview
```

## Core Modules

### Backend Components

#### main.py
**Purpose:** FastAPI application entry point  
**MVP Routes (Week 1):**
- `GET /` - API status
- `POST /auth/smugmug/request` - Start OAuth
- `GET /auth/smugmug/callback` - Complete OAuth
- `POST /photos/sync` - Sync from SmugMug
- `GET /photos` - List photos

**MVP Routes (Week 2):**
- `POST /photos/{id}/process` - Generate AI description
- `GET /search?q={query}` - Search photos
- `GET /api/health` - Health check

#### smugmug_auth.py
**Purpose:** OAuth 1.0a implementation for SmugMug  
**Key Functions:**
- `get_request_token()` - Step 1 of OAuth
- `get_authorization_url()` - Generate auth URL
- `get_access_token()` - Exchange for access token
- `make_authenticated_request()` - Sign API requests

#### smugmug_service.py
**Purpose:** SmugMug API client  
**Key Functions:**
- `get_user_albums()` - Fetch user's albums
- `get_album_photos()` - Get photos from album
- `download_image()` - Fetch image from URL
- `sync_photos()` - Sync with database

#### ai_processor.py
**Purpose:** Claude Vision API integration  
**Key Functions:**
- `resize_image()` - Prepare for Claude API
- `generate_description()` - Get AI description
- `extract_keywords()` - Parse AI response
- `process_photo()` - Complete pipeline

#### search.py
**Purpose:** Hybrid search implementation  
**Key Functions:**
- `text_search()` - PostgreSQL full-text search
- `vector_search()` - pgvector similarity search
- `hybrid_search()` - Combine both methods
- `rank_results()` - Score and sort results

### Frontend Components

#### app.js
**Purpose:** Main application controller  
**Responsibilities:**
- Initialize app on page load
- Handle routing (if any)
- Manage global state
- Coordinate between modules

#### api.js
**Purpose:** Backend API communication  
**Key Functions:**
- `fetchPhotos()` - Get photo list
- `searchPhotos()` - Search request
- `processPhoto()` - Trigger AI processing
- `syncPhotos()` - Start sync

#### gallery.js
**Purpose:** Photo grid display  
**Features:**
- Lazy loading images
- Infinite scroll
- Photo detail modal
- Batch selection

#### search.js
**Purpose:** Search interface  
**Features:**
- Search bar with autocomplete
- Filter options
- Result display
- Search history

## Data Flow

### Photo Sync Flow
1. User initiates SmugMug connection
2. OAuth flow completes
3. System fetches user's albums
4. Photos metadata saved to database
5. Photos queued for AI processing

### AI Processing Flow
1. Photo retrieved from queue
2. Image downloaded from SmugMug
3. Image resized for Claude API
4. Description generated via Claude
5. Embeddings created with CLIP
6. Results stored in database

### Search Flow
1. User enters search query
2. Query processed (text + embedding)
3. Hybrid search executed
4. Results ranked and returned
5. Frontend displays results

## Database Schema

### MVP Database Tables

**Core Tables (Week 1):**
- **photos** - SmugMug photo metadata
  - id, smugmug_id, image_url, title, caption, keywords
- **oauth_tokens** - Store access tokens (simplified for MVP)
  - id, token, secret, created_at

**AI Tables (Week 2):**
- **ai_metadata** - AI-generated content
  - id, photo_id, description, ai_keywords, embedding(vector), processed_at

### Key Relationships
- photos → ai_metadata (1:1)
- photos → embeddings (1:1)
- users → photos (1:many)
- photos → processing_queue (1:1)

## API Endpoints

### Authentication
- `POST /auth/smugmug` - Start OAuth
- `GET /auth/callback` - Complete OAuth
- `POST /auth/logout` - Clear session

### Photos
- `GET /photos` - List photos
- `GET /photos/{id}` - Get single photo
- `POST /photos/sync` - Sync from SmugMug
- `DELETE /photos/{id}` - Remove photo

### Processing
- `POST /process/{id}` - Process single
- `POST /process/batch` - Process multiple
- `GET /process/status/{job_id}` - Check status

### Search
- `GET /search?q={query}` - Text search
- `POST /search/vector` - Vector search
- `GET /search/history` - User's searches

### Metadata
- `GET /metadata/{photo_id}` - Get AI metadata
- `PUT /metadata/{photo_id}` - Update metadata
- `POST /metadata/approve/{id}` - Approve AI suggestion

## Configuration

### Required Environment Variables
```bash
# SmugMug OAuth (get from https://api.smugmug.com/api/developer/apply)
SMUGMUG_API_KEY=your_key_here
SMUGMUG_API_SECRET=your_secret_here
SMUGMUG_CALLBACK_URL=http://localhost:8000/auth/smugmug/callback

# Claude Vision API (get from https://console.anthropic.com/)
ANTHROPIC_API_KEY=your_claude_key_here

# Database (PostgreSQL with pgvector)
DATABASE_URL=postgresql://postgres:password@localhost:5432/targetvision

# Application Settings
SECRET_KEY=generate-with-openssl-rand-hex-32
DEBUG=true  # Set to false in production
PORT=8000
MAX_PHOTOS_MVP=100  # Limit for MVP testing
```

### MVP Configuration Limits
- **Max photos per sync:** 100 (prevent overwhelming during testing)
- **AI processing rate:** 1 photo/second (avoid rate limits)
- **Search results limit:** 20 (simple pagination)
- **Image resize:** 2200px max dimension (Claude API requirement)
- **Vector dimensions:** 512 (CLIP ViT-B/32 standard)
- **Request timeout:** 30 seconds
- **Database connections:** 5 (pool size for development)

## Development Workflow

### Local Setup
1. Clone repository
2. Create virtual environment
3. Install dependencies
4. Setup PostgreSQL with pgvector
5. Configure .env file
6. Run migrations
7. Start FastAPI server

### Testing
- Unit tests for each module
- Integration tests for workflows
- Manual testing checklist
- Performance benchmarks

### Deployment
- Docker containers
- PostgreSQL on managed service
- FastAPI on cloud platform
- Static files on CDN