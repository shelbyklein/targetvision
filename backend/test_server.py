from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import uvicorn
from datetime import datetime

app = FastAPI(title="TargetVision Test Server")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatMessage(BaseModel):
    message: str
    session_id: Optional[str] = None

@app.get("/")
async def root():
    return {
        "message": "TargetVision API Test Server",
        "status": "running",
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "targetvision-test"
    }

@app.post("/api/photos/upload")
async def upload_photo(file: UploadFile = File(...)):
    """Test photo upload endpoint"""
    return {
        "id": "test-photo-id",
        "filename": file.filename,
        "size": file.size,
        "content_type": file.content_type,
        "status": "uploaded (test mode - no processing)",
        "uploaded_at": datetime.utcnow().isoformat()
    }

@app.post("/api/chat/message")
async def chat_message(msg: ChatMessage):
    """Test chat endpoint"""
    return {
        "session_id": msg.session_id or "test-session",
        "message_id": "test-msg-id",
        "query": msg.message,
        "response": f"Test response: I received your message about '{msg.message}'. In production, this would use Claude to generate a response.",
        "photos": [],
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/api/photos/search")
async def search_photos(query: str, limit: int = 20):
    """Test search endpoint"""
    return {
        "query": query,
        "total": 0,
        "limit": limit,
        "results": [],
        "message": "Test mode - no photos indexed yet"
    }

if __name__ == "__main__":
    print("\n🚀 Starting TargetVision Test Server...")
    print("📍 API will be available at: http://localhost:7050")
    print("📚 API docs at: http://localhost:7050/docs")
    print("\nNote: This is a test server without database or AI features.")
    print("Press Ctrl+C to stop the server.\n")
    
    uvicorn.run(app, host="0.0.0.0", port=7050)