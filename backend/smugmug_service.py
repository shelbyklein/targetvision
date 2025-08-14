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
            "count": "50",  # Get 50 albums at a time
            "_expand": "HighlightImage"  # Include highlight image data with ThumbnailUrl
        }
        
        albums = []
        while url:
            response = await self.oauth.make_authenticated_request(
                "GET", url, self.access_token, self.access_token_secret, params
            )
            
            if response and response.status_code == 200:
                data = response.json()
                response_data = data.get("Response", {})
                album_batch = response_data.get("Album", [])
                # Process each album to extract highlight image data if present
                processed_albums = []
                for album in album_batch:
                    processed_album = album.copy()
                    # Extract highlight image info if available
                    if "HighlightImage" in album and album["HighlightImage"]:
                        highlight_image = album["HighlightImage"]
                        if "ThumbnailUrl" in highlight_image:
                            processed_album["highlight_image"] = {
                                "image_key": highlight_image.get("ImageKey", ""),
                                "title": highlight_image.get("Title", ""),
                                "caption": highlight_image.get("Caption", ""),
                                "uri": highlight_image.get("Uri", ""),
                                "thumbnail_url": highlight_image["ThumbnailUrl"],
                                "image_url": highlight_image["ThumbnailUrl"]
                            }
                    processed_albums.append(processed_album)
                
                albums.extend(processed_albums)
                
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
    
    async def get_album_images(self, album_uri: str, limit: int = 100, start: int = 1, count: int = None, progress_callback=None) -> List[Dict]:
        """Get images from a specific album with pagination support"""
        # Use count parameter if provided, otherwise use limit
        page_count = count if count is not None else limit
        logger.info(f"Starting get_album_images with limit={limit}, start={start}, count={page_count} for album: {album_uri}")
        
        # Use full album URI (it already contains /api/v2)
        url = f"https://api.smugmug.com{album_uri}!images"
        params = {
            "_expand": "ImageSizes",  # Only expand ImageSizes to avoid comma issues
            "start": str(start),  # Starting index (1-based)
            "count": str(page_count)  # Number of items to fetch
        }
        
        images = []
        total_fetched = 0
        
        while url and total_fetched < limit:
            logger.info(f"Fetching batch from SmugMug: {total_fetched}/{limit} photos fetched so far")
            response = await self.oauth.make_authenticated_request(
                "GET", url, self.access_token, self.access_token_secret, params
            )
            
            if response and response.status_code == 200:
                data = response.json()
                response_data = data.get("Response", {})
                batch_images = response_data.get("AlbumImage", [])
                logger.info(f"Received {len(batch_images)} images in this batch")
                logger.info(f"Response data keys: {list(response_data.keys())}")
                if "Pages" in response_data:
                    logger.info(f"Pages info: {response_data['Pages']}")
                
                # Add images up to limit
                remaining = limit - total_fetched
                images.extend(batch_images[:remaining])
                total_fetched += len(batch_images[:remaining])
                
                logger.info(f"Added {len(batch_images[:remaining])} images, total now: {total_fetched}")
                
                # Call progress callback if provided
                if progress_callback:
                    await progress_callback(total_fetched, limit)
                
                # Check for pagination
                if total_fetched < limit:
                    pages = response_data.get("Pages", {})
                    logger.info(f"Pages object: {pages}")
                    if pages.get("NextPage"):
                        next_page = pages['NextPage']
                        logger.info(f"NextPage found: {next_page}")
                        # Use full URL with SmugMug base
                        url = f"https://api.smugmug.com{next_page}"
                        # SmugMug NextPage URLs already contain necessary parameters
                        # Don't override them, just add _expand if not already there
                        if "_expand" not in next_page:
                            params = {"_expand": "ImageSizes"}
                        else:
                            params = {}
                    else:
                        logger.info("No NextPage found - pagination complete")
                        url = None
                else:
                    logger.info("Reached requested limit - stopping pagination")
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
    
    async def get_album_by_key(self, album_key: str) -> Optional[Dict]:
        """Get album information directly by album key via Album API"""
        try:
            url = f"{self.api_base}/album/{album_key}"
            params = {
                "_expand": "HighlightImage"  # Include highlight image data
            }
            
            response = await self.oauth.make_authenticated_request(
                "GET", url, self.access_token, self.access_token_secret, params
            )
            
            if response and response.status_code == 200:
                data = response.json()
                album = data.get("Response", {}).get("Album", {})
                logger.info(f"✅ Successfully fetched album {album_key} via Album API")
                return album
            else:
                logger.error(f"❌ Failed to get album {album_key}: {response.status_code if response else 'No response'}")
                return None
                
        except Exception as e:
            logger.error(f"Error getting album {album_key}: {e}")
            return None

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
                "count": 100,  # Get up to 100 children
                "_expand": "HighlightImage"  # Request HighlightImage data
            }
            
            response = await self.oauth.make_authenticated_request(
                "GET", url, self.access_token, self.access_token_secret, params=params
            )
            
            if response and response.status_code == 200:
                data = response.json()
                nodes = data.get("Response", {}).get("Node", [])
                
                
                # Enhance nodes with highlight image information
                enhanced_nodes = []
                for node in nodes:
                    enhanced_node = node.copy()
                    
                    # Extract highlight image information if available OR check if it's an album that needs processing
                    highlight_image = self.extract_highlight_image_info(node)
                    
                    # Add privacy/security information for albums
                    if node.get("Type", "").lower() == "album":
                        privacy = node.get("Privacy", "")
                        effective_privacy = node.get("EffectivePrivacy", "")
                        security_type = node.get("SecurityType", "")
                        effective_security = node.get("EffectiveSecurityType", "")
                        
                        enhanced_node["privacy_info"] = {
                            "privacy": privacy,
                            "effective_privacy": effective_privacy,
                            "security_type": security_type,
                            "effective_security": effective_security,
                            "is_unlisted": privacy.lower() == "unlisted" or effective_privacy.lower() == "unlisted",
                            "is_private": privacy.lower() == "private" or effective_privacy.lower() == "private"
                        }
                        
                    
                    
                    # If no highlight image found but this is an album, try to create one using album_key
                    if not highlight_image and node.get("Type", "").lower() == "album" and node.get("AlbumKey"):
                        album_key = node["AlbumKey"]
                        album_highlight_uri = f"/api/v2/album/{album_key}!highlightimage"
                        logger.info(f"🎯 Creating album highlight URI for '{node.get('Name', 'Unknown')}': {album_highlight_uri}")
                        highlight_image = {
                            "album_highlight_uri": album_highlight_uri,
                            "needs_album_fetch": True
                        }
                    
                    if highlight_image:
                        # Check if we need to fetch folder highlight image details
                        if highlight_image.get("needs_folder_fetch"):
                            folder_highlight_uri = highlight_image.get("folder_highlight_uri")
                            if folder_highlight_uri:
                                folder_image_details = await self.get_folder_highlight_image_details(folder_highlight_uri)
                                if folder_image_details:
                                    enhanced_node["highlight_image"] = folder_image_details
                                else:
                                    # Fallback to basic info if fetch fails
                                    enhanced_node["highlight_image"] = highlight_image
                            else:
                                enhanced_node["highlight_image"] = highlight_image
                        # Check if we need to fetch album highlight image details
                        elif highlight_image.get("needs_album_fetch"):
                            album_highlight_uri = highlight_image.get("album_highlight_uri")
                            logger.info(f"📸 [ALBUM DEBUG] Starting album highlight image fetch for '{node.get('Name', 'Unknown')}' from: {album_highlight_uri}")
                            if album_highlight_uri:
                                album_image_details = await self.get_album_highlight_image_details(album_highlight_uri)
                                if album_image_details:
                                    logger.info(f"✅ [ALBUM DEBUG] Successfully got album highlight image for '{node.get('Name', 'Unknown')}': thumbnail_url={album_image_details.get('thumbnail_url', 'None')}")
                                    enhanced_node["highlight_image"] = album_image_details
                                    try:
                                        with open("/Users/shelbyklein/apps/targetvision/album_debug.log", "a") as f:
                                            f.write(f"ALBUM DEBUG: SETTING enhanced_node highlight_image for '{node.get('Name', 'Unknown')}'\n")
                                    except:
                                        pass
                                else:
                                    logger.warning(f"❌ [ALBUM DEBUG] Failed to get album highlight image details for '{node.get('Name', 'Unknown')}')")
                                    # Try to get first image thumbnail as fallback for private/unlisted albums
                                    album_uri = None
                                    if "Uris" in node and "Album" in node["Uris"]:
                                        album_uri = node["Uris"]["Album"]["Uri"]
                                    
                                    if album_uri:
                                        first_image_thumbnail = await self.get_first_album_image_thumbnail(album_uri)
                                        if first_image_thumbnail:
                                            enhanced_node["highlight_image"] = first_image_thumbnail
                                        else:
                                            enhanced_node["highlight_image"] = highlight_image
                                    else:
                                        enhanced_node["highlight_image"] = highlight_image
                            else:
                                enhanced_node["highlight_image"] = highlight_image
                        elif highlight_image.get("needs_fetch"):
                            # Handle regular highlight image fetch if needed
                            highlight_uri = highlight_image.get("highlight_uri")
                            if highlight_uri:
                                image_details = await self.get_highlight_image_details(highlight_uri)
                                if image_details:
                                    enhanced_node["highlight_image"] = image_details
                                else:
                                    # Fallback to basic info if fetch fails
                                    enhanced_node["highlight_image"] = highlight_image
                            else:
                                enhanced_node["highlight_image"] = highlight_image
                        else:
                            enhanced_node["highlight_image"] = highlight_image
                    
                    enhanced_nodes.append(enhanced_node)
                
                logger.info(f"Found {len(enhanced_nodes)} child nodes with highlight image data")
                return enhanced_nodes
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
    
    def extract_highlight_image_info(self, node: Dict) -> Optional[Dict]:
        """Extract highlight image information from a node"""
        try:
            # Debug logging
            if node.get("Type", "").lower() == "album":
                logger.info(f"🔍 Extracting highlight image for album '{node.get('Name', 'Unknown')}': HighlightImage={bool('HighlightImage' in node)}, Uris={bool('Uris' in node and node['Uris'])}, AlbumKey={node.get('AlbumKey', 'None')}")
            
            # Check if HighlightImage is available in the node data
            if "HighlightImage" in node:
                highlight_image = node["HighlightImage"]
                
                # Extract basic image info
                image_info = {
                    "image_key": highlight_image.get("ImageKey", ""),
                    "title": highlight_image.get("Title", ""),
                    "caption": highlight_image.get("Caption", ""),
                    "uri": highlight_image.get("Uri", "")
                }
                
                # Check for ThumbnailUrl first (used by folder highlight images)
                if "ThumbnailUrl" in highlight_image:
                    image_info["thumbnail_url"] = highlight_image["ThumbnailUrl"]
                    image_info["image_url"] = highlight_image["ThumbnailUrl"]  # Use ThumbnailUrl as primary for folders
                
                # Extract image sizes if available
                if "ImageSizes" in highlight_image:
                    sizes = highlight_image["ImageSizes"]
                    
                    # Get various sizes (only if we don't already have ThumbnailUrl)
                    if "image_url" not in image_info:
                        for size_key in ["X5Large", "X4Large", "X3Large", "X2Large", "XLarge", "Large", "Medium"]:
                            if size_key in sizes:
                                image_info["image_url"] = sizes[size_key]["Url"]
                                image_info["width"] = sizes[size_key].get("Width", 0)
                                image_info["height"] = sizes[size_key].get("Height", 0)
                                break
                    
                    # Get thumbnail URL (if not already set from ThumbnailUrl)
                    if "thumbnail_url" not in image_info:
                        for thumb_key in ["Small", "Thumb"]:
                            if thumb_key in sizes:
                                image_info["thumbnail_url"] = sizes[thumb_key]["Url"]
                                break
                
                # Get highlight image URI for fetching sizes if not expanded
                elif "Uris" in highlight_image and "ImageSizes" in highlight_image["Uris"]:
                    image_info["sizes_uri"] = highlight_image["Uris"]["ImageSizes"]["Uri"]
                
                return image_info
            
            # Check if there's a HighlightImage URI in the node's Uris (for folders)
            elif "Uris" in node and "HighlightImage" in node["Uris"]:
                highlight_uri = node["Uris"]["HighlightImage"]["Uri"]
                
                # For folders, try to use the FolderHighlightImage endpoint to get ThumbnailUrl
                if node.get("Type") == "folder" and "FolderHighlightImage" in node["Uris"]:
                    folder_highlight_uri = node["Uris"]["FolderHighlightImage"]["Uri"]
                    return {
                        "folder_highlight_uri": folder_highlight_uri,
                        "needs_folder_fetch": True  # Use special folder highlight endpoint
                    }
                # For albums, try to use the AlbumHighlightImage endpoint to get ThumbnailUrl
                elif node.get("Type", "").lower() == "album":
                    logger.info(f"Processing album node: {node.get('Name', 'Unknown')} - NodeID: {node.get('NodeID', 'Unknown')}")
                    logger.info(f"Album node Uris structure: {list(node.get('Uris', {}).keys()) if node.get('Uris') else 'No Uris'}")
                    
                    album_highlight_uri = None
                    
                    # Method 1: Use Uris.Album if available
                    if "Uris" in node and node["Uris"].get("Album"):
                        album_uri = node["Uris"]["Album"]["Uri"]
                        album_highlight_uri = f"{album_uri}!highlightimage"
                        logger.info(f"Album method 1: Using Uris.Album - {album_highlight_uri}")
                    
                    # Method 2: Try to extract album key from node properties
                    elif node.get("AlbumKey"):
                        album_key = node["AlbumKey"]
                        album_highlight_uri = f"/api/v2/album/{album_key}!highlightimage"
                        logger.info(f"Album method 2: Using AlbumKey - {album_highlight_uri}")
                    
                    # Method 3: Check for album URI patterns in existing URIs
                    elif "Uris" in node:
                        for uri_key, uri_obj in node["Uris"].items():
                            if isinstance(uri_obj, dict) and "Uri" in uri_obj:
                                uri = uri_obj["Uri"]
                                # Look for album URI pattern
                                if "/album/" in uri and "!highlightimage" not in uri:
                                    album_highlight_uri = f"{uri}!highlightimage"
                                    logger.info(f"Album method 3: Found album URI pattern - {album_highlight_uri}")
                                    break
                    
                    if album_highlight_uri:
                        logger.info(f"Album {node.get('Name', 'Unknown')}: Using album highlight URI: {album_highlight_uri}")
                        return {
                            "album_highlight_uri": album_highlight_uri,
                            "needs_album_fetch": True  # Use special album highlight endpoint
                        }
                    else:
                        logger.warning(f"Album node {node.get('Name', 'Unknown')} could not be processed for album highlight image")
                
                return {
                    "highlight_uri": highlight_uri,
                    "needs_fetch": True  # Indicates we need to fetch the highlight image data separately
                }
            
            return None
            
        except Exception as e:
            logger.error(f"Error extracting highlight image info: {e}")
            return None
    
    async def get_highlight_image_details(self, highlight_uri: str) -> Optional[Dict]:
        """Fetch detailed highlight image information from URI"""
        try:
            # Remove leading /api/v2 if present
            if highlight_uri.startswith("/api/v2"):
                highlight_uri = highlight_uri[7:]
            
            url = f"{self.api_base}{highlight_uri}"
            params = {
                "_expand": "ImageSizes"
            }
            
            response = await self.oauth.make_authenticated_request(
                "GET", url, self.access_token, self.access_token_secret, params=params
            )
            
            if response and response.status_code == 200:
                data = response.json()
                image_data = data.get("Response", {}).get("Image", {})
                
                return self.extract_highlight_image_info({"HighlightImage": image_data})
            else:
                logger.error(f"Failed to get highlight image details: {response.status_code if response else 'No response'}")
                return None
                
        except Exception as e:
            logger.error(f"Error getting highlight image details: {e}")
            return None
    
    async def get_folder_highlight_image_details(self, folder_highlight_uri: str) -> Optional[Dict]:
        """Fetch folder highlight image information using the FolderHighlightImage endpoint"""
        try:
            # Use the full SmugMug API URL
            url = f"https://api.smugmug.com{folder_highlight_uri}"
            
            response = await self.oauth.make_authenticated_request(
                "GET", url, self.access_token, self.access_token_secret
            )
            
            if response and response.status_code == 200:
                data = response.json()
                image_data = data.get("Response", {}).get("Image", {})
                
                # Extract folder highlight image info with ThumbnailUrl
                image_info = {
                    "image_key": image_data.get("ImageKey", ""),
                    "title": image_data.get("Title", ""),
                    "caption": image_data.get("Caption", ""),
                    "uri": image_data.get("Uri", "")
                }
                
                # Use ThumbnailUrl as the primary image URL for folders
                if "ThumbnailUrl" in image_data:
                    image_info["thumbnail_url"] = image_data["ThumbnailUrl"]
                    image_info["image_url"] = image_data["ThumbnailUrl"]
                
                # Add additional metadata
                if "OriginalWidth" in image_data:
                    image_info["width"] = image_data["OriginalWidth"]
                if "OriginalHeight" in image_data:
                    image_info["height"] = image_data["OriginalHeight"]
                
                return image_info
            else:
                logger.error(f"Failed to get folder highlight image details: {response.status_code if response else 'No response'}")
                return None
                
        except Exception as e:
            logger.error(f"Error getting folder highlight image details: {e}")
            return None
    
    async def get_album_highlight_image_details(self, album_highlight_uri: str) -> Optional[Dict]:
        """Fetch album highlight image information using the AlbumHighlightImage endpoint"""
        try:
            # Use the full SmugMug API URL
            url = f"https://api.smugmug.com{album_highlight_uri}"
            logger.info(f"🔍 [ALBUM DEBUG] Making API call to: {url}")
            
            # Also write to a debug file to ensure we can see this is being called
            try:
                with open("/Users/shelbyklein/apps/targetvision/album_debug.log", "a") as f:
                    f.write(f"ALBUM DEBUG: API call to {url}\n")
            except:
                pass
            
            response = await self.oauth.make_authenticated_request(
                "GET", url, self.access_token, self.access_token_secret
            )
            
            # Log response status to file
            try:
                with open("/Users/shelbyklein/apps/targetvision/album_debug.log", "a") as f:
                    f.write(f"ALBUM DEBUG: Response status: {response.status_code if response else 'No response'}\n")
                    if response and response.status_code != 200:
                        f.write(f"ALBUM DEBUG: Error response: {response.text[:500] if response else 'No text'}\n")
            except:
                pass
            
            logger.info(f"🔍 [ALBUM DEBUG] Response status: {response.status_code if response else 'No response'}")
            
            if response and response.status_code == 200:
                data = response.json()
                logger.info(f"🔍 [ALBUM DEBUG] Full response data: {json.dumps(data, indent=2)}")
                
                # Also log successful responses to file for inspection
                try:
                    with open("/Users/shelbyklein/apps/targetvision/album_debug.log", "a") as f:
                        f.write(f"ALBUM DEBUG: SUCCESS - Response data processing starting\n")
                        f.write(f"ALBUM DEBUG: SUCCESS - Response keys: {list(data.get('Response', {}).keys())}\n")
                        f.write("=" * 20 + "\n")
                except:
                    pass
                
                # Try different response structure patterns
                image_data = None
                
                # Pattern 1: Response.AlbumImage (correct pattern for album highlight images)
                if "Response" in data and "AlbumImage" in data["Response"]:
                    image_data = data["Response"]["AlbumImage"]
                    logger.info(f"🔍 [ALBUM DEBUG] Found image data via Response.AlbumImage pattern")
                    try:
                        with open("/Users/shelbyklein/apps/targetvision/album_debug.log", "a") as f:
                            f.write(f"ALBUM DEBUG: SUCCESS - Found AlbumImage, ThumbnailUrl present: {'ThumbnailUrl' in image_data}\n")
                    except:
                        pass
                    
                # Pattern 2: Response.Image (fallback for regular images)
                elif "Response" in data and "Image" in data["Response"]:
                    image_data = data["Response"]["Image"]
                    logger.info(f"🔍 [ALBUM DEBUG] Found image data via Response.Image pattern")
                    
                # Pattern 3: Check if Response contains HighlightImage directly
                elif "Response" in data and "HighlightImage" in data["Response"]:
                    image_data = data["Response"]["HighlightImage"]
                    logger.info(f"🔍 [ALBUM DEBUG] Found image data via Response.HighlightImage pattern")
                    
                # Pattern 4: Check if Response contains album data with HighlightImage
                elif "Response" in data and "Album" in data["Response"]:
                    album_data = data["Response"]["Album"]
                    if "HighlightImage" in album_data:
                        image_data = album_data["HighlightImage"]
                        logger.info(f"🔍 [ALBUM DEBUG] Found image data via Response.Album.HighlightImage pattern")
                
                if not image_data:
                    logger.warning(f"🔍 [ALBUM DEBUG] No image data found in any expected patterns. Response keys: {list(data.get('Response', {}).keys())}")
                    return None
                    
                logger.info(f"🔍 [ALBUM DEBUG] Image data structure: {json.dumps(image_data, indent=2)}")
                
                # Extract album highlight image info with ThumbnailUrl
                image_info = {
                    "image_key": image_data.get("ImageKey", ""),
                    "title": image_data.get("Title", ""),
                    "caption": image_data.get("Caption", ""),
                    "uri": image_data.get("Uri", "")
                }
                
                # Use ThumbnailUrl as the primary image URL for albums
                if "ThumbnailUrl" in image_data:
                    image_info["thumbnail_url"] = image_data["ThumbnailUrl"]
                    image_info["image_url"] = image_data["ThumbnailUrl"]
                    logger.info(f"🔍 [ALBUM DEBUG] Found ThumbnailUrl: {image_data['ThumbnailUrl']}")
                else:
                    logger.warning(f"🔍 [ALBUM DEBUG] No ThumbnailUrl found in image data. Available keys: {list(image_data.keys())}")
                
                # Add additional metadata
                if "OriginalWidth" in image_data:
                    image_info["width"] = image_data["OriginalWidth"]
                if "OriginalHeight" in image_data:
                    image_info["height"] = image_data["OriginalHeight"]
                
                logger.info(f"🔍 [ALBUM DEBUG] Final image_info: {json.dumps(image_info, indent=2)}")
                try:
                    with open("/Users/shelbyklein/apps/targetvision/album_debug.log", "a") as f:
                        f.write(f"ALBUM DEBUG: RETURNING - thumbnail_url: {image_info.get('thumbnail_url', 'None')}\n")
                        f.write("=" * 50 + "\n")
                except:
                    pass
                return image_info
            else:
                error_msg = f"HTTP {response.status_code}" if response else "No response"
                if response and response.status_code != 200:
                    try:
                        error_data = response.json()
                        logger.error(f"🔍 [ALBUM DEBUG] API error details: {json.dumps(error_data, indent=2)}")
                    except:
                        logger.error(f"🔍 [ALBUM DEBUG] API error (no JSON): {response.text if response else 'No response text'}")
                        
                logger.error(f"Failed to get album highlight image details: {error_msg}")
                return None
                
        except Exception as e:
            logger.error(f"Error getting album highlight image details: {e}")
            import traceback
            logger.error(f"🔍 [ALBUM DEBUG] Exception traceback: {traceback.format_exc()}")
            return None

    async def get_first_album_image_thumbnail(self, album_uri: str) -> Optional[Dict]:
        """Get thumbnail of the first image in an album as fallback for highlight image"""
        try:
            # Use the album URI to get images (limit to 1 for efficiency)
            url = f"https://api.smugmug.com{album_uri}!images"
            params = {
                "_expand": "ImageSizes",
                "count": "1"  # Only get the first image
            }
            
            response = await self.oauth.make_authenticated_request(
                "GET", url, self.access_token, self.access_token_secret, params=params
            )
            
            if response and response.status_code == 200:
                data = response.json()
                images = data.get("Response", {}).get("AlbumImage", [])
                
                if images:
                    first_image = images[0]
                    
                    # Extract thumbnail info using existing metadata extraction logic
                    metadata = self.extract_photo_metadata(first_image)
                    
                    # Return thumbnail info in the same format as highlight images
                    if metadata.get("thumbnail_url"):
                        return {
                            "image_key": metadata.get("smugmug_id", ""),
                            "title": metadata.get("title", ""),
                            "caption": metadata.get("caption", ""),
                            "thumbnail_url": metadata["thumbnail_url"],
                            "image_url": metadata.get("image_url", metadata["thumbnail_url"]),
                            "width": metadata.get("width", 0),
                            "height": metadata.get("height", 0),
                            "is_fallback_thumbnail": True  # Flag to indicate this is a fallback
                        }
                        
            return None
                
        except Exception as e:
            logger.error(f"Error getting first album image thumbnail: {e}")
            return None

    async def get_largest_image_url(self, smugmug_id: str) -> Optional[Dict]:
        """Get the largest available image URL from SmugMug for a given image ID"""
        try:
            # Based on existing working URLs like: https://photos.smugmug.com/photos/i-czQ6cGq/0/L/i-czQ6cGq-L.jpg
            # We know the L size works, so let's construct larger sizes based on the same pattern
            
            base_url = f"https://photos.smugmug.com/photos/i-{smugmug_id}/0"
            
            # Try different sizes in order from largest to smallest
            # These are the actual SmugMug size codes
            size_variants = [
                {"code": "O", "width": 0, "height": 0},  # Original
                {"code": "X5", "width": 5120, "height": 3840},  # X5Large
                {"code": "X4", "width": 4096, "height": 3072},  # X4Large
                {"code": "X3", "width": 3072, "height": 2304},  # X3Large
                {"code": "X2", "width": 2048, "height": 1536},  # X2Large
                {"code": "XL", "width": 1280, "height": 960},   # XLarge
                {"code": "L", "width": 1024, "height": 768},    # Large (we know this works)
            ]
            
            # Since we know "L" size works, let's try larger sizes and return the first one that exists
            for size_variant in size_variants:
                size_code = size_variant["code"]
                test_url = f"{base_url}/{size_code}/i-{smugmug_id}-{size_code}.jpg"
                
                logger.info(f"Testing URL for {smugmug_id}: {test_url}")
                
                try:
                    # Use httpx directly for a simple HEAD request to test if the URL exists
                    import httpx
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        head_response = await client.head(test_url)
                        
                        if head_response.status_code == 200:
                            logger.info(f"Found working size {size_code} for {smugmug_id}")
                            return {
                                "url": test_url,
                                "width": size_variant["width"],
                                "height": size_variant["height"],
                                "file_size": 0,  # Unknown without content-length header
                                "format": "JPG"
                            }
                        else:
                            logger.debug(f"Size {size_code} returned {head_response.status_code} for {smugmug_id}")
                            
                except Exception as e:
                    logger.debug(f"Size {size_code} failed for {smugmug_id}: {e}")
                    continue
            
            logger.warning(f"No larger image sizes found for SmugMug ID: {smugmug_id}")
            return None
                
        except Exception as e:
            logger.error(f"Error getting largest image for {smugmug_id}: {e}")
            return None