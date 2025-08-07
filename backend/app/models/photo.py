from sqlalchemy import Column, String, DateTime, Integer, Float, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from pgvector.sqlalchemy import Vector
import uuid
from app.db.database import Base

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
    description_embedding = Column(Vector(1536))  # Max dimension (OpenAI), will work with smaller too
    
    # Additional metadata
    tags = Column(JSON, default=list)
    metadata = Column(JSON, default=dict)
    
    # Timestamps
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    processed_at = Column(DateTime(timezone=True))
    
    # Relationships
    album = relationship("Album", back_populates="photos")