"""
Tests for AI processor module
"""

import pytest
import asyncio
import io
from unittest.mock import AsyncMock, MagicMock, patch
from PIL import Image
import numpy as np

from backend.ai_processor import AIProcessor
from backend.models import Photo, AIMetadata, ProcessingQueue
from tests.conftest import create_test_photo, create_test_metadata

@pytest.mark.unit
@pytest.mark.ai
class TestAIProcessor:
    """Test AI processor functionality"""
    
    @pytest.fixture
    def ai_processor(self, mock_settings):
        """Create AI processor with mocked settings"""
        with patch('backend.ai_processor.get_settings', return_value=mock_settings):
            processor = AIProcessor()
            return processor
    
    def test_ai_processor_init(self, ai_processor, mock_settings):
        """Test AI processor initialization"""
        assert ai_processor.max_image_size == 5 * 1024 * 1024
        assert ai_processor.max_dimension == 2200
        assert ai_processor.settings == mock_settings
    
    @pytest.mark.asyncio
    async def test_resize_image_for_api_small_image(self, ai_processor, mock_image_bytes):
        """Test image resizing for small images (no resize needed)"""
        resized = await ai_processor.resize_image_for_api(mock_image_bytes)
        assert isinstance(resized, bytes)
        assert len(resized) <= ai_processor.max_image_size
    
    @pytest.mark.asyncio
    async def test_resize_image_for_api_large_image(self, ai_processor):
        """Test image resizing for large images"""
        # Create a large image that needs resizing
        large_img = Image.new('RGB', (3000, 2000), color='blue')
        img_bytes = io.BytesIO()
        large_img.save(img_bytes, format='JPEG')
        large_image_data = img_bytes.getvalue()
        
        resized = await ai_processor.resize_image_for_api(large_image_data)
        
        # Check that image was resized
        resized_img = Image.open(io.BytesIO(resized))
        assert max(resized_img.size) <= ai_processor.max_dimension
        assert len(resized) <= ai_processor.max_image_size
    
    @pytest.mark.asyncio
    async def test_download_image_success(self, ai_processor):
        """Test successful image download"""
        mock_response = MagicMock()
        mock_response.content = b"fake image data"
        mock_response.raise_for_status = MagicMock()
        
        with patch('httpx.AsyncClient') as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)
            
            result = await ai_processor.download_image("https://example.com/test.jpg")
            assert result == b"fake image data"
    
    @pytest.mark.asyncio
    async def test_download_image_failure(self, ai_processor):
        """Test image download failure"""
        with patch('httpx.AsyncClient') as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                side_effect=Exception("Network error")
            )
            
            with pytest.raises(Exception, match="Network error"):
                await ai_processor.download_image("https://example.com/test.jpg")
    
    def test_extract_keywords_from_description(self, ai_processor):
        """Test keyword extraction from description"""
        description = "A beautiful landscape photo showing mountains and trees in the background"
        keywords = ai_processor.extract_keywords_from_description(description)
        
        assert isinstance(keywords, list)
        assert len(keywords) <= 10
        assert "beautiful" in keywords
        assert "landscape" in keywords
        assert "mountains" in keywords
        # Common words should be filtered out
        assert "the" not in keywords
        assert "and" not in keywords
    
    @pytest.mark.asyncio
    async def test_generate_description_success(self, ai_processor, mock_image_bytes):
        """Test successful AI description generation"""
        mock_message = MagicMock()
        mock_message.content = [MagicMock(text="A test photo showing archery medals")]
        
        with patch.object(ai_processor, 'client') as mock_client:
            mock_client.messages.create.return_value = mock_message
            
            description, keywords, processing_time = await ai_processor.generate_description(mock_image_bytes)
            
            assert description == "A test photo showing archery medals"
            assert isinstance(keywords, list)
            assert len(keywords) > 0
            assert processing_time > 0
            assert "archery" in keywords
    
    @pytest.mark.asyncio
    async def test_generate_description_api_failure(self, ai_processor, mock_image_bytes):
        """Test AI description generation API failure"""
        with patch.object(ai_processor, 'client') as mock_client:
            mock_client.messages.create.side_effect = Exception("API Error")
            
            with pytest.raises(Exception, match="API Error"):
                await ai_processor.generate_description(mock_image_bytes)
    
    @pytest.mark.asyncio
    async def test_process_photo_success(self, ai_processor, test_db, sample_photo, mock_image_bytes):
        """Test successful photo processing"""
        # Mock the image download and description generation
        with patch.object(ai_processor, 'download_image', return_value=mock_image_bytes) as mock_download, \
             patch.object(ai_processor, 'generate_description', 
                         return_value=("Test description", ["test", "photo"], 1.5)) as mock_generate:
            
            result = await ai_processor.process_photo(sample_photo.id)
            
            assert result is not None
            assert result["description"] == "Test description"
            assert result["ai_keywords"] == ["test", "photo"]
            assert result["processing_time"] == 1.5
            assert result["model_version"] == "claude-3-5-sonnet-20241022"
            
            # Verify metadata was saved to database
            metadata = test_db.query(AIMetadata).filter_by(photo_id=sample_photo.id).first()
            assert metadata is not None
            assert metadata.description == "Test description"
    
    @pytest.mark.asyncio
    async def test_process_photo_not_found(self, ai_processor, test_db):
        """Test processing non-existent photo"""
        result = await ai_processor.process_photo(999)
        assert result is None
    
    @pytest.mark.asyncio
    async def test_process_photo_already_processed(self, ai_processor, test_db, sample_photo, sample_ai_metadata):
        """Test processing photo that already has metadata"""
        result = await ai_processor.process_photo(sample_photo.id)
        
        assert result is not None
        assert result["description"] == sample_ai_metadata.description
    
    @pytest.mark.asyncio
    async def test_process_photo_download_failure(self, ai_processor, test_db, sample_photo):
        """Test photo processing with download failure"""
        with patch.object(ai_processor, 'download_image', side_effect=Exception("Download failed")):
            with pytest.raises(Exception, match="Download failed"):
                await ai_processor.process_photo(sample_photo.id)
    
    @pytest.mark.asyncio
    async def test_process_batch_success(self, ai_processor, test_db):
        """Test batch processing success"""
        # Create multiple test photos
        photos = [create_test_photo(test_db, smugmug_id=f"batch-{i}") for i in range(3)]
        photo_ids = [p.id for p in photos]
        
        with patch.object(ai_processor, 'process_photo', return_value={"id": 1}) as mock_process:
            results = await ai_processor.process_batch(photo_ids, max_concurrent=2)
            
            assert len(results) == 3
            assert all(result is not None for result in results)
            assert mock_process.call_count == 3
    
    @pytest.mark.asyncio
    async def test_process_batch_partial_failure(self, ai_processor, test_db):
        """Test batch processing with some failures"""
        photos = [create_test_photo(test_db, smugmug_id=f"batch-{i}") for i in range(3)]
        photo_ids = [p.id for p in photos]
        
        def mock_process_side_effect(photo_id):
            if photo_id == photo_ids[1]:  # Second photo fails
                raise Exception("Processing failed")
            return {"id": photo_id}
        
        with patch.object(ai_processor, 'process_photo', side_effect=mock_process_side_effect):
            results = await ai_processor.process_batch(photo_ids)
            
            assert len(results) == 3
            # Two should succeed, one should have error
            success_count = sum(1 for r in results if r and "error" not in r)
            error_count = sum(1 for r in results if r and "error" in r)
            assert success_count == 2
            assert error_count == 1
    
    @pytest.mark.asyncio
    async def test_add_to_processing_queue(self, ai_processor, test_db, sample_photo):
        """Test adding photos to processing queue"""
        photo_ids = [sample_photo.id]
        
        await ai_processor.add_to_processing_queue(photo_ids, priority=5)
        
        queue_item = test_db.query(ProcessingQueue).filter_by(photo_id=sample_photo.id).first()
        assert queue_item is not None
        assert queue_item.status == "pending"
        assert queue_item.priority == 5
    
    @pytest.mark.asyncio
    async def test_add_to_processing_queue_duplicate(self, ai_processor, test_db, sample_photo):
        """Test adding duplicate photos to queue (should not create duplicates)"""
        # Add photo to queue first time
        await ai_processor.add_to_processing_queue([sample_photo.id])
        
        # Add same photo again
        await ai_processor.add_to_processing_queue([sample_photo.id])
        
        # Should only have one queue item
        queue_count = test_db.query(ProcessingQueue).filter_by(photo_id=sample_photo.id).count()
        assert queue_count == 1
    
    @pytest.mark.asyncio
    async def test_get_queue_status_empty(self, ai_processor, test_db):
        """Test getting queue status when empty"""
        status = await ai_processor.get_queue_status()
        
        assert status["total"] == 0
        assert status["pending"] == 0
        assert status["processing"] == 0
        assert status["completed"] == 0
        assert status["failed"] == 0
    
    @pytest.mark.asyncio
    async def test_get_queue_status_with_items(self, ai_processor, test_db):
        """Test getting queue status with various items"""
        # Create photos in different states
        photos = [create_test_photo(test_db, smugmug_id=f"queue-{i}") for i in range(4)]
        
        # Add to queue with different statuses
        queue_items = [
            ProcessingQueue(photo_id=photos[0].id, status="pending"),
            ProcessingQueue(photo_id=photos[1].id, status="processing"),
            ProcessingQueue(photo_id=photos[2].id, status="completed"),
            ProcessingQueue(photo_id=photos[3].id, status="failed")
        ]
        
        for item in queue_items:
            test_db.add(item)
        test_db.commit()
        
        status = await ai_processor.get_queue_status()
        
        assert status["total"] == 4
        assert status["pending"] == 1
        assert status["processing"] == 1
        assert status["completed"] == 1
        assert status["failed"] == 1

