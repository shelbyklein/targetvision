#!/usr/bin/env python3
"""
Test script to verify AI integration is working
"""

import asyncio
import sys
import os

# Add backend to path and change to backend directory
sys.path.append('backend')
os.chdir('backend')

from database import get_db
from models import Photo, AIMetadata
from ai_processor import ai_processor
from config import get_settings

async def test_ai_integration():
    """Test AI processing with existing photos in database"""
    
    print("🧪 Testing TargetVision AI Integration")
    print("=" * 50)
    
    # Check configuration
    settings = get_settings()
    if not settings.ANTHROPIC_API_KEY:
        print("❌ ANTHROPIC_API_KEY not configured")
        return
    
    print("✅ Configuration validated")
    
    # Get database connection
    db = next(get_db())
    
    try:
        # Get first photo from database
        photo = db.query(Photo).first()
        
        if not photo:
            print("❌ No photos found in database. Run photo sync first:")
            print("   curl -X POST http://localhost:8000/photos/sync")
            return
        
        print(f"📸 Found photo: {photo.title or photo.smugmug_id}")
        print(f"   Image URL: {photo.image_url}")
        
        # Check if already processed
        existing_metadata = db.query(AIMetadata).filter_by(photo_id=photo.id).first()
        if existing_metadata:
            print("✅ Photo already has AI metadata:")
            print(f"   Description: {existing_metadata.description[:100]}...")
            print(f"   Keywords: {existing_metadata.ai_keywords}")
            print(f"   Processing time: {existing_metadata.processing_time:.2f}s")
            return
        
        print("🤖 Processing photo with Claude Vision API...")
        
        # Process the photo
        try:
            result = await ai_processor.process_photo(photo.id)
            
            if result:
                print("✅ AI processing successful!")
                print(f"   Description: {result['description'][:100]}...")
                print(f"   Keywords: {result['ai_keywords']}")
                print(f"   Processing time: {result['processing_time']:.2f}s")
                print(f"   Model: {result['model_version']}")
            else:
                print("❌ AI processing failed - no result returned")
                
        except Exception as e:
            print(f"❌ AI processing failed: {e}")
            
    except Exception as e:
        print(f"❌ Database error: {e}")
        
    finally:
        db.close()

async def test_queue_operations():
    """Test processing queue functionality"""
    
    print("\n🔄 Testing Processing Queue")
    print("-" * 30)
    
    try:
        # Get queue status
        status = await ai_processor.get_queue_status()
        print(f"Queue status: {status}")
        
        # Get some photos to queue
        db = next(get_db())
        try:
            photos = db.query(Photo).limit(3).all()
            photo_ids = [p.id for p in photos]
            
            if photo_ids:
                print(f"Adding {len(photo_ids)} photos to queue...")
                await ai_processor.add_to_processing_queue(photo_ids)
                
                # Check status again
                status = await ai_processor.get_queue_status()
                print(f"Updated queue status: {status}")
            else:
                print("No photos available to queue")
                
        finally:
            db.close()
            
    except Exception as e:
        print(f"❌ Queue operations failed: {e}")

if __name__ == "__main__":
    print("Starting AI integration test...")
    
    # Run the tests
    asyncio.run(test_ai_integration())
    asyncio.run(test_queue_operations())
    
    print("\n🎉 AI integration test completed!")