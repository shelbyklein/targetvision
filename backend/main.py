from fastapi import FastAPI, HTTPException, Depends, Query, File, UploadFile, Header, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy.orm import Session
from typing import Dict, List, Optional
import os
import time
import base64
from datetime import datetime
from dotenv import load_dotenv
import logging
from pydantic import BaseModel
import httpx

load_dotenv()

# Import our modules
from database import get_db, init_db, test_connection
from models import Album, Photo, AIMetadata, OAuthToken, ProcessingQueue, Collection, CollectionItem
from smugmug_auth import SmugMugOAuth
from smugmug_service import SmugMugService
from ai_processor import ai_processor, AIProcessor
from embeddings import hybrid_search, vector_search
from config import settings

# Store temporary OAuth tokens in memory (use Redis in production)
oauth_temp_storage = {}

# Cache for sidebar data (in-memory cache with TTL)
sidebar_cache = {}
SIDEBAR_CACHE_TTL = int(float(os.getenv("SIDEBAR_CACHE_TTL_HOURS", 0.083)) * 3600)  # Default: 5 minutes (0.083 hours)

# Cache for thumbnail URLs (longer TTL since they rarely change)
thumbnail_cache = {}
THUMBNAIL_CACHE_TTL = int(float(os.getenv("THUMBNAIL_CACHE_TTL_HOURS", 1)) * 3600)  # Default: 1 hour

def get_cache_key(node_uri: Optional[str], user_id: str) -> str:
    """Generate cache key for sidebar data"""
    return f"sidebar_{user_id}_{node_uri or 'root'}"

def get_thumbnail_cache_key(album_key: str, user_id: str) -> str:
    """Generate cache key for thumbnail data"""
    return f"thumbnail_{user_id}_{album_key}"

def is_cache_valid(cache_entry: Dict, ttl: int = SIDEBAR_CACHE_TTL) -> bool:
    """Check if cache entry is still valid"""
    return time.time() - cache_entry.get('timestamp', 0) < ttl

def invalidate_sidebar_cache(user_id: str = None):
    """Invalidate sidebar cache for a specific user or all users"""
    keys_to_remove = []
    for key in sidebar_cache.keys():
        if user_id is None or key.startswith(f"sidebar_{user_id}_"):
            keys_to_remove.append(key)
    
    for key in keys_to_remove:
        del sidebar_cache[key]

def invalidate_thumbnail_cache(user_id: str = None):
    """Invalidate thumbnail cache for a specific user or all users"""
    keys_to_remove = []
    for key in thumbnail_cache.keys():
        if user_id is None or key.startswith(f"thumbnail_{user_id}_"):
            keys_to_remove.append(key)
    
    for key in keys_to_remove:
        del thumbnail_cache[key]

# Pydantic models for API key management
class APIKeyTestRequest(BaseModel):
    provider: str
    api_key: str

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="TargetVision MVP", 
    version="0.1.0",
    description="SmugMug-integrated RAG application with AI-powered photo metadata"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {
        "message": "TargetVision MVP API", 
        "status": "running",
        "version": "0.1.0"
    }

@app.get("/health")
async def health_check():
    health_status = {
        "status": "healthy",
        "api": "running",
        "database": "pending",
        "smugmug": "pending",
        "ai_service": "pending"
    }
    
    # TODO: Add actual health checks for database and services
    
    return health_status

@app.get("/api/status")
async def api_status():
    return {
        "environment": os.getenv("DEBUG", "false"),
        "smugmug_configured": bool(os.getenv("SMUGMUG_API_KEY")),
        "anthropic_configured": bool(os.getenv("ANTHROPIC_API_KEY")),
        "database_configured": bool(os.getenv("DATABASE_URL"))
    }

# SmugMug OAuth Endpoints
@app.post("/auth/smugmug/request")
async def start_oauth():
    """Step 1: Initiate OAuth flow with SmugMug"""
    oauth = SmugMugOAuth()
    
    # Get request token
    token_data = await oauth.get_request_token()
    if not token_data:
        raise HTTPException(status_code=500, detail="Failed to get request token from SmugMug")
    
    # Store token secret temporarily (use session/Redis in production)
    request_token = token_data["oauth_token"]
    oauth_temp_storage[request_token] = token_data["oauth_token_secret"]
    
    # Get authorization URL
    auth_url = oauth.get_authorization_url(request_token)
    
    return {
        "auth_url": auth_url,
        "request_token": request_token
    }

@app.get("/auth/smugmug/callback")
async def oauth_callback(
    oauth_token: str = Query(...),
    oauth_verifier: str = Query(...),
    db: Session = Depends(get_db)
):
    """Step 2: Complete OAuth flow and get access token"""
    
    # Get stored request token secret
    request_token_secret = oauth_temp_storage.get(oauth_token)
    if not request_token_secret:
        raise HTTPException(status_code=400, detail="Invalid or expired request token")
    
    oauth = SmugMugOAuth()
    
    # Exchange for access token
    access_data = await oauth.get_access_token(
        oauth_token, request_token_secret, oauth_verifier
    )
    
    if not access_data:
        raise HTTPException(status_code=500, detail="Failed to get access token from SmugMug")
    
    # Clean up temporary storage
    del oauth_temp_storage[oauth_token]
    
    # Store access token in database
    # Check if we already have a token
    existing_token = db.query(OAuthToken).filter_by(service="smugmug").first()
    
    if existing_token:
        # Update existing token
        existing_token.access_token = access_data["oauth_token"]
        existing_token.access_token_secret = access_data["oauth_token_secret"]
        existing_token.user_id = access_data.get("user_id", "")
        existing_token.username = access_data.get("username", "")
    else:
        # Create new token
        new_token = OAuthToken(
            service="smugmug",
            access_token=access_data["oauth_token"],
            access_token_secret=access_data["oauth_token_secret"],
            user_id=access_data.get("user_id", ""),
            username=access_data.get("username", "")
        )
        db.add(new_token)
    
    db.commit()
    
    # Redirect to success page (or return JSON for API usage)
    return RedirectResponse(url="/auth/success")

@app.get("/auth/success")
async def auth_success():
    """OAuth success page"""
    return {
        "status": "success",
        "message": "SmugMug authentication successful! You can now sync your photos."
    }

@app.get("/auth/status")
async def auth_status(db: Session = Depends(get_db)):
    """Check if user is authenticated with SmugMug"""
    token = db.query(OAuthToken).filter_by(service="smugmug").first()
    
    if token and token.is_valid():
        return {
            "authenticated": True,
            "username": token.username,
            "user_id": token.user_id
        }
    
    return {"authenticated": False}

# SmugMug Direct API Endpoints (Real-time data)
@app.get("/smugmug/albums", response_model=List[Dict])
async def list_smugmug_albums(db: Session = Depends(get_db)):
    """Fetch all albums directly from SmugMug API with processing status"""
    
    # Get stored access token
    token = db.query(OAuthToken).filter_by(service="smugmug").first()
    if not token or not token.is_valid():
        raise HTTPException(status_code=401, detail="Not authenticated with SmugMug")
    
    # Initialize SmugMug service
    service = SmugMugService(token.access_token, token.access_token_secret)
    
    try:
        # Fetch albums from SmugMug API
        smugmug_albums = await service.get_user_albums()
        
        if not smugmug_albums:
            return []
        
        # Enhance with local processing statistics
        result = []
        from sqlalchemy import func, case
        
        for album in smugmug_albums:
            album_data = {
                "smugmug_id": album.get("AlbumKey", ""),
                "smugmug_uri": album.get("Uri", ""),
                "title": album.get("Name", "Untitled Album"),
                "description": album.get("Description", ""),
                "image_count": album.get("ImageCount", 0),
                "privacy": album.get("Privacy", ""),
                "sort_method": album.get("SortMethod", ""),
                "url_name": album.get("UrlName", ""),
                "created_at": album.get("Date", ""),
                "modified_at": album.get("LastUpdated", "")
            }
            
            # Get local processing statistics if album exists in DB
            local_album = db.query(Album).filter_by(smugmug_id=album.get("Uri", "")).first()
            if local_album:
                stats = db.query(
                    func.count(Photo.id).label('synced_photo_count'),
                    func.sum(case((Photo.processing_status == 'completed', 1), else_=0)).label('processed_count'),
                    func.sum(case((Photo.ai_metadata != None, 1), else_=0)).label('ai_processed_count')
                ).filter(Photo.album_id == local_album.id).first()
                
                album_data.update({
                    'local_album_id': local_album.id,
                    'synced_photo_count': int(stats.synced_photo_count or 0),
                    'processed_count': int(stats.processed_count or 0),
                    'ai_processed_count': int(stats.ai_processed_count or 0),
                    'processing_progress': round((int(stats.ai_processed_count or 0) / max(int(stats.synced_photo_count or 1), 1)) * 100, 1),
                    'is_synced': True
                })
            else:
                album_data.update({
                    'local_album_id': None,
                    'synced_photo_count': 0,
                    'processed_count': 0,
                    'ai_processed_count': 0,
                    'processing_progress': 0.0,
                    'is_synced': False
                })
            
            result.append(album_data)
        
        return result
        
    except Exception as e:
        logger.error(f"Error fetching SmugMug albums: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch albums from SmugMug: {str(e)}")