@pytest.mark.integration
@pytest.mark.ai
class TestAIProcessorIntegration:
    """Integration tests for AI processor"""
    
    @pytest.mark.asyncio
    @pytest.mark.slow
    async def test_full_processing_pipeline(self, test_db, mock_settings):
        """Test complete processing pipeline (mocked)"""
        # This test would use real API calls in a staging environment
        # For unit tests, we mock the external dependencies
        
        photo = create_test_photo(test_db, 
            smugmug_id="integration-test",
            image_url="https://example.com/test.jpg"
        )
        
        with patch('backend.ai_processor.get_settings', return_value=mock_settings), \
             patch('httpx.AsyncClient') as mock_httpx, \
             patch('anthropic.Anthropic') as mock_anthropic:
            
            # Mock image download
            mock_response = MagicMock()
            mock_response.content = b"fake image data"
            mock_httpx.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)
            
            # Mock Claude API
            mock_message = MagicMock()
            mock_message.content = [MagicMock(text="Integration test description")]
            mock_anthropic.return_value.messages.create.return_value = mock_message
            
            processor = AIProcessor()
            result = await processor.process_photo(photo.id)
            
            assert result is not None
            assert result["description"] == "Integration test description"
            
            # Verify database state
            metadata = test_db.query(AIMetadata).filter_by(photo_id=photo.id).first()
            assert metadata is not None
            assert metadata.description == "Integration test description"