# Codebase Summary

## Project Structure
```
targetvision/
├── backend/                 # Python FastAPI backend
│   ├── main.py             # FastAPI app entry point & routes
│   ├── models.py           # SQLAlchemy database models
│   ├── database.py         # Database connection & setup
│   ├── smugmug_auth.py     # OAuth 1.0a implementation
│   ├── smugmug_service.py  # SmugMug API client
│   ├── ai_processor.py     # Claude Vision integration
│   ├── embeddings.py       # CLIP embedding generation
│   ├── search.py           # Vector & hybrid search
│   ├── queue_manager.py    # Batch processing queue
│   └── utils.py            # Helper functions
│
├── frontend/               # Vanilla JavaScript web app
│   ├── index.html         # Main HTML page
│   ├── app.js             # Application logic
│   ├── api.js             # Backend API client
│   ├── auth.js            # OAuth handling
│   ├── gallery.js         # Photo grid display
│   ├── search.js          # Search interface
│   └── styles.css         # Tailwind CSS styles
│
├── database/              # Database scripts
│   ├── schema.sql         # Table definitions
│   ├── migrations/        # Schema migrations
│   └── seed.sql          # Test data (dev only)
│
├── scripts/              # Utility scripts
│   ├── setup.sh          # One-click setup
│   ├── test_smugmug.py   # SmugMug API tester
│   └── process_batch.py  # Manual batch processor
│
├── tests/                # Test files
│   ├── test_auth.py      # OAuth flow tests
│   ├── test_search.py    # Search functionality tests
│   └── test_ai.py        # AI processing tests
│
├── claude_docs/          # Project documentation
├── .env                  # Environment variables (not in git)
├── .env.example          # Environment template
├── requirements.txt      # Python dependencies
├── package.json          # Frontend dependencies (if any)
├── docker-compose.yml    # PostgreSQL + pgvector setup
└── README.md            # Project overview
```

## Core Modules

### Backend Components

#### main.py
**Purpose:** FastAPI application and route definitions  
**Key Routes:**
- `POST /auth/smugmug` - Initiate OAuth flow
- `GET /auth/callback` - OAuth callback handler
- `GET /photos` - List synced photos
- `POST /photos/sync` - Trigger SmugMug sync
- `POST /photos/process/{id}` - Process single photo
- `POST /photos/batch` - Process multiple photos
- `GET /search` - Search photos
- `WS /chat` - WebSocket for chat

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

### Core Tables
- **users** - User accounts and OAuth tokens
- **photos** - SmugMug photo metadata
- **ai_metadata** - AI-generated descriptions
- **embeddings** - Vector embeddings for search
- **processing_queue** - Batch processing jobs
- **search_history** - User search queries

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

### Environment Variables
```bash
# SmugMug OAuth
SMUGMUG_API_KEY=
SMUGMUG_API_SECRET=
SMUGMUG_CALLBACK_URL=

# Claude API
ANTHROPIC_API_KEY=

# Database
DATABASE_URL=postgresql://user:pass@localhost/targetvision

# Application
SECRET_KEY=
DEBUG=false
PORT=8000
```

### Key Settings
- Max photos per sync: 100 (MVP)
- AI processing batch size: 10
- Search results limit: 50
- Image resize max: 2200px
- Vector dimensions: 512

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