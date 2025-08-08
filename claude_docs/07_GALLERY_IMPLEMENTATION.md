# Gallery Implementation Guide

## Overview
The gallery provides a macOS Finder-style interface for browsing SmugMug photos with nested folder structures and album organization.

---

## Architecture

### Components Structure
```
frontend/components/
├── FinderGallery.tsx    # Main gallery container
├── FolderTree.tsx        # Left panel - folder hierarchy
├── AlbumGrid.tsx         # Right panel - album thumbnails
└── PhotoViewer.tsx       # Lightbox photo viewer
```

### Backend Services
```
backend/
├── api/gallery.py              # Gallery API endpoints
└── services/smugmug_nodes.py   # Node hierarchy service
```

---

## Implementation Details

### 1. Node Hierarchy System

SmugMug uses a node-based system where both folders and albums are "nodes":

```python
# services/smugmug_nodes.py
@dataclass
class NodeInfo:
    node_id: str
    parent_id: Optional[str]
    name: str
    type: str  # 'Folder' or 'Album'
    path: str
    level: int
    album_key: Optional[str] = None
    children: List['NodeInfo'] = None
```

### 2. API Endpoints

```python
# api/gallery.py

@router.get("/tree")
# Returns complete folder/album hierarchy

@router.get("/node/{node_id}")  
# Get specific node details

@router.get("/node/{node_id}/children")
# Get node's children (folders/albums)

@router.get("/album/{album_key}/images")
# Get photos in an album

@router.post("/sync")
# Trigger hierarchy sync from SmugMug

@router.get("/search")
# Search nodes by name

@router.get("/breadcrumb/{node_id}")
# Get breadcrumb path to node
```

### 3. Frontend Components

#### FinderGallery (Main Container)
- Split panel layout
- Manages selected node state
- Handles breadcrumb navigation
- Search functionality

#### FolderTree (Left Panel)
- Recursive tree structure
- Expand/collapse functionality
- Visual indicators for folders vs albums
- Shows photo count badges

#### AlbumGrid (Right Panel)
- Grid/list view toggle
- Thumbnail display
- Hover effects
- Click to open album

#### PhotoViewer (Lightbox)
- Full-screen photo display
- Keyboard navigation (arrows, ESC)
- Photo metadata display
- Download functionality

---

## Key Features

### 1. Nested Folder Support
Supports SmugMug's hierarchy up to 6 levels deep:
```
Gallery Root
└── 2025
    └── Buckeye
        └── Saturday PM (Album)
        └── Sunday AM (Album)
```

### 2. Performance Optimizations
- Caches node hierarchy for 1 hour
- Lazy loading for large trees
- Virtual scrolling for long lists (planned)
- Prefetch on hover (planned)

### 3. User Experience
- Familiar macOS Finder interface
- Keyboard shortcuts
- Breadcrumb navigation
- Real-time search
- Responsive design

---

## Authentication Handling

The gallery requires SmugMug authentication:

```javascript
// Returns 401 when not authenticated
if (err.response?.status === 401) {
  setError('Please connect your SmugMug account')
  setIsConnected(false)
}
```

---

## State Management

### Component State
```typescript
interface FinderGalleryState {
  treeData: NodeInfo | null        // Root node with hierarchy
  selectedNode: NodeInfo | null    // Currently selected node
  selectedAlbum: string | null     // Album key for photo viewing
  expandedNodes: Set<string>       // Expanded folder IDs
  breadcrumb: BreadcrumbItem[]     // Navigation path
  isConnected: boolean            // SmugMug connection status
}
```

---

## Styling

### Design System
- **Colors**: Follows system dark/light mode
- **Icons**: Lucide React icons
- **Layout**: Flexbox with overflow handling
- **Animations**: Smooth transitions on hover/expand

### Responsive Breakpoints
- Mobile: Stack panels vertically
- Tablet: Narrower folder panel
- Desktop: Full split-panel view

---

## API Response Formats

### Tree Response
```json
{
  "success": true,
  "tree": {
    "node_id": "root_id",
    "name": "My Gallery",
    "type": "Folder",
    "children": [...]
  },
  "cached": false,
  "timestamp": "2025-01-07T..."
}
```

