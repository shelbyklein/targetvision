"""
Minimal pytest configuration for TargetVision tests
"""

import pytest
import asyncio
from unittest.mock import MagicMock

@pytest.fixture(scope="session")
def event_loop():
    """Create an event loop for the entire test session"""
    loop = asyncio.get_event_loop()
    yield loop
    loop.close()

@pytest.fixture
def mock_settings():
    """Mock settings for testing"""
    settings = MagicMock()
    settings.ANTHROPIC_API_KEY = "test-api-key"
    settings.SMUGMUG_API_KEY = "test-smugmug-key"
    settings.SMUGMUG_API_SECRET = "test-smugmug-secret"
    settings.MAX_PHOTOS_MVP = 100
    return settings

@pytest.fixture
def sample_photo_data():
    """Sample photo data for testing"""
    return {
        "smugmug_id": "test-photo-123",
        "image_url": "https://photos.smugmug.com/photos/i-test123/0/L/i-test123-L.jpg",
        "title": "Test Photo",
        "keywords": ["test", "photo", "sample"],
        "width": 1920,
        "height": 1080
    }

@pytest.fixture
def mock_image_bytes():
    """Create mock image bytes for testing"""
    # Simple mock bytes that looks like image data
    return b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00d\x00\x00\x00d\x08\x02'