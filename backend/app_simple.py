"""Simplified app with Claude integration - works without PostgreSQL"""
from fastapi import FastAPI, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict
import uvicorn
from datetime import datetime
import anthropic
import base64
from pathlib import Path
import os
from sentence_transformers import SentenceTransformer
import json
import uuid

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

app = FastAPI(title="TargetVision with Claude")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Claude client
anthropic_client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

# Initialize local embeddings model
embeddings_model = SentenceTransformer('all-MiniLM-L6-v2')

# In-memory storage (for testing)
photo_store = {}
chat_sessions = {}

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
    
    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
    
    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
    
    async def send_message(self, message: str, client_id: str):
        if client_id in self.active_connections:
            await self.active_connections[client_id].send_text(message)

manager = ConnectionManager()

class ChatMessage(BaseModel):
    message: str
    session_id: Optional[str] = None

def encode_image(image_path: str) -> str:
    """Encode image to base64"""
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

def get_image_media_type(filename: str) -> str:
    """Get media type from filename"""
    ext = Path(filename).suffix.lower()
    media_types = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp'
    }
    return media_types.get(ext, 'image/jpeg')

@app.get("/")
async def root():
    return {
        "message": "TargetVision API with Claude",
        "status": "running",
        "features": {
            "vision": "Claude 3 Opus",
            "embeddings": "Local (all-MiniLM-L6-v2)",
            "storage": "In-memory (testing)"
        }
    }

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "claude": "configured",
        "embeddings": "local"
    }

@app.post("/api/photos/upload")
async def upload_photo(file: UploadFile = File(...)):
    """Upload and analyze photo with Claude"""
    
    # Create uploads directory if it doesn't exist
    uploads_dir = Path("./uploads")
    uploads_dir.mkdir(exist_ok=True)
    
    # Save file
    file_path = uploads_dir / file.filename
    content = await file.read()
    
    with open(file_path, "wb") as f:
        f.write(content)
    
    photo_id = f"photo_{len(photo_store) + 1}"
    
    # Analyze with Claude
    try:
        base64_image = encode_image(str(file_path))
        media_type = get_image_media_type(file.filename)
        
        message = anthropic_client.messages.create(
            model="claude-3-opus-20240229",
            max_tokens=300,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": base64_image
                        }
                    },
                    {
                        "type": "text",
                        "text": "Describe this image in detail. What do you see? Include objects, people, scenery, colors, and mood."
                    }
                ]
            }]
        )
        
        description = message.content[0].text if message.content else "No description generated"
        
        # Generate embedding for the description
        embedding = embeddings_model.encode(description).tolist()
        
        # Store photo info
        photo_store[photo_id] = {
            "id": photo_id,
            "filename": file.filename,
            "path": str(file_path),
            "description": description,
            "embedding": embedding,
            "uploaded_at": datetime.utcnow().isoformat()
        }
        
        return {
            "id": photo_id,
            "filename": file.filename,
            "description": description,
            "status": "analyzed",
            "uploaded_at": photo_store[photo_id]["uploaded_at"]
        }
        
    except Exception as e:
        return {
            "id": photo_id,
            "filename": file.filename,
            "error": str(e),
            "status": "error"
        }