### Album Images Response
```json
{
  "success": true,
  "images": [{
    "image_key": "abc123",
    "file_name": "photo.jpg",
    "thumbnail_url": "https://...",
    "large_url": "https://...",
    "caption": "Photo caption",
    "date_taken": "2025-01-01T..."
  }],
  "count": 25
}
```

---

## Error Handling

### Common Errors
1. **401 Unauthorized**: SmugMug not connected
2. **500 Internal Server Error**: OAuth callback issues (fixed)
3. **404 Not Found**: Invalid node/album ID

### Error Recovery
- Retry button for failed requests
- Clear error messages
- Fallback UI states
- Cache fallback when API fails

---

## Future Enhancements

### Planned Features
1. **Drag & Drop**: Reorganize albums/folders
2. **Bulk Operations**: Select multiple items
3. **Right-Click Menu**: Context actions
4. **Quick Look**: Preview without opening
5. **Sort Options**: By name, date, size
6. **Filter Options**: By type, date range
7. **Offline Mode**: Service worker caching
8. **Virtual Scrolling**: Handle 10,000+ items
9. **Keyboard Navigation**: Full keyboard support
10. **Share Functionality**: Generate share links

### Performance Improvements
1. **Image CDN**: Use SmugMug's CDN URLs
2. **Progressive Loading**: Load visible items first
3. **Prefetching**: Preload next level on hover
4. **WebP Support**: Modern image formats
5. **Intersection Observer**: Lazy load images

---

## Testing Checklist

### Functionality Tests
- [ ] OAuth connection flow
- [ ] Tree loading and display
- [ ] Folder expand/collapse
- [ ] Album selection
- [ ] Photo viewing
- [ ] Search functionality
- [ ] Breadcrumb navigation
- [ ] Sync functionality

### Edge Cases
- [ ] Empty folders
- [ ] Large albums (1000+ photos)
- [ ] Deep nesting (6 levels)
- [ ] Network failures
- [ ] Token expiration
- [ ] Concurrent requests

### Browser Compatibility
- [ ] Chrome 90+
- [ ] Firefox 88+
- [ ] Safari 14+
- [ ] Edge 90+
- [ ] Mobile browsers

---

## Troubleshooting

### Common Issues

1. **Gallery shows 401 error**
   - SmugMug not connected
   - Token expired
   - Solution: Re-authenticate

2. **Photos not loading**
   - Check network tab for 404s
   - Verify album_key is correct
   - Check CORS settings

3. **Tree not expanding**
   - Check console for errors
   - Verify node has children
   - Check expandedNodes state

4. **Search not working**
   - Verify API endpoint is correct
   - Check query encoding
   - Review search implementation

---

## Code Examples

### Fetch Gallery Tree
```javascript
const loadGalleryTree = async () => {
  try {
    const response = await axios.get('/api/gallery/tree')
    if (response.data.success) {
      setTreeData(response.data.tree)
    }
  } catch (err) {
    if (err.response?.status === 401) {
      setError('Please connect SmugMug')
    }
  }
}
```

### Handle Node Selection
```javascript
const handleNodeSelect = async (node: NodeInfo) => {
  setSelectedNode(node)
  
  if (node.type === 'Album' && node.album_key) {
    setSelectedAlbum(node.album_key)
  }
  
  // Update breadcrumb
  const response = await axios.get(
    `/api/gallery/breadcrumb/${node.node_id}`
  )
  setBreadcrumb(response.data.path)
}
```

### Recursive Tree Rendering
```javascript
function TreeNode({ node, level = 0 }) {
  const isExpanded = expandedNodes.has(node.node_id)
  
  return (
    <div>
      <div 
        style={{ paddingLeft: `${level * 20}px` }}
        onClick={() => onNodeSelect(node)}
      >
        {node.type === 'Folder' ? <Folder /> : <Image />}
        {node.name}
      </div>
      {isExpanded && node.children?.map(child => (
        <TreeNode key={child.node_id} node={child} level={level + 1} />
      ))}
    </div>
  )
}
```

---

## Dependencies

### Frontend
- React 18+
- Next.js 14+
- TypeScript
- Axios
- Lucide React (icons)
- Tailwind CSS

### Backend
- FastAPI
- httpx
- authlib
- Python 3.8+

---

## License & Credits

Gallery implementation inspired by macOS Finder.
Icons from Lucide React.
Built for SmugMug API v2.