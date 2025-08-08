import json
from typing import List, Dict, Optional
import httpx
from smugmug_auth import SmugMugOAuth
from config import settings
import logging

logger = logging.getLogger(__name__)

class SmugMugService:
    """Service for interacting with SmugMug API v2"""
    
    def __init__(self, access_token: str, access_token_secret: str):
        self.oauth = SmugMugOAuth()
        self.access_token = access_token
        self.access_token_secret = access_token_secret
        self.api_base = settings.SMUGMUG_API_BASE
        
    async def get_current_user(self) -> Optional[Dict]:
        """Get current authenticated user information"""
        url = f"{self.api_base}!authuser"
        
        response = await self.oauth.make_authenticated_request(
            "GET", url, self.access_token, self.access_token_secret
        )
        
        if response and response.status_code == 200:
            data = response.json()
            return data.get("Response", {}).get("User", {})
        return None
    
    async def get_user_albums(self, user_uri: Optional[str] = None) -> List[Dict]:
        """Get all albums for the authenticated user"""
        if not user_uri:
            # Get current user first
            user = await self.get_current_user()
            if not user:
                logger.error("Failed to get current user")
                return []
            user_uri = user.get("Uris", {}).get("UserAlbums", {}).get("Uri")
            
        if not user_uri:
            logger.error("No user albums URI found")
            return []
            
        url = f"{self.api_base}{user_uri}"
        params = {
            "_expand": "AlbumImages",
            "_expandmethod": "inline",
            "count": "50"  # Get 50 albums at a time
        }
        
        albums = []
        while url:
            response = await self.oauth.make_authenticated_request(
                "GET", url, self.access_token, self.access_token_secret, params
            )
            
            if response and response.status_code == 200:
                data = response.json()
                response_data = data.get("Response", {})
                albums.extend(response_data.get("Album", []))
                
                # Check for pagination
                pages = response_data.get("Pages", {})
                if pages.get("NextPage"):
                    url = f"{self.api_base}{pages['NextPage']}"
                    params = {}  # Clear params for next page
                else:
                    url = None
            else:
                logger.error(f"Failed to get albums: {response.status_code if response else 'No response'}")
                break
                
        return albums
    
    async def get_album_images(self, album_uri: str, limit: int = 100) -> List[Dict]:
        """Get images from a specific album"""
        url = f"{self.api_base}{album_uri}!images"
        params = {
            "_expand": "ImageSizes,ImageMetadata",
            "_expandmethod": "inline",
            "count": str(min(limit, 100))  # Max 100 per request
        }
        
        images = []
        total_fetched = 0
        
        while url and total_fetched < limit:
            response = await self.oauth.make_authenticated_request(
                "GET", url, self.access_token, self.access_token_secret, params
            )
            
            if response and response.status_code == 200:
                data = response.json()
                response_data = data.get("Response", {})
                batch_images = response_data.get("AlbumImage", [])
                
                # Add images up to limit
                remaining = limit - total_fetched
                images.extend(batch_images[:remaining])
                total_fetched += len(batch_images[:remaining])
                
                # Check for pagination
                if total_fetched < limit:
                    pages = response_data.get("Pages", {})
                    if pages.get("NextPage"):
                        url = f"{self.api_base}{pages['NextPage']}"
                        params = {}  # Clear params for next page
                    else:
                        url = None
                else:
                    url = None
            else:
                logger.error(f"Failed to get album images: {response.status_code if response else 'No response'}")
                break
                
        return images
    
    async def get_image_sizes(self, image_uri: str) -> Dict:
        """Get available sizes for an image"""
        url = f"{self.api_base}{image_uri}!sizes"
        
        response = await self.oauth.make_authenticated_request(
            "GET", url, self.access_token, self.access_token_secret
        )
        
        if response and response.status_code == 200:
            data = response.json()
            return data.get("Response", {}).get("ImageSizes", {})
        return {}
    
    def extract_photo_metadata(self, image_data: Dict, album_name: str = "") -> Dict:
        """Extract relevant metadata from SmugMug image data"""
        # Get image URIs and metadata
        image_uri = image_data.get("Uri", "")
        image_id = image_data.get("ImageKey", "")
        
        # Get basic metadata
        metadata = {
            "smugmug_id": image_id,
            "smugmug_uri": image_uri,
            "album_name": album_name,
            "title": image_data.get("Title", ""),
            "caption": image_data.get("Caption", ""),
            "keywords": image_data.get("Keywords", "").split(";") if image_data.get("Keywords") else [],
            "filename": image_data.get("FileName", ""),
            "format": image_data.get("Format", ""),
            "width": image_data.get("OriginalWidth", 0),
            "height": image_data.get("OriginalHeight", 0),
            "file_size": image_data.get("OriginalSize", 0),
        }
        
        # Get image URLs from sizes if available
        if "Uris" in image_data and "ImageSizes" in image_data["Uris"]:
            sizes_uri = image_data["Uris"]["ImageSizes"]["Uri"]
            metadata["sizes_uri"] = sizes_uri
            
        # Try to get direct image URLs from expanded data
        if "ImageSizes" in image_data:
            sizes = image_data["ImageSizes"]
            
            # Get largest available image URL
            for size_key in ["X5Large", "X4Large", "X3Large", "X2Large", "XLarge", "Large", "Medium"]:
                if size_key in sizes:
                    metadata["image_url"] = sizes[size_key]["Url"]
                    break
            
            # Get thumbnail URL
            for thumb_key in ["Small", "Thumb"]:
                if thumb_key in sizes:
                    metadata["thumbnail_url"] = sizes[thumb_key]["Url"]
                    break
        
        # If no direct URLs, construct them based on pattern
        if not metadata.get("image_url") and image_id:
            # SmugMug URL pattern (this is a fallback, actual URLs should come from API)
            base_url = "https://photos.smugmug.com"
            metadata["image_url"] = f"{base_url}/photos/i-{image_id}/0/L/i-{image_id}-L.jpg"
            metadata["thumbnail_url"] = f"{base_url}/photos/i-{image_id}/0/S/i-{image_id}-S.jpg"
        
        return metadata
    
    async def sync_all_photos(self, limit: int = 100) -> List[Dict]:
        """Sync all photos from user's SmugMug account up to limit"""
        all_photos = []
        
        try:
            # Get all albums
            albums = await self.get_user_albums()
            logger.info(f"Found {len(albums)} albums")
            
            # Process each album
            for album in albums:
                if len(all_photos) >= limit:
                    break
                    
                album_name = album.get("Name", "")
                album_uri = album.get("Uri", "")
                
                if not album_uri:
                    continue
                
                logger.info(f"Processing album: {album_name}")
                
                # Get images from album
                remaining = limit - len(all_photos)
                images = await self.get_album_images(album_uri, remaining)
                
                # Extract metadata for each image
                for image in images:
                    if len(all_photos) >= limit:
                        break
                    
                    photo_metadata = self.extract_photo_metadata(image, album_name)
                    photo_metadata["album_uri"] = album_uri
                    all_photos.append(photo_metadata)
                
                logger.info(f"Processed {len(images)} images from {album_name}")
            
            logger.info(f"Total photos synced: {len(all_photos)}")
            return all_photos
            
        except Exception as e:
            logger.error(f"Error syncing photos: {e}")
            return all_photos