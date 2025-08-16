# Album Loading Pagination Limit

**Date**: 2025-08-16  
**Status**: Open  
**Priority**: Medium  
**Component**: Frontend/Photo Loading  

## Bug Description

When an album is loaded, only 100 photos load initially instead of implementing proper progressive loading in batches of 100.

## Current Behavior

- Album loads only the first 100 photos
- User sees incomplete album content
- No visual indication that more photos are available
- No mechanism to load additional photos beyond the first 100

## Expected Behavior

- Load photos in batches of 100 at a time
- Show loading indicators for subsequent batches
- Progressive loading as user scrolls or requests more content
- Visual indication of total photos vs loaded photos
- Ability to load all photos in the album

## Technical Details

- **Component**: DataManager.js, PhotoGrid.js
- **API Endpoint**: `/smugmug/albums/{albumId}/photos`
- **Current Limit**: Hard-coded to 100 photos
- **Expected**: Implement batch loading with 100-photo increments

## Impact

- Albums with more than 100 photos appear incomplete
- User workflow disrupted for large albums
- Inconsistent user experience
- Potential data accessibility issues

## Investigation Areas

1. Review DataManager.js `fetchPhotoBatch()` implementation
2. Check PhotoGrid.js progressive loading logic
3. Examine API pagination parameters (skip, limit)
4. Review UI indicators for "load more" functionality
5. Check if backend properly supports pagination

## Potential Solutions

1. Implement proper progressive loading with "Load More" button
2. Add infinite scroll for automatic batch loading
3. Show total photo count vs loaded count
4. Add loading indicators for batch operations
5. Ensure proper state management during batch loading

## Related Components

- `DataManager.js` - Photo fetching logic
- `PhotoGrid.js` - Photo display and pagination
- `ProgressManager.js` - Loading indicators
- Backend API - Pagination support