@app.get("/smugmug/nodes")
async def list_smugmug_nodes(
    node_uri: Optional[str] = Query(default=None, description="Node URI to get children for (root if not provided)"),
    db: Session = Depends(get_db)
):
    """Get child nodes (folders and albums) for a node using SmugMug Node API"""
    
    # Get stored access token
    token = db.query(OAuthToken).filter_by(service="smugmug").first()
    if not token or not token.is_valid():
        raise HTTPException(status_code=401, detail="Not authenticated with SmugMug")
    
    # Generate cache key using user ID from token
    cache_key = get_cache_key(node_uri, token.user_id or "unknown")
    
    # Check cache first
    if cache_key in sidebar_cache and is_cache_valid(sidebar_cache[cache_key]):
        logger.info(f"Cache hit for sidebar data: {cache_key}")
        cached_data = sidebar_cache[cache_key]['data']
        
        # Update local database stats for albums (always fresh)
        for node_data in cached_data['nodes']:
            if node_data.get('type') == 'album' and node_data.get('album_key'):
                album_key = node_data['album_key']
                album_uri = f"/api/v2/album/{album_key}"
                local_album = db.query(Album).filter_by(smugmug_id=album_uri).first()
                if local_album:
                    from sqlalchemy import func, case
                    stats = db.query(
                        func.count(Photo.id).label('synced_photo_count'),
                        func.sum(case((Photo.processing_status == 'completed', 1), else_=0)).label('processed_count'),
                        func.sum(case((Photo.ai_metadata != None, 1), else_=0)).label('ai_processed_count')
                    ).filter(Photo.album_id == local_album.id).first()
                    
                    node_data.update({
                        'local_album_id': local_album.id,
                        'synced_photo_count': int(stats.synced_photo_count or 0),
                        'processed_count': int(stats.processed_count or 0),
                        'ai_processed_count': int(stats.ai_processed_count or 0),
                        'processing_progress': round((int(stats.ai_processed_count or 0) / max(int(stats.synced_photo_count or 1), 1)) * 100, 1),
                        'is_synced': True
                    })
                else:
                    node_data.update({
                        'local_album_id': None,
                        'synced_photo_count': 0,
                        'processed_count': 0,
                        'ai_processed_count': 0,
                        'processing_progress': 0.0,
                        'is_synced': False
                    })
        
        return cached_data
    
    # Initialize SmugMug service
    service = SmugMugService(token.access_token, token.access_token_secret)
    
    try:
        logger.info(f"Cache miss for sidebar data: {cache_key} - fetching from SmugMug API")
        
        # Fetch nodes from SmugMug API
        nodes = await service.get_node_children(node_uri)
        
        if not nodes:
            return []
        
        # Transform nodes to consistent format
        result = []
        
        for node in nodes:
            node_type = node.get("Type", "").lower()
            
            if node_type == "album":
                # For albums, get detailed information including AlbumKey
                node_data = await service.get_detailed_album_info(node)
                
                # Get local processing statistics for albums
                if node_data.get("album_key"):
                    album_key = node_data["album_key"]
                    # Albums are stored with full URI, so construct it for lookup
                    album_uri = f"/api/v2/album/{album_key}"
                    local_album = db.query(Album).filter_by(smugmug_id=album_uri).first()
                    if local_album:
                        from sqlalchemy import func, case
                        stats = db.query(
                            func.count(Photo.id).label('synced_photo_count'),
                            func.sum(case((Photo.processing_status == 'completed', 1), else_=0)).label('processed_count'),
                            func.sum(case((Photo.ai_metadata != None, 1), else_=0)).label('ai_processed_count')
                        ).filter(Photo.album_id == local_album.id).first()
                        
                        node_data.update({
                            'local_album_id': local_album.id,
                            'synced_photo_count': int(stats.synced_photo_count or 0),
                            'processed_count': int(stats.processed_count or 0),
                            'ai_processed_count': int(stats.ai_processed_count or 0),
                            'processing_progress': round((int(stats.ai_processed_count or 0) / max(int(stats.synced_photo_count or 1), 1)) * 100, 1),
                            'is_synced': True
                        })
                    else:
                        node_data.update({
                            'local_album_id': None,
                            'synced_photo_count': 0,
                            'processed_count': 0,
                            'ai_processed_count': 0,
                            'processing_progress': 0.0,
                            'is_synced': False
                        })
                else:
                    # No album key available
                    node_data.update({
                        'local_album_id': None,
                        'synced_photo_count': 0,
                        'processed_count': 0,
                        'ai_processed_count': 0,
                        'processing_progress': 0.0,
                        'is_synced': False
                    })
            else:
                # For folders and other node types, use basic node data
                node_data = {
                    "node_id": node.get("NodeID", ""),
                    "node_uri": node.get("Uri", ""),
                    "name": node.get("Name", "Untitled"),
                    "description": node.get("Description", ""),
                    "type": node_type,
                    "privacy": node.get("Privacy", ""),
                    "security_type": node.get("SecurityType", ""),
                    "date_added": node.get("DateAdded", ""),
                    "date_modified": node.get("DateModified", ""),
                    "has_children": node.get("HasChildren", False),
                    "sort_method": node.get("SortMethod", ""),
                    "sort_direction": node.get("SortDirection", "")
                }
                
                # Add highlight image data if available
                if "highlight_image" in node:
                    node_data["highlight_image"] = node["highlight_image"]
            
            result.append(node_data)
        
        # Get breadcrumbs for the current node if requested
        breadcrumbs = []
        if node_uri:
            breadcrumbs = await service.get_folder_breadcrumbs(node_uri)
        
        response_data = {
            "nodes": result,
            "breadcrumbs": breadcrumbs,
            "current_node_uri": node_uri
        }
        
        # Cache the response data (without local database stats for albums)
        cache_data = {
            "nodes": [],
            "breadcrumbs": breadcrumbs,
            "current_node_uri": node_uri
        }
        
        # Store nodes in cache but remove local database-specific fields for albums
        for node_data in result:
            cached_node = node_data.copy()
            if cached_node.get('type') == 'album':
                # Remove local database stats from cache
                for key in ['local_album_id', 'synced_photo_count', 'processed_count', 'ai_processed_count', 'processing_progress', 'is_synced']:
                    cached_node.pop(key, None)
            cache_data["nodes"].append(cached_node)
        
        sidebar_cache[cache_key] = {
            'data': cache_data,
            'timestamp': time.time()
        }
        logger.info(f"Cached sidebar data: {cache_key}")
        
        return response_data
        
    except Exception as e:
        logger.error(f"Error fetching SmugMug nodes: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch nodes from SmugMug: {str(e)}")

@app.post("/cache/clear")
async def clear_all_cache(
    db: Session = Depends(get_db)
):
    """Clear all cache (sidebar and thumbnail) for the current user"""
    
    # Get stored access token to identify user
    token = db.query(OAuthToken).filter_by(service="smugmug").first()
    if not token or not token.is_valid():
        raise HTTPException(status_code=401, detail="Not authenticated with SmugMug")
    
    user_id = token.user_id or "unknown"
    
    sidebar_count = len([k for k in sidebar_cache.keys() if k.startswith(f"sidebar_{user_id}_")])
    thumbnail_count = len([k for k in thumbnail_cache.keys() if k.startswith(f"thumbnail_{user_id}_")])
    
    invalidate_sidebar_cache(user_id)
    invalidate_thumbnail_cache(user_id)
    
    return {
        "message": f"All cache cleared for user {user_id}",
        "cleared_sidebar_entries": sidebar_count,
        "cleared_thumbnail_entries": thumbnail_count,
        "total_cleared": sidebar_count + thumbnail_count
    }

