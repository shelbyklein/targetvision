# Embedding Tests

This directory contains comprehensive tests to verify the embedding creation functionality.

## Test Files

### `test_embeddings.py` - Full Test Suite
Comprehensive test that verifies the complete embedding pipeline:
- ✅ EmbeddingGenerator initialization with CLIP model
- ✅ Embedding generation from real images (downloaded from web)
- ✅ Database storage using pgvector Vector(512) type
- ✅ Vector similarity search with pgvector operators
- ✅ Automatic test data cleanup

**Usage:**
```bash
python test_embeddings.py
```

**Requirements:**
- Database connection (PostgreSQL with pgvector)
- Internet connection (for downloading test images)
- All backend dependencies installed

### `test_embeddings_simple.py` - Quick Test
Lightweight test that only verifies the embedding generation without database:
- ✅ CLIP model loading and initialization
- ✅ 512-dimensional embedding generation
- ✅ Similarity calculations between different images

**Usage:**
```bash
python test_embeddings_simple.py
```

**Requirements:**
- Only requires CLIP/torch dependencies
- No database or internet connection needed
- Perfect for CI/development environments

## What Gets Tested

### Embedding Generation Pipeline
1. **CLIP Model Loading**: ViT-B-32 model with OpenAI weights
2. **Image Processing**: PIL Image → bytes → tensor → embedding
3. **Vector Operations**: 512-dimensional float arrays
4. **Similarity Calculations**: Cosine similarity between embeddings

### Database Integration (Full Test Only)
1. **pgvector Storage**: Vector(512) column type
2. **Distance Queries**: L2 distance operator (`<->`) 
3. **Similarity Search**: ORDER BY distance for nearest neighbors
4. **Data Integrity**: Foreign key relationships and constraints

### Expected Results
- **Embedding Dimensions**: Exactly 512 floats (CLIP ViT-B-32)
- **Processing Time**: ~0.05-0.1 seconds per image
- **Similarity Range**: 0.0 (identical) to 2.0 (completely different)
- **Database Storage**: Efficient vector operations with pgvector

## Troubleshooting

### Common Issues
1. **Import Errors**: Make sure you're in the `backend/` directory
2. **Database Connection**: Ensure PostgreSQL is running with pgvector extension
3. **Missing Dependencies**: Install via `pip install -r requirements.txt`
4. **Memory Issues**: CLIP model requires ~1GB RAM for loading

### Performance Notes
- First run is slower (model downloading/loading)
- Subsequent runs use cached model weights
- Vector similarity queries scale with database size
- Consider HNSW indexing for large datasets

## Integration with Main Application

These tests verify the same embedding generation used by:
- `ai_processor.py` - Photo processing pipeline
- `embeddings.py` - Core embedding generation service
- Vector similarity search in the API endpoints

The tests ensure compatibility with the production database schema and Vector(512) storage format.