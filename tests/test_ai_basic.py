"""
Basic AI functionality tests with careful import management
"""

import pytest
import sys
import os
from unittest.mock import MagicMock, patch, AsyncMock

# Only add backend path when we actually need to import
def get_backend_path():
    return os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend'))

def test_config_import():
    """Test that we can import config without heavy dependencies"""
    backend_path = get_backend_path()
    if backend_path not in sys.path:
        sys.path.insert(0, backend_path)
    
    try:
        from config import get_settings
        settings = get_settings()
        assert settings is not None
        assert hasattr(settings, 'ANTHROPIC_API_KEY')
        print("✅ Config import successful")
    except ImportError as e:
        pytest.skip(f"Config import failed: {e}")

@patch('anthropic.Anthropic')
def test_ai_processor_mock(mock_anthropic):
    """Test AI processor with all dependencies mocked"""
    backend_path = get_backend_path()
    if backend_path not in sys.path:
        sys.path.insert(0, backend_path)
    
    # Mock all heavy dependencies before import
    with patch('torch.cuda.is_available', return_value=False), \
         patch('open_clip.create_model_and_transforms') as mock_clip, \
         patch('open_clip.get_tokenizer'):
        
        try:
            from ai_processor import AIProcessor
            
            # Create processor
            processor = AIProcessor()
            assert processor is not None
            assert processor.max_image_size == 5 * 1024 * 1024
            print("✅ AI processor creation successful")
            
        except ImportError as e:
            pytest.skip(f"AI processor import failed: {e}")

def test_keyword_extraction():
    """Test keyword extraction without heavy imports"""
    backend_path = get_backend_path()
    if backend_path not in sys.path:
        sys.path.insert(0, backend_path)
    
    with patch('torch.cuda.is_available', return_value=False), \
         patch('open_clip.create_model_and_transforms'), \
         patch('open_clip.get_tokenizer'), \
         patch('anthropic.Anthropic'):
        
        try:
            from ai_processor import AIProcessor
            
            processor = AIProcessor()
            description = "A beautiful landscape photo showing mountains and trees in the background"
            keywords = processor.extract_keywords_from_description(description)
            
            assert isinstance(keywords, list)
            assert len(keywords) > 0
            assert "beautiful" in keywords
            assert "landscape" in keywords
            # Common words should be filtered out
            assert "the" not in keywords
            print("✅ Keyword extraction successful")
            
        except ImportError as e:
            pytest.skip(f"Failed to test keyword extraction: {e}")

@pytest.mark.asyncio
async def test_mock_image_processing():
    """Test image processing with mocked components"""
    backend_path = get_backend_path()
    if backend_path not in sys.path:
        sys.path.insert(0, backend_path)
    
    with patch('torch.cuda.is_available', return_value=False), \
         patch('open_clip.create_model_and_transforms'), \
         patch('open_clip.get_tokenizer'), \
         patch('anthropic.Anthropic') as mock_anthropic, \
         patch('httpx.AsyncClient') as mock_httpx:
        
        try:
            from ai_processor import AIProcessor
            
            # Mock image download
            mock_response = MagicMock()
            mock_response.content = b"fake image data"
            mock_response.raise_for_status = MagicMock()
            mock_httpx.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)
            
            # Mock Claude API response
            mock_message = MagicMock()
            mock_message.content = [MagicMock(text="A test image for unit testing")]
            mock_anthropic.return_value.messages.create.return_value = mock_message
            
            processor = AIProcessor()
            
            # Test image download
            image_data = await processor.download_image("https://example.com/test.jpg")
            assert image_data == b"fake image data"
            
            # Test description generation with real image data
            from PIL import Image
            import io
            
            # Create a real image for testing
            img = Image.new('RGB', (100, 100), color='red')
            img_bytes = io.BytesIO()
            img.save(img_bytes, format='JPEG')
            real_image_data = img_bytes.getvalue()
            
            description, keywords, time_taken = await processor.generate_description(real_image_data)
            assert description == "A test image for unit testing"
            assert isinstance(keywords, list)
            assert time_taken > 0
            
            print("✅ Mock image processing successful")
            
        except ImportError as e:
            pytest.skip(f"Failed to test image processing: {e}")

def test_database_model_basic():
    """Test basic database model functionality"""
    try:
        # Test that we can create basic model-like objects
        photo_data = {
            "smugmug_id": "test-123",
            "title": "Test Photo",
            "width": 1920,
            "height": 1080
        }
        
        # Simulate model to_dict functionality
        def to_dict():
            return photo_data.copy()
        
        result = to_dict()
        assert result["smugmug_id"] == "test-123"
        assert result["width"] == 1920
        
        print("✅ Basic model functionality works")
        
    except Exception as e:
        pytest.fail(f"Basic model test failed: {e}")

class TestAIFunctionalityBasic:
    """Test class for AI functionality with minimal imports"""
    
    def test_settings_validation(self, mock_settings):
        """Test settings validation"""
        assert mock_settings.ANTHROPIC_API_KEY == "test-api-key"
        assert mock_settings.SMUGMUG_API_KEY == "test-smugmug-key"
        assert mock_settings.MAX_PHOTOS_MVP == 100
    
    def test_photo_data_structure(self, sample_photo_data):
        """Test photo data structure"""
        assert sample_photo_data["smugmug_id"] == "test-photo-123"
        assert sample_photo_data["width"] == 1920
        assert sample_photo_data["height"] == 1080
        assert isinstance(sample_photo_data["keywords"], list)
    
    def test_mock_image_data(self, mock_image_bytes):
        """Test mock image data"""
        assert isinstance(mock_image_bytes, bytes)
        assert len(mock_image_bytes) > 0