"""SmugMug Node Hierarchy Service for managing folders and albums"""

import asyncio
import json
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
import logging
from dataclasses import dataclass, asdict

logger = logging.getLogger(__name__)


@dataclass
class NodeInfo:
    """Represents a node in the SmugMug hierarchy"""
    node_id: str
    parent_id: Optional[str]
    name: str
    type: str  # 'Folder' or 'Album'
    path: str
    level: int
    album_key: Optional[str] = None
    url_path: Optional[str] = None
    description: Optional[str] = None
    image_count: Optional[int] = None
    thumbnail_url: Optional[str] = None
    children: List['NodeInfo'] = None
    
    def __post_init__(self):
        if self.children is None:
            self.children = []
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        data = {
            'node_id': self.node_id,
            'parent_id': self.parent_id,
            'name': self.name,
            'type': self.type,
            'path': self.path,
            'level': self.level,
            'album_key': self.album_key,
            'url_path': self.url_path,
            'description': self.description,
            'image_count': self.image_count,
            'thumbnail_url': self.thumbnail_url,
            'children': [child.to_dict() for child in self.children] if self.children else []
        }
        return data


class SmugMugNodeService:
    """Service for managing SmugMug node hierarchy (folders and albums)"""
    
    def __init__(self, smugmug_api):
        """Initialize with SmugMug API client"""
        self.api = smugmug_api
        self.node_cache = {}
        self.hierarchy_cache = None
        self.cache_timestamp = None
        self.CACHE_DURATION = 3600  # 1 hour cache
    
    def _build_path(self, parent_path: str, node_name: str) -> str:
        """Build full path for a node"""
        if parent_path:
            return f"{parent_path}/{node_name}"
        return node_name
    
    async def get_user_root_node(self, username: str) -> Dict[str, Any]:
        """Get the root node for a user"""
        try:
            # Get user info which includes root node
            result = await self.api._make_request(
                f"/user/{username}",
                expand=['Node']
            )
            
            user_data = result.get('User', {})
            node_data = user_data.get('Node', {})
            
            if not node_data:
                # If Node not expanded, fetch it separately
                node_uri = user_data.get('Uris', {}).get('Node', {}).get('Uri')
                if node_uri:
                    # Extract node ID from URI
                    node_id = node_uri.split('/')[-1]
                    node_data = await self.get_node_details(node_id)
            
            return node_data
            
        except Exception as e:
            logger.error(f"Failed to get root node for user {username}: {e}")
            raise
    
    async def get_node_details(self, node_id: str) -> Dict[str, Any]:
        """Get details for a specific node"""
        try:
            # Check cache first
            if node_id in self.node_cache:
                return self.node_cache[node_id]
            
            result = await self.api._make_request(
                f"/node/{node_id}",
                expand=['ChildNodes', 'HighlightImage']
            )
            
            node_data = result.get('Node', {})
            self.node_cache[node_id] = node_data
            return node_data
            
        except Exception as e:
            logger.error(f"Failed to get node details for {node_id}: {e}")
            raise
    
    async def get_node_children(
        self,
        node_id: str,
        include_albums: bool = True,
        include_folders: bool = True
    ) -> List[Dict[str, Any]]:
        """Get children of a node (folders and/or albums)"""
        try:
            all_children = []
            start = 0
            count = 100
            
            while True:
                result = await self.api._make_request(
                    f"/node/{node_id}!children",
                    params={
                        'count': count,
                        'start': start
                    },
                    expand=['HighlightImage']
                )
                
                nodes = result.get('Node', [])
                if not nodes:
                    break
                
                # Filter by type if requested
                for node in nodes:
                    node_type = node.get('Type', '')
                    if (node_type == 'Album' and include_albums) or \
                       (node_type == 'Folder' and include_folders):
                        all_children.append(node)
                
                if len(nodes) < count:
                    break
                
                start += count
            
            return all_children
            
        except Exception as e:
            logger.error(f"Failed to get children for node {node_id}: {e}")
            return []
    
    async def build_node_hierarchy(
        self,
        username: str,
        max_depth: int = 5,
        include_empty_folders: bool = True
    ) -> NodeInfo:
        """Build complete node hierarchy for a user"""
        
        # Check cache
        current_time = datetime.utcnow()
        if self.hierarchy_cache and self.cache_timestamp:
            cache_age = (current_time - self.cache_timestamp).total_seconds()
            if cache_age < self.CACHE_DURATION:
                logger.info("Using cached hierarchy")
                return self.hierarchy_cache
        
        logger.info(f"Building node hierarchy for user {username}")
        
        # Get root node
        root_data = await self.get_user_root_node(username)
        if not root_data:
            raise ValueError(f"Could not find root node for user {username}")
        
        # Build hierarchy recursively
        root_node = await self._build_node_recursive(
            node_data=root_data,
            parent_path="",
            level=0,
            max_depth=max_depth,
            include_empty_folders=include_empty_folders
        )
        
        # Cache the result
        self.hierarchy_cache = root_node
        self.cache_timestamp = current_time
        
        logger.info(f"Built hierarchy with {self._count_nodes(root_node)} total nodes")
        return root_node
    
    async def _build_node_recursive(
        self,
        node_data: Dict[str, Any],
        parent_path: str,
        level: int,
        max_depth: int,
        include_empty_folders: bool,
        parent_id: Optional[str] = None
    ) -> NodeInfo:
        """Recursively build node hierarchy"""
        
        node_id = node_data.get('NodeID', '')
        node_name = node_data.get('Name', 'Untitled')
        node_type = node_data.get('Type', 'Folder')
        
        # Build node info
        node_info = NodeInfo(
            node_id=node_id,
            parent_id=parent_id,
            name=node_name,
            type=node_type,
            path=self._build_path(parent_path, node_name),
            level=level,
            url_path=node_data.get('UrlPath'),
            description=node_data.get('Description')
        )
        
        # Add album-specific info
        if node_type == 'Album':
            node_info.album_key = node_data.get('Uris', {}).get('Album', {}).get('Uri', '').split('/')[-1]
            node_info.image_count = node_data.get('ImageCount', 0)
            
            # Get thumbnail from highlight image
            highlight = node_data.get('Uris', {}).get('HighlightImage')
            if highlight:
                node_info.thumbnail_url = highlight.get('Image', {}).get('Uris', {}).get('ThumbnailUrl')
        
        # Get children if it's a folder and we haven't reached max depth
        if node_type == 'Folder' and level < max_depth:
            children = await self.get_node_children(node_id)
            
            for child_data in children:
                child_node = await self._build_node_recursive(
                    node_data=child_data,
                    parent_path=node_info.path,
                    level=level + 1,
                    max_depth=max_depth,
                    include_empty_folders=include_empty_folders,
                    parent_id=node_id
                )
                
                # Skip empty folders if requested
                if child_node.type == 'Folder' and not include_empty_folders:
                    if not child_node.children:
                        continue
                
                node_info.children.append(child_node)
        
        return node_info
    
    def _count_nodes(self, node: NodeInfo) -> int:
        """Count total nodes in hierarchy"""
        count = 1
        for child in node.children:
            count += self._count_nodes(child)
        return count
    
    async def search_nodes(
        self,
        hierarchy: NodeInfo,
        query: str,
        node_type: Optional[str] = None
    ) -> List[NodeInfo]:
        """Search for nodes in hierarchy by name"""
        results = []
        query_lower = query.lower()
        
        def search_recursive(node: NodeInfo):
            # Check if node matches
            if query_lower in node.name.lower():
                if not node_type or node.type == node_type:
                    results.append(node)
            
            # Search children
            for child in node.children:
                search_recursive(child)
        
        search_recursive(hierarchy)
        return results
    
    def get_node_by_path(self, hierarchy: NodeInfo, path: str) -> Optional[NodeInfo]:
        """Get a node by its path"""
        path_parts = path.strip('/').split('/')
        current = hierarchy
        
        for part in path_parts:
            if not part:
                continue
            
            found = False
            for child in current.children:
                if child.name == part:
                    current = child
                    found = True
                    break
            
            if not found:
                return None
        
        return current
    
    def get_breadcrumb_path(self, hierarchy: NodeInfo, node_id: str) -> List[Tuple[str, str]]:
        """Get breadcrumb path to a node (list of (name, node_id) tuples)"""
        path = []
        
        def find_path_recursive(node: NodeInfo, target_id: str, current_path: List[Tuple[str, str]]) -> bool:
            current_path.append((node.name, node.node_id))
            
            if node.node_id == target_id:
                path.extend(current_path)
                return True
            
            for child in node.children:
                if find_path_recursive(child, target_id, current_path.copy()):
                    return True
            
            return False
        
        find_path_recursive(hierarchy, node_id, [])
        return path
    
    def flatten_hierarchy(self, hierarchy: NodeInfo, albums_only: bool = False) -> List[NodeInfo]:
        """Flatten hierarchy to a list of all nodes"""
        flat_list = []
        
        def flatten_recursive(node: NodeInfo):
            if not albums_only or node.type == 'Album':
                flat_list.append(node)
            
            for child in node.children:
                flatten_recursive(child)
        
        flatten_recursive(hierarchy)
        return flat_list
    
    def clear_cache(self):
        """Clear all cached data"""
        self.node_cache.clear()
        self.hierarchy_cache = None
        self.cache_timestamp = None
        logger.info("Node cache cleared")