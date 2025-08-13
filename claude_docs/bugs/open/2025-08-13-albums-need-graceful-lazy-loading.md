# Albums Need More Graceful Lazy Loading

**Date Reported**: 2025-08-13  
**Reporter**: User  
**Priority**: High  
**Component**: PhotoGrid, DataManager  
**Status**: Open  

## Description
Albums currently show no content until all photos are loaded, creating a poor user experience with blank screens during loading. The system needs graceful progressive loading where photos appear as they load rather than waiting for the entire album to load.

## Current Behavior
- Clicking an album shows loading spinner
- No photos appear until ALL photos in album are loaded
- Large albums cause long blank loading periods
- No visual feedback of loading progress

## Expected Behavior
- Photos should appear progressively as they load
- Show loading skeleton/placeholders for photos being loaded
- Display partial album content immediately when available
- Show loading progress indicator (e.g., "Loading 45 of 120 photos...")

## User Impact
- **High Priority** because it affects core browsing experience
- Users with large albums (100+ photos) experience long delays
- No visual feedback makes app appear unresponsive
- Poor perceived performance even when backend is fast

## Investigation Areas
1. **DataManager.js**: Check `loadAlbumPhotos()` and `fetchAlbumPhotos()` methods
2. **PhotoGrid.js**: Implement progressive photo rendering
3. **Caching Strategy**: Load cached photos immediately, then fetch updates
4. **Backend API**: Consider pagination or streaming photo data

## Potential Solutions
### Progressive Loading
- Load photos in batches (e.g., 20-30 at a time)
- Render available photos immediately
- Show skeleton placeholders for loading photos
- Infinite scroll or "Load More" button for additional photos

### Improved Caching
- Show cached photos instantly while fetching fresh data
- Update photos in-place as fresh data arrives
- Cache thumbnail images for faster initial display

### Loading States
- Replace binary loading with progressive states
- Show "Loading X of Y photos..." counter
- Skeleton grid with loading placeholders
- Photo thumbnails load individually with loading states

## Related Code
- `frontend/components/DataManager.js` (loadAlbumPhotos method)
- `frontend/components/PhotoGrid.js` (displayPhotos method)
- `frontend/managers/CacheManager.js` (album photo caching)
- Backend photo API endpoints

## Success Criteria
- Photos appear within 1-2 seconds of album selection
- Large albums show content progressively
- Clear loading feedback for remaining photos
- No blank screens during album loading