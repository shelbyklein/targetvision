"""
Simplified pytest configuration and fixtures for TargetVision tests
"""

import pytest
import asyncio
import os
import sys
from typing import Generator
from unittest.mock import MagicMock, patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Test database URL (SQLite in-memory for tests)
TEST_DATABASE_URL = "sqlite:///./test.db"

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
    settings.DATABASE_URL = TEST_DATABASE_URL
    return settings

@pytest.fixture
def sample_photo_data():
    """Sample photo data for testing"""
    return {
        "smugmug_id": "test-photo-123",
        "smugmug_uri": "/api/v2/photo/test-photo-123",
        "image_url": "https://photos.smugmug.com/photos/i-test123/0/L/i-test123-L.jpg",
        "thumbnail_url": "https://photos.smugmug.com/photos/i-test123/0/Th/i-test123-Th.jpg",
        "title": "Test Photo",
        "caption": "A test photo for unit testing",
        "keywords": ["test", "photo", "sample"],
        "album_name": "Test Album",
        "album_uri": "/api/v2/album/test-album",
        "width": 1920,
        "height": 1080,
        "format": "JPG",
        "file_size": 2048000
    }

@pytest.fixture
def mock_image_bytes():
    """Create mock image bytes for testing"""
    # Create a simple 1x1 pixel PNG
    import io
    from PIL import Image
    
    img = Image.new('RGB', (100, 100), color='red')
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='JPEG')
    return img_bytes.getvalue()

@pytest.fixture
def mock_claude_response():
    """Mock Claude API response"""
    return {
        "content": [{
            "text": "A professional archery competition photo showing medals and awards arranged on a table with ribbons"
        }]
    }

@pytest.fixture
def mock_httpx_client():
    """Mock httpx client for image downloads"""
    with patch('httpx.AsyncClient') as mock_client:
        yield mock_client

@pytest.fixture
def mock_anthropic_client():
    """Mock Anthropic client"""
    with patch('anthropic.Anthropic') as mock_client:
        yield mock_client