@app.post("/cache/sidebar/clear")
async def clear_sidebar_cache(
    db: Session = Depends(get_db)
):
    """Clear the sidebar cache for the current user"""
    
    # Get stored access token to identify user
    token = db.query(OAuthToken).filter_by(service="smugmug").first()
    if not token or not token.is_valid():
        raise HTTPException(status_code=401, detail="Not authenticated with SmugMug")
    
    user_id = token.user_id or "unknown"
    cleared_count = len([k for k in sidebar_cache.keys() if k.startswith(f"sidebar_{user_id}_")])
    invalidate_sidebar_cache(user_id)
    
    return {"message": f"Sidebar cache cleared for user {user_id}", "cleared_entries": cleared_count}

@app.post("/cache/thumbnails/clear")
async def clear_thumbnail_cache(
    db: Session = Depends(get_db)
):
    """Clear the thumbnail cache for the current user"""
    
    # Get stored access token to identify user
    token = db.query(OAuthToken).filter_by(service="smugmug").first()
    if not token or not token.is_valid():
        raise HTTPException(status_code=401, detail="Not authenticated with SmugMug")
    
    user_id = token.user_id or "unknown"
    cleared_count = len([k for k in thumbnail_cache.keys() if k.startswith(f"thumbnail_{user_id}_")])
    invalidate_thumbnail_cache(user_id)
    
    return {"message": f"Thumbnail cache cleared for user {user_id}", "cleared_entries": cleared_count}

@app.get("/cache/status")
async def get_cache_status(
    db: Session = Depends(get_db)
):
    """Get cache status for the current user"""
    
    # Get stored access token to identify user
    token = db.query(OAuthToken).filter_by(service="smugmug").first()
    if not token or not token.is_valid():
        raise HTTPException(status_code=401, detail="Not authenticated with SmugMug")
    
    user_id = token.user_id or "unknown"
    
    # Sidebar cache info
    sidebar_keys = [k for k in sidebar_cache.keys() if k.startswith(f"sidebar_{user_id}_")]
    sidebar_info = []
    for key in sidebar_keys:
        entry = sidebar_cache[key]
        sidebar_info.append({
            "key": key,
            "timestamp": entry["timestamp"],
            "age_seconds": int(time.time() - entry["timestamp"]),
            "is_valid": is_cache_valid(entry, SIDEBAR_CACHE_TTL),
            "nodes_count": len(entry["data"]["nodes"])
        })
    
    # Thumbnail cache info
    thumbnail_keys = [k for k in thumbnail_cache.keys() if k.startswith(f"thumbnail_{user_id}_")]
    thumbnail_info = []
    for key in thumbnail_keys:
        entry = thumbnail_cache[key]
        thumbnail_info.append({
            "key": key,
            "timestamp": entry["timestamp"],
            "age_seconds": int(time.time() - entry["timestamp"]),
            "is_valid": is_cache_valid(entry, THUMBNAIL_CACHE_TTL),
            "album_key": entry["data"]["album_key"]
        })
    
    return {
        "user_id": user_id,
        "sidebar_cache": {
            "ttl_seconds": SIDEBAR_CACHE_TTL,
            "total_entries": len(sidebar_keys),
            "entries": sidebar_info
        },
        "thumbnail_cache": {
            "ttl_seconds": THUMBNAIL_CACHE_TTL,
            "total_entries": len(thumbnail_keys),
            "entries": thumbnail_info
        },
        "total_cache_entries": len(sidebar_keys) + len(thumbnail_keys)
    }


