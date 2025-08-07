"""SmugMug API Service for fetching photos and albums"""

import asyncio
import json
from typing import Dict, List, Optional, Any
from datetime import datetime
import httpx
from authlib.integrations.httpx_client import OAuth1Auth
import logging
from urllib.parse import quote

logger = logging.getLogger(__name__)


class SmugMugAPI:
    """SmugMug API client for authenticated requests"""
    
    BASE_URL = "https://api.smugmug.com"
    API_VERSION = "/api/v2"
    
    # Rate limiting
    REQUESTS_PER_SECOND = 2
    REQUEST_DELAY = 1.0 / REQUESTS_PER_SECOND
    
    def __init__(self, access_token: str, access_token_secret: str, api_key: str, api_secret: str):
        """Initialize with OAuth credentials"""
        self.auth = OAuth1Auth(
            client_id=api_key,
            client_secret=api_secret,
            token=access_token,
            token_secret=access_token_secret
        )
        self.last_request_time = 0
        self.request_count = 0
    
    async def _rate_limit(self):
        """Implement rate limiting"""
        current_time = asyncio.get_event_loop().time()
        time_since_last = current_time - self.last_request_time
        
        if time_since_last < self.REQUEST_DELAY:
            await asyncio.sleep(self.REQUEST_DELAY - time_since_last)
        
        self.last_request_time = asyncio.get_event_loop().time()
        self.request_count += 1
    
    async def _make_request(
        self, 
        endpoint: str, 
        params: Optional[Dict] = None,
        expand: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Make authenticated API request with rate limiting"""
        await self._rate_limit()
        
        url = f"{self.BASE_URL}{self.API_VERSION}{endpoint}"
        
        # Add common parameters
        if params is None:
            params = {}
        
        params['_accept'] = 'application/json'
        params['_verbosity'] = '1'  # Include URLs
        
        # Add expansions if requested
        if expand:
            params['_expand'] = ','.join(expand)
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params=params, auth=self.auth)
                response.raise_for_status()
            
            data = response.json()
            
            if 'Response' in data:
                return data['Response']
            return data
            
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error {e.response.status_code}: {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"API request failed: {e}")
            raise
    
    async def get_authenticated_user(self) -> Dict[str, Any]:
        """Get information about the authenticated user"""
        try:
            result = await self._make_request("!authuser")
            logger.info(f"Authenticated as user: {result.get('User', {}).get('NickName')}")
            return result.get('User', {})
        except Exception as e:
            logger.error(f"Failed to get authenticated user: {e}")
            raise
    
    async def get_user_albums(
        self, 
        username: str,
        count: int = 50,
        start: int = 0
    ) -> List[Dict[str, Any]]:
        """Get all albums for a user"""
        all_albums = []
        
        while True:
            try:
                result = await self._make_request(
                    f"/user/{username}!albums",
                    params={
                        'count': count,
                        'start': start
                    }
                )
                
                albums = result.get('Album', [])
                if not albums:
                    break
                
                all_albums.extend(albums)
                
                # Check if there are more albums
                if len(albums) < count:
                    break
                
                start += count
                
            except Exception as e:
                logger.error(f"Failed to get albums: {e}")
                break
        
        logger.info(f"Retrieved {len(all_albums)} albums")
        return all_albums
    
    async def get_album_images(
        self,
        album_key: str,
        count: int = 100,
        start: int = 0,
        include_metadata: bool = True
    ) -> List[Dict[str, Any]]:
        """Get all images in an album"""
        all_images = []
        
        expand = ['ImageSizes']
        if include_metadata:
            expand.append('ImageMetadata')
        
        while True:
            try:
                result = await self._make_request(
                    f"/album/{album_key}!images",
                    params={
                        'count': count,
                        'start': start
                    },
                    expand=expand
                )
                
                images = result.get('AlbumImage', [])
                if not images:
                    break
                
                all_images.extend(images)
                
                # Check if there are more images
                if len(images) < count:
                    break
                
                start += count
                
            except Exception as e:
                logger.error(f"Failed to get images from album {album_key}: {e}")
                break
        
        logger.info(f"Retrieved {len(all_images)} images from album {album_key}")
        return all_images
    
    async def get_image_details(
        self,
        image_key: str,
        include_metadata: bool = True,
        include_sizes: bool = True
    ) -> Dict[str, Any]:
        """Get detailed information about a specific image"""
        expand = []
        if include_metadata:
            expand.append('ImageMetadata')
        if include_sizes:
            expand.append('ImageSizes')
        
        try:
            result = await self._make_request(
                f"/image/{image_key}",
                expand=expand
            )
            return result.get('Image', {})
        except Exception as e:
            logger.error(f"Failed to get image details for {image_key}: {e}")
            raise
    
    async def get_node_children(
        self,
        node_id: str,
        count: int = 100,
        start: int = 0
    ) -> List[Dict[str, Any]]:
        """Get children of a node (folders and albums)"""
        try:
            result = await self._make_request(
                f"/node/{node_id}!children",
                params={
                    'count': count,
                    'start': start
                }
            )
            return result.get('Node', [])
        except Exception as e:
            logger.error(f"Failed to get node children for {node_id}: {e}")
            raise
    
    async def get_node(self, node_id: str) -> Dict[str, Any]:
        """Get details for a specific node"""
        try:
            result = await self._make_request(f"/node/{node_id}")
            return result.get('Node', {})
        except Exception as e:
            logger.error(f"Failed to get node {node_id}: {e}")
            raise
    
    async def search_images(
        self,
        username: str,
        query: str,
        count: int = 50,
        start: int = 0
    ) -> List[Dict[str, Any]]:
        """Search for images across user's account"""
        try:
            result = await self._make_request(
                f"/user/{username}!imagesearch",
                params={
                    'q': query,
                    'count': count,
                    'start': start
                }
            )
            return result.get('Image', [])
        except Exception as e:
            logger.error(f"Failed to search images: {e}")
            raise


class SmugMugSync:
    """Service to sync photos from SmugMug to local database"""
    
    def __init__(self, api: SmugMugAPI, db_session):
        self.api = api
        self.db = db_session
    
    async def sync_user_photos(self, username: str) -> Dict[str, Any]:
        """Full sync of user's photos"""
        sync_stats = {
            'albums_synced': 0,
            'photos_synced': 0,
            'errors': [],
            'started_at': datetime.utcnow(),
            'completed_at': None
        }
        
        try:
            # Get all albums
            albums = await self.api.get_user_albums(username)
            
            for album in albums:
                try:
                    await self.sync_album(album)
                    sync_stats['albums_synced'] += 1
                    
                    # Get images in album
                    images = await self.api.get_album_images(album['AlbumKey'])
                    
                    for image in images:
                        await self.sync_image(image, album['AlbumKey'])
                        sync_stats['photos_synced'] += 1
                    
                except Exception as e:
                    logger.error(f"Error syncing album {album.get('Title')}: {e}")
                    sync_stats['errors'].append({
                        'album': album.get('Title'),
                        'error': str(e)
                    })
        
        except Exception as e:
            logger.error(f"Sync failed: {e}")
            sync_stats['errors'].append({'error': str(e)})
        
        sync_stats['completed_at'] = datetime.utcnow()
        return sync_stats
    
    async def sync_album(self, album_data: Dict[str, Any]) -> None:
        """Sync album metadata to database"""
        # Implementation to store album in database
        # This would create or update album record
        pass
    
    async def sync_image(self, image_data: Dict[str, Any], album_key: str) -> None:
        """Sync image metadata to database"""
        # Extract image URLs
        image_sizes = image_data.get('Uris', {})
        
        photo_data = {
            'smugmug_id': image_data.get('ImageKey'),
            'album_id': album_key,
            'file_name': image_data.get('FileName'),
            'caption': image_data.get('Caption'),
            'keywords': image_data.get('Keywords', []),
            'date_taken': image_data.get('DateTimeOriginal'),
            'image_url': image_sizes.get('LargestImageUrl', image_sizes.get('LargeImageUrl')),
            'thumbnail_url': image_sizes.get('ThumbnailUrl'),
            'last_synced': datetime.utcnow()
        }
        
        # Store in database
        # This would create or update photo record
        pass
    
    async def incremental_sync(self, username: str, last_sync: datetime) -> Dict[str, Any]:
        """Sync only changed content since last sync"""
        # Implementation for incremental sync
        # Check LastUpdated field on albums
        pass