"""
Tests for FastAPI endpoints
"""

import pytest
import json
from unittest.mock import MagicMock, patch, AsyncMock
from fastapi.testclient import TestClient

from backend.models import Photo, AIMetadata, OAuthToken, ProcessingQueue
from tests.conftest import create_test_photo, create_test_metadata

@pytest.mark.api
@pytest.mark.unit
class TestBasicEndpoints:
    """Test basic API endpoints"""
    
    def test_root_endpoint(self, client):
        """Test root endpoint"""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "TargetVision MVP API"
        assert data["status"] == "running"
        assert data["version"] == "0.1.0"
    
    def test_health_endpoint(self, client):
        """Test health check endpoint"""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["api"] == "running"
    
    def test_api_status_endpoint(self, client):
        """Test API status endpoint"""
        response = client.get("/api/status")
        assert response.status_code == 200
        data = response.json()
        assert "smugmug_configured" in data
        assert "anthropic_configured" in data
        assert "database_configured" in data

@pytest.mark.api
@pytest.mark.unit
class TestAuthEndpoints:
    """Test authentication endpoints"""
    
    def test_auth_status_not_authenticated(self, client, test_db):
        """Test auth status when not authenticated"""
        response = client.get("/auth/status")
        assert response.status_code == 200
        data = response.json()
        assert data["authenticated"] is False
    
    def test_auth_status_authenticated(self, client, test_db, mock_oauth_token):
        """Test auth status when authenticated"""
        response = client.get("/auth/status")
        assert response.status_code == 200
        data = response.json()
        assert data["authenticated"] is True
        assert data["username"] == mock_oauth_token.username
        assert data["user_id"] == mock_oauth_token.user_id
    
    @patch('backend.main.SmugMugOAuth')
    def test_start_oauth_success(self, mock_oauth_class, client):
        """Test starting OAuth flow successfully"""
        mock_oauth = MagicMock()
        mock_oauth_class.return_value = mock_oauth
        mock_oauth.get_request_token = AsyncMock(return_value={
            "oauth_token": "test-token",
            "oauth_token_secret": "test-secret"
        })
        mock_oauth.get_authorization_url.return_value = "https://api.smugmug.com/auth?oauth_token=test-token"
        
        response = client.post("/auth/smugmug/request")
        assert response.status_code == 200
        data = response.json()
        assert "auth_url" in data
        assert "request_token" in data
    
    @patch('backend.main.SmugMugOAuth')
    def test_start_oauth_failure(self, mock_oauth_class, client):
        """Test OAuth flow failure"""
        mock_oauth = MagicMock()
        mock_oauth_class.return_value = mock_oauth
        mock_oauth.get_request_token = AsyncMock(return_value=None)
        
        response = client.post("/auth/smugmug/request")
        assert response.status_code == 500
        assert "Failed to get request token" in response.json()["detail"]
    
    def test_oauth_callback_invalid_token(self, client):
        """Test OAuth callback with invalid token"""
        response = client.get("/auth/smugmug/callback?oauth_token=invalid&oauth_verifier=test")
        assert response.status_code == 400
        assert "Invalid or expired request token" in response.json()["detail"]

