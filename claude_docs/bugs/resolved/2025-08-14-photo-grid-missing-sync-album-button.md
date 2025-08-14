# Bug: Photo Grid Actions Missing Sync Album Button

**Date:** 2025-08-14  
**Status:** Open  
**Priority:** High  
**Component:** PhotoGrid - Action Controls  

## Issue Description
The PhotoGrid component references a "Sync Album" button in error messages (lines 367 and 392) but this button is no longer present in the photo grid actions/controls. Users are told to use the "Sync Album" button when trying to select unsynced photos, but the button doesn't exist.

## Current Behavior
- PhotoGrid shows error messages referencing "Sync Album" button
- No sync album button is available in the photo controls/actions
- Users cannot sync albums from the photo grid interface
- Unsynced photos cannot be processed due to missing sync functionality

## Expected Behavior
- Photo grid actions should include a "Sync Album" button
- Button should trigger album synchronization to enable photo selection
- Button should be properly wired to sync functionality via EventBus

## Impact
- **High Priority**: Core functionality broken - users cannot sync albums
- User experience issue - error messages reference non-existent UI elements
- Photos remain unselectable without sync capability

## Error Messages Affected
- Line 367: `'This photo must be synced to the database before it can be selected for processing. Use the "Sync Album" button first.'`
- Line 392: Same error message in selection hover handler

## Suggested Fix
Add sync album button to photo controls section and wire to appropriate sync event (likely `albums:sync-current` or similar).

## Location
- **Component**: `frontend/components/PhotoGrid.js`
- **Missing UI**: Sync Album button in photo controls
- **Error References**: Lines 367, 392
- **Related**: Photo controls section around line 120