# Bug: Breadcrumbs Show Unnecessary Dropdowns

**Date:** 2025-08-14  
**Status:** Open  
**Priority:** Low  
**Component:** AlbumBrowser - Breadcrumb Navigation  

## Issue Description
The breadcrumb navigation includes dropdown functionality that provides an additional way to navigate through the folder tree. This dropdown feature is unnecessary and creates UI clutter.

## Expected Behavior
Breadcrumbs should provide simple hierarchical navigation up the tree structure with clickable path segments, without dropdown menus.

## Current Behavior
Breadcrumbs display dropdown functionality that duplicates navigation options already available through the main folder tree interface.

## Impact
- UI complexity without added value
- Redundant navigation options
- Potential user confusion with multiple navigation methods

## Suggested Fix
Remove dropdown functionality from breadcrumbs while maintaining the core path navigation functionality.

## Location
- Component: `frontend/components/AlbumBrowser.js`
- UI Element: Breadcrumb navigation system