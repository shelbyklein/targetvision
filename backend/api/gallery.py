"""Gallery API endpoints for SmugMug folder/album hierarchy"""

from typing import Dict, List, Optional, Any
from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime
import logging
import os

from services.smugmug_service import SmugMugAPI
from services.smugmug_nodes import SmugMugNodeService, NodeInfo
from services.smugmug_auth import SmugMugOAuth

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/gallery", tags=["gallery"])

# In-memory storage for demo (replace with database in production)
user_hierarchies = {}
user_apis = {}


async def get_smugmug_api(user_id: str = "demo") -> Optional[SmugMugAPI]:
    """Get SmugMug API client for user (mock for now)"""
    if user_id not in user_apis:
        # In production, fetch these from encrypted database
        # For demo, check if tokens exist in session/env
        access_token = os.getenv("SMUGMUG_ACCESS_TOKEN", "")
        access_token_secret = os.getenv("SMUGMUG_ACCESS_TOKEN_SECRET", "")
        api_key = os.getenv("SMUGMUG_API_KEY", "")
        api_secret = os.getenv("SMUGMUG_API_SECRET", "")
        
        if not all([access_token, access_token_secret, api_key, api_secret]):
            # Return None instead of raising exception for optional endpoints
            return None
        
        user_apis[user_id] = SmugMugAPI(
            access_token=access_token,
            access_token_secret=access_token_secret,
            api_key=api_key,
            api_secret=api_secret
        )
    
    return user_apis[user_id]


@router.get("/tree")
async def get_gallery_tree(
    user_id: str = Query(default="demo", description="User ID"),
    refresh: bool = Query(default=False, description="Force refresh from SmugMug")
) -> Dict[str, Any]:
    """Get complete folder/album hierarchy tree"""
    try:
        # Check cache first
        if user_id in user_hierarchies and not refresh:
            hierarchy = user_hierarchies[user_id]
            return {
                "success": True,
                "tree": hierarchy.to_dict(),
                "cached": True,
                "timestamp": datetime.utcnow().isoformat()
            }
        
        # Get SmugMug API client
        api = await get_smugmug_api(user_id)
        
        # If API is not available, return error requiring authentication
        if api is None:
            raise HTTPException(
                status_code=401,
                detail="SmugMug not connected. Please connect your account first."
            )
        
        # Get authenticated user info
        user_info = await api.get_authenticated_user()
        username = user_info.get('NickName', '')
        
        if not username:
            raise ValueError("Could not get username from SmugMug")
        
        # Create node service and build hierarchy
        node_service = SmugMugNodeService(api)
        hierarchy = await node_service.build_node_hierarchy(
            username=username,
            max_depth=6,  # SmugMug supports up to 6 levels
            include_empty_folders=True
        )
        
        # Cache the hierarchy
        user_hierarchies[user_id] = hierarchy
        
        return {
            "success": True,
            "tree": hierarchy.to_dict(),
            "cached": False,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get gallery tree: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch gallery tree: {str(e)}"
        )


@router.get("/node/{node_id}")
async def get_node_details(
    node_id: str,
    user_id: str = Query(default="demo", description="User ID")
) -> Dict[str, Any]:
    """Get details for a specific node"""
    try:
        api = await get_smugmug_api(user_id)
        if api is None:
            raise HTTPException(
                status_code=401,
                detail="SmugMug not connected. Please connect your account first."
            )
        node_data = await api.get_node(node_id)
        
        return {
            "success": True,
            "node": node_data,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get node details: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch node details: {str(e)}"
        )


@router.get("/node/{node_id}/children")
async def get_node_children(
    node_id: str,
    user_id: str = Query(default="demo", description="User ID"),
    include_albums: bool = Query(default=True, description="Include albums"),
    include_folders: bool = Query(default=True, description="Include folders")
) -> Dict[str, Any]:
    """Get children of a specific node"""
    try:
        api = await get_smugmug_api(user_id)
        if api is None:
            raise HTTPException(
                status_code=401,
                detail="SmugMug not connected. Please connect your account first."
            )
        node_service = SmugMugNodeService(api)
        
        children = await node_service.get_node_children(
            node_id=node_id,
            include_albums=include_albums,
            include_folders=include_folders
        )
        
        # Format children for response
        formatted_children = []
        for child in children:
            child_info = {
                "node_id": child.get("NodeID"),
                "name": child.get("Name"),
                "type": child.get("Type"),
                "url_path": child.get("UrlPath"),
                "description": child.get("Description")
            }
            
            # Add album-specific info
            if child.get("Type") == "Album":
                child_info["album_key"] = child.get("Uris", {}).get("Album", {}).get("Uri", "").split("/")[-1]
                child_info["image_count"] = child.get("ImageCount", 0)
                
                # Try to get thumbnail
                highlight = child.get("Uris", {}).get("HighlightImage")
                if highlight:
                    child_info["thumbnail_url"] = highlight.get("Image", {}).get("Uris", {}).get("ThumbnailUrl")
            
            formatted_children.append(child_info)
        
        return {
            "success": True,
            "children": formatted_children,
            "count": len(formatted_children),
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get node children: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch node children: {str(e)}"
        )


