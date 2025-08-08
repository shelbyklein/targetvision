"""
Tests for database models
"""

import pytest
from datetime import datetime, timedelta

from backend.models import Photo, AIMetadata, OAuthToken, ProcessingQueue

@pytest.mark.unit
@pytest.mark.database
class TestPhotoModel:
    """Test Photo model functionality"""
    
    def test_photo_creation(self, test_db):
        """Test creating a photo"""
        photo = Photo(
            smugmug_id="test-photo-123",
            image_url="https://example.com/test.jpg",
            title="Test Photo",
            caption="A test photo",
            keywords=["test", "photo"],
            width=1920,
            height=1080
        )
        test_db.add(photo)
        test_db.commit()
        
        assert photo.id is not None
        assert photo.smugmug_id == "test-photo-123"
        assert photo.created_at is not None
    
    def test_photo_to_dict(self, test_db):
        """Test photo serialization to dict"""
        photo = Photo(
            smugmug_id="dict-test",
            title="Dict Test Photo",
            width=800,
            height=600
        )
        test_db.add(photo)
        test_db.commit()
        
        photo_dict = photo.to_dict()
        
        assert isinstance(photo_dict, dict)
        assert photo_dict["id"] == photo.id
        assert photo_dict["smugmug_id"] == "dict-test"
        assert photo_dict["title"] == "Dict Test Photo"
        assert photo_dict["width"] == 800
        assert photo_dict["height"] == 600
        assert "created_at" in photo_dict
    
    def test_photo_unique_smugmug_id(self, test_db):
        """Test that smugmug_id is unique"""
        photo1 = Photo(smugmug_id="unique-test", title="Photo 1")
        photo2 = Photo(smugmug_id="unique-test", title="Photo 2")
        
        test_db.add(photo1)
        test_db.commit()
        
        test_db.add(photo2)
        
        # This should raise an integrity error
        with pytest.raises(Exception):  # IntegrityError in real database
            test_db.commit()
    
    def test_photo_relationship_with_metadata(self, test_db):
        """Test photo relationship with AI metadata"""
        photo = Photo(smugmug_id="relationship-test", title="Relationship Test")
        test_db.add(photo)
        test_db.commit()
        
        metadata = AIMetadata(
            photo_id=photo.id,
            description="Test metadata",
            ai_keywords=["test"]
        )
        test_db.add(metadata)
        test_db.commit()
        
        # Test relationship
        assert photo.ai_metadata is not None
        assert photo.ai_metadata.id == metadata.id
        assert metadata.photo.id == photo.id

@pytest.mark.unit
@pytest.mark.database
class TestAIMetadataModel:
    """Test AIMetadata model functionality"""
    
    def test_ai_metadata_creation(self, test_db, sample_photo):
        """Test creating AI metadata"""
        metadata = AIMetadata(
            photo_id=sample_photo.id,
            description="AI generated description",
            ai_keywords=["ai", "generated", "test"],
            confidence_score=0.85,
            processing_time=2.5,
            model_version="claude-3-5-sonnet-20241022"
        )
        test_db.add(metadata)
        test_db.commit()
        
        assert metadata.id is not None
        assert metadata.photo_id == sample_photo.id
        assert metadata.confidence_score == 0.85
        assert metadata.processed_at is not None
        assert metadata.approved is False  # Default value
    
    def test_ai_metadata_to_dict(self, test_db, sample_photo):
        """Test AI metadata serialization to dict"""
        metadata = AIMetadata(
            photo_id=sample_photo.id,
            description="Dict test description",
            ai_keywords=["dict", "test"],
            confidence_score=0.9
        )
        test_db.add(metadata)
        test_db.commit()
        
        metadata_dict = metadata.to_dict()
        
        assert isinstance(metadata_dict, dict)
        assert metadata_dict["id"] == metadata.id
        assert metadata_dict["photo_id"] == sample_photo.id
        assert metadata_dict["description"] == "Dict test description"
        assert metadata_dict["ai_keywords"] == ["dict", "test"]
        assert metadata_dict["confidence_score"] == 0.9
        assert metadata_dict["approved"] is False
    
    def test_ai_metadata_approval_workflow(self, test_db, sample_photo):
        """Test metadata approval workflow"""
        metadata = AIMetadata(
            photo_id=sample_photo.id,
            description="Approval test",
            ai_keywords=["approval", "test"]
        )
        test_db.add(metadata)
        test_db.commit()
        
        # Initially not approved
        assert metadata.approved is False
        assert metadata.approved_at is None
        
        # Approve metadata
        approval_time = datetime.now()
        metadata.approved = True
        metadata.approved_at = approval_time
        test_db.commit()
        
        # Verify approval
        assert metadata.approved is True
        assert metadata.approved_at == approval_time
    
    def test_ai_metadata_cascade_delete(self, test_db):
        """Test that AI metadata is deleted when photo is deleted"""
        photo = Photo(smugmug_id="cascade-test", title="Cascade Test")
        test_db.add(photo)
        test_db.commit()
        
        metadata = AIMetadata(
            photo_id=photo.id,
            description="Cascade test metadata"
        )
        test_db.add(metadata)
        test_db.commit()
        
        metadata_id = metadata.id
        
        # Delete photo
        test_db.delete(photo)
        test_db.commit()
        
        # Metadata should be deleted
        deleted_metadata = test_db.query(AIMetadata).filter_by(id=metadata_id).first()
        assert deleted_metadata is None

