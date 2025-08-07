"""Initialize test database without PostgreSQL/pgvector"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, Column, String, DateTime, Integer, Text, JSON, ForeignKey, Float
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

Base = declarative_base()

class Album(Base):
    __tablename__ = "albums"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    photos = relationship("Photo", back_populates="album", cascade="all, delete-orphan")

class Photo(Base):
    __tablename__ = "photos"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = Column(String(255), nullable=False)
    stored_path = Column(String(500), nullable=False)
    album_id = Column(String, ForeignKey("albums.id"), nullable=True)
    
    # Photo metadata
    width = Column(Integer)
    height = Column(Integer)
    size_bytes = Column(Integer)
    mime_type = Column(String(50))
    
    # AI-generated content
    description = Column(Text)
    # Note: SQLite doesn't support Vector type, using Text to store JSON array
    description_embedding = Column(Text)  
    
    # Additional metadata
    tags = Column(JSON, default=list)
    photo_metadata = Column(JSON, default=dict)
    
    # Timestamps
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    processed_at = Column(DateTime(timezone=True))
    
    # Relationships
    album = relationship("Album", back_populates="photos")

class ChatSession(Base):
    __tablename__ = "chat_sessions"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=True)
    title = Column(String(255))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_active = Column(Integer, default=1)  # SQLite uses Integer for boolean
    
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, ForeignKey("chat_sessions.id"), nullable=False)
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    
    # For semantic search on conversation history
    content_embedding = Column(Text)  # Store as JSON array in SQLite
    
    # Related photos returned in response
    photo_ids = Column(JSON, default=list)
    
    # Additional context
    message_metadata = Column(JSON, default=dict)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    session = relationship("ChatSession", back_populates="messages")

if __name__ == "__main__":
    # Create SQLite database
    DATABASE_URL = "sqlite:///./targetvision_test.db"
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    
    print("✅ Test database initialized successfully!")
    print(f"📁 Database file: targetvision_test.db")
    print("\nTables created:")
    print("  - albums")
    print("  - photos")
    print("  - chat_sessions")
    print("  - chat_messages")
    print("\nNote: This is a SQLite database for testing.")
    print("For production, install PostgreSQL with pgvector extension.")