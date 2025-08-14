# Bug: Breadcrumbs Do Not Display Album Title When Navigating Into Album

**Date:** 2025-08-14  
**Status:** Open  
**Priority:** Medium  
**Component:** Navigation - Breadcrumbs, Album View  

## Issue Description
When navigating into an album to view photos, the breadcrumb navigation does not update to show the current album title, leaving users without clear context of their current location.

## Expected Behavior
Breadcrumbs should display the full navigation path including:
- SmugMug Albums / [Folder Path] / **Album Name**
- The album name should appear as the final breadcrumb segment
- Users should understand they are viewing photos within a specific album

## Current Behavior
- Breadcrumbs show folder path but stop at the parent folder
- No indication of which album is currently being viewed
- Users lose context when viewing album photos
- Navigation path appears incomplete

## Example
**Current:** SmugMug Albums / 2025 / Buckeye Classic  
**Expected:** SmugMug Albums / 2025 / Buckeye Classic / Saturday PM

## Impact
- Users lose navigation context when viewing album photos
- Unclear which album photos belong to when switching between albums
- Inconsistent breadcrumb behavior between folder and album views
- Reduced navigation usability

## Technical Details
The issue likely occurs because:
- Album selection may not trigger breadcrumb updates
- Album data may not be integrated into breadcrumb generation
- Different navigation paths (folder vs album) may use different breadcrumb logic

## Root Cause Analysis Needed
1. Check if `album:selected` event updates breadcrumb state
2. Verify if album title is available in breadcrumb data
3. Examine breadcrumb update logic in AlbumBrowser component
4. Review StateManager album navigation handling

## Suggested Fix
1. Update breadcrumb logic to include album title when viewing album photos
2. Ensure `album:selected` event triggers breadcrumb update
3. Add album information to breadcrumb data structure
4. Handle album breadcrumb display in `updateBreadcrumbs()` method
5. Maintain navigation state when switching between album and folder views

## Acceptance Criteria
- [ ] Breadcrumbs show album name when viewing album photos
- [ ] Navigation path is complete and accurate
- [ ] Breadcrumb updates occur on album selection
- [ ] Back navigation works correctly from album view
- [ ] Consistent breadcrumb behavior across all navigation types

## Related Components
- AlbumBrowser.js (breadcrumb display)
- StateManager.js (navigation state)
- SmugMugAPI.js (album data)
- DataManager.js (album loading)