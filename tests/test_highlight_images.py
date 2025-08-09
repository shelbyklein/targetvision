"""
Tests for SmugMug HighlightImage functionality
"""

import pytest
from unittest.mock import Mock, AsyncMock, patch
import json

# Import our modules
import sys
import os
# Add both the project root and backend directories to the path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
backend_dir = os.path.join(project_root, 'backend')
sys.path.insert(0, project_root)
sys.path.insert(0, backend_dir)

from smugmug_service import SmugMugService


class TestHighlightImages:
    """Test suite for SmugMug HighlightImage functionality"""

    @pytest.fixture
    def mock_oauth(self):
        """Mock SmugMug OAuth for testing"""
        oauth = Mock()
        oauth.make_authenticated_request = AsyncMock()
        return oauth

    @pytest.fixture
    def smugmug_service(self, mock_oauth):
        """Create SmugMugService instance with mocked OAuth"""
        with patch('smugmug_service.SmugMugOAuth', return_value=mock_oauth):
            service = SmugMugService("test_token", "test_secret")
            service.oauth = mock_oauth
            return service

    @pytest.fixture
    def sample_node_with_highlight_image(self):
        """Sample folder node with HighlightImage data"""
        return {
            "NodeID": "ABC123",
            "Uri": "/api/v2/node/ABC123",
            "Name": "Test Folder",
            "Type": "folder",
            "HasChildren": True,
            "HighlightImage": {
                "ImageKey": "XYZ789",
                "Title": "Highlight Photo",
                "Caption": "Representative image for folder",
                "Uri": "/api/v2/image/XYZ789",
                "ImageSizes": {
                    "Thumb": {
                        "Url": "https://photos.smugmug.com/photos/i-XYZ789/0/S/i-XYZ789-S.jpg",
                        "Width": 150,
                        "Height": 150
                    },
                    "Small": {
                        "Url": "https://photos.smugmug.com/photos/i-XYZ789/0/S/i-XYZ789-S.jpg", 
                        "Width": 300,
                        "Height": 300
                    },
                    "Large": {
                        "Url": "https://photos.smugmug.com/photos/i-XYZ789/0/L/i-XYZ789-L.jpg",
                        "Width": 1024,
                        "Height": 768
                    }
                }
            }
        }

    @pytest.fixture
    def sample_album_with_highlight_image(self):
        """Sample album node with HighlightImage data"""
        return {
            "NodeID": "DEF456",
            "Uri": "/api/v2/node/DEF456",
            "Name": "Test Album",
            "Type": "album",
            "Uris": {
                "Album": {
                    "Uri": "/api/v2/album/GHI789"
                }
            },
            "HighlightImage": {
                "ImageKey": "JKL012",
                "Title": "Album Cover",
                "Caption": "Representative image for album",
                "Uri": "/api/v2/image/JKL012",
                "ImageSizes": {
                    "Thumb": {
                        "Url": "https://photos.smugmug.com/photos/i-JKL012/0/S/i-JKL012-S.jpg",
                        "Width": 150,
                        "Height": 150
                    },
                    "Medium": {
                        "Url": "https://photos.smugmug.com/photos/i-JKL012/0/M/i-JKL012-M.jpg",
                        "Width": 600,
                        "Height": 400
                    }
                }
            }
        }

    @pytest.fixture
    def sample_node_without_highlight_image(self):
        """Sample node without HighlightImage data"""
        return {
            "NodeID": "MNO345",
            "Uri": "/api/v2/node/MNO345",
            "Name": "Empty Folder",
            "Type": "folder",
            "HasChildren": False
        }
    
    @pytest.fixture
    def sample_folder_with_highlight_image_uri(self):
        """Sample folder node with HighlightImage URI that needs fetching"""
        return {
            "NodeID": "FOLDER123",
            "Uri": "/api/v2/node/FOLDER123",
            "Name": "Test Folder with Highlight",
            "Type": "folder",
            "HasChildren": True,
            "Uris": {
                "HighlightImage": {
                    "Uri": "/api/v2/highlight/node/FOLDER123"
                },
                "FolderHighlightImage": {
                    "Uri": "/api/v2/folder/user/cmac/SmugMug/Heroes!highlightimage"
                }
            }
        }
    
    @pytest.fixture
    def sample_folder_highlight_api_response(self):
        """Sample API response for folder highlight image endpoint"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "Response": {
                "Image": {
                    "ImageKey": "FOLDER_IMG_123",
                    "Title": "Folder Highlight Image",
                    "Caption": "Representative image for folder",
                    "Uri": "/api/v2/image/FOLDER_IMG_123",
                    "ThumbnailUrl": "https://photos.smugmug.com/SmugMug/Heroes/Von-Wongs-INSANE-rooftop/i-7NBSB2t/1/M7866GF3XHZL53htNWgS2GdqpqpV6Qpwznw4NKqjt/Th/smugmug_rooftop_0244-Th.jpg",
                    "OriginalWidth": 7360,
                    "OriginalHeight": 4912
                }
            }
        }
        return mock_response

    @pytest.fixture
    def mock_api_response(self, sample_node_with_highlight_image, sample_album_with_highlight_image):
        """Mock API response for get_node_children"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "Response": {
                "Node": [
                    sample_node_with_highlight_image,
                    sample_album_with_highlight_image
                ]
            }
        }
        return mock_response

    @pytest.mark.asyncio
    async def test_extract_highlight_image_info_with_image_sizes(self, smugmug_service, sample_node_with_highlight_image):
        """Test extracting highlight image info when ImageSizes are present"""
        result = smugmug_service.extract_highlight_image_info(sample_node_with_highlight_image)
        
        assert result is not None
        assert result["image_key"] == "XYZ789"
        assert result["title"] == "Highlight Photo"
        assert result["caption"] == "Representative image for folder"
        assert result["uri"] == "/api/v2/image/XYZ789"
        assert result["image_url"] == "https://photos.smugmug.com/photos/i-XYZ789/0/L/i-XYZ789-L.jpg"
        assert result["thumbnail_url"] == "https://photos.smugmug.com/photos/i-XYZ789/0/S/i-XYZ789-S.jpg"
        assert result["width"] == 1024
        assert result["height"] == 768

    @pytest.mark.asyncio
    async def test_extract_highlight_image_info_without_image_sizes(self, smugmug_service):
        """Test extracting highlight image info when only URI is available"""
        node_with_uri_only = {
            "NodeID": "TEST123",
            "Uris": {
                "HighlightImage": {
                    "Uri": "/api/v2/image/TEST456"
                }
            }
        }
        
        result = smugmug_service.extract_highlight_image_info(node_with_uri_only)
        
        assert result is not None
        assert result["highlight_uri"] == "/api/v2/image/TEST456"
        assert result["needs_fetch"] == True

    @pytest.mark.asyncio
    async def test_extract_highlight_image_info_no_highlight(self, smugmug_service, sample_node_without_highlight_image):
        """Test extracting highlight image info when no highlight image exists"""
        result = smugmug_service.extract_highlight_image_info(sample_node_without_highlight_image)
        
        assert result is None

    @pytest.mark.asyncio
    async def test_get_node_children_with_highlight_images(self, smugmug_service, sample_node_with_highlight_image, sample_album_with_highlight_image):
        """Test get_node_children includes HighlightImage data"""
        # Mock the children API response
        mock_children_response = Mock()
        mock_children_response.status_code = 200
        mock_children_response.json.return_value = {
            "Response": {
                "Node": [
                    sample_node_with_highlight_image,
                    sample_album_with_highlight_image
                ]
            }
        }
        
        # Mock get_user_root_node to return proper root node structure
        with patch.object(smugmug_service, 'get_user_root_node', return_value={
            "Uris": {"ChildNodes": {"Uri": "/api/v2/node/root!children"}}
        }):
            # Set up the API response for children request
            smugmug_service.oauth.make_authenticated_request.return_value = mock_children_response
            
            nodes = await smugmug_service.get_node_children()
        
        assert len(nodes) == 2
        
        # Check first node (folder with highlight image)
        folder_node = nodes[0]
        assert folder_node["NodeID"] == "ABC123"
        assert "highlight_image" in folder_node
        assert folder_node["highlight_image"]["image_key"] == "XYZ789"
        assert folder_node["highlight_image"]["image_url"] == "https://photos.smugmug.com/photos/i-XYZ789/0/L/i-XYZ789-L.jpg"
        
        # Check second node (album with highlight image)
        album_node = nodes[1]
        assert album_node["NodeID"] == "DEF456"
        assert "highlight_image" in album_node
        assert album_node["highlight_image"]["image_key"] == "JKL012"

    @pytest.mark.asyncio
    async def test_get_node_children_makes_request_with_expand_parameter(self, smugmug_service, mock_api_response):
        """Test that get_node_children requests HighlightImage expansion"""
        smugmug_service.oauth.make_authenticated_request.return_value = mock_api_response
        
        with patch.object(smugmug_service, 'get_user_root_node', return_value={
            "Uris": {"ChildNodes": {"Uri": "/api/v2/node/root!children"}}
        }):
            await smugmug_service.get_node_children()
        
        # Verify that the request included _expand=HighlightImage
        call_args = smugmug_service.oauth.make_authenticated_request.call_args
        assert call_args[1]['params']['_expand'] == 'HighlightImage'

    @pytest.mark.asyncio
    async def test_get_highlight_image_details_success(self, smugmug_service):
        """Test fetching highlight image details by URI"""
        highlight_uri = "/api/v2/image/TEST123"
        
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "Response": {
                "Image": {
                    "ImageKey": "TEST123",
                    "Title": "Test Image",
                    "ImageSizes": {
                        "Thumb": {"Url": "https://example.com/thumb.jpg"},
                        "Large": {"Url": "https://example.com/large.jpg"}
                    }
                }
            }
        }
        
        smugmug_service.oauth.make_authenticated_request.return_value = mock_response
        
        result = await smugmug_service.get_highlight_image_details(highlight_uri)
        
        assert result is not None
        assert result["image_key"] == "TEST123"
        assert result["title"] == "Test Image"
        
        # Verify request was made with correct parameters
        call_args = smugmug_service.oauth.make_authenticated_request.call_args
        assert "_expand" in call_args[1]['params']
        assert call_args[1]['params']['_expand'] == "ImageSizes"

    @pytest.mark.asyncio
    async def test_get_highlight_image_details_failure(self, smugmug_service):
        """Test handling of failed highlight image details request"""
        highlight_uri = "/api/v2/image/FAIL123"
        
        mock_response = Mock()
        mock_response.status_code = 404
        smugmug_service.oauth.make_authenticated_request.return_value = mock_response
        
        result = await smugmug_service.get_highlight_image_details(highlight_uri)
        
        assert result is None

    @pytest.mark.asyncio
    async def test_highlight_image_size_preference(self, smugmug_service):
        """Test that highlight image extraction prefers larger sizes"""
        node_with_multiple_sizes = {
            "HighlightImage": {
                "ImageKey": "SIZE_TEST",
                "ImageSizes": {
                    "Thumb": {
                        "Url": "https://example.com/thumb.jpg",
                        "Width": 150, "Height": 150
                    },
                    "Medium": {
                        "Url": "https://example.com/medium.jpg",
                        "Width": 400, "Height": 300
                    },
                    "X2Large": {
                        "Url": "https://example.com/x2large.jpg",
                        "Width": 1600, "Height": 1200
                    },
                    "Small": {
                        "Url": "https://example.com/small.jpg",
                        "Width": 240, "Height": 180
                    }
                }
            }
        }
        
        result = smugmug_service.extract_highlight_image_info(node_with_multiple_sizes)
        
        # Should prefer X2Large over smaller sizes
        assert result["image_url"] == "https://example.com/x2large.jpg"
        assert result["width"] == 1600
        assert result["height"] == 1200
        
        # Should prefer Small for thumbnail over Thumb
        assert result["thumbnail_url"] == "https://example.com/small.jpg"

    @pytest.mark.asyncio
    async def test_highlight_image_fallback_order(self, smugmug_service):
        """Test fallback order when preferred sizes aren't available"""
        node_with_limited_sizes = {
            "HighlightImage": {
                "ImageKey": "FALLBACK_TEST",
                "ImageSizes": {
                    "Thumb": {
                        "Url": "https://example.com/thumb.jpg",
                        "Width": 150, "Height": 150
                    },
                    "Medium": {
                        "Url": "https://example.com/medium.jpg",
                        "Width": 400, "Height": 300
                    }
                }
            }
        }
        
        result = smugmug_service.extract_highlight_image_info(node_with_limited_sizes)
        
        # Should fall back to Medium when larger sizes not available
        assert result["image_url"] == "https://example.com/medium.jpg"
        assert result["width"] == 400
        assert result["height"] == 300
        
        # Should use Thumb for thumbnail when Small not available
        assert result["thumbnail_url"] == "https://example.com/thumb.jpg"
    
    @pytest.mark.asyncio
    async def test_extract_highlight_image_info_with_thumbnail_url(self, smugmug_service):
        """Test extracting highlight image info when ThumbnailUrl is present (folder case)"""
        node_with_thumbnail_url = {
            "HighlightImage": {
                "ImageKey": "THUMB_TEST",
                "Title": "Folder Highlight",
                "Caption": "Folder representative image",
                "Uri": "/api/v2/image/THUMB_TEST",
                "ThumbnailUrl": "https://photos.smugmug.com/SmugMug/Heroes/i-test/Th/test-Th.jpg"
            }
        }
        
        result = smugmug_service.extract_highlight_image_info(node_with_thumbnail_url)
        
        assert result is not None
        assert result["image_key"] == "THUMB_TEST"
        assert result["title"] == "Folder Highlight"
        assert result["thumbnail_url"] == "https://photos.smugmug.com/SmugMug/Heroes/i-test/Th/test-Th.jpg"
        # ThumbnailUrl should be used as primary image URL for folders
        assert result["image_url"] == "https://photos.smugmug.com/SmugMug/Heroes/i-test/Th/test-Th.jpg"
    
    @pytest.mark.asyncio
    async def test_extract_folder_highlight_uri_needs_fetch(self, smugmug_service, sample_folder_with_highlight_image_uri):
        """Test extracting folder highlight URI when it needs to be fetched"""
        result = smugmug_service.extract_highlight_image_info(sample_folder_with_highlight_image_uri)
        
        assert result is not None
        assert result["folder_highlight_uri"] == "/api/v2/folder/user/cmac/SmugMug/Heroes!highlightimage"
        assert result["needs_folder_fetch"] == True
    
    @pytest.mark.asyncio
    async def test_get_folder_highlight_image_details_success(self, smugmug_service, sample_folder_highlight_api_response):
        """Test fetching folder highlight image details successfully"""
        folder_highlight_uri = "/api/v2/folder/user/cmac/SmugMug/Heroes!highlightimage"
        
        smugmug_service.oauth.make_authenticated_request.return_value = sample_folder_highlight_api_response
        
        result = await smugmug_service.get_folder_highlight_image_details(folder_highlight_uri)
        
        assert result is not None
        assert result["image_key"] == "FOLDER_IMG_123"
        assert result["title"] == "Folder Highlight Image"
        assert result["thumbnail_url"] == "https://photos.smugmug.com/SmugMug/Heroes/Von-Wongs-INSANE-rooftop/i-7NBSB2t/1/M7866GF3XHZL53htNWgS2GdqpqpV6Qpwznw4NKqjt/Th/smugmug_rooftop_0244-Th.jpg"
        assert result["image_url"] == "https://photos.smugmug.com/SmugMug/Heroes/Von-Wongs-INSANE-rooftop/i-7NBSB2t/1/M7866GF3XHZL53htNWgS2GdqpqpV6Qpwznw4NKqjt/Th/smugmug_rooftop_0244-Th.jpg"
        assert result["width"] == 7360
        assert result["height"] == 4912
        
        # Verify request was made to correct URL
        call_args = smugmug_service.oauth.make_authenticated_request.call_args
        assert call_args[0][1] == "https://api.smugmug.com/api/v2/folder/user/cmac/SmugMug/Heroes!highlightimage"
    
    @pytest.mark.asyncio
    async def test_get_folder_highlight_image_details_failure(self, smugmug_service):
        """Test handling of failed folder highlight image details request"""
        folder_highlight_uri = "/api/v2/folder/user/cmac/SmugMug/Heroes!highlightimage"
        
        mock_response = Mock()
        mock_response.status_code = 404
        smugmug_service.oauth.make_authenticated_request.return_value = mock_response
        
        result = await smugmug_service.get_folder_highlight_image_details(folder_highlight_uri)
        
        assert result is None
    
    @pytest.mark.asyncio
    async def test_get_node_children_with_folder_highlight_images(self, smugmug_service, sample_folder_with_highlight_image_uri, sample_folder_highlight_api_response):
        """Test get_node_children fetches and includes folder HighlightImage data with ThumbnailUrl"""
        # Mock the children API response with folder that has highlight image URI
        mock_children_response = Mock()
        mock_children_response.status_code = 200
        mock_children_response.json.return_value = {
            "Response": {
                "Node": [sample_folder_with_highlight_image_uri]
            }
        }
        
        # Mock get_user_root_node
        with patch.object(smugmug_service, 'get_user_root_node', return_value={
            "Uris": {"ChildNodes": {"Uri": "/api/v2/node/root!children"}}
        }):
            # Set up API responses: first for children, then for folder highlight image
            smugmug_service.oauth.make_authenticated_request.side_effect = [
                mock_children_response,           # Children request
                sample_folder_highlight_api_response  # Folder highlight image request
            ]
            
            nodes = await smugmug_service.get_node_children()
        
        assert len(nodes) == 1
        
        # Check folder node has highlight image with ThumbnailUrl
        folder_node = nodes[0]
        assert folder_node["NodeID"] == "FOLDER123"
        assert "highlight_image" in folder_node
        assert folder_node["highlight_image"]["image_key"] == "FOLDER_IMG_123"
        assert folder_node["highlight_image"]["thumbnail_url"] == "https://photos.smugmug.com/SmugMug/Heroes/Von-Wongs-INSANE-rooftop/i-7NBSB2t/1/M7866GF3XHZL53htNWgS2GdqpqpV6Qpwznw4NKqjt/Th/smugmug_rooftop_0244-Th.jpg"
        # Verify ThumbnailUrl is used as primary image URL
        assert folder_node["highlight_image"]["image_url"] == folder_node["highlight_image"]["thumbnail_url"]