@app.get("/smugmug/node/{node_id}")
async def get_smugmug_node_details(
    node_id: str,
    db: Session = Depends(get_db)
):
    """Get details for a specific SmugMug node"""
    
    # Get stored access token
    token = db.query(OAuthToken).filter_by(service="smugmug").first()
    if not token or not token.is_valid():
        raise HTTPException(status_code=401, detail="Not authenticated with SmugMug")
    
    # Initialize SmugMug service
    service = SmugMugService(token.access_token, token.access_token_secret)
    
    try:
        # Construct node URI
        node_uri = f"/node/{node_id}"
        
        # Get node details
        node = await service.get_node_details(node_uri)
        if not node:
            raise HTTPException(status_code=404, detail="Node not found")
        
        # Get breadcrumbs
        breadcrumbs = await service.get_folder_breadcrumbs(node_uri)
        
        return {
            "node": node,
            "breadcrumbs": breadcrumbs
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting SmugMug node details: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get node details: {str(e)}")

@app.get("/smugmug/album/{album_key}/thumbnail")
async def get_album_thumbnail(
    album_key: str,
    if_none_match: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Get thumbnail URL for a specific album with caching"""
    
    # Get stored access token
    token = db.query(OAuthToken).filter_by(service="smugmug").first()
    if not token or not token.is_valid():
        raise HTTPException(status_code=401, detail="Not authenticated with SmugMug")
    
    user_id = token.user_id or "unknown"
    cache_key = get_thumbnail_cache_key(album_key, user_id)
    
    # Check cache first
    if cache_key in thumbnail_cache and is_cache_valid(thumbnail_cache[cache_key], THUMBNAIL_CACHE_TTL):
        logger.info(f"Cache hit for thumbnail: {cache_key}")
        cached_data = thumbnail_cache[cache_key]['data']
        etag = f'"{hash(cached_data["thumbnail_url"])}"'
        
        # Check ETag for 304 Not Modified
        if if_none_match and if_none_match == etag:
            return JSONResponse(
                content={},
                status_code=304,
                headers={
                    "Cache-Control": "public, max-age=3600",
                    "ETag": etag,
                    "X-Cache": "HIT-304"
                }
            )
        
        # Return cached response with cache headers
        response = JSONResponse(
            content=cached_data,
            headers={
                "Cache-Control": "public, max-age=3600",  # 1 hour browser cache
                "ETag": etag,
                "X-Cache": "HIT"
            }
        )
        return response
    
    # Initialize SmugMug service for OAuth calls
    service = SmugMugService(token.access_token, token.access_token_secret)
    
    try:
        logger.info(f"Cache miss for thumbnail: {cache_key} - fetching from SmugMug API")
        
        # Direct call to SmugMug API for album highlight image
        url = f"https://api.smugmug.com/api/v2/album/{album_key}!highlightimage"
        response = await service.oauth.make_authenticated_request(
            "GET", url, token.access_token, token.access_token_secret
        )
        
        if response and response.status_code == 200:
            data = response.json()
            
            # Extract thumbnail URL from Response.AlbumImage
            if "Response" in data and "AlbumImage" in data["Response"]:
                album_image = data["Response"]["AlbumImage"]
                thumbnail_url = album_image.get("ThumbnailUrl")
                
                if thumbnail_url:
                    response_data = {
                        "album_key": album_key,
                        "thumbnail_url": thumbnail_url
                    }
                    
                    # Cache the response
                    thumbnail_cache[cache_key] = {
                        'data': response_data,
                        'timestamp': time.time()
                    }
                    logger.info(f"Cached thumbnail data: {cache_key}")
                    
                    # Return response with cache headers
                    return JSONResponse(
                        content=response_data,
                        headers={
                            "Cache-Control": "public, max-age=3600",  # 1 hour browser cache
                            "ETag": f'"{hash(thumbnail_url)}"',
                            "X-Cache": "MISS"
                        }
                    )
        
        # If no highlight image, try to get the first image from the album as fallback
        try:
            album_data = await service.get_album_by_key(album_key)
            if album_data:
                # Try to get first image from album  
                album_uri = f"/api/v2/album/{album_key}"
                album_images = await service.get_album_images(album_uri, limit=1)
                if album_images and len(album_images) > 0:
                    first_image = album_images[0]
                    thumbnail_url = first_image.get("ThumbnailUrl")
                    if thumbnail_url:
                        response_data = {
                            "album_key": album_key,
                            "thumbnail_url": thumbnail_url,
                            "fallback": True  # Indicate this is a fallback
                        }
                        
                        # Cache the fallback response
                        thumbnail_cache[cache_key] = {
                            'data': response_data,
                            'timestamp': time.time()
                        }
                        logger.info(f"Cached fallback thumbnail data: {cache_key}")
                        
                        return JSONResponse(
                            content=response_data,
                            headers={
                                "Cache-Control": "public, max-age=3600",
                                "ETag": f'"{hash(thumbnail_url)}"',
                                "X-Cache": "MISS-FALLBACK"
                            }
                        )
        except Exception as fallback_error:
            logger.warning(f"Fallback thumbnail fetch failed for {album_key}: {fallback_error}")
        
        # Return default placeholder when no thumbnail is available
        default_response_data = {
            "album_key": album_key,
            "thumbnail_url": "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQwIiBoZWlnaHQ9IjE4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjQwIiBoZWlnaHQ9IjE4MCIgZmlsbD0iI2Y0ZjRmNCIgc3Ryb2tlPSIjZGRkIiBzdHJva2Utd2lkdGg9IjIiLz48dGV4dCB4PSIxMjAiIHk9IjkwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM2NjYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuNGVtIj5ObyBJbWFnZSBBdmFpbGFibGU8L3RleHQ+PC9zdmc+",
            "is_default": True
        }
        
        # Cache the default response
        thumbnail_cache[cache_key] = {
            'data': default_response_data,
            'timestamp': time.time()
        }
        
        return JSONResponse(
            content=default_response_data,
            headers={
                "Cache-Control": "public, max-age=3600",
                "ETag": f'"{hash("default_thumbnail")}"',
                "X-Cache": "MISS-DEFAULT"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting album thumbnail for {album_key}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get album thumbnail: {str(e)}")

@app.get("/smugmug/albums/{smugmug_album_key}/photos", response_model=List[Dict])
async def list_smugmug_album_photos(
    smugmug_album_key: str,
    db: Session = Depends(get_db)
):
    """Fetch photos from a specific SmugMug album with processing status"""
    
    # Get stored access token
    token = db.query(OAuthToken).filter_by(service="smugmug").first()
    if not token or not token.is_valid():
        raise HTTPException(status_code=401, detail="Not authenticated with SmugMug")
    
    # Initialize SmugMug service
    service = SmugMugService(token.access_token, token.access_token_secret)
    
    try:
        # Get album info directly by album key
        target_album = await service.get_album_by_key(smugmug_album_key)
        
        if not target_album:
            raise HTTPException(status_code=404, detail="Album not found in SmugMug")
        
        # Get the total image count for the album
        album_image_count = target_album.get("ImageCount", 100)  # Fallback to 100 if not available
        
        # Construct album URI from key
        album_uri = f"/api/v2/album/{smugmug_album_key}"
        
        # Fetch ALL photos from SmugMug API using the album's total image count
        smugmug_photos = await service.get_album_images(album_uri, limit=album_image_count)
        
        if not smugmug_photos:
            return []
        
        # Enhance with local processing status
        result = []
        
        for photo in smugmug_photos:
            photo_metadata = service.extract_photo_metadata(photo)
            smugmug_id = photo_metadata.get("smugmug_id", "")
            
            # Check if photo exists in local database
            local_photo = db.query(Photo).filter_by(smugmug_id=smugmug_id).first()
            
            photo_data = {
                "smugmug_id": smugmug_id,
                "smugmug_uri": photo_metadata.get("smugmug_uri", ""),
                "title": photo_metadata.get("title", ""),
                "caption": photo_metadata.get("caption", ""),
                "keywords": photo_metadata.get("keywords", []),
                "filename": photo_metadata.get("filename", ""),
                "width": photo_metadata.get("width", 0),
                "height": photo_metadata.get("height", 0),
                "image_url": photo_metadata.get("image_url", ""),
                "thumbnail_url": photo_metadata.get("thumbnail_url", ""),
                "format": photo_metadata.get("format", ""),
                "file_size": photo_metadata.get("file_size", 0)
            }
            
            if local_photo:
                # Use the Photo model's to_dict method to include all data including collections
                local_data = local_photo.to_dict(include_ai_metadata=True, include_collections=True)
                
                # Merge local database data with SmugMug data, prioritizing local data
                photo_data.update({
                    'local_photo_id': local_data['id'],
                    'processing_status': local_data['processing_status'],
                    'has_ai_metadata': local_data['has_ai_metadata'],
                    'is_synced': True,
                    'synced_at': local_data['created_at'],
                    'collections': local_data.get('collections', [])  # Include collections data
                })
                
                # Include AI metadata if available
                if local_data.get('ai_metadata'):
                    photo_data['ai_metadata'] = local_data['ai_metadata']
            else:
                photo_data.update({
                    'local_photo_id': None,
                    'processing_status': 'not_synced',
                    'has_ai_metadata': False,
                    'is_synced': False,
                    'synced_at': None,
                    'collections': []  # Empty collections array for non-synced photos
                })
            
            result.append(photo_data)
        
        return result
        
    except Exception as e:
        logger.error(f"Error fetching photos from SmugMug album {smugmug_album_key}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch photos from SmugMug: {str(e)}")

@app.post("/smugmug/albums/{smugmug_album_key}/sync")
async def sync_smugmug_album(
    smugmug_album_key: str,
    db: Session = Depends(get_db)
):
    """Sync a specific SmugMug album to local database for processing"""
    
    # Get stored access token
    token = db.query(OAuthToken).filter_by(service="smugmug").first()
    if not token or not token.is_valid():
        raise HTTPException(status_code=401, detail="Not authenticated with SmugMug")
    
    # Initialize SmugMug service
    service = SmugMugService(token.access_token, token.access_token_secret)
    
    try:
        # Get album info directly by album key
        target_album = await service.get_album_by_key(smugmug_album_key)
        
        if not target_album:
            raise HTTPException(status_code=404, detail="Album not found in SmugMug")
        
        album_uri = target_album.get("Uri", "")
        album_name = target_album.get("Name", "Untitled Album")
        
        # Check if album already exists in local database
        existing_album = db.query(Album).filter_by(smugmug_id=album_uri).first()
        
        if not existing_album:
            # Create new album in database
            new_album = Album(
                smugmug_id=album_uri,
                smugmug_uri=album_uri,
                title=album_name,
                description=target_album.get("Description", ""),
                keywords=target_album.get("Keywords", "").split(";") if target_album.get("Keywords") else [],
                photo_count=target_album.get("ImageCount", 0),
                image_count=target_album.get("ImageCount", 0),
                album_key=smugmug_album_key,
                url_name=target_album.get("UrlName", ""),
                privacy=target_album.get("Privacy", ""),
                sort_method=target_album.get("SortMethod", "")
            )
            db.add(new_album)
            db.commit()
            db.refresh(new_album)
            album_id = new_album.id
        else:
            album_id = existing_album.id
        
        # Get photos from SmugMug and sync them - sync entire album
        album_image_count = target_album.get("ImageCount", 0)
        logger.info(f"Syncing album '{album_name}' with {album_image_count} total photos")
        
        # Progress callback for large albums
        async def sync_progress(current: int, total: int):
            percent = round((current / total) * 100, 1) if total > 0 else 0
            logger.info(f"Album sync progress: {current}/{total} photos fetched ({percent}%)")
        
        photos = await service.get_album_images(album_uri, limit=album_image_count, progress_callback=sync_progress)
        synced_count = 0
        
        for photo in photos:
            photo_metadata = service.extract_photo_metadata(photo, album_name)
            smugmug_id = photo_metadata.get("smugmug_id", "")
            
            if not smugmug_id:
                continue
            
            # Check if photo already exists
            existing_photo = db.query(Photo).filter_by(smugmug_id=smugmug_id).first()
            
            if not existing_photo:
                # Create new photo
                new_photo = Photo(
                    smugmug_id=smugmug_id,
                    smugmug_uri=photo_metadata.get("smugmug_uri"),
                    image_url=photo_metadata.get("image_url"),
                    thumbnail_url=photo_metadata.get("thumbnail_url"),
                    title=photo_metadata.get("title"),
                    caption=photo_metadata.get("caption"),
                    keywords=photo_metadata.get("keywords", []),
                    album_id=album_id,
                    album_name=album_name,
                    album_uri=album_uri,
                    width=photo_metadata.get("width"),
                    height=photo_metadata.get("height"),
                    format=photo_metadata.get("format"),
                    file_size=photo_metadata.get("file_size"),
                    processing_status="not_processed"
                )
                db.add(new_photo)
                synced_count += 1
            else:
                # Update existing photo
                existing_photo.album_id = album_id
                existing_photo.image_url = photo_metadata.get("image_url") or existing_photo.image_url
                existing_photo.thumbnail_url = photo_metadata.get("thumbnail_url") or existing_photo.thumbnail_url
                synced_count += 1
        
        db.commit()
        
        logger.info(f"Album sync completed: {synced_count} photos synced to database from {len(photos)} photos fetched")
        
        return {
            "message": f"Successfully synced album '{album_name}'",
            "album_name": album_name,
            "smugmug_album_key": smugmug_album_key,
            "synced_photos": synced_count,
            "local_album_id": album_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error syncing SmugMug album {smugmug_album_key}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to sync album: {str(e)}")

# Local Database Album Management Endpoints (for processed items)
@app.get("/albums", response_model=List[Dict])
async def list_local_albums(db: Session = Depends(get_db)):
    """List locally synced albums with photo counts and processing status"""
    
    # Get albums with photo counts and processing statistics
    from sqlalchemy import func
    
    from sqlalchemy import case
    
    albums_with_stats = db.query(
        Album,
        func.count(Photo.id).label('actual_photo_count'),
        func.sum(case((Photo.processing_status == 'completed', 1), else_=0)).label('processed_count'),
        func.sum(case((Photo.ai_metadata != None, 1), else_=0)).label('ai_processed_count')
    ).outerjoin(Photo, Album.id == Photo.album_id)\
     .group_by(Album.id)\
     .all()
    
    result = []
    for album, photo_count, processed_count, ai_processed_count in albums_with_stats:
        album_dict = album.to_dict()
        album_dict.update({
            'actual_photo_count': int(photo_count or 0),
            'processed_count': int(processed_count or 0),
            'ai_processed_count': int(ai_processed_count or 0),
            'processing_progress': round((int(ai_processed_count or 0) / max(int(photo_count or 1), 1)) * 100, 1)
        })
        result.append(album_dict)
    
    return result

@app.get("/albums/{album_id}/photos", response_model=List[Dict])
async def get_album_photos(
    album_id: int,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, le=200),
    processing_status: Optional[str] = Query(default=None, regex="^(not_processed|processing|completed|failed)$"),
    db: Session = Depends(get_db)
):
    """Get photos from a specific album with optional filtering by processing status"""
    
    # Verify album exists
    album = db.query(Album).filter_by(id=album_id).first()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    
    # Build query
    query = db.query(Photo).filter_by(album_id=album_id)
    
    # Filter by processing status if specified
    if processing_status:
        query = query.filter(Photo.processing_status == processing_status)
    
    # Get photos with pagination
    photos = query.offset(skip).limit(limit).all()
    
    return [photo.to_dict() for photo in photos]

@app.get("/albums/{album_id}", response_model=Dict)
async def get_album(album_id: int, db: Session = Depends(get_db)):
    """Get single album details with statistics"""
    
    album = db.query(Album).filter_by(id=album_id).first()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    
    # Get processing statistics
    from sqlalchemy import func, case
    stats = db.query(
        func.count(Photo.id).label('total_photos'),
        func.sum(case((Photo.processing_status == 'completed', 1), else_=0)).label('processed'),
        func.sum(case((Photo.processing_status == 'processing', 1), else_=0)).label('processing'),
        func.sum(case((Photo.processing_status == 'failed', 1), else_=0)).label('failed'),
        func.sum(case((Photo.ai_metadata != None, 1), else_=0)).label('ai_processed')
    ).filter(Photo.album_id == album_id).first()
    
    album_dict = album.to_dict()
    album_dict.update({
        'total_photos': int(stats.total_photos or 0),
        'processed_photos': int(stats.processed or 0),
        'processing_photos': int(stats.processing or 0),
        'failed_photos': int(stats.failed or 0),
        'ai_processed_photos': int(stats.ai_processed or 0)
    })
    
    return album_dict

# Photo Management Endpoints
@app.post("/photos/sync")
async def sync_photos(
    limit: Optional[int] = Query(default=100, le=settings.MAX_PHOTOS_MVP),
    db: Session = Depends(get_db)
):
    """Sync photos from SmugMug to local database"""
    
    # Get stored access token
    token = db.query(OAuthToken).filter_by(service="smugmug").first()
    if not token or not token.is_valid():
        raise HTTPException(status_code=401, detail="Not authenticated with SmugMug")
    
    # Initialize SmugMug service
    service = SmugMugService(token.access_token, token.access_token_secret)
    
    # Sync photos
    photos_data = await service.sync_all_photos(limit=limit)
    
    if not photos_data:
        return {"message": "No photos found or sync failed", "synced": 0}
    
    # Save photos to database
    synced_count = 0
    for photo_data in photos_data:
        # Check if photo already exists
        existing = db.query(Photo).filter_by(smugmug_id=photo_data["smugmug_id"]).first()
        
        if not existing:
            # Create new photo
            photo = Photo(
                smugmug_id=photo_data["smugmug_id"],
                smugmug_uri=photo_data.get("smugmug_uri"),
                image_url=photo_data.get("image_url"),
                thumbnail_url=photo_data.get("thumbnail_url"),
                title=photo_data.get("title"),
                caption=photo_data.get("caption"),
                keywords=photo_data.get("keywords", []),
                album_name=photo_data.get("album_name"),
                album_uri=photo_data.get("album_uri"),
                width=photo_data.get("width"),
                height=photo_data.get("height"),
                format=photo_data.get("format"),
                file_size=photo_data.get("file_size")
            )
            db.add(photo)
            synced_count += 1
        else:
            # Update existing photo
            existing.image_url = photo_data.get("image_url") or existing.image_url
            existing.thumbnail_url = photo_data.get("thumbnail_url") or existing.thumbnail_url
            existing.title = photo_data.get("title") or existing.title
            existing.caption = photo_data.get("caption") or existing.caption
            existing.keywords = photo_data.get("keywords") or existing.keywords
            synced_count += 1
    
    db.commit()
    
    return {
        "message": f"Successfully synced {synced_count} photos",
        "synced": synced_count,
        "total_photos": db.query(Photo).count()
    }

@app.get("/photos")
async def list_photos(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, le=100),
    stats_only: bool = Query(default=False, description="Return only statistics instead of photo list"),
    smugmug_id: Optional[str] = Query(default=None, description="Filter by SmugMug ID"),
    db: Session = Depends(get_db)
):
    """List photos from database or return statistics"""
    
    if stats_only:
        # Return aggregate statistics for system info
        total_count = db.query(Photo).count()
        processed_count = db.query(Photo).filter(Photo.processing_status == 'completed').count()
        
        return {
            "total": total_count,
            "processed": processed_count
        }
    else:
        # Build query with optional filtering
        query = db.query(Photo)
        
        # Filter by SmugMug ID if provided
        if smugmug_id:
            query = query.filter(Photo.smugmug_id == smugmug_id)
        
        # Apply pagination
        photos = query.offset(skip).limit(limit).all()
        return [photo.to_dict() for photo in photos]

@app.get("/photos/{photo_id}")
async def get_photo(photo_id: int, db: Session = Depends(get_db)):
    """Get single photo by ID"""
    photo = db.query(Photo).filter_by(id=photo_id).first()
    
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    photo_dict = photo.to_dict()
    
    # Include AI metadata if available
    if photo.ai_metadata:
        photo_dict["ai_metadata"] = photo.ai_metadata.to_dict()
    
    return photo_dict

@app.delete("/photos/{photo_id}")
async def delete_photo(photo_id: int, db: Session = Depends(get_db)):
    """Delete a photo from database"""
    photo = db.query(Photo).filter_by(id=photo_id).first()
    
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    db.delete(photo)
    db.commit()
    
    return {"message": "Photo deleted successfully"}

# AI Processing Endpoints
@app.post("/photos/{photo_id}/process")
async def process_photo(
    photo_id: int, 
    provider: str = Query(default="anthropic", regex="^(anthropic|openai)$"),
    anthropic_key: Optional[str] = Header(default=None, alias="X-Anthropic-Key"),
    openai_key: Optional[str] = Header(default=None, alias="X-OpenAI-Key"),
    db: Session = Depends(get_db)
):
    """Process a single photo with AI analysis using specified provider and API keys"""
    
    # Check if photo exists
    photo = db.query(Photo).filter_by(id=photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    # Check if already processed
    existing = db.query(AIMetadata).filter_by(photo_id=photo_id).first()
    if existing:
        return {
            "message": "Photo already processed",
            "ai_metadata": existing.to_dict()
        }
    
    try:
        # Create AI processor with user's API keys
        processor = AIProcessor(
            anthropic_api_key=anthropic_key,
            openai_api_key=openai_key
        )
        
        # Process the photo
        result = await processor.process_photo(photo_id, provider)
        
        if result:
            return {
                "message": "Photo processed successfully",
                "ai_metadata": result
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to process photo")
            
    except Exception as e:
        logger.error(f"Error processing photo {photo_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

@app.post("/photos/process/batch")
async def process_photos_batch(
    photo_ids: List[int],
    max_concurrent: int = Query(default=3, le=5),
    provider: str = Query(default="anthropic", regex="^(anthropic|openai)$"),
    anthropic_key: Optional[str] = Header(default=None, alias="X-Anthropic-Key"),
    openai_key: Optional[str] = Header(default=None, alias="X-OpenAI-Key"),
    db: Session = Depends(get_db)
):
    """Process multiple photos in batch using specified provider and API keys"""
    
    # Validate photo IDs exist
    existing_photos = db.query(Photo.id).filter(Photo.id.in_(photo_ids)).all()
    existing_ids = [p.id for p in existing_photos]
    
    if not existing_ids:
        raise HTTPException(status_code=404, detail="No valid photos found")
    
    try:
        # Create AI processor with user's API keys
        processor = AIProcessor(
            anthropic_api_key=anthropic_key,
            openai_api_key=openai_key
        )
        
        # Add to processing queue (using default processor for queue management)
        await ai_processor.add_to_processing_queue(existing_ids)
        
        # Process batch with user's configured processor
        async def process_single_with_provider(photo_id: int):
            try:
                return await processor.process_photo(photo_id, provider)
            except Exception as e:
                logger.error(f"Failed to process photo {photo_id}: {e}")
                return {"photo_id": photo_id, "error": str(e)}
        
        # Process in batches to respect rate limits
        results = []
        for i in range(0, len(existing_ids), max_concurrent):
            batch = existing_ids[i:i + max_concurrent]
            
            # Process batch concurrently
            import asyncio
            batch_tasks = [process_single_with_provider(photo_id) for photo_id in batch]
            batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)
            
            results.extend(batch_results)
            
            # Rate limiting - wait between batches
            if i + max_concurrent < len(existing_ids):
                await asyncio.sleep(2)  # 2 second delay between batches
        
        successful = len([r for r in results if r and "error" not in r])
        
        return {
            "message": f"Batch processing completed: {successful}/{len(existing_ids)} successful",
            "processed": successful,
            "total": len(existing_ids),
            "results": results
        }
        
    except Exception as e:
        logger.error(f"Error in batch processing: {e}")
        raise HTTPException(status_code=500, detail=f"Batch processing failed: {str(e)}")

@app.get("/photos/process/queue")
async def get_processing_queue_status():
    """Get current processing queue status"""
    
    try:
        status = await ai_processor.get_queue_status()
        return status
    except Exception as e:
        logger.error(f"Error getting queue status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get queue status")

@app.post("/photos/update-status")
async def update_photos_processing_status(
    photo_ids: List[int],
    status: str = Query(..., regex="^(not_processed|processing|completed|failed)$"),
    db: Session = Depends(get_db)
):
    """Update processing status for multiple photos"""
    
    # Validate photos exist
    photos = db.query(Photo).filter(Photo.id.in_(photo_ids)).all()
    if not photos:
        raise HTTPException(status_code=404, detail="No photos found")
    
    # Update status
    from sqlalchemy import func
    updated_count = 0
    for photo in photos:
        photo.processing_status = status
        photo.updated_at = func.now()
        updated_count += 1
    
    db.commit()
    
    return {
        "message": f"Updated processing status for {updated_count} photos",
        "updated_count": updated_count,
        "status": status
    }

@app.post("/photos/process/queue/add")
async def add_to_queue(
    photo_ids: List[int],
    priority: int = Query(default=0, ge=0, le=10),
    db: Session = Depends(get_db)
):
    """Add photos to processing queue"""
    
    # Validate photo IDs
    existing_photos = db.query(Photo.id).filter(Photo.id.in_(photo_ids)).all()
    existing_ids = [p.id for p in existing_photos]
    
    if not existing_ids:
        raise HTTPException(status_code=404, detail="No valid photos found")
    
    try:
        await ai_processor.add_to_processing_queue(existing_ids, priority)
        
        return {
            "message": f"Added {len(existing_ids)} photos to processing queue",
            "added": len(existing_ids)
        }
        
    except Exception as e:
        logger.error(f"Error adding to queue: {e}")
        raise HTTPException(status_code=500, detail="Failed to add to queue")

# Search Endpoints
@app.get("/search")
async def search_photos(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(default=20, le=50),
    search_type: str = Query(default="hybrid", regex="^(text|vector|hybrid)$"),
    album: Optional[str] = Query(default=None, description="Filter by album name or ID"),
    processing_status: Optional[str] = Query(default=None, description="Filter by processing status"),
    date_from: Optional[str] = Query(default=None, description="Filter photos from date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(default=None, description="Filter photos to date (YYYY-MM-DD)")
):
    """Search photos using text or vector similarity with optional filters"""
    
    def apply_search_filters(photos_query, album_filter=None, status_filter=None, date_from_filter=None, date_to_filter=None):
        """Apply filters to a Photo query"""
        if album_filter:
            # Try to find album by name first, then by ID
            album_obj = photos_query.session.query(Album).filter(
                (Album.title.ilike(f"%{album_filter}%")) | 
                (Album.id == album_filter if album_filter.isdigit() else False)
            ).first()
            if album_obj:
                photos_query = photos_query.filter(Photo.album_id == album_obj.id)
        
        if status_filter:
            photos_query = photos_query.filter(Photo.processing_status == status_filter)
        
        if date_from_filter:
            try:
                date_from = datetime.strptime(date_from_filter, "%Y-%m-%d")
                photos_query = photos_query.filter(Photo.created_at >= date_from)
            except ValueError:
                pass  # Invalid date format, skip filter
        
        if date_to_filter:
            try:
                date_to = datetime.strptime(date_to_filter, "%Y-%m-%d")
                photos_query = photos_query.filter(Photo.created_at <= date_to)
            except ValueError:
                pass  # Invalid date format, skip filter
        
        return photos_query
    
    try:
        if search_type == "vector":
            # For vector search, we'll need to implement filtering separately
            results = await vector_search.search_by_text(q, limit)
            # TODO: Apply filters to vector search results
        elif search_type == "text":
            # Enhanced text search implementation with filters
            db = next(get_db())
            try:
                query_lower = q.lower()
                
                # Start with a base query that includes filters
                base_query = db.query(Photo).join(AIMetadata, Photo.id == AIMetadata.photo_id)
                filtered_query = apply_search_filters(
                    base_query, album, processing_status, date_from, date_to
                )
                
                # Get metadata records that match filters
                metadata_records = db.query(AIMetadata).join(Photo).filter(
                    Photo.id.in_([photo.id for photo in filtered_query])
                ).all()
                
                # Search in AI metadata and photo metadata
                photos = []
                
                for metadata in metadata_records:
                    score = 0.0
                    
                    # Search in description
                    if metadata.description and query_lower in metadata.description.lower():
                        score += 1.0
                    
                    # Search in keywords
                    if metadata.ai_keywords:
                        for keyword in metadata.ai_keywords:
                            if query_lower in keyword.lower():
                                score += 0.5
                    
                    # Search in photo title and filename
                    if metadata.photo:
                        if metadata.photo.title and query_lower in metadata.photo.title.lower():
                            score += 0.8
                        if metadata.photo.filename and query_lower in metadata.photo.filename.lower():
                            score += 0.6
                    
                    if score > 0 and metadata.photo:
                        # Use the enhanced photo.to_dict() which includes AI metadata
                        photo_dict = metadata.photo.to_dict(include_ai_metadata=True)
                        photo_dict["search_score"] = score
                        photos.append(photo_dict)
                
                # Sort by score
                photos.sort(key=lambda x: x["search_score"], reverse=True)
                results = photos[:limit]
                
            finally:
                db.close()
                
        else:  # hybrid
            # For hybrid search, we'll also need to implement filtering
            results = await hybrid_search.search(q, limit)
            # TODO: Apply filters to hybrid search results
        
        return {
            "query": q,
            "search_type": search_type,
            "results": len(results),
            "photos": results,
            "filters": {
                "album": album,
                "processing_status": processing_status,
                "date_from": date_from,
                "date_to": date_to
            }
        }
        
    except Exception as e:
        logger.error(f"Error in search: {e}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

@app.get("/photos/{photo_id}/similar")
async def find_similar_photos(
    photo_id: int,
    limit: int = Query(default=10, le=20),
    db: Session = Depends(get_db)
):
    """Find photos similar to the given photo"""
    
    # Check if photo exists
    photo = db.query(Photo).filter_by(id=photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    try:
        results = await vector_search.search_similar_images(photo_id, limit)
        
        return {
            "photo_id": photo_id,
            "similar_photos": len(results),
            "results": results
        }
        
    except Exception as e:
        logger.error(f"Error finding similar photos: {e}")
        raise HTTPException(status_code=500, detail=f"Similar photo search failed: {str(e)}")

# Metadata Management Endpoints
@app.get("/metadata/{photo_id}")
async def get_ai_metadata(photo_id: int, db: Session = Depends(get_db)):
    """Get AI metadata for a photo"""
    
    metadata = db.query(AIMetadata).filter_by(photo_id=photo_id).first()
    if not metadata:
        raise HTTPException(status_code=404, detail="AI metadata not found")
    
    return metadata.to_dict()

@app.put("/metadata/{photo_id}")
async def update_ai_metadata(
    photo_id: int,
    description: Optional[str] = None,
    ai_keywords: Optional[List[str]] = None,
    approved: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    """Update AI metadata for a photo"""
    
    metadata = db.query(AIMetadata).filter_by(photo_id=photo_id).first()
    if not metadata:
        raise HTTPException(status_code=404, detail="AI metadata not found")
    
    # Update fields if provided
    if description is not None:
        metadata.description = description
    if ai_keywords is not None:
        metadata.ai_keywords = ai_keywords
    if approved is not None:
        metadata.approved = approved
        if approved:
            metadata.approved_at = datetime.now()
    
    db.commit()
    db.refresh(metadata)
    
    return {
        "message": "Metadata updated successfully",
        "metadata": metadata.to_dict()
    }

@app.post("/metadata/{photo_id}/approve")
async def approve_ai_metadata(photo_id: int, db: Session = Depends(get_db)):
    """Approve AI-generated metadata"""
    
    metadata = db.query(AIMetadata).filter_by(photo_id=photo_id).first()
    if not metadata:
        raise HTTPException(status_code=404, detail="AI metadata not found")
    
    metadata.approved = True
    metadata.approved_at = datetime.now()
    
    db.commit()
    
    return {
        "message": "Metadata approved successfully",
        "photo_id": photo_id
    }

# Settings Endpoints
@app.get("/settings/prompt")
async def get_ai_prompt():
    """Get the current AI processing prompt"""
    try:
        # For now, store in a simple file or return default
        # In production, this could be stored in the database
        prompt_file = "custom_prompt.txt"
        
        if os.path.exists(prompt_file):
            with open(prompt_file, 'r', encoding='utf-8') as f:
                custom_prompt = f.read().strip()
            return {
                "prompt": custom_prompt,
                "is_custom": True
            }
        else:
            # Return the default prompt from ai_processor
            default_prompt = """Analyze this image and provide a detailed description focusing on the main subjects, actions, and context. Then extract relevant keywords.

Return your response as a JSON object with these fields:
- "description": A detailed description of what you see in the image
- "keywords": An array of relevant keywords that describe the image content

Focus on:
- Main subjects and people
- Actions being performed
- Objects and equipment visible
- Setting and environment
- Events or activities
- Emotions or mood if apparent

Do not include speculation about metadata like camera settings, date, or photographer information."""
            
            return {
                "prompt": default_prompt,
                "is_custom": False
            }
    except Exception as e:
        logger.error(f"Error getting AI prompt: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/settings/prompt")
async def save_ai_prompt(prompt_data: Dict):
    """Save a custom AI processing prompt"""
    try:
        prompt = prompt_data.get("prompt", "").strip()
        
        if not prompt:
            raise HTTPException(status_code=400, detail="Prompt cannot be empty")
        
        # Save to file
        prompt_file = "custom_prompt.txt"
        with open(prompt_file, 'w', encoding='utf-8') as f:
            f.write(prompt)
        
        logger.info("Custom AI prompt saved successfully")
        return {"message": "Prompt saved successfully", "is_custom": True}
        
    except Exception as e:
        logger.error(f"Error saving AI prompt: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/settings/prompt")
async def reset_ai_prompt():
    """Reset to default AI processing prompt"""
    try:
        prompt_file = "custom_prompt.txt"
        
        if os.path.exists(prompt_file):
            os.remove(prompt_file)
        
        logger.info("AI prompt reset to default")
        return {"message": "Prompt reset to default", "is_custom": False}
        
    except Exception as e:
        logger.error(f"Error resetting AI prompt: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/settings/test-api-key")
async def test_api_key(request: APIKeyTestRequest):
    """Test if an API key is valid for the specified provider"""
    try:
        provider = request.provider.lower()
        api_key = request.api_key
        
        if provider == "anthropic":
            return await test_anthropic_key(api_key)
        elif provider == "openai":
            return await test_openai_key(api_key)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported provider: {provider}")
            
    except Exception as e:
        logger.error(f"Error testing API key for {request.provider}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def test_anthropic_key(api_key: str):
    """Test Anthropic API key by making a simple request"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "content-type": "application/json",
                    "anthropic-version": "2023-06-01"
                },
                json={
                    "model": "claude-3-haiku-20240307",
                    "max_tokens": 10,
                    "messages": [{"role": "user", "content": "Hello"}]
                },
                timeout=10.0
            )
            
        if response.status_code == 200:
            return {"success": True, "message": "Anthropic API key is valid"}
        else:
            error_detail = response.json().get("error", {}).get("message", "Invalid API key")
            return {"success": False, "error": error_detail}
            
    except httpx.TimeoutException:
        return {"success": False, "error": "Request timed out"}
    except Exception as e:
        return {"success": False, "error": str(e)}

