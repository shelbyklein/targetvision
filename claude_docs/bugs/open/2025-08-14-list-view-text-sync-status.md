# Bug: List View Uses Text for Sync Status Instead of Icons

**Date:** 2025-08-14  
**Status:** Open  
**Priority:** Low  
**Component:** UI - List View (Left Column)  

## Issue Description
The left column list view displays sync status as text ("Synced" / "Not synced") instead of using clear visual icons, creating unnecessary text clutter and inconsistent UI patterns.

## Expected Behavior
Replace text-based sync status with intuitive icons:
- ✅ Green checkmark for synced albums
- ⏳ Clock/spinner icon for syncing in progress  
- ❌ Red X or ⚠️ warning for sync failed
- ○ Empty circle for not synced

## Current Behavior
- Text labels "Synced" and "Not synced" appear in list items
- Inconsistent with other parts of the UI that use icons
- Takes up unnecessary horizontal space

## Impact
- Cluttered text presentation
- Inconsistent UI language
- Missed opportunity for quick visual scanning
- Slower user comprehension of sync status

## Visual Comparison
**Before:** Album Name - 123 photos • Not synced  
**After:** Album Name - 123 photos ○

## Suggested Fix
1. Replace text sync status with appropriate icons
2. Use consistent icon colors (green=good, red=error, gray=pending)
3. Add tooltips on hover to show full status text if needed
4. Ensure icons are accessible and meet contrast requirements