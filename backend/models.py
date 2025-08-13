from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey, ARRAY, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY as PgArray
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from pgvector.sqlalchemy import Vector
from database import Base
from datetime import datetime

class Album(Base):
    """SmugMug album metadata"""
    __tablename__ = "albums"
    
    id = Column(Integer, primary_key=True, index=True)
    smugmug_id = Column(String(255), unique=True, nullable=False, index=True)
    smugmug_uri = Column(String(500))
    title = Column(String(255))
    description = Column(Text)
    keywords = Column(ARRAY(Text), default=[])
    photo_count = Column(Integer, default=0)
    image_count = Column(Integer, default=0)
    video_count = Column(Integer, default=0)
    album_key = Column(String(255))  # SmugMug album key
    url_name = Column(String(255))   # SmugMug URL name
    privacy = Column(String(50))     # Public, Unlisted, Private
    security_type = Column(String(50))
    sort_method = Column(String(50))
    sort_direction = Column(String(10))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationship to photos
    photos = relationship("Photo", back_populates="album")
    
    def to_dict(self):
        return {
            "id": self.id,
            "smugmug_id": self.smugmug_id,
            "title": self.title,
            "description": self.description,
            "keywords": self.keywords,
            "photo_count": self.photo_count,
            "image_count": self.image_count,
            "video_count": self.video_count,
            "album_key": self.album_key,
            "url_name": self.url_name,
            "privacy": self.privacy,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

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
    album_id = Column(Integer, ForeignKey("albums.id"), nullable=True, index=True)
    album_name = Column(String(255))  # Keep for backwards compatibility
    album_uri = Column(String(500))   # Keep for backwards compatibility
    width = Column(Integer)
    height = Column(Integer)
    format = Column(String(50))
    file_size = Column(Integer)
    processing_status = Column(String(50), default="not_processed")  # not_processed, processing, completed, failed
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    album = relationship("Album", back_populates="photos")
    ai_metadata = relationship("AIMetadata", back_populates="photo", uselist=False, cascade="all, delete-orphan")
    collection_items = relationship("CollectionItem", back_populates="photo", cascade="all, delete-orphan")
    
    def to_dict(self, include_ai_metadata=True, include_collections=True, include_embedding=False):
        result = {
            "id": self.id,
            "smugmug_id": self.smugmug_id,
            "title": self.title,
            "caption": self.caption,
            "keywords": self.keywords,
            "album_id": self.album_id,
            "album_name": self.album_name,
            "image_url": self.image_url,
            "thumbnail_url": self.thumbnail_url,
            "width": self.width,
            "height": self.height,
            "processing_status": self.processing_status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "has_ai_metadata": self.ai_metadata is not None
        }
        
        # Include AI metadata if requested and available
        if include_ai_metadata and self.ai_metadata:
            result["ai_metadata"] = self.ai_metadata.to_dict(include_embedding=include_embedding)
        
        # Include collections if requested and available
        if include_collections and self.collection_items:
            result["collections"] = [
                {
                    "id": item.collection.id,
                    "name": item.collection.name,
                    "added_at": item.added_at.isoformat() if item.added_at else None
                }
                for item in self.collection_items if item.collection
            ]
        
        return result
    
    def get_collections(self):
        """Get list of collections this photo belongs to"""
        return [item.collection for item in self.collection_items if item.collection]

class AIMetadata(Base):
    """AI-generated metadata for photos"""
    __tablename__ = "ai_metadata"
    
    id = Column(Integer, primary_key=True, index=True)
    photo_id = Column(Integer, ForeignKey("photos.id", ondelete="CASCADE"), nullable=False, index=True)
    description = Column(Text)
    ai_keywords = Column(ARRAY(Text), default=[])
    embedding = Column(Vector(512), nullable=True)  # CLIP ViT-B/32 embeddings (512 dimensions)
    confidence_score = Column(Float)
    processing_time = Column(Float)  # Time taken to process in seconds
    model_version = Column(String(100))  # Track which model generated this
    processed_at = Column(DateTime(timezone=True), server_default=func.now())
    approved = Column(Boolean, default=False)
    approved_at = Column(DateTime(timezone=True))
    
    # Relationship to photo
    photo = relationship("Photo", back_populates="ai_metadata")
    
    def to_dict(self, include_embedding=False):
        result = {
            "id": self.id,
            "photo_id": self.photo_id,
            "description": self.description,
            "ai_keywords": self.ai_keywords,
            "confidence_score": self.confidence_score,
            "model_version": self.model_version,
            "processing_time": self.processing_time,
            "approved": self.approved,
            "processed_at": self.processed_at.isoformat() if self.processed_at else None
        }
        
        # Include embedding data if requested (for detailed views)
        if include_embedding and self.embedding is not None:
            # Convert embedding to list if it's not already, handling numpy types
            try:
                if hasattr(self.embedding, '__iter__') and not isinstance(self.embedding, str):
                    # Handle numpy arrays and other iterables
                    import numpy as np
                    if isinstance(self.embedding, np.ndarray):
                        result["embedding"] = self.embedding.tolist()
                    else:
                        result["embedding"] = [float(x) if hasattr(x, '__float__') else x for x in self.embedding]
                else:
                    result["embedding"] = float(self.embedding) if hasattr(self.embedding, '__float__') else self.embedding
            except Exception as e:
                # If embedding conversion fails, skip it but log the error
                print(f"Warning: Could not serialize embedding: {e}")
                result["embedding"] = None
        
        return result

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

class Collection(Base):
    """User-created collections of photos"""
    __tablename__ = "collections"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    cover_photo_id = Column(Integer, ForeignKey("photos.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    cover_photo = relationship("Photo", foreign_keys=[cover_photo_id])
    items = relationship("CollectionItem", back_populates="collection", cascade="all, delete-orphan")
    
    def to_dict(self, include_photos=False):
        result = {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "cover_photo_id": self.cover_photo_id,
            "photo_count": len(self.items) if self.items else 0,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
        
        # Include cover photo details if available
        if self.cover_photo:
            result["cover_photo"] = {
                "id": self.cover_photo.id,
                "thumbnail_url": self.cover_photo.thumbnail_url,
                "title": self.cover_photo.title
            }
        
        # Include photos if requested
        if include_photos and self.items:
            result["photos"] = [item.photo.to_dict() for item in self.items if item.photo]
        
        return result

class CollectionItem(Base):
    """Many-to-many relationship between collections and photos"""
    __tablename__ = "collection_items"
    
    id = Column(Integer, primary_key=True, index=True)
    collection_id = Column(Integer, ForeignKey("collections.id", ondelete="CASCADE"), nullable=False, index=True)
    photo_id = Column(Integer, ForeignKey("photos.id", ondelete="CASCADE"), nullable=False, index=True)
    added_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Ensure each photo can only be added once per collection
    __table_args__ = (
        UniqueConstraint('collection_id', 'photo_id', name='unique_collection_photo'),
    )
    
    # Relationships
    collection = relationship("Collection", back_populates="items")
    photo = relationship("Photo")
    
    def to_dict(self):
        return {
            "id": self.id,
            "collection_id": self.collection_id,
            "photo_id": self.photo_id,
            "added_at": self.added_at.isoformat() if self.added_at else None
        }