# Folder/Album Grid Missing Thumbnails

**Date Reported**: 2025-08-13  
**Reporter**: User  
**Priority**: Medium  
**Component**: FolderGrid  
**Status**: Open  

## Description
The folder/album grid cards are not displaying thumbnails or images properly. Folder cards show only generic blue folder icons, and album cards are not showing album thumbnail images even when thumbnail URLs are available.

## Expected Behavior
- **Folder Cards**: Should show preview thumbnails of contained content when available
- **Album Cards**: Should display album cover image/thumbnail from SmugMug when `thumbnail_url` is provided
- **Fallback**: Generic icons when no thumbnails are available

## Current Behavior
- All folder cards show generic blue folder SVG icon
- Album cards show generic green album SVG icon instead of actual thumbnails
- `thumbnail_url` property is not being properly utilized

## Investigation Areas
1. **FolderGrid.js**: Check `createAlbumCard()` method thumbnail handling
2. **SmugMug API Data**: Verify `thumbnail_url` field is populated in album objects
3. **Image Loading**: Implement proper image loading with fallbacks
4. **CORS Issues**: Check if SmugMug thumbnail URLs have CORS restrictions

## Steps to Reproduce
1. Navigate to root folder or any folder with albums
2. Observe folder/album cards in right column grid
3. Notice missing thumbnail images on album cards
4. Expected: Album cover images should display

## Potential Solutions
- Verify SmugMug API response includes thumbnail URLs
- Add proper image loading with error handling
- Implement lazy loading for thumbnail images
- Add fallback handling for missing/broken thumbnail URLs

## Related Code
- `frontend/components/FolderGrid.js` (lines ~120-140)
- Album data structure from SmugMug API
- SmugMug thumbnail URL format and accessibility