@router.get("/album/{album_key}/images")
async def get_album_images(
    album_key: str,
    user_id: str = Query(default="demo", description="User ID"),
    count: int = Query(default=50, description="Number of images to fetch"),
    start: int = Query(default=0, description="Starting index")
) -> Dict[str, Any]:
    """Get images from an album"""
    try:
        api = await get_smugmug_api(user_id)
        if api is None:
            raise HTTPException(
                status_code=401,
                detail="SmugMug not connected. Please connect your account first."
            )
        
        images = await api.get_album_images(
            album_key=album_key,
            count=count,
            start=start,
            include_metadata=True
        )
        
        # Format images for response
        formatted_images = []
        for img in images:
            image_sizes = img.get("Uris", {}).get("ImageSizes", {})
            
            image_info = {
                "image_key": img.get("ImageKey"),
                "file_name": img.get("FileName"),
                "caption": img.get("Caption"),
                "keywords": img.get("Keywords", []),
                "date_taken": img.get("DateTimeOriginal"),
                "thumbnail_url": image_sizes.get("ThumbnailUrl"),
                "medium_url": image_sizes.get("MediumUrl"),
                "large_url": image_sizes.get("LargeUrl"),
                "original_url": image_sizes.get("OriginalUrl"),
                "width": img.get("OriginalWidth"),
                "height": img.get("OriginalHeight")
            }
            formatted_images.append(image_info)
        
        return {
            "success": True,
            "images": formatted_images,
            "count": len(formatted_images),
            "album_key": album_key,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get album images: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch album images: {str(e)}"
        )


@router.post("/sync")
async def sync_gallery_hierarchy(
    user_id: str = Query(default="demo", description="User ID")
) -> Dict[str, Any]:
    """Trigger a sync of the gallery hierarchy from SmugMug"""
    try:
        # Clear cache to force refresh
        if user_id in user_hierarchies:
            del user_hierarchies[user_id]
        
        # Get fresh hierarchy
        api = await get_smugmug_api(user_id)
        if api is None:
            raise HTTPException(
                status_code=401,
                detail="SmugMug not connected. Please connect your account first."
            )
        user_info = await api.get_authenticated_user()
        username = user_info.get('NickName', '')
        
        if not username:
            raise ValueError("Could not get username from SmugMug")
        
        node_service = SmugMugNodeService(api)
        hierarchy = await node_service.build_node_hierarchy(
            username=username,
            max_depth=6,
            include_empty_folders=True
        )
        
        # Count nodes
        def count_nodes(node):
            count = {"folders": 0, "albums": 0}
            if node.type == "Folder":
                count["folders"] = 1
            else:
                count["albums"] = 1
            
            for child in node.children:
                child_count = count_nodes(child)
                count["folders"] += child_count["folders"]
                count["albums"] += child_count["albums"]
            
            return count
        
        stats = count_nodes(hierarchy)
        
        # Cache the new hierarchy
        user_hierarchies[user_id] = hierarchy
        
        return {
            "success": True,
            "message": "Gallery hierarchy synced successfully",
            "stats": {
                "total_folders": stats["folders"],
                "total_albums": stats["albums"],
                "total_nodes": stats["folders"] + stats["albums"]
            },
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to sync gallery: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to sync gallery: {str(e)}"
        )


@router.get("/search")
async def search_gallery(
    query: str,
    user_id: str = Query(default="demo", description="User ID"),
    node_type: Optional[str] = Query(default=None, description="Filter by node type (Folder/Album)")
) -> Dict[str, Any]:
    """Search for folders or albums by name"""
    try:
        # Get cached hierarchy or fetch if needed
        if user_id not in user_hierarchies:
            # Fetch hierarchy first
            await get_gallery_tree(user_id=user_id)
        
        hierarchy = user_hierarchies[user_id]
        node_service = SmugMugNodeService(await get_smugmug_api(user_id))
        
        # Search nodes
        results = await node_service.search_nodes(
            hierarchy=hierarchy,
            query=query,
            node_type=node_type
        )
        
        # Format results
        formatted_results = []
        for node in results:
            formatted_results.append({
                "node_id": node.node_id,
                "name": node.name,
                "type": node.type,
                "path": node.path,
                "level": node.level,
                "album_key": node.album_key,
                "image_count": node.image_count
            })
        
        return {
            "success": True,
            "results": formatted_results,
            "count": len(formatted_results),
            "query": query,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to search gallery: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to search gallery: {str(e)}"
        )


@router.get("/breadcrumb/{node_id}")
async def get_breadcrumb_path(
    node_id: str,
    user_id: str = Query(default="demo", description="User ID")
) -> Dict[str, Any]:
    """Get breadcrumb path to a node"""
    try:
        # Get cached hierarchy or fetch if needed
        if user_id not in user_hierarchies:
            await get_gallery_tree(user_id=user_id)
        
        hierarchy = user_hierarchies[user_id]
        node_service = SmugMugNodeService(await get_smugmug_api(user_id))
        
        # Get breadcrumb path
        path = node_service.get_breadcrumb_path(hierarchy, node_id)
        
        return {
            "success": True,
            "path": [{"name": name, "node_id": nid} for name, nid in path],
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get breadcrumb path: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get breadcrumb path: {str(e)}"
        )