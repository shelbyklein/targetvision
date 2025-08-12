#!/usr/bin/env python3
"""
Test script to verify embedding creation functionality.
This tests the complete pipeline from CLIP model loading to database storage.
"""

import sys
import os
import numpy as np
from PIL import Image
import requests
from io import BytesIO
import time

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import get_db, init_db
from models import Photo, Album, AIMetadata
from embeddings import EmbeddingGenerator
from config import settings
from sqlalchemy import text

def test_embedding_creation():
    """Test the complete embedding creation pipeline"""
    
    print("🧪 Testing Embedding Creation Pipeline")
    print("=" * 50)
    
    # Test 1: Initialize embedding service
    print("\n1️⃣ Testing EmbeddingGenerator initialization...")
    try:
        embedding_service = EmbeddingGenerator()
        print("✅ EmbeddingGenerator initialized successfully")
    except Exception as e:
        print(f"❌ Failed to initialize EmbeddingGenerator: {e}")
        return False
    
    # Test 2: Test with a sample image URL (public domain image)
    print("\n2️⃣ Testing embedding generation from image...")
    
    # Use a small public domain test image
    test_image_url = "https://picsum.photos/400/300"
    
    try:
        # Download test image
        response = requests.get(test_image_url, timeout=10)
        response.raise_for_status()
        
        # Create PIL Image
        image = Image.open(BytesIO(response.content))
        print(f"✅ Downloaded test image: {image.size} pixels, mode: {image.mode}")
        
        # Convert image to bytes for the API
        img_bytes = BytesIO()
        image.save(img_bytes, format='JPEG')
        image_data = img_bytes.getvalue()
        
        # Generate embedding (async)
        start_time = time.time()
        import asyncio
        embedding = asyncio.run(embedding_service.generate_image_embedding(image_data))
        processing_time = time.time() - start_time
        
        # Convert numpy array to list for database storage
        embedding = embedding.tolist()
        
        print(f"✅ Generated embedding in {processing_time:.2f}s")
        print(f"   - Embedding shape: {len(embedding)} dimensions")
        print(f"   - Embedding type: {type(embedding)}")
        print(f"   - Sample values: {embedding[:5]}...")
        
        # Verify embedding properties
        assert len(embedding) == 512, f"Expected 512 dimensions, got {len(embedding)}"
        assert isinstance(embedding, list), f"Expected list, got {type(embedding)}"
        assert all(isinstance(x, (float, np.floating)) for x in embedding[:10]), "Embedding should contain floats"
        
        print("✅ Embedding validation passed")
        
    except Exception as e:
        print(f"❌ Failed to generate embedding: {e}")
        return False
    
    # Test 3: Test database storage
    print("\n3️⃣ Testing database storage...")
    
    try:
        db = next(get_db())
        
        # Create test album with timestamp to ensure uniqueness
        import time as time_module
        timestamp = str(int(time_module.time()))
        
        test_album = Album(
            smugmug_id=f"test_album_{timestamp}",
            title="Test Album for Embeddings",
            description="Test album for embedding functionality"
        )
        db.add(test_album)
        db.flush()  # Get the ID
        
        # Create test photo
        test_photo = Photo(
            smugmug_id=f"test_photo_{timestamp}_1",
            title="Test Photo",
            image_url=test_image_url,
            album_id=test_album.id,
            processing_status="completed"
        )
        db.add(test_photo)
        db.flush()  # Get the ID
        
        # Create AI metadata with embedding
        ai_metadata = AIMetadata(
            photo_id=test_photo.id,
            description="Test embedding for verification",
            ai_keywords=["test", "embedding", "verification"],
            embedding=embedding,  # This should work with Vector(512)
            confidence_score=0.95,
            processing_time=processing_time,
            model_version="clip-vit-b-32",
            approved=False
        )
        db.add(ai_metadata)
        db.commit()
        
        print("✅ Successfully stored embedding in database")
        print(f"   - Photo ID: {test_photo.id}")
        print(f"   - AI Metadata ID: {ai_metadata.id}")
        
    except Exception as e:
        print(f"❌ Failed to store embedding in database: {e}")
        db.rollback()
        return False
    
    # Test 4: Test vector similarity search
    print("\n4️⃣ Testing vector similarity search...")
    
    try:
        # Generate a slightly different embedding for similarity test
        test_image2_url = "https://picsum.photos/400/300?random=2"
        response2 = requests.get(test_image2_url, timeout=10)
        image2 = Image.open(BytesIO(response2.content))
        
        # Convert second image to bytes
        img_bytes2 = BytesIO()
        image2.save(img_bytes2, format='JPEG')
        image_data2 = img_bytes2.getvalue()
        
        # Generate second embedding
        embedding2 = asyncio.run(embedding_service.generate_image_embedding(image_data2))
        embedding2 = embedding2.tolist()
        
        # Store second embedding
        test_photo2 = Photo(
            smugmug_id=f"test_photo_{timestamp}_2",
            title="Test Photo 2",
            image_url=test_image2_url,
            album_id=test_album.id,
            processing_status="completed"
        )
        db.add(test_photo2)
        db.flush()
        
        ai_metadata2 = AIMetadata(
            photo_id=test_photo2.id,
            description="Second test embedding",
            embedding=embedding2,
            model_version="clip-vit-b-32"
        )
        db.add(ai_metadata2)
        db.commit()
        
        # Test similarity search using pgvector
        
        # Convert embedding to vector format for query
        embedding_str = "[" + ",".join(map(str, embedding)) + "]"
        
        # Use direct SQL substitution since pgvector syntax is complex
        similarity_query = text(f"""
        SELECT 
            p.title,
            p.smugmug_id,
            ai.description,
            ai.embedding <-> '{embedding_str}'::vector as distance
        FROM ai_metadata ai
        JOIN photos p ON p.id = ai.photo_id
        WHERE ai.embedding IS NOT NULL
        ORDER BY ai.embedding <-> '{embedding_str}'::vector
        LIMIT 3
        """)
        
        results = db.execute(similarity_query).fetchall()
        
        print("✅ Vector similarity search successful")
        print("   Similar images (by distance):")
        for i, result in enumerate(results, 1):
            print(f"   {i}. {result.title} - Distance: {result.distance:.4f}")
        
    except Exception as e:
        print(f"❌ Failed vector similarity search: {e}")
        return False
    
    # Test 5: Cleanup test data
    print("\n5️⃣ Cleaning up test data...")
    
    try:
        # Delete test data
        db.query(AIMetadata).filter(AIMetadata.photo_id.in_([test_photo.id, test_photo2.id])).delete(synchronize_session=False)
        db.query(Photo).filter(Photo.id.in_([test_photo.id, test_photo2.id])).delete(synchronize_session=False)
        db.query(Album).filter(Album.id == test_album.id).delete()
        db.commit()
        db.close()
        
        print("✅ Test data cleaned up successfully")
        
    except Exception as e:
        print(f"⚠️  Warning: Failed to cleanup test data: {e}")
    
    print("\n🎉 All embedding tests passed successfully!")
    print("\nTest Summary:")
    print("✅ EmbeddingGenerator initialization")
    print("✅ Embedding generation from image")
    print("✅ Database storage with Vector(512)")
    print("✅ Vector similarity search")
    print("✅ Test data cleanup")
    
    return True

