# Photo Lightbox Not Using High-Res Image for Secondary Lightbox/Download

**Date Reported**: 2025-08-13  
**Reporter**: User  
**Priority**: Medium  
**Component**: ModalManager  
**Status**: Resolved  

## Description
The photo lightbox/modal is not using high-resolution images for the secondary lightbox view or download functionality. Users are getting lower quality images instead of the full-resolution versions available from SmugMug.

## Current Behavior
- Photo modal displays thumbnail or medium-resolution image
- Secondary lightbox (click to expand) shows same resolution
- Download functionality provides lower resolution image
- No access to full-resolution SmugMug images

## Expected Behavior
- Initial modal can show medium-resolution for speed
- Secondary lightbox should display full high-resolution image
- Download button should provide highest quality available
- Progressive loading: thumbnail → medium → high-res

## User Impact
- Users cannot view photos in full quality
- Download feature doesn't provide expected high-resolution files
- Poor experience for photography enthusiasts
- Defeats purpose of photo management system

## Investigation Areas
1. **SmugMug Image URLs**: 
   - Check available image size options in photo data
   - Verify high-resolution URL formats and access
   - Review SmugMug API documentation for image sizes

2. **ModalManager.js**:
   - Check `showPhotoModal()` and image source handling
   - Implement multi-resolution image loading strategy
   - Add high-res loading for secondary lightbox

3. **Image Loading Strategy**:
   - Progressive enhancement: load higher quality on demand
   - Proper loading states for high-resolution images
   - Error handling for unavailable high-res images

## SmugMug Image Size Investigation
- **Thumbnail**: `_S` suffix (e.g., `photo_S.jpg`)
- **Medium**: `_M` suffix (e.g., `photo_M.jpg`)  
- **Large**: `_L` suffix (e.g., `photo_L.jpg`)
- **X-Large**: `_XL` suffix (e.g., `photo_XL.jpg`)
- **Original**: `_O` suffix or no suffix for full resolution

## Potential Solutions
1. **Multi-Resolution Loading**:
   ```javascript
   // Load medium for initial modal
   modalImage.src = photo.medium_url || photo.thumbnail_url;
   
   // Load high-res for secondary lightbox
   lightboxImage.src = photo.original_url || photo.large_url;
   ```

2. **Progressive Enhancement**:
   - Show thumbnail immediately
   - Load medium resolution in background
   - Load high-res only when user clicks to expand

3. **Download Functionality**:
   - Always use highest available resolution for downloads
   - Provide file size information to user
   - Show download progress for large files

## Related Code
- `frontend/components/ModalManager.js` (photo modal display)
- SmugMug photo data structure and URL formats
- Image loading and display logic

## Success Criteria
- Secondary lightbox displays full high-resolution images
- Download provides highest quality files available
- Smooth progressive loading experience
- Proper loading states and error handling

## Resolution (2025-08-13)
**Root Cause**: The fullscreen lightbox was using a non-existent API endpoint `/smugmug/photos/${smugmug_id}/largest` which was causing 404 errors and falling back to low-resolution images.

**Fix Applied**:
- Changed fullscreen lightbox to use the same working endpoint as the download functionality: `/photos/${photoId}/largest-image`
- This endpoint returns SmugMug Original quality images (suffix `_O`) instead of Large quality (suffix `_L`)
- Used existing `apiService` instead of raw `fetch()` for consistency

**Technical Details**:
- Before: Used non-existent `/smugmug/photos/${smugmug_id}/largest` endpoint
- After: Uses working `/photos/${photoId}/largest-image` endpoint
- Result: Fullscreen lightbox now loads high-resolution Original quality images from SmugMug
- Fallback mechanism remains in place for error handling

**Verification**: Tested endpoint `/photos/7/largest-image` returns Original resolution URLs (e.g., `i-xQgM53J-O.jpg` instead of `i-xQgM53J-L.jpg`)