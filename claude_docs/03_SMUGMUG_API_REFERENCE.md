# SmugMug API Reference

## Overview
This document provides a comprehensive reference for integrating SmugMug API v2 into TargetVision. SmugMug API allows read-only access to user photos and albums for processing with AI-generated metadata.

**API Version**: v2  
**Base URL**: `https://api.smugmug.com/api/v2`  
**Documentation**: https://api.smugmug.com/api/v2/doc  
**Interactive Browser**: https://api.smugmug.com/api/v2

---

## Authentication

### OAuth 2.0 Flow
SmugMug uses OAuth 2.0 for authentication. The application will need to:

1. **Register Application**
   - Request API key at SmugMug Developer site
   - Obtain `API_KEY` and `API_SECRET`
   - Configure callback URL

2. **OAuth Endpoints**
   ```
   Authorization: https://secure.smugmug.com/services/oauth/1.0a/authorize
   Request Token: https://secure.smugmug.com/services/oauth/1.0a/getRequestToken
   Access Token: https://secure.smugmug.com/services/oauth/1.0a/getAccessToken
   ```

3. **Required Scopes**
   - `read` - Read access to public content
   - `browse` - Browse private content

### Authentication Headers
```python
headers = {
    'Accept': 'application/json',
    'Authorization': f'Bearer {access_token}'
}
```

---

## Core Endpoints

### 1. Authenticated User
Get information about the authenticated user.

**Endpoint**: `GET /api/v2!authuser`

**Response Example**:
```json
{
  "Response": {
    "User": {
      "NickName": "username",
      "Name": "Full Name",
      "Uri": "/api/v2/user/username"
    }
  }
}
```

### 2. User Albums
List all albums for a user.

**Endpoint**: `GET /api/v2/user/{username}!albums`

**Parameters**:
- `count`: Number of albums to return (max 100)
- `start`: Starting index for pagination

**Response Example**:
```json
{
  "Response": {
    "Album": [
      {
        "AlbumKey": "abc123",
        "Title": "Vacation 2024",
        "Uri": "/api/v2/album/abc123",
        "ImageCount": 150,
        "LastUpdated": "2024-01-15T10:30:00Z"
      }
    ]
  }
}
```

### 3. Album Images
Get all images in an album.

**Endpoint**: `GET /api/v2/album/{albumKey}!images`

**Parameters**:
- `count`: Number of images (max 100)
- `start`: Starting index
- `_expand`: Expand additional data (e.g., "ImageMetadata,ImageSizes")

**Response Example**:
```json
{
  "Response": {
    "AlbumImage": [
      {
        "Uri": "/api/v2/image/xyz789",
        "FileName": "IMG_1234.jpg",
        "Caption": "Beach sunset",
        "DateTimeOriginal": "2024-01-10T18:30:00Z",
        "ArchivedUri": "https://photos.smugmug.com/...",
        "ThumbnailUrl": "https://photos.smugmug.com/.../Th/...",
        "Uris": {
          "LargeImageUrl": "...",
          "MediumImageUrl": "...",
          "SmallImageUrl": "..."
        }
      }
    ]
  }
}
```

### 4. Image Details
Get detailed information about a specific image.

**Endpoint**: `GET /api/v2/image/{imageKey}`

**Expansions Available**:
- `ImageMetadata` - EXIF data
- `ImageSizes` - Available size URLs
- `ImageComments` - User comments

**Response Example**:
```json
{
  "Response": {
    "Image": {
      "Title": "Sunset Photo",
      "Caption": "Beautiful sunset at the beach",
      "Keywords": ["sunset", "beach", "vacation"],
      "DateTimeOriginal": "2024-01-10T18:30:00Z",
      "ImageSizes": {
        "Large": {
          "Url": "https://...",
          "Width": 1920,
          "Height": 1080
        }
      },
      "ImageMetadata": {
        "Camera": "Canon EOS R5",
        "Lens": "24-70mm",
        "ISO": 100,
        "Aperture": "f/8.0",
        "ShutterSpeed": "1/250"
      }
    }
  }
}
```

### 5. User Folders (Node API)
Get folder structure using the Node API.

**Endpoint**: `GET /api/v2/node/{nodeId}!children`

**Node Types**:
- `Folder` - Container for albums/folders
- `Album` - Contains images
- `Page` - SmugMug page

**Response Example**:
```json
{
  "Response": {
    "Node": [
      {
        "Type": "Album",
        "Name": "Family Photos",
        "NodeID": "node123",
        "Uri": "/api/v2/node/node123"
      }
    ]
  }
}
```

### 6. Search Images
Search for images across the user's account.

**Endpoint**: `GET /api/v2/user/{username}!imagesearch`

