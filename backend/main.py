from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy.orm import Session
from typing import Dict, List, Optional
import os
from datetime import datetime
from dotenv import load_dotenv
import logging

load_dotenv()

# Import our modules
from database import get_db, init_db, test_connection
from models import Photo, AIMetadata, OAuthToken, ProcessingQueue
from smugmug_auth import SmugMugOAuth
from smugmug_service import SmugMugService
from ai_processor import ai_processor
from embeddings import hybrid_search, vector_search
from config import settings

# Store temporary OAuth tokens in memory (use Redis in production)
oauth_temp_storage = {}

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="TargetVision MVP", 
    version="0.1.0",
    description="SmugMug-integrated RAG application with AI-powered photo metadata"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {
        "message": "TargetVision MVP API", 
        "status": "running",
        "version": "0.1.0"
    }

@app.get("/health")
async def health_check():
    health_status = {
        "status": "healthy",
        "api": "running",
        "database": "pending",
        "smugmug": "pending",
        "ai_service": "pending"
    }
    
    # TODO: Add actual health checks for database and services
    
    return health_status

@app.get("/api/status")
async def api_status():
    return {
        "environment": os.getenv("DEBUG", "false"),
        "smugmug_configured": bool(os.getenv("SMUGMUG_API_KEY")),
        "anthropic_configured": bool(os.getenv("ANTHROPIC_API_KEY")),
        "database_configured": bool(os.getenv("DATABASE_URL"))
    }

# SmugMug OAuth Endpoints
@app.post("/auth/smugmug/request")
async def start_oauth():
    """Step 1: Initiate OAuth flow with SmugMug"""
    oauth = SmugMugOAuth()
    
    # Get request token
    token_data = await oauth.get_request_token()
    if not token_data:
        raise HTTPException(status_code=500, detail="Failed to get request token from SmugMug")
    
    # Store token secret temporarily (use session/Redis in production)
    request_token = token_data["oauth_token"]
    oauth_temp_storage[request_token] = token_data["oauth_token_secret"]
    
    # Get authorization URL
    auth_url = oauth.get_authorization_url(request_token)
    
    return {
        "auth_url": auth_url,
        "request_token": request_token
    }

@app.get("/auth/smugmug/callback")
async def oauth_callback(
    oauth_token: str = Query(...),
    oauth_verifier: str = Query(...),
    db: Session = Depends(get_db)
):
    """Step 2: Complete OAuth flow and get access token"""
    
    # Get stored request token secret
    request_token_secret = oauth_temp_storage.get(oauth_token)
    if not request_token_secret:
        raise HTTPException(status_code=400, detail="Invalid or expired request token")
    
    oauth = SmugMugOAuth()
    
    # Exchange for access token
    access_data = await oauth.get_access_token(
        oauth_token, request_token_secret, oauth_verifier
    )
    
    if not access_data:
        raise HTTPException(status_code=500, detail="Failed to get access token from SmugMug")
    
    # Clean up temporary storage
    del oauth_temp_storage[oauth_token]
    
    # Store access token in database
    # Check if we already have a token
    existing_token = db.query(OAuthToken).filter_by(service="smugmug").first()
    
    if existing_token:
        # Update existing token
        existing_token.access_token = access_data["oauth_token"]
        existing_token.access_token_secret = access_data["oauth_token_secret"]
        existing_token.user_id = access_data.get("user_id", "")
        existing_token.username = access_data.get("username", "")
    else:
        # Create new token
        new_token = OAuthToken(
            service="smugmug",
            access_token=access_data["oauth_token"],
            access_token_secret=access_data["oauth_token_secret"],
            user_id=access_data.get("user_id", ""),
            username=access_data.get("username", "")
        )
        db.add(new_token)
    
    db.commit()
    
    # Redirect to success page (or return JSON for API usage)
    return RedirectResponse(url="/auth/success")

@app.get("/auth/success")
async def auth_success():
    """OAuth success page"""
    return {
        "status": "success",
        "message": "SmugMug authentication successful! You can now sync your photos."
    }

@app.get("/auth/status")
async def auth_status(db: Session = Depends(get_db)):
    """Check if user is authenticated with SmugMug"""
    token = db.query(OAuthToken).filter_by(service="smugmug").first()
    
    if token and token.is_valid():
        return {
            "authenticated": True,
            "username": token.username,
            "user_id": token.user_id
        }
    
    return {"authenticated": False}

