# Bug: Album Cards Only Show Thumbnails If Synced

**Date:** 2025-08-14  
**Status:** Open  
**Priority:** Medium  
**Component:** UI - Album Cards  

## Issue Description
Album cards in the folder browsing view only display thumbnail images when the album has been synced. Non-synced albums show no visual preview.

## Expected Behavior
Album cards should display thumbnails regardless of sync status, pulling the preview image directly from SmugMug API.

## Current Behavior
- Synced albums: Display thumbnail correctly
- Non-synced albums: No thumbnail shown, just empty space

## Impact
- Poor visual experience when browsing folders
- Users cannot preview album contents before syncing
- Inconsistent UI presentation

## Technical Details
The thumbnail URL is available from the SmugMug API response but may not be displayed if the album sync status check prevents rendering.

## Suggested Fix
- Always display thumbnail from SmugMug API when available
- Sync status should not affect thumbnail visibility
- Add fallback placeholder image if thumbnail fails to load