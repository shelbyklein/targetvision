# 🚀 TargetVision Quick Start Guide

## Current Setup Status ✅

### What's Working:
- ✅ Backend API server (port 7050)
- ✅ Frontend web interface (port 3000)
- ✅ SQLite test database (for development)
- ✅ All Python dependencies installed
- ✅ All Node.js dependencies installed

### Running Servers:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:7050
- **API Documentation**: http://localhost:7050/docs

## How to Start Everything

### 1. Start Backend (Terminal 1)
```bash
cd backend
source venv/bin/activate
python test_server.py
```
Server will run on http://localhost:7050

### 2. Start Frontend (Terminal 2)
```bash
cd frontend
npm run dev
```
Web app will open on http://localhost:3000

## Next Steps for Full Functionality

### 1. Install PostgreSQL (for production)
```bash
# macOS
brew install postgresql@15
brew install pgvector
brew services start postgresql@15

# Create database
createdb targetvision
```

### 2. Add Your API Keys
Edit the `.env` file in the backend directory:
```bash
ANTHROPIC_API_KEY=your-anthropic-api-key-here
OPENAI_API_KEY=your-openai-api-key-here  # Optional
USE_LOCAL_EMBEDDINGS=true  # Set to true to avoid OpenAI costs
```

### 3. Run Full Backend (with database)
Once PostgreSQL is installed:
```bash
cd backend
source venv/bin/activate
alembic upgrade head  # Run migrations
python -m uvicorn app.main:app --port 7050
```

## Testing the Application

### Test Photo Upload
1. Go to http://localhost:3000
2. Click "Upload Photos" tab
3. Drag and drop an image

### Test Chat Interface
1. Go to http://localhost:3000
2. Type a message like "Show me sunset photos"
3. Press Enter or click Send

### Test API Directly
```bash
# Health check
curl http://localhost:7050/api/health

# Upload test
curl -X POST http://localhost:7050/api/photos/upload \
  -F "file=@test.jpg"

# Chat test
curl -X POST http://localhost:7050/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello"}'
```

## Current Limitations (Test Mode)

Without PostgreSQL and API keys:
- ❌ No actual image analysis (returns test data)
- ❌ No embeddings or vector search
- ❌ No persistent data storage
- ❌ No Claude AI responses

## Troubleshooting

### Port Already in Use
If port 7050 is taken, change it in:
- `backend/test_server.py` (line with `port=7050`)
- `frontend/.env.local` (update API_URL)

### Database Issues
Currently using SQLite for testing. For full functionality:
1. Install PostgreSQL with pgvector
2. Update DATABASE_URL in `.env`
3. Run migrations with alembic

### Missing Dependencies
```bash
# Backend
cd backend
source venv/bin/activate
pip install -r requirements.txt

# Frontend
cd frontend
npm install
```

## Architecture Overview

```
TargetVision/
├── backend/          # Python FastAPI server
│   ├── app/         # Application code
│   ├── venv/        # Python virtual environment
│   └── test_server.py # Test server (current)
├── frontend/         # Next.js React app
│   ├── app/         # Next.js app router
│   └── components/  # React components
└── uploads/         # Uploaded photos (local storage)
```

## Features When Fully Configured

- 📸 **Photo Upload**: Drag & drop multiple photos
- 🤖 **AI Analysis**: Claude 3 describes your photos
- 🔍 **Smart Search**: Natural language photo search
- 💬 **Chat Interface**: Conversational photo discovery
- 🗂️ **Albums**: Organize photos into collections
- ⚡ **Real-time**: WebSocket for instant responses

---

**Status**: Running in test mode without AI features
**Next Step**: Add API keys to enable AI functionality