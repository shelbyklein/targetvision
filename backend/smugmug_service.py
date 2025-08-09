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
            
        # Remove leading /api/v2 from user_uri if present since api_base already has it
        if user_uri.startswith("/api/v2"):
            user_uri = user_uri[7:]  # Remove "/api/v2"
        url = f"{self.api_base}{user_uri}"
        params = {
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
                    next_page = pages['NextPage']
                    # Remove leading /api/v2 if present
                    if next_page.startswith("/api/v2"):
                        next_page = next_page[7:]
                    url = f"{self.api_base}{next_page}"
                    params = {}  # Clear params for next page
                else:
                    url = None
            else:
                logger.error(f"Failed to get albums: {response.status_code if response else 'No response'}")
                break
                
        return albums
    
    async def get_album_images(self, album_uri: str, limit: int = 100) -> List[Dict]:
        """Get images from a specific album"""
        # Use full album URI (it already contains /api/v2)
        url = f"https://api.smugmug.com{album_uri}!images"
        params = {
            "_expand": "ImageSizes",  # Only expand ImageSizes to avoid comma issues
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
                        next_page = pages['NextPage']
                        # Use full URL with SmugMug base
                        url = f"https://api.smugmug.com{next_page}"
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
        # Use full image URI (it already contains /api/v2)
        url = f"https://api.smugmug.com{image_uri}!sizes"
        
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
    
    async def get_detailed_album_info(self, node: Dict) -> Dict:
        """Get detailed album information from a Node API album node"""
        try:
            # Start with the basic node info
            album_info = {
                "node_id": node.get("NodeID", ""),
                "node_uri": node.get("Uri", ""),
                "name": node.get("Name", "Untitled"),
                "description": node.get("Description", ""),
                "type": "album",
                "date_added": node.get("DateAdded", ""),
                "date_modified": node.get("DateModified", ""),
            }
            
            # Get the Album URI from the node's Uris if available
            album_uri = None
            if "Uris" in node and "Album" in node["Uris"]:
                album_uri = node["Uris"]["Album"]["Uri"]
            
            if album_uri:
                # Remove leading /api/v2 if present
                if album_uri.startswith("/api/v2"):
                    album_uri = album_uri[7:]
                
                # Fetch detailed album information
                album_url = f"{self.api_base}{album_uri}"
                album_response = await self.oauth.make_authenticated_request(
                    "GET", album_url, self.access_token, self.access_token_secret
                )
                
                if album_response and album_response.status_code == 200:
                    album_data = album_response.json().get("Response", {}).get("Album", {})
                    
                    # Add detailed album information
                    album_info.update({
                        "album_key": album_data.get("AlbumKey", ""),
                        "image_count": album_data.get("ImageCount", 0),
                        "album_uri": album_uri,
                        "privacy": album_data.get("Privacy", ""),
                        "security_type": album_data.get("SecurityType", ""),
                        "sort_method": album_data.get("SortMethod", ""),
                        "sort_direction": album_data.get("SortDirection", ""),
                        "template": album_data.get("Template", {}),
                    })
                    
                    logger.info(f"Fetched detailed album info for {album_info['name']}: {album_info['image_count']} images")
                else:
                    logger.warning(f"Failed to fetch album details: {album_response.status_code if album_response else 'No response'}")
            else:
                logger.warning(f"No Album URI found in node {node.get('NodeID', 'unknown')}")
            
            return album_info
            
        except Exception as e:
            logger.error(f"Error getting detailed album info: {e}")
            # Return basic info even if detailed fetch fails
            return {
                "node_id": node.get("NodeID", ""),
                "node_uri": node.get("Uri", ""),
                "name": node.get("Name", "Untitled"),
                "description": node.get("Description", ""),
                "type": "album",
                "album_key": "",
                "image_count": 0,
            }
    
    async def get_user_root_node(self) -> Optional[Dict]:
        """Get the user's root folder node"""
        try:
            user = await self.get_current_user()
            if not user:
                logger.error("Failed to get current user for root node")
                return None
            
            node_uri = user.get("Uris", {}).get("Node", {}).get("Uri")
            if not node_uri:
                logger.error("No root node URI found for user")
                return None
            
            # Remove leading /api/v2 if present
            if node_uri.startswith("/api/v2"):
                node_uri = node_uri[7:]
            
            url = f"{self.api_base}{node_uri}"
            
            response = await self.oauth.make_authenticated_request(
                "GET", url, self.access_token, self.access_token_secret
            )
            
            if response and response.status_code == 200:
                data = response.json()
                return data.get("Response", {}).get("Node", {})
            else:
                logger.error(f"Failed to get root node: {response.status_code if response else 'No response'}")
                return None
                
        except Exception as e:
            logger.error(f"Error getting user root node: {e}")
            return None
    
    async def get_node_children(self, node_uri: Optional[str] = None) -> List[Dict]:
        """Get child nodes (folders and albums) for a given node"""
        try:
            if not node_uri:
                # Get root node
                root_node = await self.get_user_root_node()
                if not root_node:
                    return []
                child_nodes_uri = root_node.get("Uris", {}).get("ChildNodes", {}).get("Uri")
            else:
                # Use provided node URI to get its children
                if node_uri.startswith("/api/v2"):
                    node_uri = node_uri[7:]
                
                # First get the node to get its ChildNodes URI
                node_url = f"{self.api_base}{node_uri}"
                node_response = await self.oauth.make_authenticated_request(
                    "GET", node_url, self.access_token, self.access_token_secret
                )
                
                if not node_response or node_response.status_code != 200:
                    logger.error(f"Failed to get node: {node_response.status_code if node_response else 'No response'}")
                    return []
                
                node_data = node_response.json().get("Response", {}).get("Node", {})
                child_nodes_uri = node_data.get("Uris", {}).get("ChildNodes", {}).get("Uri")
            
            if not child_nodes_uri:
                logger.warning("No ChildNodes URI found")
                return []
            
            # Remove leading /api/v2 if present
            if child_nodes_uri.startswith("/api/v2"):
                child_nodes_uri = child_nodes_uri[7:]
            
            url = f"{self.api_base}{child_nodes_uri}"
            params = {
                "count": 100  # Get up to 100 children
            }
            
            response = await self.oauth.make_authenticated_request(
                "GET", url, self.access_token, self.access_token_secret, params=params
            )
            
            if response and response.status_code == 200:
                data = response.json()
                nodes = data.get("Response", {}).get("Node", [])
                
                logger.info(f"Found {len(nodes)} child nodes")
                return nodes
            else:
                logger.error(f"Failed to get child nodes: {response.status_code if response else 'No response'}")
                return []
                
        except Exception as e:
            logger.error(f"Error getting child nodes: {e}")
            return []
    
    async def get_node_details(self, node_uri: str) -> Optional[Dict]:
        """Get details for a specific node"""
        try:
            if node_uri.startswith("/api/v2"):
                node_uri = node_uri[7:]
            
            url = f"{self.api_base}{node_uri}"
            
            response = await self.oauth.make_authenticated_request(
                "GET", url, self.access_token, self.access_token_secret
            )
            
            if response and response.status_code == 200:
                data = response.json()
                return data.get("Response", {}).get("Node", {})
            else:
                logger.error(f"Failed to get node details: {response.status_code if response else 'No response'}")
                return None
                
        except Exception as e:
            logger.error(f"Error getting node details: {e}")
            return None
    
    async def get_folder_breadcrumbs(self, node_uri: str) -> List[Dict]:
        """Get breadcrumb path for a node by walking up the parent chain"""
        breadcrumbs = []
        current_uri = node_uri
        
        try:
            while current_uri:
                node = await self.get_node_details(current_uri)
                if not node:
                    break
                
                # Add current node to breadcrumbs (prepend to maintain order)
                breadcrumbs.insert(0, {
                    "name": node.get("Name", "Untitled"),
                    "node_uri": current_uri,
                    "type": node.get("Type", "Unknown").lower()
                })
                
                # Get parent URI
                parent_node = node.get("Uris", {}).get("ParentNode")
                current_uri = parent_node.get("Uri") if parent_node else None
                
                # Stop if we've reached the root or hit recursion limit
                if len(breadcrumbs) > 10:  # Safety limit
                    break
            
            return breadcrumbs
            
        except Exception as e:
            logger.error(f"Error getting breadcrumbs: {e}")
            return []