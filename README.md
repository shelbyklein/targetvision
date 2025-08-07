# TargetVision - Photo Library RAG Application

A web-based Retrieval Augmented Generation (RAG) application for intelligent photo search and management using natural language.

## Features

- 📸 **Smart Photo Upload**: Upload photos with automatic AI-powered description generation
- 🔍 **Natural Language Search**: Search your photo library using conversational queries
- 💬 **Interactive Chat**: Chat interface for exploring and discovering photos
- 🧠 **AI-Powered**: Uses Claude 3 Opus for understanding images and generating descriptions
- ⚡ **Real-time Updates**: WebSocket support for instant chat responses
- 🗄️ **Vector Search**: Semantic search using embeddings and pgvector

## Tech Stack

### Backend
- Python 3.11+ with FastAPI
- PostgreSQL with pgvector extension
- Anthropic Claude 3 for vision and chat
- OpenAI or local embeddings (Sentence Transformers)
- SQLAlchemy ORM with Alembic migrations
- WebSocket support for real-time chat

### Frontend
- Next.js 14 with TypeScript
- React 18 with Tailwind CSS
- Axios for API communication
- React Dropzone for file uploads
- Socket.io client for real-time chat

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL 14+ with pgvector extension
- Anthropic API key (for Claude 3)
- OpenAI API key (optional, for embeddings) or use local embeddings

### Backend Setup

1. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration:
# - DATABASE_URL=postgresql://postgres:password@localhost:5432/targetvision
# - ANTHROPIC_API_KEY=your-anthropic-api-key
# - OPENAI_API_KEY=your-openai-api-key (optional, for embeddings)
# - USE_LOCAL_EMBEDDINGS=true (to use free local embeddings instead of OpenAI)
```

2. Set up PostgreSQL database:
```bash
# Install PostgreSQL and pgvector (if not already installed)
# macOS: brew install postgresql pgvector
# Ubuntu: sudo apt-get install postgresql postgresql-14-pgvector

cd backend
chmod +x scripts/init_db.sh
./scripts/init_db.sh
```

3. Create virtual environment and install dependencies:
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

4. Run database migrations:
```bash
alembic upgrade head
```

5. Start the backend server:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at http://localhost:8000
API documentation at http://localhost:8000/api/docs

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

The web app will be available at http://localhost:3000

## Project Structure

```
targetvision/
├── backend/
│   ├── app/
│   │   ├── api/          # API endpoints (photos, chat, health)
│   │   ├── core/         # Configuration and settings
│   │   ├── db/           # Database connection and setup
│   │   ├── models/       # SQLAlchemy models
│   │   └── services/     # Business logic (vision, embedding, RAG)
│   ├── alembic/          # Database migrations
│   ├── scripts/          # Utility scripts
│   ├── tests/            # Backend tests
│   └── requirements.txt
├── frontend/
│   ├── app/              # Next.js app directory
│   ├── components/       # React components
│   ├── public/           # Static assets
│   └── package.json
├── uploads/              # Uploaded photos storage
└── @claude_docs/         # Project documentation
```

## Development

### Running Tests

Backend:
```bash
cd backend
pytest tests/
```

Frontend:
```bash
cd frontend
npm test
```

### Code Formatting

Backend:
```bash
black .
ruff check .
```

Frontend:
```bash
npm run lint
```

## API Endpoints

### Photos
- `POST /api/photos/upload` - Upload single photo
- `POST /api/photos/upload-batch` - Upload multiple photos
- `GET /api/photos/search` - Search photos by query
- `GET /api/photos/{photo_id}` - Get photo details

### Chat
- `WS /api/chat/ws/{client_id}` - WebSocket chat connection
- `POST /api/chat/message` - Send chat message (REST)
- `GET /api/chat/history/{session_id}` - Get chat history

### Health
- `GET /api/health` - Health check endpoint

## Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running: `pg_isready`
- Check connection string in `.env`
- Verify pgvector extension: `psql -d targetvision -c "SELECT * FROM pg_extension WHERE extname = 'vector';"`

### API Issues
- Verify Anthropic API key is set in `.env`
- Check Claude API quota and rate limits
- If using OpenAI embeddings, verify OpenAI API key
- To avoid OpenAI costs, set `USE_LOCAL_EMBEDDINGS=true`

## Deployment

See [@claude_docs/01_IMPLEMENTATION_ROADMAP.md](@claude_docs/01_IMPLEMENTATION_ROADMAP.md) for deployment instructions.

## License

MIT