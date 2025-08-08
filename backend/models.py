from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey, ARRAY
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
# from pgvector.sqlalchemy import Vector  # Commented out for testing without pgvector
from database import Base
from datetime import datetime

class Photo(Base):
    """SmugMug photo metadata"""
    __tablename__ = "photos"
    
    id = Column(Integer, primary_key=True, index=True)
    smugmug_id = Column(String(255), unique=True, nullable=False, index=True)
    smugmug_uri = Column(String(500))
    image_url = Column(Text)
    thumbnail_url = Column(Text)
    title = Column(String(255))
    caption = Column(Text)
    keywords = Column(ARRAY(Text), default=[])
    album_name = Column(String(255))
    album_uri = Column(String(500))
    width = Column(Integer)
    height = Column(Integer)
    format = Column(String(50))
    file_size = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationship to AI metadata
    ai_metadata = relationship("AIMetadata", back_populates="photo", uselist=False, cascade="all, delete-orphan")
    
    def to_dict(self):
        return {
            "id": self.id,
            "smugmug_id": self.smugmug_id,
            "title": self.title,
            "caption": self.caption,
            "keywords": self.keywords,
            "album_name": self.album_name,
            "image_url": self.image_url,
            "thumbnail_url": self.thumbnail_url,
            "width": self.width,
            "height": self.height,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class AIMetadata(Base):
    """AI-generated metadata for photos"""
    __tablename__ = "ai_metadata"
    
    id = Column(Integer, primary_key=True, index=True)
    photo_id = Column(Integer, ForeignKey("photos.id", ondelete="CASCADE"), nullable=False, index=True)
    description = Column(Text)
    ai_keywords = Column(ARRAY(Text), default=[])
    # embedding = Column(Vector(512))  # CLIP ViT-B/32 embeddings - disabled for testing
    confidence_score = Column(Float)
    processing_time = Column(Float)  # Time taken to process in seconds
    model_version = Column(String(100))  # Track which model generated this
    processed_at = Column(DateTime(timezone=True), server_default=func.now())
    approved = Column(Boolean, default=False)
    approved_at = Column(DateTime(timezone=True))
    
    # Relationship to photo
    photo = relationship("Photo", back_populates="ai_metadata")
    
    def to_dict(self):
        return {
            "id": self.id,
            "photo_id": self.photo_id,
            "description": self.description,
            "ai_keywords": self.ai_keywords,
            "confidence_score": self.confidence_score,
            "approved": self.approved,
            "processed_at": self.processed_at.isoformat() if self.processed_at else None
        }

class OAuthToken(Base):
    """Store OAuth tokens for SmugMug"""
    __tablename__ = "oauth_tokens"
    
    id = Column(Integer, primary_key=True, index=True)
    service = Column(String(50), default="smugmug")
    access_token = Column(Text, nullable=False)
    access_token_secret = Column(Text, nullable=False)
    user_id = Column(String(255))  # SmugMug user ID
    username = Column(String(255))  # SmugMug username
    expires_at = Column(DateTime(timezone=True))  # If token expires
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def is_valid(self):
        """Check if token is still valid"""
        if not self.expires_at:
            return True  # No expiration
        return datetime.now() < self.expires_at

class ProcessingQueue(Base):
    """Queue for photos awaiting AI processing"""
    __tablename__ = "processing_queue"
    
    id = Column(Integer, primary_key=True, index=True)
    photo_id = Column(Integer, ForeignKey("photos.id", ondelete="CASCADE"), nullable=False, unique=True)
    status = Column(String(50), default="pending")  # pending, processing, completed, failed
    priority = Column(Integer, default=0)  # Higher number = higher priority
    attempts = Column(Integer, default=0)
    last_error = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))