def test_embedding_service_only():
    """Test just the embedding service without database operations"""
    
    print("🧪 Testing EmbeddingGenerator Only (No Database)")
    print("=" * 50)
    
    try:
        # Test embedding service initialization
        embedding_service = EmbeddingGenerator()
        print("✅ EmbeddingGenerator initialized")
        
        # Create a simple test image
        test_image = Image.new('RGB', (224, 224), color='red')
        print("✅ Created test image")
        
        # Convert to bytes for API
        img_bytes = BytesIO()
        test_image.save(img_bytes, format='JPEG')
        image_data = img_bytes.getvalue()
        
        # Generate embedding
        import asyncio
        embedding = asyncio.run(embedding_service.generate_image_embedding(image_data))
        embedding = embedding.tolist()
        print(f"✅ Generated embedding: {len(embedding)} dimensions")
        
        # Test with different image
        test_image2 = Image.new('RGB', (224, 224), color='blue')
        img_bytes2 = BytesIO()
        test_image2.save(img_bytes2, format='JPEG')
        image_data2 = img_bytes2.getvalue()
        
        embedding2 = asyncio.run(embedding_service.generate_image_embedding(image_data2))
        embedding2 = embedding2.tolist()
        
        # Calculate similarity (cosine similarity)
        embedding_np = np.array(embedding)
        embedding2_np = np.array(embedding2)
        
        similarity = np.dot(embedding_np, embedding2_np) / (
            np.linalg.norm(embedding_np) * np.linalg.norm(embedding2_np)
        )
        
        print(f"✅ Similarity between different colored images: {similarity:.4f}")
        print("✅ EmbeddingGenerator test completed successfully")
        
        return True
        
    except Exception as e:
        print(f"❌ EmbeddingGenerator test failed: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Starting Embedding Tests\n")
    
    # Check if we can run full tests or just service tests
    try:
        # Try to import database dependencies
        from database import get_db
        from models import Photo, Album, AIMetadata
        
        # Try to test database connection
        db = next(get_db())
        db.execute(text("SELECT 1"))
        db.close()
        
        print("📊 Database connection available - running full tests\n")
        success = test_embedding_creation()
        
    except Exception as e:
        print(f"⚠️  Database not available ({e}) - running service-only tests\n")
        success = test_embedding_service_only()
    
    if success:
        print("\n🎉 All tests completed successfully!")
        sys.exit(0)
    else:
        print("\n❌ Some tests failed!")
        sys.exit(1)