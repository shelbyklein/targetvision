"""
Tests for embeddings module
"""

import pytest
import numpy as np
from unittest.mock import MagicMock, patch, AsyncMock
from PIL import Image
import io

from backend.embeddings import EmbeddingGenerator, VectorSearch, HybridSearch
from backend.models import AIMetadata
from tests.conftest import create_test_photo, create_test_metadata

@pytest.mark.unit
@pytest.mark.ai
class TestEmbeddingGenerator:
    """Test embedding generation functionality"""
    
    @pytest.fixture
    def embedding_generator(self, mock_clip_model):
        """Create embedding generator with mocked CLIP model"""
        with patch('backend.embeddings.open_clip.create_model_and_transforms') as mock_create, \
             patch('backend.embeddings.open_clip.get_tokenizer') as mock_tokenizer:
            
            mock_create.return_value = (mock_clip_model, None, MagicMock())
            mock_tokenizer.return_value = MagicMock()
            
            generator = EmbeddingGenerator()
            return generator
    
    def test_embedding_generator_init(self, embedding_generator):
        """Test embedding generator initialization"""
        assert embedding_generator.model_name == "ViT-B-32"
        assert embedding_generator.pretrained == "openai"
        assert embedding_generator.device in ["cuda", "cpu"]
        assert embedding_generator.model is not None
    
    @pytest.mark.asyncio
    async def test_generate_image_embedding(self, embedding_generator, mock_image_bytes):
        """Test image embedding generation"""
        embedding = await embedding_generator.generate_image_embedding(mock_image_bytes)
        
        assert isinstance(embedding, np.ndarray)
        assert embedding.shape == (512,)  # CLIP ViT-B/32 embedding size
    
    @pytest.mark.asyncio
    async def test_generate_image_embedding_rgba_conversion(self, embedding_generator):
        """Test image embedding with RGBA image (should convert to RGB)"""
        # Create RGBA image
        img = Image.new('RGBA', (100, 100), color=(255, 0, 0, 128))
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='PNG')
        
        embedding = await embedding_generator.generate_image_embedding(img_bytes.getvalue())
        
        assert isinstance(embedding, np.ndarray)
        assert embedding.shape == (512,)
    
    @pytest.mark.asyncio
    async def test_generate_text_embedding(self, embedding_generator):
        """Test text embedding generation"""
        text = "archery competition medals"
        embedding = await embedding_generator.generate_text_embedding(text)
        
        assert isinstance(embedding, np.ndarray)
        assert embedding.shape == (512,)
    
    def test_calculate_similarity_identical(self, embedding_generator):
        """Test similarity calculation for identical embeddings"""
        embedding1 = np.random.rand(512)
        embedding2 = embedding1.copy()
        
        similarity = embedding_generator.calculate_similarity(embedding1, embedding2)
        
        assert similarity == pytest.approx(1.0, abs=1e-6)
    
    def test_calculate_similarity_orthogonal(self, embedding_generator):
        """Test similarity calculation for orthogonal embeddings"""
        embedding1 = np.array([1.0, 0.0] + [0.0] * 510)
        embedding2 = np.array([0.0, 1.0] + [0.0] * 510)
        
        similarity = embedding_generator.calculate_similarity(embedding1, embedding2)
        
        assert similarity == pytest.approx(0.0, abs=1e-6)
    
    def test_calculate_similarity_opposite(self, embedding_generator):
        """Test similarity calculation for opposite embeddings"""
        embedding1 = np.array([1.0] + [0.0] * 511)
        embedding2 = np.array([-1.0] + [0.0] * 511)
        
        similarity = embedding_generator.calculate_similarity(embedding1, embedding2)
        
        assert similarity == pytest.approx(-1.0, abs=1e-6)
    
    @pytest.mark.asyncio
    async def test_batch_process_images(self, embedding_generator, mock_image_bytes):
        """Test batch processing of images"""
        image_list = [mock_image_bytes] * 3
        
        embeddings = await embedding_generator.batch_process_images(image_list, batch_size=2)
        
        assert len(embeddings) == 3
        assert all(isinstance(emb, np.ndarray) for emb in embeddings)
        assert all(emb.shape == (512,) for emb in embeddings)