@pytest.mark.unit
@pytest.mark.database
class TestOAuthTokenModel:
    """Test OAuthToken model functionality"""
    
    def test_oauth_token_creation(self, test_db):
        """Test creating OAuth token"""
        token = OAuthToken(
            service="smugmug",
            access_token="test-access-token",
            access_token_secret="test-secret",
            user_id="test-user-123",
            username="testuser"
        )
        test_db.add(token)
        test_db.commit()
        
        assert token.id is not None
        assert token.service == "smugmug"
        assert token.access_token == "test-access-token"
        assert token.created_at is not None
    
    def test_oauth_token_is_valid_no_expiration(self, test_db):
        """Test token validity when no expiration is set"""
        token = OAuthToken(
            service="smugmug",
            access_token="test-token",
            access_token_secret="test-secret"
        )
        test_db.add(token)
        test_db.commit()
        
        assert token.is_valid() is True
    
    def test_oauth_token_is_valid_not_expired(self, test_db):
        """Test token validity when not expired"""
        future_time = datetime.now() + timedelta(hours=1)
        token = OAuthToken(
            service="smugmug",
            access_token="test-token",
            access_token_secret="test-secret",
            expires_at=future_time
        )
        test_db.add(token)
        test_db.commit()
        
        assert token.is_valid() is True
    
    def test_oauth_token_is_valid_expired(self, test_db):
        """Test token validity when expired"""
        past_time = datetime.now() - timedelta(hours=1)
        token = OAuthToken(
            service="smugmug",
            access_token="test-token",
            access_token_secret="test-secret",
            expires_at=past_time
        )
        test_db.add(token)
        test_db.commit()
        
        assert token.is_valid() is False

@pytest.mark.unit
@pytest.mark.database
class TestProcessingQueueModel:
    """Test ProcessingQueue model functionality"""
    
    def test_processing_queue_creation(self, test_db, sample_photo):
        """Test creating processing queue item"""
        queue_item = ProcessingQueue(
            photo_id=sample_photo.id,
            status="pending",
            priority=5
        )
        test_db.add(queue_item)
        test_db.commit()
        
        assert queue_item.id is not None
        assert queue_item.photo_id == sample_photo.id
        assert queue_item.status == "pending"
        assert queue_item.priority == 5
        assert queue_item.attempts == 0  # Default value
        assert queue_item.created_at is not None
    
    def test_processing_queue_status_transitions(self, test_db, sample_photo):
        """Test processing queue status transitions"""
        queue_item = ProcessingQueue(
            photo_id=sample_photo.id,
            status="pending"
        )
        test_db.add(queue_item)
        test_db.commit()
        
        # Start processing
        start_time = datetime.now()
        queue_item.status = "processing"
        queue_item.started_at = start_time
        test_db.commit()
        
        assert queue_item.status == "processing"
        assert queue_item.started_at == start_time
        
        # Complete processing
        completion_time = datetime.now()
        queue_item.status = "completed"
        queue_item.completed_at = completion_time
        test_db.commit()
        
        assert queue_item.status == "completed"
        assert queue_item.completed_at == completion_time
    
    def test_processing_queue_error_handling(self, test_db, sample_photo):
        """Test processing queue error handling"""
        queue_item = ProcessingQueue(
            photo_id=sample_photo.id,
            status="processing"
        )
        test_db.add(queue_item)
        test_db.commit()
        
        # Simulate processing failure
        error_message = "Processing failed due to network error"
        queue_item.status = "failed"
        queue_item.last_error = error_message
        queue_item.attempts += 1
        test_db.commit()
        
        assert queue_item.status == "failed"
        assert queue_item.last_error == error_message
        assert queue_item.attempts == 1
    
    def test_processing_queue_unique_photo_constraint(self, test_db, sample_photo):
        """Test that each photo can only have one queue item"""
        queue_item1 = ProcessingQueue(photo_id=sample_photo.id, status="pending")
        queue_item2 = ProcessingQueue(photo_id=sample_photo.id, status="processing")
        
        test_db.add(queue_item1)
        test_db.commit()
        
        test_db.add(queue_item2)
        
        # This should raise an integrity error due to unique constraint
        with pytest.raises(Exception):  # IntegrityError in real database
            test_db.commit()
    
    def test_processing_queue_cascade_delete(self, test_db):
        """Test that queue items are deleted when photo is deleted"""
        photo = Photo(smugmug_id="queue-cascade-test", title="Queue Cascade Test")
        test_db.add(photo)
        test_db.commit()
        
        queue_item = ProcessingQueue(
            photo_id=photo.id,
            status="pending"
        )
        test_db.add(queue_item)
        test_db.commit()
        
        queue_item_id = queue_item.id
        
        # Delete photo
        test_db.delete(photo)
        test_db.commit()
        
        # Queue item should be deleted
        deleted_queue_item = test_db.query(ProcessingQueue).filter_by(id=queue_item_id).first()
        assert deleted_queue_item is None

