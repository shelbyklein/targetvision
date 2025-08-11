#!/usr/bin/env python3
"""
Script to verify image metadata has embeddings
"""
import asyncio
import sys
import os

# Add backend to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from backend.database import get_db
from backend.models import Photo, AIMetadata

async def check_embeddings():
    """Check which photos have embeddings"""
    
    # Get database session
    db = next(get_db())
    
    try:
        print("🔍 CHECKING AI METADATA AND EMBEDDINGS...")
        print("=" * 50)
        
        # Get all AI metadata records
        all_metadata = db.query(AIMetadata).all()
        print(f'📊 Total AI metadata records: {len(all_metadata)}')
        
        # Count records with embeddings
        with_embeddings = db.query(AIMetadata).filter(AIMetadata.embedding.isnot(None)).all()
        print(f'✅ Records with embeddings: {len(with_embeddings)}')
        
        # Count records without embeddings
        without_embeddings = db.query(AIMetadata).filter(AIMetadata.embedding.is_(None)).all()
        print(f'❌ Records WITHOUT embeddings: {len(without_embeddings)}')
        
        if with_embeddings:
            print(f'\n📈 EMBEDDING STATISTICS:')
            print("-" * 30)
            
            sample_embedding = with_embeddings[0].embedding
            if sample_embedding:
                import numpy as np
                embedding_array = np.array(sample_embedding)
                print(f'🔢 Embedding dimensions: {len(sample_embedding)}')
                print(f'📏 Vector norm (first record): {np.linalg.norm(embedding_array):.4f}')
                print(f'📊 Value range (first record): {embedding_array.min():.4f} to {embedding_array.max():.4f}')
            
            print(f'\n📋 SAMPLE RECORDS WITH EMBEDDINGS:')
            print("-" * 40)
            for i, metadata in enumerate(with_embeddings[:5]):
                photo_title = metadata.photo.title if metadata.photo else "No title"
                embedding_dims = len(metadata.embedding) if metadata.embedding else 0
                print(f'{i+1}. Photo ID: {metadata.photo_id} | Title: "{photo_title[:30]}..." | Dims: {embedding_dims}')
        
        if without_embeddings:
            print(f'\n❌ RECORDS WITHOUT EMBEDDINGS:')
            print("-" * 35)
            for i, metadata in enumerate(without_embeddings[:5]):
                photo_title = metadata.photo.title if metadata.photo else "No title"
                print(f'{i+1}. Photo ID: {metadata.photo_id} | Title: "{photo_title[:30]}..."')
        
        # Summary
        print(f'\n📊 SUMMARY:')
        print("-" * 20)
        total_photos = db.query(Photo).count()
        total_with_ai = len(all_metadata)
        total_with_embeddings = len(with_embeddings)
        
        print(f'Total photos in database: {total_photos}')
        print(f'Photos with AI metadata: {total_with_ai}')
        print(f'Photos with embeddings: {total_with_embeddings}')
        
        if total_photos > 0:
            ai_coverage = (total_with_ai / total_photos) * 100
            embedding_coverage = (total_with_embeddings / total_photos) * 100
            print(f'AI metadata coverage: {ai_coverage:.1f}%')
            print(f'Embedding coverage: {embedding_coverage:.1f}%')
        
        # Test vector search if we have embeddings
        if total_with_embeddings > 0:
            print(f'\n🔍 TESTING VECTOR SEARCH:')
            print("-" * 25)
            try:
                from backend.embeddings import vector_search
                search_results = await vector_search.search_by_text("photo", limit=3)
                print(f'✅ Vector search test: Found {len(search_results)} similar photos')
                
                if search_results:
                    print("Top search results:")
                    for i, result in enumerate(search_results[:3]):
                        print(f"  {i+1}. Photo {result['photo_id']}: {result['similarity']:.3f} similarity")
                        print(f"     Description: {result['description'][:60]}...")
                        
            except Exception as e:
                print(f"❌ Vector search test failed: {e}")
            
    except Exception as e:
        print(f"❌ Error during check: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    print("🔍 Checking image metadata embeddings...")
    asyncio.run(check_embeddings())