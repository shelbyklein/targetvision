# Metadata Management System

## Overview
The Metadata Management System allows users to review, edit, and manage AI-generated descriptions for their SmugMug photos. This system provides full control over LLM-generated metadata while maintaining the original SmugMug data intact.

---

## Architecture

### Data Flow
```
SmugMug Photos → Sync Service → LLM Processing → Metadata Storage → User Review → Approved Metadata
                                       ↓
                                 Claude Vision API
```

### Database Schema

```sql
-- SmugMug photo reference
CREATE TABLE smugmug_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    smugmug_id VARCHAR(255) UNIQUE NOT NULL,
    album_id VARCHAR(255),
    image_url TEXT NOT NULL,
    thumbnail_url TEXT,
    original_caption TEXT,
    original_keywords TEXT[],
    file_name VARCHAR(255),
    date_taken TIMESTAMP,
    last_synced TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- LLM-generated metadata
CREATE TABLE photo_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    photo_id UUID REFERENCES smugmug_photos(id) ON DELETE CASCADE,
    description TEXT,
    llm_keywords TEXT[],
    embedding VECTOR(1536),  -- For pgvector
    confidence_score FLOAT,
    processing_status VARCHAR(50) DEFAULT 'pending',
    -- Status: pending, processing, completed, failed, approved
    approved BOOLEAN DEFAULT FALSE,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Metadata version history
CREATE TABLE metadata_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metadata_id UUID REFERENCES photo_metadata(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    description TEXT,
    keywords TEXT[],
    changed_by UUID REFERENCES users(id),
    change_type VARCHAR(50),  -- manual_edit, llm_regeneration, bulk_update
    changed_at TIMESTAMP DEFAULT NOW()
);

-- Processing queue
CREATE TABLE processing_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    photo_id UUID REFERENCES smugmug_photos(id) ON DELETE CASCADE,
    priority INTEGER DEFAULT 5,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    status VARCHAR(50) DEFAULT 'queued',
    -- Status: queued, processing, completed, failed
    error_message TEXT,
    queued_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);
```

---

## UI Components

### 1. Metadata Manager Tab

Main interface for managing photo metadata:

```typescript
// components/MetadataManager.tsx
interface MetadataManagerProps {
  photos: PhotoWithMetadata[]
  onEdit: (photoId: string, metadata: Metadata) => void
  onBulkAction: (action: BulkAction, photoIds: string[]) => void
}

export default function MetadataManager({ photos, onEdit, onBulkAction }: MetadataManagerProps) {
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([])
  const [filter, setFilter] = useState<FilterOptions>({
    status: 'all',
    approved: null,
    dateRange: null
  })
  
  return (
    <div className="metadata-manager">
      {/* Toolbar */}
      <div className="toolbar flex justify-between p-4">
        <FilterControls 
          filter={filter} 
          onChange={setFilter} 
        />
        <BulkActions 
          selectedCount={selectedPhotos.length}
          onAction={(action) => onBulkAction(action, selectedPhotos)}
        />
      </div>
      
      {/* Photo Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPhotos.map(photo => (
          <MetadataCard
            key={photo.id}
            photo={photo}
            selected={selectedPhotos.includes(photo.id)}
            onSelect={(id) => toggleSelection(id)}
            onEdit={(metadata) => onEdit(photo.id, metadata)}
          />
        ))}
      </div>
      
      {/* Statistics */}
      <MetadataStatistics photos={photos} />
    </div>
  )
}
```

### 2. Metadata Card Component

Individual photo card with editable metadata:

