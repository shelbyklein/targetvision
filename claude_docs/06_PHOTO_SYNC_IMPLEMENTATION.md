# Photo Sync Implementation Plan

## Overview
Now that OAuth is working, the next phase is implementing photo synchronization from SmugMug accounts.

---

## Implementation Steps

### 1. SmugMug API Endpoints Needed

#### Get User Albums
```
GET /api/v2/user/{username}!albums
```
- Returns list of all albums for authenticated user
- Includes album metadata (title, description, image count)

#### Get Album Images
```
GET /api/v2/album/{albumKey}!images
```
- Returns all images in an album
- Includes image URLs and metadata

#### Get Image Details
```
GET /api/v2/image/{imageKey}
```
- Returns detailed information about a specific image
- Includes multiple size URLs, EXIF data, keywords

---

## Database Schema Design

### Tables Needed

#### smugmug_albums
```sql
CREATE TABLE smugmug_albums (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    album_key VARCHAR(255) UNIQUE NOT NULL,
    album_id VARCHAR(255) NOT NULL,
    title VARCHAR(500),
    description TEXT,
    image_count INTEGER,
    last_updated TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    synced_at TIMESTAMP
);
```

#### smugmug_photos
```sql
CREATE TABLE smugmug_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    album_id UUID REFERENCES smugmug_albums(id),
    image_key VARCHAR(255) UNIQUE NOT NULL,
    image_id VARCHAR(255) NOT NULL,
    filename VARCHAR(500),
    caption TEXT,
    keywords TEXT[],
    date_taken TIMESTAMP,
    image_url TEXT,
    thumbnail_url TEXT,
    large_url TEXT,
    original_url TEXT,
    width INTEGER,
    height INTEGER,
    size_bytes BIGINT,
    created_at TIMESTAMP DEFAULT NOW(),
    synced_at TIMESTAMP
);
```

#### ai_metadata
```sql
CREATE TABLE ai_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    photo_id UUID REFERENCES smugmug_photos(id),
    ai_description TEXT,
    ai_tags TEXT[],
    ai_categories TEXT[],
    embedding VECTOR(1536),  -- For OpenAI embeddings
    confidence_score FLOAT,
    processing_status VARCHAR(50) DEFAULT 'pending',
    approved BOOLEAN DEFAULT FALSE,
    approved_by VARCHAR(255),
    approved_at TIMESTAMP,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### metadata_history
```sql
CREATE TABLE metadata_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metadata_id UUID REFERENCES ai_metadata(id),
    previous_description TEXT,
    new_description TEXT,
    changed_by VARCHAR(255),
    change_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Photo Sync Service Implementation

### Backend Service: `services/smugmug_sync.py`

```python
import asyncio
from datetime import datetime
from typing import List, Dict
from services.smugmug_service import SmugMugAPI
from sqlalchemy.orm import Session

class SmugMugSyncService:
    def __init__(self, db: Session, api: SmugMugAPI):
        self.db = db
        self.api = api
        self.sync_status = {
            'in_progress': False,
            'last_sync': None,
            'albums_synced': 0,
            'photos_synced': 0,
            'errors': []
        }
    
    async def sync_user_library(self, username: str):
        """Full sync of user's SmugMug library"""
        self.sync_status['in_progress'] = True
        
        try:
            # Step 1: Get all albums
            albums = await self.api.get_user_albums(username)
            
            for album in albums:
                # Step 2: Sync each album
                await self.sync_album(album)
                self.sync_status['albums_synced'] += 1
                
                # Step 3: Get photos in album
                photos = await self.api.get_album_images(album['AlbumKey'])
                
                for photo in photos:
                    await self.sync_photo(album['AlbumKey'], photo)
                    self.sync_status['photos_synced'] += 1
                    
                # Rate limiting
                await asyncio.sleep(0.5)
            
            self.sync_status['last_sync'] = datetime.utcnow()
            
        except Exception as e:
            self.sync_status['errors'].append(str(e))
            raise
        finally:
            self.sync_status['in_progress'] = False
    
    async def sync_album(self, album_data: Dict):
        """Sync individual album to database"""
        # Upsert album data
        pass
    
    async def sync_photo(self, album_key: str, photo_data: Dict):
        """Sync individual photo to database"""
        # Upsert photo data
        pass
    
    async def incremental_sync(self, username: str, since: datetime):
        """Sync only changed items since last sync"""
        # Use LastUpdated field to sync only changes
        pass
```

