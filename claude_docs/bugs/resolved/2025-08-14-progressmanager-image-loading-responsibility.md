# Bug: ProgressManager Handles Image Loading Progress - Should Be in PhotoGrid

**Date:** 2025-08-14  
**Status:** Open  
**Priority:** Medium  
**Component:** ProgressManager / PhotoGrid Architecture  

## Issue Description
The ProgressManager component at line 269 reports that it's "updating batch progress" but this is actually for loading images, not processing them. Image loading progress should be handled within the PhotoGrid component since it's directly related to photo display operations.

## Current Behavior
- ProgressManager.js:269 logs "Updated batch progress" for image loading operations
- Image loading progress is managed outside of the PhotoGrid component
- Separation of concerns is violated - UI progress for photos handled elsewhere

## Expected Behavior
- PhotoGrid component should handle its own image loading progress
- ProgressManager should only handle actual AI processing progress
- Clear separation between display loading and processing operations

## Impact
- Confusing progress reporting (batch processing vs image loading)
- Architectural inconsistency in component responsibilities
- Harder to maintain and debug image loading vs processing states

## Suggested Fix
Move image loading progress handling from ProgressManager to PhotoGrid component, keeping only AI processing progress in ProgressManager.

## Location
- **Current Issue**: `frontend/components/ProgressManager.js:269`
- **Target Component**: `frontend/components/PhotoGrid.js`
- **Event**: `progress:update-batch` (image loading context)

## Component Responsibility Clarification
- **PhotoGrid**: Should handle photo display, selection, and image loading progress
- **ProgressManager**: Should handle AI processing progress, sync operations, and general app loading states