```typescript
// components/MetadataCard.tsx
interface MetadataCardProps {
  photo: PhotoWithMetadata
  selected: boolean
  onSelect: (id: string) => void
  onEdit: (metadata: Metadata) => void
}

export default function MetadataCard({ photo, selected, onSelect, onEdit }: MetadataCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedDescription, setEditedDescription] = useState(photo.metadata?.description || '')
  
  const statusColors = {
    pending: 'bg-gray-200',
    processing: 'bg-blue-200',
    completed: 'bg-green-200',
    failed: 'bg-red-200',
    approved: 'bg-purple-200'
  }
  
  return (
    <div className={`metadata-card border rounded-lg p-4 ${selected ? 'ring-2 ring-blue-500' : ''}`}>
      {/* Selection Checkbox */}
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onSelect(photo.id)}
        className="absolute top-2 left-2"
      />
      
      {/* Photo Thumbnail */}
      <img 
        src={photo.thumbnailUrl} 
        alt={photo.fileName}
        className="w-full h-48 object-cover rounded"
      />
      
      {/* Status Badge */}
      <span className={`px-2 py-1 rounded text-xs ${statusColors[photo.metadata?.status]}`}>
        {photo.metadata?.status || 'pending'}
      </span>
      
      {/* Metadata Display/Edit */}
      {isEditing ? (
        <div className="mt-2">
          <textarea
            value={editedDescription}
            onChange={(e) => setEditedDescription(e.target.value)}
            className="w-full p-2 border rounded"
            rows={3}
          />
          <div className="flex gap-2 mt-2">
            <button 
              onClick={() => {
                onEdit({ ...photo.metadata, description: editedDescription })
                setIsEditing(false)
              }}
              className="px-3 py-1 bg-blue-500 text-white rounded"
            >
              Save
            </button>
            <button 
              onClick={() => setIsEditing(false)}
              className="px-3 py-1 bg-gray-300 rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2">
          <p className="text-sm text-gray-700">{photo.metadata?.description || 'No description yet'}</p>
          <button 
            onClick={() => setIsEditing(true)}
            className="text-blue-500 text-sm mt-1"
          >
            Edit
          </button>
        </div>
      )}
      
      {/* Actions */}
      <div className="flex gap-2 mt-3">
        <button className="text-sm text-green-600">Approve</button>
        <button className="text-sm text-orange-600">Regenerate</button>
        <button className="text-sm text-gray-600">History</button>
      </div>
    </div>
  )
}
```

### 3. Bulk Operations

```typescript
// components/BulkActions.tsx
type BulkAction = 'approve' | 'regenerate' | 'delete' | 'export'

interface BulkActionsProps {
  selectedCount: number
  onAction: (action: BulkAction) => void
}

export default function BulkActions({ selectedCount, onAction }: BulkActionsProps) {
  if (selectedCount === 0) return null
  
  return (
    <div className="bulk-actions flex gap-2">
      <span className="text-sm text-gray-600">{selectedCount} selected</span>
      <button 
        onClick={() => onAction('approve')}
        className="px-3 py-1 bg-green-500 text-white rounded text-sm"
      >
        Approve All
      </button>
      <button 
        onClick={() => onAction('regenerate')}
        className="px-3 py-1 bg-orange-500 text-white rounded text-sm"
      >
        Regenerate
      </button>
      <button 
        onClick={() => onAction('export')}
        className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
      >
        Export
      </button>
    </div>
  )
}
```

---

## API Endpoints

### Metadata CRUD Operations

