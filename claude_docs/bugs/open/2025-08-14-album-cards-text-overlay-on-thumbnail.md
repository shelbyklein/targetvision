# Bug: Album Card Text Overlays Thumbnail Image

**Date:** 2025-08-14  
**Status:** Open  
**Priority:** Medium  
**Component:** UI - Album Cards  

## Issue Description
Album card titles, photo counts, and sync status icons are currently overlaid on top of the thumbnail image, obscuring the preview and creating readability issues.

## Expected Behavior
Album information should be displayed below the thumbnail image in a separate text area, keeping the image clear and unobstructed.

## Current Behavior
- Title, photo count, and sync icon are positioned over the thumbnail
- Text can be hard to read depending on image colors
- Thumbnail preview is partially obscured

## Visual Structure Needed
```
[--------]
[Thumbnail]
[--------]
Title
X photos • ✓
```

## Impact
- Reduced thumbnail visibility
- Poor text readability on certain image backgrounds
- Cluttered visual presentation

## Suggested Fix
1. Move all text elements below the thumbnail container
2. Create a dedicated info section under each thumbnail
3. Ensure consistent spacing and alignment
4. Keep sync status as an icon for visual clarity