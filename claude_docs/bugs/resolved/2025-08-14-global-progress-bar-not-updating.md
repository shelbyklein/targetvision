# Global Progress Bar Not Updating During Processing

**Date**: 2025-08-14  
**Priority**: High  
**Status**: Open  
**Component**: PhotoProcessor.js, UI Progress Tracking  

## Description

The global progress bar (`#global-progress-bar`) shows when batch photo processing starts but doesn't update as photos are processed. It remains at 0% for the entire duration until all processing completes.

## Steps to Reproduce

1. Select multiple photos in an album
2. Click "Process Selected" to start batch processing
3. Observe the global progress bar at the bottom of the screen
4. Expected: Progress bar should update as photos are processed (1/5, 2/5, 3/5, etc.)
5. Actual: Progress bar stays at "0/5" until all photos are complete

## Expected Behavior

- Progress bar starts at 0/N photos when processing begins
- As individual photos complete processing, progress bar updates (1/N, 2/N, etc.)
- Progress percentage increases smoothly showing real progress
- Progress bar auto-hides when all photos are processed

## Actual Behavior

- Progress bar shows "0/N" throughout the entire processing
- No visual feedback on processing progress
- Progress bar only disappears when all processing completes

## Root Cause

The `handleStatusUpdate` method in PhotoProcessor.js receives polling updates about processing status but never calls `updateGlobalProgress` to update the progress bar UI. The polling logic only tracks completion and individual photo status updates.

## Technical Details

- **File**: `frontend/managers/PhotoProcessor.js`
- **Method**: `handleStatusUpdate` (line ~602)
- **Issue**: Missing call to `updateGlobalProgress` during polling
- **Missing**: Tracking of original batch total for progress calculation

## Impact

- Poor user experience during batch processing
- No visual feedback on processing progress
- Users don't know if processing is stuck or progressing normally

## Related Code

```javascript
// PhotoProcessor.js - showGlobalProgress called initially
this.showGlobalProgress(0, localPhotoIds.length, 'Starting AI analysis...');

// But handleStatusUpdate never calls updateGlobalProgress
handleStatusUpdate(status) {
    // Missing: updateGlobalProgress call
}
```

## Solution

Add progress tracking to the polling system:
1. Store original batch total when processing starts
2. Calculate progress in `handleStatusUpdate` (total - remaining)
3. Call `updateGlobalProgress` with calculated values
4. Clear tracking when processing completes