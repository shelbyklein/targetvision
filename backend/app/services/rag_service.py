from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
import json
import anthropic
from app.core.config import settings
from app.models import Photo, ChatMessage, ChatSession
from app.services.embedding_service import EmbeddingService

class RAGService:
    def __init__(self):
        self.client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        self.embedding_service = EmbeddingService()
    
    async def search_photos(
        self,
        query: str,
        db: Session,
        limit: int = 10,
        threshold: float = 0.7
    ) -> List[Photo]:
        """Search for photos using vector similarity"""
        
        # Generate embedding for the query
        query_embedding = await self.embedding_service.generate_embedding(query)
        
        if not query_embedding:
            return []
        
        # Perform vector search using pgvector
        sql = text("""
            SELECT id, filename, description, 
                   1 - (description_embedding <=> :embedding::vector) as similarity
            FROM photos
            WHERE description_embedding IS NOT NULL
            ORDER BY description_embedding <=> :embedding::vector
            LIMIT :limit
        """)
        
        results = db.execute(
            sql,
            {
                "embedding": json.dumps(query_embedding),
                "limit": limit
            }
        ).fetchall()
        
        # Filter by threshold and convert to Photo objects
        photo_ids = [r[0] for r in results if r[3] >= threshold]
        
        if not photo_ids:
            return []
        
        photos = db.query(Photo).filter(Photo.id.in_(photo_ids)).all()
        
        # Sort photos by similarity score
        photo_dict = {p.id: p for p in photos}
        sorted_photos = [photo_dict[pid] for pid in photo_ids if pid in photo_dict]
        
        return sorted_photos
    
    async def generate_response(
        self,
        query: str,
        context_photos: List[Photo],
        chat_history: Optional[List[ChatMessage]] = None
    ) -> str:
        """Generate a response using the retrieved context"""
        
        # Build context from photos
        context = "Retrieved photos and their descriptions:\n\n"
        for i, photo in enumerate(context_photos, 1):
            context += f"{i}. {photo.filename}: {photo.description}\n"
        
        # Build conversation with Claude format
        system_prompt = """You are a helpful assistant that helps users find and understand their photos. 
        Use the provided photo descriptions to answer questions about the user's photo collection.
        Be specific and reference the actual photos when relevant."""
        
        # Build messages in Claude format
        messages = []
        
        if chat_history:
            for msg in chat_history[-5:]:  # Include last 5 messages for context
                # Claude uses 'user' and 'assistant' roles
                if msg.role in ['user', 'assistant']:
                    messages.append({
                        "role": msg.role,
                        "content": msg.content
                    })
        
        # Add current query with context
        messages.append({
            "role": "user",
            "content": f"Context about photos in my collection:\n{context}\n\nMy question: {query}"
        })
        
        try:
            message = self.client.messages.create(
                model="claude-3-sonnet-20240229",  # Use Sonnet for general chat
                max_tokens=500,
                temperature=0.7,
                system=system_prompt,
                messages=messages
            )
            
            return message.content[0].text if message.content else "I couldn't generate a response."
            
        except Exception as e:
            print(f"Error generating response: {e}")
            return "I'm sorry, I couldn't generate a response at this time."
    
    async def process_chat_message(
        self,
        message: str,
        session_id: str,
        db: Session
    ) -> Dict[str, Any]:
        """Process a chat message and return response with relevant photos"""
        
        # Search for relevant photos
        photos = await self.search_photos(message, db, limit=5)
        
        # Get chat history
        session = db.query(ChatSession).filter_by(id=session_id).first()
        chat_history = []
        if session:
            chat_history = db.query(ChatMessage).filter_by(
                session_id=session_id
            ).order_by(ChatMessage.created_at).all()
        else:
            # Create new session
            session = ChatSession(id=session_id, title=message[:100])
            db.add(session)
        
        # Generate response
        response_text = await self.generate_response(message, photos, chat_history)
        
        # Save messages to database
        user_message = ChatMessage(
            session_id=session_id,
            role="user",
            content=message,
            content_embedding=await self.embedding_service.generate_embedding(message)
        )
        
        assistant_message = ChatMessage(
            session_id=session_id,
            role="assistant",
            content=response_text,
            photo_ids=[p.id for p in photos],
            content_embedding=await self.embedding_service.generate_embedding(response_text)
        )
        
        db.add(user_message)
        db.add(assistant_message)
        db.commit()
        
        return {
            "response": response_text,
            "photos": [
                {
                    "id": p.id,
                    "filename": p.filename,
                    "description": p.description,
                    "url": f"/uploads/{p.stored_path}"
                }
                for p in photos
            ],
            "session_id": session_id
        }