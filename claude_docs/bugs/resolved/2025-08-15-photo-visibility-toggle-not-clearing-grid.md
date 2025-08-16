# Bug: Show/Hide Processed/Unprocessed Photos Not Working

## Issue Description
The toggle buttons for showing/hiding processed and unprocessed photos in the album view are not functioning correctly. When toggling visibility, the photos are not being properly hidden or shown.

## Root Cause
The issue is in the `displayPhotos()` method in `/Users/shelbyklein/apps/targetvision/frontend/components/PhotoGrid.js`. When the show/hide toggles are activated, the method:

1. Correctly filters the photos in the `photosToShow` array (lines 151-160)
2. **BUT** it only clears the photo grid HTML when `isInitialLoad` or `isRefresh` flags are true (lines 179-182)
3. When toggling visibility, neither flag is set to true, so the existing photos remain in the DOM
4. The filtered photos are then appended to the existing photos, creating duplicates and not removing hidden photos

## Affected Code
File: `/Users/shelbyklein/apps/targetvision/frontend/components/PhotoGrid.js`
Lines: 179-182

```javascript
// Only clear grid for initial loads or refreshes, not for progressive updates
if (isInitialLoad || isRefresh) {
    photoGrid.innerHTML = '';
    // Rendering photos
}
```

## Solution
The photo grid needs to be cleared and re-rendered when visibility toggles change, not just during initial loads or refreshes. 

### Option 1: Always clear grid when not appending
Modify the condition to clear the grid whenever we're not doing progressive loading:
```javascript
// Clear grid unless we're doing progressive append
if (isInitialLoad || isRefresh || !isAppending) {
    photoGrid.innerHTML = '';
}
```

### Option 2: Clear grid for any filter change
Clear the grid whenever filters change (including visibility toggles):
```javascript
// Clear grid for initial loads, refreshes, or filter changes
if (isInitialLoad || isRefresh || this.hasFilterChanged) {
    photoGrid.innerHTML = '';
}
```

### Option 3: Simple fix - always clear when displayPhotos is called
Since `appendPhotos()` handles progressive loading separately, `displayPhotos()` should always clear:
```javascript
// Always clear grid when displaying photos (not appending)
photoGrid.innerHTML = '';
```

## Recommended Fix
Option 3 is the simplest and most straightforward. The `displayPhotos()` method should always clear the grid before rendering, since progressive loading is handled by the separate `appendPhotos()` method.

## Testing Steps
1. Navigate to an album with both processed and unprocessed photos
2. Click the "Processed" toggle button to hide processed photos
3. Verify processed photos are hidden
4. Click the "Unprocessed" toggle button to hide unprocessed photos  
5. Verify unprocessed photos are hidden
6. Re-enable both toggles and verify all photos show again

## Priority
Medium - Core functionality is broken but has a workaround (refresh page)

## Introduced In
Commit: abe63c8 (bug fixes) - The recent changes to support progressive loading inadvertently broke the filter toggle functionality.