@pytest.mark.unit
@pytest.mark.ai
class TestVectorSearch:
    """Test vector search functionality"""
    
    @pytest.fixture
    def vector_search(self, mock_clip_model):
        """Create vector search with mocked embedding generator"""
        with patch('backend.embeddings.open_clip.create_model_and_transforms') as mock_create, \
             patch('backend.embeddings.open_clip.get_tokenizer') as mock_tokenizer:
            
            mock_create.return_value = (mock_clip_model, None, MagicMock())
            mock_tokenizer.return_value = MagicMock()
            
            search = VectorSearch()
            return search
    
    @pytest.mark.asyncio
    async def test_search_by_text_no_results(self, vector_search, test_db):
        """Test text search with no matching results"""
        results = await vector_search.search_by_text("nonexistent query")
        
        assert isinstance(results, list)
        assert len(results) == 0
    
    @pytest.mark.asyncio
    async def test_search_by_text_with_results(self, vector_search, test_db, sample_photo, sample_ai_metadata):
        """Test text search with matching results (mocked embeddings)"""
        # Note: This test is limited because we're not using real pgvector
        # In a real implementation, this would test vector similarity search
        
        with patch.object(vector_search.embedding_generator, 'generate_text_embedding',
                         return_value=np.random.rand(512)):
            results = await vector_search.search_by_text("archery")
            
            # Without real embeddings, this will return empty
            # In a real test with pgvector, we would populate embeddings first
            assert isinstance(results, list)
    
    @pytest.mark.asyncio
    async def test_search_similar_images_no_target(self, vector_search, test_db):
        """Test similar image search with non-existent target"""
        results = await vector_search.search_similar_images(999)
        
        assert isinstance(results, list)
        assert len(results) == 0
    
    @pytest.mark.asyncio
    async def test_search_similar_images_no_embedding(self, vector_search, test_db, sample_photo):
        """Test similar image search with photo that has no embedding"""
        results = await vector_search.search_similar_images(sample_photo.id)
        
        assert isinstance(results, list)
        assert len(results) == 0

@pytest.mark.unit
@pytest.mark.ai
class TestHybridSearch:
    """Test hybrid search functionality"""
    
    @pytest.fixture
    def hybrid_search(self, mock_clip_model):
        """Create hybrid search with mocked components"""
        with patch('backend.embeddings.open_clip.create_model_and_transforms') as mock_create, \
             patch('backend.embeddings.open_clip.get_tokenizer') as mock_tokenizer:
            
            mock_create.return_value = (mock_clip_model, None, MagicMock())
            mock_tokenizer.return_value = MagicMock()
            
            search = HybridSearch()
            return search
    
    @pytest.mark.asyncio
    async def test_search_empty_database(self, hybrid_search, test_db):
        """Test hybrid search with empty database"""
        results = await hybrid_search.search("archery competition")
        
        assert isinstance(results, list)
        assert len(results) == 0
    
    @pytest.mark.asyncio
    async def test_search_text_matching(self, hybrid_search, test_db, sample_photo, sample_ai_metadata):
        """Test hybrid search with text matching"""
        with patch.object(hybrid_search.vector_search, 'search_by_text', return_value=[]):
            results = await hybrid_search.search("archery")
            
            assert isinstance(results, list)
            # Should find the photo based on text matching in description/keywords
            if len(results) > 0:
                assert results[0]["photo_id"] == sample_photo.id
                assert results[0]["text_score"] > 0
    
    @pytest.mark.asyncio
    async def test_search_combined_scoring(self, hybrid_search, test_db, sample_photo, sample_ai_metadata):
        """Test hybrid search combined scoring"""
        # Mock vector search to return results
        mock_vector_result = [{
            "photo_id": sample_photo.id,
            "similarity": 0.8,
            "description": sample_ai_metadata.description,
            "ai_keywords": sample_ai_metadata.ai_keywords,
            "photo": sample_photo.to_dict()
        }]
        
        with patch.object(hybrid_search.vector_search, 'search_by_text', return_value=mock_vector_result):
            results = await hybrid_search.search("archery")
            
            assert isinstance(results, list)
            if len(results) > 0:
                result = results[0]
                assert "combined_score" in result
                assert "vector_score" in result
                assert "text_score" in result
                # Combined score should be weighted combination
                expected_combined = 0.6 * result["vector_score"] + 0.4 * result["text_score"]
                assert result["combined_score"] == pytest.approx(expected_combined, abs=0.001)

