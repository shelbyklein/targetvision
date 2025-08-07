from fastapi import APIRouter, UploadFile, File, HTTPException, status, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
import os
from pathlib import Path
import uuid
from datetime import datetime

from app.core.config import settings
from app.db.database import get_db
from app.models import Photo, Album
from app.services import VisionService, EmbeddingService

router = APIRouter()

@router.post("/upload")
async def upload_photo(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    album: Optional[str] = None,
    db: Session = Depends(get_db)
) -> dict:
    """Upload a single photo to the system"""
    
    # Validate file extension
    file_extension = file.filename.split(".")[-1].lower()
    if file_extension not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not allowed. Allowed types: {', '.join(settings.ALLOWED_EXTENSIONS)}"
        )
    
    # Validate file size
    file_size = 0
    contents = await file.read()
    file_size = len(contents)
    
    if file_size > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size: {settings.MAX_UPLOAD_SIZE / 1024 / 1024}MB"
        )
    
    # Generate unique filename
    unique_id = str(uuid.uuid4())
    new_filename = f"{unique_id}.{file_extension}"
    
    # Save file
    upload_path = Path(settings.UPLOAD_DIR) / new_filename
    with open(upload_path, "wb") as f:
        f.write(contents)
    
    # Create database entry
    photo = Photo(
        id=unique_id,
        filename=file.filename,
        stored_path=new_filename,
        album_id=album,
        size_bytes=file_size,
        mime_type=file.content_type
    )
    db.add(photo)
    db.commit()
    
    # Process image in background
    background_tasks.add_task(
        process_photo,
        photo_id=unique_id,
        image_path=str(upload_path),
        db=db
    )
    
    return {
        "id": unique_id,
        "filename": file.filename,
        "stored_as": new_filename,
        "size": file_size,
        "album": album,
        "uploaded_at": datetime.utcnow().isoformat(),
        "status": "processing"
    }

@router.post("/upload-batch")
async def upload_photos_batch(
    files: List[UploadFile] = File(...),
    album: Optional[str] = None
) -> dict:
    """Upload multiple photos at once"""
    
    if len(files) > 20:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 20 files can be uploaded at once"
        )
    
    results = []
    errors = []
    
    for file in files:
        try:
            result = await upload_photo(file, album)
            results.append(result)
        except HTTPException as e:
            errors.append({
                "filename": file.filename,
                "error": e.detail
            })
    
    return {
        "uploaded": len(results),
        "failed": len(errors),
        "results": results,
        "errors": errors
    }

@router.get("/search")
async def search_photos(
    query: str,
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db)
) -> dict:
    """Search photos using natural language query"""
    
    from app.services import RAGService
    rag_service = RAGService()
    
    photos = await rag_service.search_photos(query, db, limit=limit)
    
    results = [
        {
            "id": p.id,
            "filename": p.filename,
            "url": f"/uploads/{p.stored_path}",
            "description": p.description,
            "uploaded_at": p.uploaded_at.isoformat() if p.uploaded_at else None
        }
        for p in photos
    ]
    
    return {
        "query": query,
        "total": len(results),
        "limit": limit,
        "offset": offset,
        "results": results
    }

@router.get("/{photo_id}")
async def get_photo(
    photo_id: str,
    db: Session = Depends(get_db)
) -> dict:
    """Get details of a specific photo"""
    
    photo = db.query(Photo).filter_by(id=photo_id).first()
    
    if not photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Photo not found"
        )
    
    return {
        "id": photo.id,
        "filename": photo.filename,
        "url": f"/uploads/{photo.stored_path}",
        "description": photo.description,
        "tags": photo.tags or [],
        "metadata": photo.metadata or {},
        "uploaded_at": photo.uploaded_at.isoformat() if photo.uploaded_at else None,
        "processed_at": photo.processed_at.isoformat() if photo.processed_at else None
    }

async def process_photo(photo_id: str, image_path: str, db: Session):
    """Background task to process photo with vision model"""
    
    vision_service = VisionService()
    embedding_service = EmbeddingService()
    
    # Generate description
    result = await vision_service.generate_description(image_path)
    
    if result.get("description"):
        # Extract tags
        tags = await vision_service.extract_tags(result["description"])
        
        # Generate embedding
        embedding = await embedding_service.generate_embedding(result["description"])
        
        # Update photo in database
        photo = db.query(Photo).filter_by(id=photo_id).first()
        if photo:
            photo.description = result["description"]
            photo.description_embedding = embedding
            photo.tags = tags
            photo.metadata = result.get("metadata", {})
            photo.width = result["metadata"].get("width")
            photo.height = result["metadata"].get("height")
            photo.processed_at = datetime.utcnow()
            
            db.commit()