# Photo Management Endpoints
@app.post("/photos/sync")
async def sync_photos(
    limit: Optional[int] = Query(default=100, le=settings.MAX_PHOTOS_MVP),
    db: Session = Depends(get_db)
):
    """Sync photos from SmugMug to local database"""
    
    # Get stored access token
    token = db.query(OAuthToken).filter_by(service="smugmug").first()
    if not token or not token.is_valid():
        raise HTTPException(status_code=401, detail="Not authenticated with SmugMug")
    
    # Initialize SmugMug service
    service = SmugMugService(token.access_token, token.access_token_secret)
    
    # Sync photos
    photos_data = await service.sync_all_photos(limit=limit)
    
    if not photos_data:
        return {"message": "No photos found or sync failed", "synced": 0}
    
    # Save photos to database
    synced_count = 0
    for photo_data in photos_data:
        # Check if photo already exists
        existing = db.query(Photo).filter_by(smugmug_id=photo_data["smugmug_id"]).first()
        
        if not existing:
            # Create new photo
            photo = Photo(
                smugmug_id=photo_data["smugmug_id"],
                smugmug_uri=photo_data.get("smugmug_uri"),
                image_url=photo_data.get("image_url"),
                thumbnail_url=photo_data.get("thumbnail_url"),
                title=photo_data.get("title"),
                caption=photo_data.get("caption"),
                keywords=photo_data.get("keywords", []),
                album_name=photo_data.get("album_name"),
                album_uri=photo_data.get("album_uri"),
                width=photo_data.get("width"),
                height=photo_data.get("height"),
                format=photo_data.get("format"),
                file_size=photo_data.get("file_size")
            )
            db.add(photo)
            synced_count += 1
        else:
            # Update existing photo
            existing.image_url = photo_data.get("image_url") or existing.image_url
            existing.thumbnail_url = photo_data.get("thumbnail_url") or existing.thumbnail_url
            existing.title = photo_data.get("title") or existing.title
            existing.caption = photo_data.get("caption") or existing.caption
            existing.keywords = photo_data.get("keywords") or existing.keywords
            synced_count += 1
    
    db.commit()
    
    return {
        "message": f"Successfully synced {synced_count} photos",
        "synced": synced_count,
        "total_photos": db.query(Photo).count()
    }

@app.get("/photos", response_model=List[Dict])
async def list_photos(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, le=100),
    db: Session = Depends(get_db)
):
    """List photos from database"""
    photos = db.query(Photo).offset(skip).limit(limit).all()
    
    return [photo.to_dict() for photo in photos]

@app.get("/photos/{photo_id}")
async def get_photo(photo_id: int, db: Session = Depends(get_db)):
    """Get single photo by ID"""
    photo = db.query(Photo).filter_by(id=photo_id).first()
    
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    photo_dict = photo.to_dict()
    
    # Include AI metadata if available
    if photo.ai_metadata:
        photo_dict["ai_metadata"] = photo.ai_metadata.to_dict()
    
    return photo_dict

@app.delete("/photos/{photo_id}")
async def delete_photo(photo_id: int, db: Session = Depends(get_db)):
    """Delete a photo from database"""
    photo = db.query(Photo).filter_by(id=photo_id).first()
    
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    db.delete(photo)
    db.commit()
    
    return {"message": "Photo deleted successfully"}

