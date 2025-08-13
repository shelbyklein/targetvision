#!/usr/bin/env python3
"""
Minimal server to test the photo endpoint fix without AI dependencies
"""

from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

# Import models and database
from database import get_db, init_db
from models import Photo, AIMetadata, Collection, CollectionItem

app = FastAPI(title="TargetVision Photo Test API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "TargetVision Photo Test API", "status": "running"}

@app.get("/photos/{photo_id}")
async def get_photo(
    photo_id: int, 
    include_embedding: bool = Query(default=True, description="Include embedding data in AI metadata"),
    db: Session = Depends(get_db)
):
    """Get single photo by ID with optional embedding data"""
    print(f"Fetching photo {photo_id} with include_embedding={include_embedding}")
    
    # Use joinedload to eagerly load relationships and avoid lazy loading issues
    query = db.query(Photo).options(
        joinedload(Photo.ai_metadata),
        joinedload(Photo.collection_items).joinedload(CollectionItem.collection)
    )
    
    photo = query.filter(Photo.id == photo_id).first()
    
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    print(f"Found photo: {photo.title if photo.title else 'Untitled'}")
    print(f"AI metadata present: {photo.ai_metadata is not None}")
    
    # Include embedding data for detailed view (used by photo modal)
    try:
        result = photo.to_dict(include_embedding=include_embedding)
        print(f"Successfully serialized photo data")
        return result
    except Exception as e:
        print(f"Error serializing photo: {e}")
        raise HTTPException(status_code=500, detail=f"Error serializing photo: {str(e)}")

@app.get("/photos/{photo_id}/largest-image")
async def get_largest_image(photo_id: int, db: Session = Depends(get_db)):
    """Get the largest available image URL from SmugMug for a photo"""
    photo = db.query(Photo).filter(Photo.id == photo_id).first()
    
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    # For testing, return the existing image_url as the "largest"
    # In production, this would call SmugMug API
    return {
        "url": photo.image_url,
        "width": photo.width,
        "height": photo.height,
        "format": "JPEG"
    }

if __name__ == "__main__":
    import uvicorn
    print("Starting minimal photo test server...")
    print("Testing database connection...")
    
    try:
        # Initialize database
        init_db()
        print("Database connection successful")
    except Exception as e:
        print(f"Database error: {e}")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)