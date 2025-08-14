# Photo Grid Not Hiding When Navigating from Album to Folder

**Date:** 2025-08-14  
**Status:** Open  
**Priority:** Medium  
**Component:** Navigation/PhotoGrid  

## Description
When navigating from an album view to a folder view, the #photo-grid element remains visible instead of being hidden. This creates a confusing UI state where both folder contents and photo grid may be displayed simultaneously.

## Expected Behavior
- When navigating from album to folder, photo grid should be hidden
- Only folder contents should be visible in folder view

## Actual Behavior  
- Photo grid remains visible after navigation
- Creates cluttered/confusing UI state

## Reproduction Steps
1. Navigate to an album view (photo grid visible)
2. Navigate to a folder 
3. Observe that photo grid is still visible

## Technical Details
- Issue appears to be in navigation logic
- PhotoGrid component may not be receiving proper hide events
- Could be related to AlbumBrowser or NavigationManager event handling

## Files Likely Involved
- `frontend/components/AlbumBrowser.js`
- `frontend/components/PhotoGrid.js` 
- `frontend/components/NavigationManager.js`
- Navigation event handling in EventBus