```python
# backend/api/metadata.py
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional

router = APIRouter(prefix="/api/metadata", tags=["metadata"])

@router.get("/photos")
async def get_photos_with_metadata(
    status: Optional[str] = None,
    approved: Optional[bool] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """Get photos with their metadata"""
    query = db.query(SmugMugPhoto).join(PhotoMetadata)
    
    if status:
        query = query.filter(PhotoMetadata.processing_status == status)
    if approved is not None:
        query = query.filter(PhotoMetadata.approved == approved)
    
    photos = query.limit(limit).offset(offset).all()
    return {"photos": photos, "total": query.count()}

@router.put("/photos/{photo_id}")
async def update_metadata(
    photo_id: str,
    metadata: MetadataUpdate,
    db: Session = Depends(get_db)
):
    """Update metadata for a photo"""
    # Save current version to history
    current = db.query(PhotoMetadata).filter_by(photo_id=photo_id).first()
    if current:
        history = MetadataHistory(
            metadata_id=current.id,
            version=get_next_version(current.id),
            description=current.description,
            keywords=current.llm_keywords,
            changed_by=current_user.id,
            change_type='manual_edit'
        )
        db.add(history)
    
    # Update metadata
    current.description = metadata.description
    current.llm_keywords = metadata.keywords
    current.updated_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Metadata updated", "metadata": current}

@router.post("/photos/{photo_id}/approve")
async def approve_metadata(
    photo_id: str,
    db: Session = Depends(get_db)
):
    """Approve metadata for a photo"""
    metadata = db.query(PhotoMetadata).filter_by(photo_id=photo_id).first()
    metadata.approved = True
    metadata.approved_by = current_user.id
    metadata.approved_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Metadata approved"}

@router.post("/photos/{photo_id}/regenerate")
async def regenerate_metadata(
    photo_id: str,
    db: Session = Depends(get_db)
):
    """Queue photo for metadata regeneration"""
    # Add to processing queue
    queue_item = ProcessingQueue(
        photo_id=photo_id,
        priority=5,
        status='queued'
    )
    db.add(queue_item)
    db.commit()
    
    # Trigger processing
    background_tasks.add_task(process_photo, photo_id)
    
    return {"message": "Photo queued for regeneration"}

@router.post("/bulk")
async def bulk_operation(
    action: str,
    photo_ids: List[str],
    db: Session = Depends(get_db)
):
    """Perform bulk operations on multiple photos"""
    if action == 'approve':
        db.query(PhotoMetadata).filter(
            PhotoMetadata.photo_id.in_(photo_ids)
        ).update({
            'approved': True,
            'approved_by': current_user.id,
            'approved_at': datetime.utcnow()
        })
    elif action == 'regenerate':
        for photo_id in photo_ids:
            queue_item = ProcessingQueue(photo_id=photo_id)
            db.add(queue_item)
    elif action == 'delete':
        db.query(PhotoMetadata).filter(
            PhotoMetadata.photo_id.in_(photo_ids)
        ).delete()
    
    db.commit()
    return {"message": f"Bulk {action} completed for {len(photo_ids)} photos"}
```

---

## Processing Pipeline

### LLM Processing Service

```python
# backend/services/metadata_processor.py
import asyncio
from typing import List
from services.claude_vision import ClaudeVisionService

class MetadataProcessor:
    def __init__(self):
        self.claude = ClaudeVisionService()
        self.queue = asyncio.Queue()
        self.processing = False
    
    async def process_photo(self, photo_id: str):
        """Process a single photo with LLM"""
        # Get photo from database
        photo = db.query(SmugMugPhoto).filter_by(id=photo_id).first()
        
        # Update status to processing
        metadata = db.query(PhotoMetadata).filter_by(photo_id=photo_id).first()
        if not metadata:
            metadata = PhotoMetadata(photo_id=photo_id)
            db.add(metadata)
        
        metadata.processing_status = 'processing'
        db.commit()
        
        try:
            # Download image from SmugMug
            image_data = await self.download_image(photo.image_url)
            
            # Process with Claude Vision
            description = await self.claude.generate_description(image_data)
            keywords = await self.claude.extract_keywords(description)
            embedding = await self.generate_embedding(description)
            
            # Update metadata
            metadata.description = description
            metadata.llm_keywords = keywords
            metadata.embedding = embedding
            metadata.processing_status = 'completed'
            metadata.confidence_score = 0.95  # From Claude response
            
        except Exception as e:
            metadata.processing_status = 'failed'
            # Log error
            logger.error(f"Processing failed for {photo_id}: {e}")
        
        finally:
            db.commit()
    
    async def process_queue(self):
        """Process photos from queue"""
        while self.processing:
            try:
                # Get next item from queue
                item = await self.queue.get()
                await self.process_photo(item.photo_id)
                
                # Update queue status
                item.status = 'completed'
                item.completed_at = datetime.utcnow()
                db.commit()
                
            except Exception as e:
                logger.error(f"Queue processing error: {e}")
                await asyncio.sleep(5)  # Wait before retry
    
    async def start_processing(self):
        """Start background processing"""
        self.processing = True
        asyncio.create_task(self.process_queue())
    
    async def stop_processing(self):
        """Stop background processing"""
        self.processing = False
```

---

## Export Functionality

### Export Formats