**Parameters**:
- `q`: Search query
- `count`: Number of results
- `start`: Starting index

---

## Image URLs and Sizes

### Available Image Sizes
SmugMug provides multiple image sizes:

| Size | Use Case | Typical Dimensions |
|------|----------|-------------------|
| `Ti` | Tiny | 100x100 |
| `Th` | Thumbnail | 150x150 |
| `S` | Small | 400x300 |
| `M` | Medium | 600x450 |
| `L` | Large | 800x600 |
| `XL` | Extra Large | 1024x768 |
| `X2` | XX Large | 1280x960 |
| `X3` | XXX Large | 1600x1200 |
| `Original` | Original | Full resolution |

### Constructing Image URLs
```python
# Base pattern
base_url = "https://photos.smugmug.com"
# Thumbnail: {base_url}/{path}/Th/{filename}
# Large: {base_url}/{path}/L/{filename}
```

---

## Rate Limits and Best Practices

### Rate Limiting
- **Requests per second**: Not explicitly documented, use conservative approach
- **Recommended**: 2-3 requests per second
- **Batch operations**: Use pagination with `count` parameter

### Best Practices
1. **Caching**
   - Cache album lists (refresh daily)
   - Cache image metadata (refresh weekly)
   - Store thumbnail URLs locally

2. **Pagination**
   - Always paginate large albums
   - Use `count=50` for optimal performance
   - Track `start` parameter for continuation

3. **Error Handling**
   ```python
   if response.status_code == 429:  # Rate limited
       wait_time = int(response.headers.get('Retry-After', 60))
       time.sleep(wait_time)
   ```

4. **Efficient Syncing**
   - Use `LastUpdated` field to detect changes
   - Only fetch changed albums
   - Process images in batches

---

## Implementation Strategy for TargetVision

### 1. Initial Sync
```python
async def initial_sync(user_token):
    # 1. Get user info
    user = await get_authenticated_user(token)
    
    # 2. Fetch all albums
    albums = await get_all_albums(user.username)
    
    # 3. For each album, get basic image info
    for album in albums:
        images = await get_album_images(album.key, expand="ImageSizes")
        # Store image URLs and metadata
        await store_smugmug_photos(images)
```

### 2. Incremental Updates
```python
async def incremental_sync(user_token, last_sync_date):
    albums = await get_updated_albums(user.username, since=last_sync_date)
    for album in albums:
        await sync_album_changes(album)
```

### 3. Image Processing Pipeline
```python
async def process_image_for_llm(image_data):
    # 1. Get optimal image URL (Large or XLarge)
    image_url = image_data.get('Uris', {}).get('LargeImageUrl')
    
    # 2. Fetch image for LLM processing
    image_bytes = await fetch_image(image_url)
    
    # 3. Generate description with Claude Vision
    description = await claude_vision_api(image_bytes)
    
    # 4. Store metadata
    await store_image_metadata(image_data.id, description)
```

---

## Error Codes

| Code | Description | Action |
|------|-------------|--------|
| 200 | Success | Process response |
| 401 | Unauthorized | Refresh OAuth token |
| 403 | Forbidden | Check permissions |
| 404 | Not Found | Invalid resource |
| 429 | Rate Limited | Wait and retry |
| 500 | Server Error | Retry with backoff |

---

## Security Considerations

1. **Token Storage**
   - Store OAuth tokens encrypted
   - Use environment variables for API keys
   - Implement token refresh mechanism

2. **Data Privacy**
   - Only store image URLs, not actual images
   - Respect user's privacy settings
   - Allow users to control what gets processed

3. **API Key Protection**
   - Never expose API keys in frontend
   - Use backend proxy for all SmugMug calls
   - Implement request signing

---

## Testing Endpoints

### Test Authentication
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Accept: application/json" \
     https://api.smugmug.com/api/v2!authuser
```

### Test Album Fetch
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Accept: application/json" \
     https://api.smugmug.com/api/v2/user/USERNAME!albums?count=10
```

---

## Troubleshooting

### Common Issues

1. **Empty Response**
   - Check if user has public/private settings
   - Verify OAuth scopes include 'browse'

2. **Missing Image URLs**
   - Use `_expand=ImageSizes` parameter
   - Check if images are password protected

3. **Slow Performance**
   - Reduce batch size
   - Implement local caching
   - Use thumbnail URLs for previews

---

## References

- [SmugMug API Documentation](https://api.smugmug.com/api/v2/doc)
- [OAuth Tutorial](https://api.smugmug.com/api/v2/doc/tutorial/authorization.html)
- [API Explorer](https://api.smugmug.com/api/v2)
- [SmugMug Developer Forum](https://dgrin.com/categories/smugmug-api-support-integrations)