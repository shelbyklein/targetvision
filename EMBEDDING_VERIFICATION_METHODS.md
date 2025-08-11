# Image Metadata Embedding Verification Guide

This guide shows you multiple ways to verify that your image metadata has embeddings in your TargetVision system.

## Current Status Summary

Based on the latest verification (August 10, 2025):

- **Total Photos**: 3,903
- **Photos with AI Metadata**: 1,978 (50.7% coverage)
- **Photos with Embeddings**: 4 (0.1% coverage)
- **Embedding Dimensions**: 512 (CLIP ViT-B/32 format)
- **Photos without Embeddings**: 1,974

## Verification Methods

### 1. 🔧 Python Script Method (Most Detailed)

Run the verification script:
```bash
source venv/bin/activate
python3 test_embedding.py
```

This will show:
- Total counts and coverage percentages
- Embedding statistics (dimensions, vector norms, value ranges)
- Sample records with and without embeddings
- Vector search functionality test

### 2. 🌐 API Endpoint Method (Quick Check)

**New endpoint available**: `GET /photos/embedding-stats`

```bash
curl "http://localhost:8000/photos/embedding-stats" | python3 -m json.tool
```

Returns:
```json
{
    "total_photos": 3903,
    "photos_with_ai_metadata": 1978,
    "photos_with_embeddings": 4,
    "embedding_dimensions": 512,
    "ai_metadata_coverage": 50.68,
    "embedding_coverage": 0.1,
    "photos_without_embeddings": 1974
}
```

### 3. 🗄️ Direct Database Query Method

Connect to PostgreSQL directly:
```sql
-- Count records with embeddings
SELECT COUNT(*) FROM ai_metadata WHERE embedding IS NOT NULL;

-- Count records without embeddings  
SELECT COUNT(*) FROM ai_metadata WHERE embedding IS NULL;

-- Check embedding dimensions (first record)
SELECT array_length(embedding, 1) as dimensions 
FROM ai_metadata 
WHERE embedding IS NOT NULL 
LIMIT 1;

-- Sample embedding values
SELECT photo_id, array_length(embedding, 1) as dims, 
       embedding[1:5] as sample_values
FROM ai_metadata 
WHERE embedding IS NOT NULL 
LIMIT 3;
```

### 4. 🔍 Vector Search Test Method

Test if embeddings are working for search:
```bash
curl -X POST "http://localhost:8000/search/vector" \
  -H "Content-Type: application/json" \
  -d '{"query": "archery", "limit": 5}'
```

### 5. 📊 Web Interface Method

Visit the TargetVision frontend and:
1. Go to **Settings** page
2. Check the AI processing statistics
3. Look for embedding-related metrics
4. Try the chat interface with semantic queries

## Understanding the Results

### ✅ Good Signs (Embeddings Working)
- **512 dimensions**: CLIP ViT-B/32 standard format ✅
- **Vector norm ≈ 1.0**: Properly normalized embeddings ✅  
- **Value range**: -1.0 to 1.0 (typical for normalized embeddings) ✅
- **Vector search returns results**: Semantic search functional ✅

### ⚠️ Current Issues
- **Low embedding coverage (0.1%)**: Only 4 out of 3,903 photos have embeddings
- **1,974 photos with AI metadata but no embeddings**: These need to be reprocessed

### 🔄 Expected Values for Full Implementation
- **Embedding dimensions**: 512 (CLIP ViT-B/32)
- **Vector norm**: ~1.0 (L2 normalized)
- **Value range**: -1.0 to 1.0
- **Coverage target**: 100% of processed photos should have embeddings

## How Embeddings Are Generated

Embeddings are automatically generated when:
1. Processing new photos with AI (single or batch)
2. Using the `/photos/{id}/process` endpoint
3. The `ai_processor.process_photo()` method is called

## Troubleshooting

### Photos Have AI Metadata But No Embeddings
This happens for photos processed before embeddings were implemented. Solutions:
1. **Reprocess individual photos**: Click status indicator in UI
2. **Batch reprocess**: Select photos and use "Process Selected"  
3. **API reprocessing**: Use `/photos/{id}/process` endpoint

### Embedding Generation Fails
Check:
1. CLIP model loading (requires torch, open_clip)
2. Image download from SmugMug URLs
3. Memory availability for embedding generation
4. Database connection and permissions

## Technical Details

### Database Schema
```sql
-- AI metadata table with embedding column
CREATE TABLE ai_metadata (
    id SERIAL PRIMARY KEY,
    photo_id INTEGER REFERENCES photos(id),
    description TEXT,
    ai_keywords TEXT[],
    embedding REAL[],  -- 512-dimensional CLIP embedding
    confidence_score REAL,
    processing_time REAL,
    model_version VARCHAR(100),
    processed_at TIMESTAMP WITH TIME ZONE
);
```

### CLIP Model Details
- **Model**: CLIP ViT-B/32 (OpenAI)
- **Dimensions**: 512
- **Normalization**: L2 normalized to unit vectors
- **Similarity**: Cosine similarity for search

## Quick Status Check Commands

```bash
# Quick embedding count
curl -s "http://localhost:8000/photos/embedding-stats" | grep "photos_with_embeddings"

# Full verification
source venv/bin/activate && python3 test_embedding.py

# Test vector search
curl -X POST "http://localhost:8000/search/vector" -H "Content-Type: application/json" -d '{"query": "test", "limit": 1}'
```