---

## API Endpoints for Sync

### `POST /api/smugmug/sync`
- Triggers full sync of user's library
- Returns sync job ID for status tracking

### `GET /api/smugmug/sync/status`
- Returns current sync status
- Shows progress (albums/photos synced)

### `POST /api/smugmug/sync/album/{albumKey}`
- Sync specific album only
- Useful for selective updates

### `GET /api/smugmug/albums`
- Returns user's synced albums from database
- Includes sync status and photo count

### `GET /api/smugmug/photos/{albumId}`
- Returns photos in an album from database
- Includes AI metadata if processed

---

## Frontend Components

### Sync Status Component
```typescript
// components/SyncStatus.tsx
export default function SyncStatus() {
  const [syncStatus, setSyncStatus] = useState(null)
  const [isPolling, setIsPolling] = useState(false)
  
  // Poll for sync status while in progress
  useEffect(() => {
    if (isPolling) {
      const interval = setInterval(async () => {
        const status = await fetchSyncStatus()
        setSyncStatus(status)
        
        if (!status.in_progress) {
          setIsPolling(false)
        }
      }, 2000)
      
      return () => clearInterval(interval)
    }
  }, [isPolling])
  
  return (
    <div className="sync-status">
      {syncStatus?.in_progress && (
        <div className="progress">
          <p>Syncing: {syncStatus.albums_synced} albums, 
             {syncStatus.photos_synced} photos</p>
          <div className="progress-bar">
            <div className="progress-fill" 
                 style={{width: `${progressPercent}%`}} />
          </div>
        </div>
      )}
    </div>
  )
}
```

### Album Grid Component
```typescript
// components/AlbumGrid.tsx
export default function AlbumGrid() {
  const [albums, setAlbums] = useState([])
  
  useEffect(() => {
    fetchAlbums()
  }, [])
  
  return (
    <div className="grid grid-cols-3 gap-4">
      {albums.map(album => (
        <AlbumCard 
          key={album.id}
          album={album}
          onClick={() => navigateToAlbum(album.id)}
        />
      ))}
    </div>
  )
}
```

---

## Processing Queue for AI Metadata

### Celery Task: `tasks/process_photos.py`
```python
from celery import Celery
from services.ai_processor import AIProcessor

app = Celery('targetvision')

@app.task
def process_photo_batch(photo_ids: List[str]):
    """Process batch of photos with AI"""
    processor = AIProcessor()
    
    for photo_id in photo_ids:
        # Get photo from database
        photo = get_photo(photo_id)
        
        # Download image from SmugMug
        image_data = download_image(photo.large_url)
        
        # Generate AI description
        description = processor.generate_description(image_data)
        
        # Generate embedding
        embedding = processor.generate_embedding(description)
        
        # Store in database
        save_ai_metadata(photo_id, description, embedding)
        
        # Rate limiting for API calls
        time.sleep(1)
```

---

## Next Implementation Tasks

1. **Set up PostgreSQL with pgvector**
   - Create database schema
   - Set up migrations with Alembic

2. **Implement sync service**
   - Create SmugMugSyncService class
   - Add sync API endpoints
   - Handle rate limiting and retries

3. **Build sync UI**
   - Create sync button and status display
   - Show album grid after sync
   - Add photo gallery view

4. **Set up processing queue**
   - Configure Celery with Redis
   - Create photo processing tasks
   - Implement batch processing

5. **Create metadata management UI**
   - Review/edit AI descriptions
   - Bulk approve functionality
   - Export capabilities

---

## Performance Considerations

- **Batch Processing**: Process photos in batches of 10-20
- **Rate Limiting**: Respect SmugMug API limits (max 4 requests/second)
- **Caching**: Cache album/photo data for 1 hour
- **Pagination**: Load photos progressively (50 per page)
- **Background Jobs**: Use Celery for long-running sync tasks
- **Database Indexing**: Index on user_id, album_key, image_key

---

## Security Considerations

- **Token Encryption**: Always encrypt stored OAuth tokens
- **URL Signing**: Use signed URLs for image access
- **Permission Checks**: Verify user owns albums before sync
- **Rate Limiting**: Implement per-user sync limits
- **Audit Logging**: Log all sync operations