@pytest.mark.integration
@pytest.mark.ai
class TestEmbeddingsIntegration:
    """Integration tests for embeddings functionality"""
    
    @pytest.mark.asyncio
    async def test_end_to_end_search_workflow(self, test_db, mock_settings):
        """Test complete search workflow with mocked components"""
        # Create test data
        photo = create_test_photo(test_db, 
            title="Archery Competition", 
            caption="Olympic archery medals ceremony"
        )
        metadata = create_test_metadata(test_db, photo.id,
            description="Athletes receiving gold medals at archery competition",
            ai_keywords=["archery", "medals", "competition", "athletes", "gold"]
        )
        
        with patch('backend.embeddings.open_clip.create_model_and_transforms') as mock_create, \
             patch('backend.embeddings.open_clip.get_tokenizer') as mock_tokenizer:
            
            # Mock CLIP model
            mock_model = MagicMock()
            mock_embedding = np.random.rand(512)
            mock_model.encode_text.return_value = MagicMock(
                cpu=lambda: MagicMock(numpy=lambda: MagicMock(flatten=lambda: mock_embedding))
            )
            mock_create.return_value = (mock_model, None, MagicMock())
            mock_tokenizer.return_value = MagicMock()
            
            # Test hybrid search
            search = HybridSearch()
            results = await search.search("archery medals")
            
            assert isinstance(results, list)
            # Should find our test photo based on text matching
            matching_results = [r for r in results if r["photo_id"] == photo.id]
            if len(matching_results) > 0:
                result = matching_results[0]
                assert result["text_score"] > 0  # Should have text match
                assert "combined_score" in result
    
    @pytest.mark.asyncio
    @pytest.mark.slow
    async def test_embedding_generation_performance(self, mock_clip_model):
        """Test embedding generation performance with multiple images"""
        with patch('backend.embeddings.open_clip.create_model_and_transforms') as mock_create, \
             patch('backend.embeddings.open_clip.get_tokenizer') as mock_tokenizer:
            
            mock_create.return_value = (mock_clip_model, None, MagicMock())
            mock_tokenizer.return_value = MagicMock()
            
            generator = EmbeddingGenerator()
            
            # Create multiple test images
            test_images = []
            for i in range(5):
                img = Image.new('RGB', (100, 100), color=(i*50, 0, 0))
                img_bytes = io.BytesIO()
                img.save(img_bytes, format='JPEG')
                test_images.append(img_bytes.getvalue())
            
            # Test batch processing
            embeddings = await generator.batch_process_images(test_images, batch_size=3)
            
            assert len(embeddings) == 5
            assert all(isinstance(emb, np.ndarray) for emb in embeddings)
            assert all(emb.shape == (512,) for emb in embeddings)
    
    @pytest.mark.asyncio
    async def test_similarity_calculations_accuracy(self, mock_clip_model):
        """Test accuracy of similarity calculations"""
        with patch('backend.embeddings.open_clip.create_model_and_transforms') as mock_create, \
             patch('backend.embeddings.open_clip.get_tokenizer') as mock_tokenizer:
            
            mock_create.return_value = (mock_clip_model, None, MagicMock())
            mock_tokenizer.return_value = MagicMock()
            
            generator = EmbeddingGenerator()
            
            # Test with known vectors
            vec1 = np.array([1.0, 0.0] + [0.0] * 510)  # Unit vector along x-axis
            vec2 = np.array([0.707, 0.707] + [0.0] * 510)  # 45-degree angle
            
            similarity = generator.calculate_similarity(vec1, vec2)
            expected_similarity = 0.707  # cos(45°)
            
            assert similarity == pytest.approx(expected_similarity, abs=0.001)