# AI Processing Endpoints
@app.post("/photos/{photo_id}/process")
async def process_photo(photo_id: int, db: Session = Depends(get_db)):
    """Process a single photo with AI analysis"""
    
    # Check if photo exists
    photo = db.query(Photo).filter_by(id=photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    # Check if already processed
    existing = db.query(AIMetadata).filter_by(photo_id=photo_id).first()
    if existing:
        return {
            "message": "Photo already processed",
            "ai_metadata": existing.to_dict()
        }
    
    try:
        # Process the photo
        result = await ai_processor.process_photo(photo_id)
        
        if result:
            return {
                "message": "Photo processed successfully",
                "ai_metadata": result
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to process photo")
            
    except Exception as e:
        logger.error(f"Error processing photo {photo_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

@app.post("/photos/process/batch")
async def process_photos_batch(
    photo_ids: List[int],
    max_concurrent: int = Query(default=3, le=5),
    db: Session = Depends(get_db)
):
    """Process multiple photos in batch"""
    
    # Validate photo IDs exist
    existing_photos = db.query(Photo.id).filter(Photo.id.in_(photo_ids)).all()
    existing_ids = [p.id for p in existing_photos]
    
    if not existing_ids:
        raise HTTPException(status_code=404, detail="No valid photos found")
    
    try:
        # Add to processing queue
        await ai_processor.add_to_processing_queue(existing_ids)
        
        # Process batch
        results = await ai_processor.process_batch(existing_ids, max_concurrent)
        
        successful = len([r for r in results if r and "error" not in r])
        
        return {
            "message": f"Batch processing completed: {successful}/{len(existing_ids)} successful",
            "processed": successful,
            "total": len(existing_ids),
            "results": results
        }
        
    except Exception as e:
        logger.error(f"Error in batch processing: {e}")
        raise HTTPException(status_code=500, detail=f"Batch processing failed: {str(e)}")

@app.get("/photos/process/queue")
async def get_processing_queue_status():
    """Get current processing queue status"""
    
    try:
        status = await ai_processor.get_queue_status()
        return status
    except Exception as e:
        logger.error(f"Error getting queue status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get queue status")

@app.post("/photos/process/queue/add")
async def add_to_queue(
    photo_ids: List[int],
    priority: int = Query(default=0, ge=0, le=10),
    db: Session = Depends(get_db)
):
    """Add photos to processing queue"""
    
    # Validate photo IDs
    existing_photos = db.query(Photo.id).filter(Photo.id.in_(photo_ids)).all()
    existing_ids = [p.id for p in existing_photos]
    
    if not existing_ids:
        raise HTTPException(status_code=404, detail="No valid photos found")
    
    try:
        await ai_processor.add_to_processing_queue(existing_ids, priority)
        
        return {
            "message": f"Added {len(existing_ids)} photos to processing queue",
            "added": len(existing_ids)
        }
        
    except Exception as e:
        logger.error(f"Error adding to queue: {e}")
        raise HTTPException(status_code=500, detail="Failed to add to queue")

# Search Endpoints
@app.get("/search")
async def search_photos(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(default=20, le=50),
    search_type: str = Query(default="hybrid", regex="^(text|vector|hybrid)$")
):
    """Search photos using text or vector similarity"""
    
    try:
        if search_type == "vector":
            results = await vector_search.search_by_text(q, limit)
        elif search_type == "text":
            # Simple text search implementation
            db = next(get_db())
            try:
                query_lower = q.lower()
                
                # Search in AI metadata and photo metadata
                photos = []
                metadata_records = db.query(AIMetadata).all()
                
                for metadata in metadata_records:
                    score = 0.0
                    
                    # Search in description
                    if metadata.description and query_lower in metadata.description.lower():
                        score += 1.0
                    
                    # Search in keywords
                    if metadata.ai_keywords:
                        for keyword in metadata.ai_keywords:
                            if query_lower in keyword.lower():
                                score += 0.5
                    
                    if score > 0 and metadata.photo:
                        photos.append({
                            "photo_id": metadata.photo_id,
                            "score": score,
                            "description": metadata.description,
                            "ai_keywords": metadata.ai_keywords,
                            "photo": metadata.photo.to_dict()
                        })
                
                # Sort by score
                photos.sort(key=lambda x: x["score"], reverse=True)
                results = photos[:limit]
                
            finally:
                db.close()
                
        else:  # hybrid
            results = await hybrid_search.search(q, limit)
        
        return {
            "query": q,
            "search_type": search_type,
            "results": len(results),
            "photos": results
        }
        
    except Exception as e:
        logger.error(f"Error in search: {e}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

@app.get("/photos/{photo_id}/similar")
async def find_similar_photos(
    photo_id: int,
    limit: int = Query(default=10, le=20),
    db: Session = Depends(get_db)
):
    """Find photos similar to the given photo"""
    
    # Check if photo exists
    photo = db.query(Photo).filter_by(id=photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    try:
        results = await vector_search.search_similar_images(photo_id, limit)
        
        return {
            "photo_id": photo_id,
            "similar_photos": len(results),
            "results": results
        }
        
    except Exception as e:
        logger.error(f"Error finding similar photos: {e}")
        raise HTTPException(status_code=500, detail=f"Similar photo search failed: {str(e)}")

# Metadata Management Endpoints
@app.get("/metadata/{photo_id}")
async def get_ai_metadata(photo_id: int, db: Session = Depends(get_db)):
    """Get AI metadata for a photo"""
    
    metadata = db.query(AIMetadata).filter_by(photo_id=photo_id).first()
    if not metadata:
        raise HTTPException(status_code=404, detail="AI metadata not found")
    
    return metadata.to_dict()

@app.put("/metadata/{photo_id}")
async def update_ai_metadata(
    photo_id: int,
    description: Optional[str] = None,
    ai_keywords: Optional[List[str]] = None,
    approved: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    """Update AI metadata for a photo"""
    
    metadata = db.query(AIMetadata).filter_by(photo_id=photo_id).first()
    if not metadata:
        raise HTTPException(status_code=404, detail="AI metadata not found")
    
    # Update fields if provided
    if description is not None:
        metadata.description = description
    if ai_keywords is not None:
        metadata.ai_keywords = ai_keywords
    if approved is not None:
        metadata.approved = approved
        if approved:
            metadata.approved_at = datetime.now()
    
    db.commit()
    db.refresh(metadata)
    
    return {
        "message": "Metadata updated successfully",
        "metadata": metadata.to_dict()
    }

@app.post("/metadata/{photo_id}/approve")
async def approve_ai_metadata(photo_id: int, db: Session = Depends(get_db)):
    """Approve AI-generated metadata"""
    
    metadata = db.query(AIMetadata).filter_by(photo_id=photo_id).first()
    if not metadata:
        raise HTTPException(status_code=404, detail="AI metadata not found")
    
    metadata.approved = True
    metadata.approved_at = datetime.now()
    
    db.commit()
    
    return {
        "message": "Metadata approved successfully",
        "photo_id": photo_id
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True if os.getenv("DEBUG") == "true" else False
    )