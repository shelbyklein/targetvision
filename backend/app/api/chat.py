from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import json
import uuid
from datetime import datetime

from app.db.database import get_db
from app.models import ChatSession, ChatMessage
from app.services import RAGService

router = APIRouter()

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
    
    async def broadcast(self, message: str):
        for connection in self.active_connections.values():
            await connection.send_text(message)

manager = ConnectionManager()

@router.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """WebSocket endpoint for real-time chat"""
    await manager.connect(websocket, client_id)
    rag_service = RAGService()
    
    # Get database session
    db = next(get_db())
    
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            # Process message with RAG service
            session_id = message_data.get('session_id', str(uuid.uuid4()))
            result = await rag_service.process_chat_message(
                message=message_data.get('content', ''),
                session_id=session_id,
                db=db
            )
            
            response = {
                "id": str(uuid.uuid4()),
                "type": "assistant",
                "content": result['response'],
                "timestamp": datetime.utcnow().isoformat(),
                "photos": result['photos'],
                "session_id": result['session_id']
            }
            
            await manager.send_message(json.dumps(response), client_id)
            
    except WebSocketDisconnect:
        manager.disconnect(client_id)
        print(f"Client {client_id} disconnected")
    except Exception as e:
        print(f"Error in WebSocket connection: {e}")
        manager.disconnect(client_id)
    finally:
        db.close()

@router.post("/message")
async def send_message(
    message: str,
    session_id: Optional[str] = None,
    db: Session = Depends(get_db)
) -> dict:
    """Send a chat message (REST alternative to WebSocket)"""
    
    if not session_id:
        session_id = str(uuid.uuid4())
    
    rag_service = RAGService()
    result = await rag_service.process_chat_message(
        message=message,
        session_id=session_id,
        db=db
    )
    
    return {
        "session_id": result['session_id'],
        "message_id": str(uuid.uuid4()),
        "query": message,
        "response": result['response'],
        "photos": result['photos'],
        "timestamp": datetime.utcnow().isoformat()
    }

@router.get("/history/{session_id}")
async def get_chat_history(
    session_id: str,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
) -> dict:
    """Get chat history for a session"""
    
    # Get session
    session = db.query(ChatSession).filter_by(id=session_id).first()
    
    if not session:
        raise HTTPException(
            status_code=404,
            detail="Session not found"
        )
    
    # Get messages
    messages = db.query(ChatMessage).filter_by(
        session_id=session_id
    ).order_by(ChatMessage.created_at).limit(limit).offset(offset).all()
    
    total = db.query(ChatMessage).filter_by(session_id=session_id).count()
    
    return {
        "session_id": session_id,
        "messages": [
            {
                "id": msg.id,
                "role": msg.role,
                "content": msg.content,
                "photo_ids": msg.photo_ids or [],
                "created_at": msg.created_at.isoformat() if msg.created_at else None
            }
            for msg in messages
        ],
        "total": total,
        "limit": limit,
        "offset": offset
    }