async def test_openai_key(api_key: str):
    """Test OpenAI API key by making a simple request"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "gpt-4o-mini",
                    "messages": [{"role": "user", "content": "Hello"}],
                    "max_tokens": 10
                },
                timeout=10.0
            )
            
        if response.status_code == 200:
            return {"success": True, "message": "OpenAI API key is valid"}
        else:
            error_detail = response.json().get("error", {}).get("message", "Invalid API key")
            return {"success": False, "error": error_detail}
            
    except httpx.TimeoutException:
        return {"success": False, "error": "Request timed out"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/settings/test-image-analysis")
async def test_image_analysis(
    image: UploadFile = File(...),
    provider: str = Form(...),
    anthropic_key: Optional[str] = Header(default=None, alias="X-Anthropic-Key"),
    openai_key: Optional[str] = Header(default=None, alias="X-OpenAI-Key")
):
    """Test image analysis with the specified provider"""
    try:
        # Validate image file
        if not image.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # Read image data
        image_data = await image.read()
        
        start_time = time.time()
        
        # Create AI processor with user's API keys
        processor = AIProcessor(
            anthropic_api_key=anthropic_key,
            openai_api_key=openai_key
        )
        
        # Generate description using the processor
        description, keywords, processing_time, prompt = await processor.generate_description(
            image_data, provider.lower()
        )
        
        return {
            "success": True,
            "provider": provider,
            "prompt_used": prompt,
            "analysis": {
                "description": description,
                "keywords": keywords
            },
            "processing_time": round(processing_time, 2)
        }
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        logger.error(f"Error in test image analysis with {provider}: {e}")
        logger.error(f"Full traceback: {error_details}")
        
        # Provide user-friendly error messages
        error_message = str(e)
        if "429 Too Many Requests" in error_message:
            error_message = "Rate limit exceeded. Please wait a moment before trying again, or check your API usage limits."
        elif "401" in error_message or "unauthorized" in error_message.lower():
            error_message = "Invalid API key. Please check your API key configuration."
        elif "insufficient_quota" in error_message.lower():
            error_message = "Insufficient API credits. Please check your account balance."
        elif "api key not configured" in error_message.lower():
            error_message = f"Please configure your {provider.title()} API key in the settings."
        
        raise HTTPException(status_code=500, detail=error_message)

async def analyze_with_anthropic(image_base64: str, content_type: str, api_key: str = None):
    """Analyze image using Anthropic Claude Vision"""
    # In a real implementation, you'd get the API key from secure storage or headers
    # For this demo, we'll use environment variables as fallback
    api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
    
    if not api_key:
        raise HTTPException(status_code=400, detail="Anthropic API key not configured")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "content-type": "application/json",
                    "anthropic-version": "2023-06-01"
                },
                json={
                    "model": "claude-3-sonnet-20240229",
                    "max_tokens": 500,
                    "messages": [{
                        "role": "user",
                        "content": [{
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": content_type,
                                "data": image_base64
                            }
                        }, {
                            "type": "text",
                            "text": "Analyze this image and provide a detailed description and relevant keywords. Return your response as a JSON object with 'description' and 'keywords' fields, where keywords is an array of strings."
                        }]
                    }]
                },
                timeout=30.0
            )
            
        if response.status_code != 200:
            error_detail = response.json().get("error", {}).get("message", "API request failed")
            raise HTTPException(status_code=400, detail=error_detail)
        
        result = response.json()
        content = result["content"][0]["text"]
        
        # Try to parse as JSON, fallback to structured response
        try:
            import json
            parsed = json.loads(content)
            return parsed
        except:
            return {
                "description": content,
                "keywords": ["image", "analysis", "test"]
            }
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=408, detail="Request timed out")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def analyze_with_openai(image_base64: str, content_type: str, api_key: str = None):
    """Analyze image using OpenAI GPT-4 Vision"""
    # In a real implementation, you'd get the API key from secure storage or headers
    api_key = api_key or os.getenv("OPENAI_API_KEY")
    
    if not api_key:
        raise HTTPException(status_code=400, detail="OpenAI API key not configured")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "gpt-4o",
                    "messages": [{
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": "Analyze this image and provide a detailed description and relevant keywords. Return your response as a JSON object with 'description' and 'keywords' fields, where keywords is an array of strings."
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:{content_type};base64,{image_base64}"
                                }
                            }
                        ]
                    }],
                    "max_tokens": 500
                },
                timeout=30.0
            )
            
        if response.status_code != 200:
            error_detail = response.json().get("error", {}).get("message", "API request failed")
            raise HTTPException(status_code=400, detail=error_detail)
        
        result = response.json()
        content = result["choices"][0]["message"]["content"]
        
        # Try to parse as JSON, fallback to structured response
        try:
            import json
            parsed = json.loads(content)
            return parsed
        except:
            return {
                "description": content,
                "keywords": ["image", "analysis", "test"]
            }
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=408, detail="Request timed out")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Collections API Endpoints
@app.get("/collections", response_model=List[Dict])
async def list_collections(db: Session = Depends(get_db)):
    """List all collections"""
    
    collections = db.query(Collection).order_by(Collection.created_at.desc()).all()
    
    return [collection.to_dict() for collection in collections]

@app.post("/collections", response_model=Dict)
async def create_collection(
    name: str = Query(..., min_length=1, max_length=255),
    description: Optional[str] = Query(default=None),
    db: Session = Depends(get_db)
):
    """Create a new collection"""
    
    # Check if collection with same name already exists
    existing = db.query(Collection).filter(Collection.name == name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Collection with this name already exists")
    
    # Create new collection
    collection = Collection(
        name=name,
        description=description
    )
    
    db.add(collection)
    db.commit()
    db.refresh(collection)
    
    return {
        "message": "Collection created successfully",
        "collection": collection.to_dict()
    }

@app.get("/collections/{collection_id}", response_model=Dict)
async def get_collection(
    collection_id: int, 
    include_photos: bool = Query(default=True),
    db: Session = Depends(get_db)
):
    """Get collection details with photos"""
    
    collection = db.query(Collection).filter(Collection.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    return collection.to_dict(include_photos=include_photos)

@app.put("/collections/{collection_id}", response_model=Dict)
async def update_collection(
    collection_id: int,
    name: Optional[str] = Query(default=None, min_length=1, max_length=255),
    description: Optional[str] = Query(default=None),
    db: Session = Depends(get_db)
):
    """Update collection name or description"""
    
    collection = db.query(Collection).filter(Collection.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    # Check if new name conflicts with existing collection (if name is being changed)
    if name and name != collection.name:
        existing = db.query(Collection).filter(Collection.name == name).first()
        if existing:
            raise HTTPException(status_code=400, detail="Collection with this name already exists")
        collection.name = name
    
    if description is not None:
        collection.description = description
    
    db.commit()
    db.refresh(collection)
    
    return {
        "message": "Collection updated successfully",
        "collection": collection.to_dict()
    }

@app.delete("/collections/{collection_id}")
async def delete_collection(collection_id: int, db: Session = Depends(get_db)):
    """Delete a collection"""
    
    collection = db.query(Collection).filter(Collection.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    collection_name = collection.name
    db.delete(collection)
    db.commit()
    
    return {
        "message": f"Collection '{collection_name}' deleted successfully"
    }

@app.post("/collections/{collection_id}/photos", response_model=Dict)
async def add_photos_to_collection(
    collection_id: int,
    request_data: Dict,
    db: Session = Depends(get_db)
):
    """Add photos to a collection"""
    
    # Extract photo_ids from request data
    photo_ids = request_data.get("photo_ids", [])
    if not photo_ids:
        raise HTTPException(status_code=400, detail="photo_ids required")
    
    # Verify collection exists
    collection = db.query(Collection).filter(Collection.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    # Verify photos exist
    existing_photos = db.query(Photo.id).filter(Photo.id.in_(photo_ids)).all()
    existing_photo_ids = [p.id for p in existing_photos]
    
    if not existing_photo_ids:
        raise HTTPException(status_code=404, detail="No valid photos found")
    
    # Add photos to collection (ignore duplicates)
    added_count = 0
    skipped_count = 0
    
    for photo_id in existing_photo_ids:
        # Check if photo is already in collection
        existing_item = db.query(CollectionItem).filter(
            CollectionItem.collection_id == collection_id,
            CollectionItem.photo_id == photo_id
        ).first()
        
        if not existing_item:
            collection_item = CollectionItem(
                collection_id=collection_id,
                photo_id=photo_id
            )
            db.add(collection_item)
            added_count += 1
        else:
            skipped_count += 1
    
    db.commit()
    
    return {
        "message": f"Added {added_count} photos to collection '{collection.name}'",
        "added": added_count,
        "skipped": skipped_count,
        "total_requested": len(photo_ids)
    }

@app.delete("/collections/{collection_id}/photos/{photo_id}")
async def remove_photo_from_collection(
    collection_id: int, 
    photo_id: int, 
    db: Session = Depends(get_db)
):
    """Remove a photo from a collection"""
    
    # Find the collection item
    collection_item = db.query(CollectionItem).filter(
        CollectionItem.collection_id == collection_id,
        CollectionItem.photo_id == photo_id
    ).first()
    
    if not collection_item:
        raise HTTPException(status_code=404, detail="Photo not found in this collection")
    
    # Get collection name for response
    collection = db.query(Collection).filter(Collection.id == collection_id).first()
    collection_name = collection.name if collection else "Collection"
    
    db.delete(collection_item)
    db.commit()
    
    return {
        "message": f"Photo removed from collection '{collection_name}'"
    }

@app.put("/collections/{collection_id}/cover")
async def set_collection_cover(
    collection_id: int,
    photo_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """Set the cover photo for a collection"""
    
    # Verify collection exists
    collection = db.query(Collection).filter(Collection.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    # Verify photo exists and is in the collection
    collection_item = db.query(CollectionItem).filter(
        CollectionItem.collection_id == collection_id,
        CollectionItem.photo_id == photo_id
    ).first()
    
    if not collection_item:
        raise HTTPException(status_code=400, detail="Photo must be in the collection to be set as cover")
    
    # Update collection cover
    collection.cover_photo_id = photo_id
    db.commit()
    db.refresh(collection)
    
    return {
        "message": f"Cover photo set for collection '{collection.name}'",
        "collection": collection.to_dict()
    }

@app.get("/photos/{photo_id}/collections", response_model=List[Dict])
async def get_photo_collections(photo_id: int, db: Session = Depends(get_db)):
    """Get all collections that contain a specific photo"""
    
    # Verify photo exists
    photo = db.query(Photo).filter(Photo.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    # Get collection items for this photo
    collection_items = db.query(CollectionItem).filter(
        CollectionItem.photo_id == photo_id
    ).all()
    
    collections = []
    for item in collection_items:
        if item.collection:
            collection_data = item.collection.to_dict()
            collection_data["added_at"] = item.added_at.isoformat() if item.added_at else None
            collections.append(collection_data)
    
    return collections

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True if os.getenv("DEBUG") == "true" else False
    )