@pytest.mark.unit
@pytest.mark.database
class TestModelInteractions:
    """Test interactions between different models"""
    
    def test_complete_photo_lifecycle(self, test_db):
        """Test complete photo lifecycle with all related models"""
        # Create photo
        photo = Photo(
            smugmug_id="lifecycle-test",
            title="Lifecycle Test Photo",
            image_url="https://example.com/lifecycle.jpg"
        )
        test_db.add(photo)
        test_db.commit()
        
        # Add to processing queue
        queue_item = ProcessingQueue(
            photo_id=photo.id,
            status="pending",
            priority=1
        )
        test_db.add(queue_item)
        test_db.commit()
        
        # Start processing
        queue_item.status = "processing"
        queue_item.started_at = datetime.now()
        test_db.commit()
        
        # Create AI metadata (processing complete)
        metadata = AIMetadata(
            photo_id=photo.id,
            description="Complete lifecycle test photo",
            ai_keywords=["lifecycle", "test", "complete"],
            confidence_score=0.88,
            processing_time=3.2
        )
        test_db.add(metadata)
        test_db.commit()
        
        # Complete processing
        queue_item.status = "completed"
        queue_item.completed_at = datetime.now()
        test_db.commit()
        
        # Approve metadata
        metadata.approved = True
        metadata.approved_at = datetime.now()
        test_db.commit()
        
        # Verify all relationships and states
        final_photo = test_db.query(Photo).filter_by(id=photo.id).first()
        assert final_photo.ai_metadata.approved is True
        
        final_queue = test_db.query(ProcessingQueue).filter_by(photo_id=photo.id).first()
        assert final_queue.status == "completed"
        
        # Test cleanup (cascade deletes)
        photo_id = photo.id
        metadata_id = metadata.id
        queue_id = queue_item.id
        
        test_db.delete(photo)
        test_db.commit()
        
        # All related records should be deleted
        assert test_db.query(Photo).filter_by(id=photo_id).first() is None
        assert test_db.query(AIMetadata).filter_by(id=metadata_id).first() is None
        assert test_db.query(ProcessingQueue).filter_by(id=queue_id).first() is None
    
    def test_multiple_photos_same_keywords(self, test_db):
        """Test multiple photos with overlapping keywords"""
        photos_data = [
            ("photo1", ["archery", "competition", "medals"]),
            ("photo2", ["archery", "training", "practice"]),
            ("photo3", ["swimming", "competition", "medals"])
        ]
        
        created_photos = []
        for smugmug_id, keywords in photos_data:
            photo = Photo(smugmug_id=smugmug_id, keywords=keywords)
            test_db.add(photo)
            test_db.commit()
            
            metadata = AIMetadata(
                photo_id=photo.id,
                description=f"Photo about {', '.join(keywords)}",
                ai_keywords=keywords
            )
            test_db.add(metadata)
            test_db.commit()
            
            created_photos.append(photo)
        
        # Query for photos with specific keywords
        archery_photos = test_db.query(Photo).filter(Photo.keywords.contains(["archery"])).all()
        assert len(archery_photos) >= 2  # Depends on database array contains support
        
        competition_metadata = test_db.query(AIMetadata).filter(
            AIMetadata.ai_keywords.contains(["competition"])
        ).all()
        assert len(competition_metadata) >= 2  # Depends on database array contains support