```python
# backend/services/metadata_export.py
import csv
import json
from typing import List

class MetadataExporter:
    def export_csv(self, photos: List[PhotoWithMetadata]) -> str:
        """Export metadata to CSV"""
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow([
            'Photo ID', 'SmugMug ID', 'File Name', 
            'Original Caption', 'AI Description', 
            'Keywords', 'Status', 'Approved'
        ])
        
        # Data rows
        for photo in photos:
            writer.writerow([
                photo.id,
                photo.smugmug_id,
                photo.file_name,
                photo.original_caption,
                photo.metadata.description,
                ', '.join(photo.metadata.llm_keywords or []),
                photo.metadata.processing_status,
                photo.metadata.approved
            ])
        
        return output.getvalue()
    
    def export_json(self, photos: List[PhotoWithMetadata]) -> dict:
        """Export metadata to JSON"""
        return {
            'export_date': datetime.utcnow().isoformat(),
            'total_photos': len(photos),
            'photos': [
                {
                    'id': photo.id,
                    'smugmug_id': photo.smugmug_id,
                    'file_name': photo.file_name,
                    'metadata': {
                        'description': photo.metadata.description,
                        'keywords': photo.metadata.llm_keywords,
                        'status': photo.metadata.processing_status,
                        'approved': photo.metadata.approved,
                        'confidence_score': photo.metadata.confidence_score
                    }
                }
                for photo in photos
            ]
        }
```

---

## Statistics Dashboard

### Metadata Statistics Component

```typescript
// components/MetadataStatistics.tsx
interface Statistics {
  total: number
  pending: number
  processing: number
  completed: number
  failed: number
  approved: number
  approvalRate: number
  averageConfidence: number
}

export default function MetadataStatistics({ photos }: { photos: PhotoWithMetadata[] }) {
  const stats = calculateStatistics(photos)
  
  return (
    <div className="statistics-dashboard grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
      <StatCard 
        title="Total Photos" 
        value={stats.total} 
        icon={<PhotoIcon />}
      />
      <StatCard 
        title="Processed" 
        value={stats.completed} 
        color="green"
        percentage={(stats.completed / stats.total) * 100}
      />
      <StatCard 
        title="Approved" 
        value={stats.approved}
        color="purple"
        percentage={stats.approvalRate}
      />
      <StatCard 
        title="Avg Confidence" 
        value={`${stats.averageConfidence}%`}
        color="blue"
      />
      
      {/* Processing Status Chart */}
      <div className="col-span-2">
        <ProcessingChart data={stats} />
      </div>
      
      {/* Recent Activity */}
      <div className="col-span-2">
        <RecentActivity photos={photos} />
      </div>
    </div>
  )
}
```

---

## Best Practices

### 1. Performance Optimization
- Paginate large photo collections
- Use virtual scrolling for long lists
- Cache thumbnails locally
- Batch API requests

### 2. User Experience
- Auto-save edits after delay
- Show processing progress
- Provide undo/redo for edits
- Keyboard shortcuts for common actions

### 3. Data Integrity
- Always maintain version history
- Never modify SmugMug original data
- Validate metadata before saving
- Regular backups of metadata

### 4. Processing Efficiency
- Priority queue for user-requested regenerations
- Rate limit LLM API calls
- Process in batches during off-peak hours
- Cache LLM responses for similar images

---

## Configuration

### Environment Variables

```env
# Metadata Processing
MAX_CONCURRENT_PROCESSING=5
PROCESSING_BATCH_SIZE=10
AUTO_APPROVE_THRESHOLD=0.95
METADATA_CACHE_TTL=3600

# Export Settings
MAX_EXPORT_SIZE=10000
EXPORT_FORMATS=csv,json,xlsx
```

### User Permissions

```python
# Metadata permissions
class MetadataPermissions:
    VIEW_METADATA = "metadata:view"
    EDIT_METADATA = "metadata:edit"
    APPROVE_METADATA = "metadata:approve"
    BULK_OPERATIONS = "metadata:bulk"
    EXPORT_METADATA = "metadata:export"
    REGENERATE_METADATA = "metadata:regenerate"
```

---

## Monitoring

### Key Metrics
- Processing queue length
- Average processing time
- LLM API success rate
- User approval rate
- Metadata quality scores

### Alerts
- Queue backup (> 100 items)
- High failure rate (> 10%)
- Low approval rate (< 50%)
- API quota warnings