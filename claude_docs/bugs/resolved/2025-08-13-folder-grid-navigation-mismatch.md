# Bug Report: Folder Grid Navigation Mismatch

**Date Created:** 2025-08-13  
**Status:** Open  
**Priority:** High  
**Component:** FolderGrid, AlbumBrowser Navigation  

## Description
The folder display column (left) and grid column (right) do not match up. When viewing the root folder on the left/in breadcrumbs, the right column does not show its children as cards.

## Expected Behavior
- When navigating to a folder in the left column (tree view)
- The right column should display the children of that folder as cards
- The breadcrumbs should match the currently displayed folder contents
- Left and right columns should stay synchronized

## Actual Behavior
- Left column shows current folder in tree/breadcrumb navigation
- Right column does not display the corresponding child folders/albums as cards
- Navigation state between left and right columns is not synchronized

## Steps to Reproduce
1. Load the application
2. Navigate to root folder in left column
3. Observe breadcrumbs show root folder
4. Check right column for child folders/albums as cards
5. Notice mismatch between left column navigation and right column display

## Technical Details
- **Affected Components:** FolderGrid.js, AlbumBrowser.js
- **Event Flow:** `folders:display-grid` event may not be properly triggered
- **Navigation State:** Left/right column synchronization issue

## Impact
- **User Experience:** Confusing navigation experience
- **Functionality:** Cannot browse folder structure effectively
- **Severity:** High - affects core folder browsing functionality

## Potential Root Causes
1. Event synchronization issue between AlbumBrowser and FolderGrid
2. Missing event emission when folder is selected in left column
3. State management issue with current folder context
4. Event listener not properly triggering grid display

## Investigation Notes
- Check event flow between left column folder selection and right column display
- Verify `folders:display-grid` event is emitted correctly
- Review AlbumBrowser folder selection event handlers
- Check FolderGrid event listeners for proper folder content display

## Files to Investigate
- `/frontend/components/FolderGrid.js` - Grid display logic
- `/frontend/components/AlbumBrowser.js` - Folder navigation logic  
- Event flow between folder selection and grid display
- State synchronization between left/right columns