@pytest.mark.api
@pytest.mark.unit
class TestPhotoEndpoints:
    """Test photo management endpoints"""
    
    def test_list_photos_empty(self, client, test_db):
        """Test listing photos when database is empty"""
        response = client.get("/photos")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0
    
    def test_list_photos_with_data(self, client, test_db, sample_photo):
        """Test listing photos with data"""
        response = client.get("/photos")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["id"] == sample_photo.id
        assert data[0]["smugmug_id"] == sample_photo.smugmug_id
    
    def test_list_photos_pagination(self, client, test_db):
        """Test photo listing with pagination"""
        # Create multiple photos
        for i in range(5):
            create_test_photo(test_db, smugmug_id=f"test-{i}")
        
        # Test with limit
        response = client.get("/photos?limit=3")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3
        
        # Test with skip and limit
        response = client.get("/photos?skip=2&limit=2")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
    
    def test_get_photo_success(self, client, test_db, sample_photo):
        """Test getting single photo"""
        response = client.get(f"/photos/{sample_photo.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == sample_photo.id
        assert data["smugmug_id"] == sample_photo.smugmug_id
    
    def test_get_photo_with_ai_metadata(self, client, test_db, sample_photo, sample_ai_metadata):
        """Test getting photo with AI metadata"""
        response = client.get(f"/photos/{sample_photo.id}")
        assert response.status_code == 200
        data = response.json()
        assert "ai_metadata" in data
        assert data["ai_metadata"]["description"] == sample_ai_metadata.description
    
    def test_get_photo_not_found(self, client, test_db):
        """Test getting non-existent photo"""
        response = client.get("/photos/999")
        assert response.status_code == 404
        assert "Photo not found" in response.json()["detail"]
    
    def test_delete_photo_success(self, client, test_db, sample_photo):
        """Test deleting photo successfully"""
        response = client.delete(f"/photos/{sample_photo.id}")
        assert response.status_code == 200
        assert "deleted successfully" in response.json()["message"]
        
        # Verify photo is deleted
        deleted_photo = test_db.query(Photo).filter_by(id=sample_photo.id).first()
        assert deleted_photo is None
    
    def test_delete_photo_not_found(self, client, test_db):
        """Test deleting non-existent photo"""
        response = client.delete("/photos/999")
        assert response.status_code == 404
        assert "Photo not found" in response.json()["detail"]
    
    def test_sync_photos_not_authenticated(self, client, test_db):
        """Test photo sync without authentication"""
        response = client.post("/photos/sync")
        assert response.status_code == 401
        assert "Not authenticated" in response.json()["detail"]
    
    @patch('backend.main.SmugMugService')
    def test_sync_photos_success(self, mock_service_class, client, test_db, mock_oauth_token):
        """Test successful photo sync"""
        mock_service = MagicMock()
        mock_service_class.return_value = mock_service
        mock_service.sync_all_photos = AsyncMock(return_value=[{
            "smugmug_id": "sync-test-123",
            "image_url": "https://example.com/test.jpg",
            "title": "Synced Photo"
        }])
        
        response = client.post("/photos/sync")
        assert response.status_code == 200
        data = response.json()
        assert "Successfully synced" in data["message"]
        assert data["synced"] == 1

@pytest.mark.api
@pytest.mark.unit
class TestAIProcessingEndpoints:
    """Test AI processing endpoints"""
    
    @patch('backend.main.ai_processor')
    def test_process_photo_success(self, mock_processor, client, test_db, sample_photo):
        """Test successful photo processing"""
        mock_processor.process_photo = AsyncMock(return_value={
            "id": 1,
            "photo_id": sample_photo.id,
            "description": "Test AI description",
            "ai_keywords": ["test", "ai"],
            "processing_time": 2.5
        })
        
        response = client.post(f"/photos/{sample_photo.id}/process")
        assert response.status_code == 200
        data = response.json()
        assert "successfully" in data["message"]
        assert "ai_metadata" in data
    
    def test_process_photo_not_found(self, client, test_db):
        """Test processing non-existent photo"""
        response = client.post("/photos/999/process")
        assert response.status_code == 404
        assert "Photo not found" in response.json()["detail"]
    
    def test_process_photo_already_processed(self, client, test_db, sample_photo, sample_ai_metadata):
        """Test processing photo that already has metadata"""
        response = client.post(f"/photos/{sample_photo.id}/process")
        assert response.status_code == 200
        data = response.json()
        assert "already processed" in data["message"]
    
    @patch('backend.main.ai_processor')
    def test_process_photos_batch_success(self, mock_processor, client, test_db):
        """Test successful batch processing"""
        # Create test photos
        photos = [create_test_photo(test_db, smugmug_id=f"batch-{i}") for i in range(3)]
        photo_ids = [p.id for p in photos]
        
        mock_processor.add_to_processing_queue = AsyncMock()
        mock_processor.process_batch = AsyncMock(return_value=[
            {"id": 1}, {"id": 2}, {"id": 3}
        ])
        
        response = client.post("/photos/process/batch", json=photo_ids)
        assert response.status_code == 200
        data = response.json()
        assert "completed" in data["message"]
        assert data["processed"] == 3
        assert data["total"] == 3
    
    def test_process_photos_batch_no_photos(self, client, test_db):
        """Test batch processing with no valid photos"""
        response = client.post("/photos/process/batch", json=[999, 1000])
        assert response.status_code == 404
        assert "No valid photos found" in response.json()["detail"]
    
    @patch('backend.main.ai_processor')
    def test_get_queue_status(self, mock_processor, client):
        """Test getting processing queue status"""
        mock_processor.get_queue_status = AsyncMock(return_value={
            "total": 5,
            "pending": 2,
            "processing": 1,
            "completed": 2,
            "failed": 0
        })
        
        response = client.get("/photos/process/queue")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 5
        assert data["pending"] == 2
    
    @patch('backend.main.ai_processor')
    def test_add_to_queue(self, mock_processor, client, test_db, sample_photo):
        """Test adding photos to processing queue"""
        mock_processor.add_to_processing_queue = AsyncMock()
        
        response = client.post("/photos/process/queue/add", json=[sample_photo.id])
        assert response.status_code == 200
        data = response.json()
        assert "Added" in data["message"]
        assert data["added"] == 1

@pytest.mark.api
@pytest.mark.unit
class TestSearchEndpoints:
    """Test search endpoints"""
    
    def test_search_missing_query(self, client):
        """Test search without query parameter"""
        response = client.get("/search")
        assert response.status_code == 422  # Validation error
    
    def test_search_empty_query(self, client):
        """Test search with empty query"""
        response = client.get("/search?q=")
        assert response.status_code == 422  # Validation error (min_length=1)
    
    @patch('backend.main.hybrid_search')
    def test_search_hybrid_success(self, mock_search, client):
        """Test successful hybrid search"""
        mock_search.search = AsyncMock(return_value=[{
            "photo_id": 1,
            "combined_score": 0.8,
            "description": "Test photo",
            "photo": {"id": 1, "title": "Test"}
        }])
        
        response = client.get("/search?q=test&search_type=hybrid")
        assert response.status_code == 200
        data = response.json()
        assert data["query"] == "test"
        assert data["search_type"] == "hybrid"
        assert data["results"] == 1
        assert len(data["photos"]) == 1
    
    @patch('backend.main.vector_search')
    def test_search_vector_success(self, mock_search, client):
        """Test successful vector search"""
        mock_search.search_by_text = AsyncMock(return_value=[{
            "photo_id": 1,
            "similarity": 0.9,
            "description": "Vector search result"
        }])
        
        response = client.get("/search?q=archery&search_type=vector")
        assert response.status_code == 200
        data = response.json()
        assert data["search_type"] == "vector"
    
    def test_search_text_with_metadata(self, client, test_db, sample_photo, sample_ai_metadata):
        """Test text search with existing metadata"""
        response = client.get("/search?q=archery&search_type=text")
        assert response.status_code == 200
        data = response.json()
        assert data["search_type"] == "text"
        # Should find the photo based on AI metadata keywords
        if data["results"] > 0:
            assert data["photos"][0]["photo_id"] == sample_photo.id
    
    def test_search_invalid_type(self, client):
        """Test search with invalid search type"""
        response = client.get("/search?q=test&search_type=invalid")
        assert response.status_code == 422  # Validation error
    
    @patch('backend.main.vector_search')
    def test_find_similar_photos_success(self, mock_search, client, test_db, sample_photo):
        """Test finding similar photos successfully"""
        mock_search.search_similar_images = AsyncMock(return_value=[{
            "photo_id": 2,
            "similarity": 0.7,
            "description": "Similar photo"
        }])
        
        response = client.get(f"/photos/{sample_photo.id}/similar")
        assert response.status_code == 200
        data = response.json()
        assert data["photo_id"] == sample_photo.id
        assert "similar_photos" in data
        assert "results" in data
    
    def test_find_similar_photos_not_found(self, client, test_db):
        """Test finding similar photos for non-existent photo"""
        response = client.get("/photos/999/similar")
        assert response.status_code == 404
        assert "Photo not found" in response.json()["detail"]

@pytest.mark.api
@pytest.mark.unit
class TestMetadataEndpoints:
    """Test metadata management endpoints"""
    
    def test_get_metadata_success(self, client, test_db, sample_photo, sample_ai_metadata):
        """Test getting AI metadata successfully"""
        response = client.get(f"/metadata/{sample_photo.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["photo_id"] == sample_photo.id
        assert data["description"] == sample_ai_metadata.description
    
    def test_get_metadata_not_found(self, client, test_db, sample_photo):
        """Test getting metadata for photo without AI metadata"""
        response = client.get(f"/metadata/{sample_photo.id}")
        assert response.status_code == 404
        assert "AI metadata not found" in response.json()["detail"]
    
    def test_update_metadata_success(self, client, test_db, sample_photo, sample_ai_metadata):
        """Test updating AI metadata successfully"""
        update_data = {
            "description": "Updated description",
            "ai_keywords": ["updated", "keywords"],
            "approved": True
        }
        
        response = client.put(f"/metadata/{sample_photo.id}", json=update_data)
        assert response.status_code == 200
        data = response.json()
        assert "updated successfully" in data["message"]
        assert data["metadata"]["description"] == "Updated description"
        assert data["metadata"]["approved"] is True
    
    def test_update_metadata_partial(self, client, test_db, sample_photo, sample_ai_metadata):
        """Test partial metadata update"""
        update_data = {"approved": True}
        
        response = client.put(f"/metadata/{sample_photo.id}", json=update_data)
        assert response.status_code == 200
        data = response.json()
        assert data["metadata"]["approved"] is True
        # Other fields should remain unchanged
        assert data["metadata"]["description"] == sample_ai_metadata.description
    
    def test_update_metadata_not_found(self, client, test_db, sample_photo):
        """Test updating metadata that doesn't exist"""
        update_data = {"description": "New description"}
        
        response = client.put(f"/metadata/{sample_photo.id}", json=update_data)
        assert response.status_code == 404
        assert "AI metadata not found" in response.json()["detail"]
    
    def test_approve_metadata_success(self, client, test_db, sample_photo, sample_ai_metadata):
        """Test approving AI metadata successfully"""
        response = client.post(f"/metadata/{sample_photo.id}/approve")
        assert response.status_code == 200
        data = response.json()
        assert "approved successfully" in data["message"]
        assert data["photo_id"] == sample_photo.id
        
        # Verify in database
        updated_metadata = test_db.query(AIMetadata).filter_by(photo_id=sample_photo.id).first()
        assert updated_metadata.approved is True
        assert updated_metadata.approved_at is not None
    
    def test_approve_metadata_not_found(self, client, test_db, sample_photo):
        """Test approving metadata that doesn't exist"""
        response = client.post(f"/metadata/{sample_photo.id}/approve")
        assert response.status_code == 404
        assert "AI metadata not found" in response.json()["detail"]

@pytest.mark.api
@pytest.mark.integration
class TestAPIIntegration:
    """Integration tests for API endpoints"""
    
    @patch('backend.main.ai_processor')
    def test_complete_photo_workflow(self, mock_processor, client, test_db, mock_oauth_token):
        """Test complete photo processing workflow"""
        # Mock SmugMug service for sync
        with patch('backend.main.SmugMugService') as mock_service_class:
            mock_service = MagicMock()
            mock_service_class.return_value = mock_service
            mock_service.sync_all_photos = AsyncMock(return_value=[{
                "smugmug_id": "workflow-test",
                "image_url": "https://example.com/workflow.jpg",
                "title": "Workflow Test Photo"
            }])
            
            # 1. Sync photos
            sync_response = client.post("/photos/sync")
            assert sync_response.status_code == 200
            
            # 2. Get synced photos
            photos_response = client.get("/photos")
            assert photos_response.status_code == 200
            photos = photos_response.json()
            assert len(photos) > 0
            
            photo_id = photos[0]["id"]
            
            # 3. Mock AI processing
            mock_processor.process_photo = AsyncMock(return_value={
                "id": 1,
                "photo_id": photo_id,
                "description": "Workflow test description",
                "ai_keywords": ["workflow", "test"]
            })
            
            # 4. Process photo with AI
            process_response = client.post(f"/photos/{photo_id}/process")
            assert process_response.status_code == 200
            
            # 5. Search for processed photo
            with patch('backend.main.hybrid_search') as mock_search:
                mock_search.search = AsyncMock(return_value=[{
                    "photo_id": photo_id,
                    "combined_score": 0.8,
                    "description": "Workflow test description"
                }])
                
                search_response = client.get("/search?q=workflow")
                assert search_response.status_code == 200
                search_data = search_response.json()
                assert search_data["results"] > 0