@app.post("/api/chat/message")
async def chat_message(msg: ChatMessage):
    """Chat with Claude about photos"""
    
    session_id = msg.session_id or "default"
    
    # Get or create session
    if session_id not in chat_sessions:
        chat_sessions[session_id] = []
    
    # Add user message to history
    chat_sessions[session_id].append({
        "role": "user",
        "content": msg.message
    })
    
    # Search for relevant photos (simple similarity search)
    query_embedding = embeddings_model.encode(msg.message).tolist()
    
    relevant_photos = []
    if photo_store:
        # Calculate similarities
        similarities = []
        for photo_id, photo in photo_store.items():
            if "embedding" in photo:
                # Simple dot product similarity
                similarity = sum(a*b for a, b in zip(query_embedding, photo["embedding"]))
                similarities.append((photo_id, similarity, photo))
        
        # Get top 3 most similar photos
        similarities.sort(key=lambda x: x[1], reverse=True)
        relevant_photos = [photo for _, _, photo in similarities[:3]]
    
    # Build context from photos
    context = ""
    if relevant_photos:
        context = "Here are some relevant photos from the collection:\n"
        for photo in relevant_photos:
            context += f"- {photo['filename']}: {photo['description']}\n"
    
    # Generate response with Claude
    try:
        system_prompt = "You are a helpful assistant that helps users explore their photo collection. Use the context about their photos to answer questions."
        
        user_message = msg.message
        if context:
            user_message = f"{context}\n\nUser question: {msg.message}"
        
        response = anthropic_client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=300,
            system=system_prompt,
            messages=[{
                "role": "user",
                "content": user_message
            }]
        )
        
        response_text = response.content[0].text if response.content else "I couldn't generate a response."
        
        # Add assistant response to history
        chat_sessions[session_id].append({
            "role": "assistant",
            "content": response_text
        })
        
        return {
            "session_id": session_id,
            "message_id": f"msg_{len(chat_sessions[session_id])}",
            "query": msg.message,
            "response": response_text,
            "photos": [
                {
                    "id": p["id"],
                    "filename": p["filename"],
                    "description": p["description"][:100] + "...",
                    "url": f"/uploads/{p['filename']}"
                }
                for p in relevant_photos
            ],
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        return {
            "session_id": session_id,
            "error": str(e),
            "response": f"Error: {str(e)}"
        }

@app.websocket("/api/chat/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """WebSocket endpoint for real-time chat"""
    await manager.connect(websocket, client_id)
    
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            session_id = message_data.get('session_id', 'default')
            user_message = message_data.get('content', '')
            
            # Get or create session
            if session_id not in chat_sessions:
                chat_sessions[session_id] = []
            
            # Add user message to history
            chat_sessions[session_id].append({
                "role": "user",
                "content": user_message
            })
            
            # Search for relevant photos
            query_embedding = embeddings_model.encode(user_message).tolist()
            
            relevant_photos = []
            if photo_store:
                similarities = []
                for photo_id, photo in photo_store.items():
                    if "embedding" in photo:
                        similarity = sum(a*b for a, b in zip(query_embedding, photo["embedding"]))
                        similarities.append((photo_id, similarity, photo))
                
                similarities.sort(key=lambda x: x[1], reverse=True)
                relevant_photos = [photo for _, _, photo in similarities[:3]]
            
            # Build context from photos
            context = ""
            if relevant_photos:
                context = "Here are some relevant photos from the collection:\n"
                for photo in relevant_photos:
                    context += f"- {photo['filename']}: {photo['description']}\n"
            
            # Generate response with Claude
            try:
                system_prompt = "You are a helpful assistant that helps users explore their photo collection. Use the context about their photos to answer questions."
                
                prompt_message = user_message
                if context:
                    prompt_message = f"{context}\n\nUser question: {user_message}"
                
                response = anthropic_client.messages.create(
                    model="claude-3-5-sonnet-20241022",
                    max_tokens=300,
                    system=system_prompt,
                    messages=[{
                        "role": "user",
                        "content": prompt_message
                    }]
                )
                
                response_text = response.content[0].text if response.content else "I couldn't generate a response."
                
                # Add assistant response to history
                chat_sessions[session_id].append({
                    "role": "assistant",
                    "content": response_text
                })
                
                # Send response
                ws_response = {
                    "id": str(uuid.uuid4()),
                    "type": "assistant",
                    "content": response_text,
                    "timestamp": datetime.utcnow().isoformat(),
                    "photos": [
                        {
                            "id": p["id"],
                            "filename": p["filename"],
                            "description": p["description"][:100] + "...",
                            "url": f"/uploads/{p['filename']}"
                        }
                        for p in relevant_photos
                    ],
                    "session_id": session_id
                }
                
                await manager.send_message(json.dumps(ws_response), client_id)
                
            except Exception as e:
                error_response = {
                    "id": str(uuid.uuid4()),
                    "type": "error",
                    "content": f"Error: {str(e)}",
                    "timestamp": datetime.utcnow().isoformat(),
                    "session_id": session_id
                }
                await manager.send_message(json.dumps(error_response), client_id)
    
    except WebSocketDisconnect:
        manager.disconnect(client_id)
        print(f"Client {client_id} disconnected")
    except Exception as e:
        print(f"Error in WebSocket connection: {e}")
        manager.disconnect(client_id)

@app.get("/api/photos/search")
async def search_photos(query: str, limit: int = 20):
    """Search photos using embeddings"""
    
    if not photo_store:
        return {
            "query": query,
            "total": 0,
            "results": [],
            "message": "No photos uploaded yet"
        }
    
    # Generate query embedding
    query_embedding = embeddings_model.encode(query).tolist()
    
    # Calculate similarities
    similarities = []
    for photo_id, photo in photo_store.items():
        if "embedding" in photo:
            similarity = sum(a*b for a, b in zip(query_embedding, photo["embedding"]))
            similarities.append((photo_id, similarity, photo))
    
    # Sort by similarity
    similarities.sort(key=lambda x: x[1], reverse=True)
    
    # Get top results
    results = []
    for photo_id, similarity, photo in similarities[:limit]:
        results.append({
            "id": photo["id"],
            "filename": photo["filename"],
            "description": photo["description"],
            "similarity": similarity,
            "url": f"/uploads/{photo['filename']}"
        })
    
    return {
        "query": query,
        "total": len(results),
        "results": results
    }

@app.get("/api/photos/list")
async def list_photos():
    """List all uploaded photos"""
    return {
        "total": len(photo_store),
        "photos": list(photo_store.values())
    }

if __name__ == "__main__":
    print("\n🚀 Starting TargetVision with Claude Integration...")
    print("✨ Claude API: Connected")
    print("🧠 Embeddings: Local (all-MiniLM-L6-v2)")
    print("📍 API: http://localhost:7050")
    print("📚 Docs: http://localhost:7050/docs")
    print("\nPress Ctrl+C to stop\n")
    
    uvicorn.run(app, host="0.0.0.0", port=7050)