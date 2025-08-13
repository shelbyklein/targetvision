# Image Cards Don't Load in Right Column on Page Load

**Date Reported**: 2025-08-13
**Reporter**: User
**Priority**: High
**Component**: AlbumBrowser, PhotoGrid
**Status**: Open

## Description
Image cards are not displaying in the right column when the application loads. The right column appears empty or doesn't populate with photo thumbnails on initial page load, requiring user interaction or refresh to display properly.

## Steps to Reproduce
1. Open the TargetVision application (http://localhost:3000)
2. Wait for application to load and authenticate
3. Observe the right column where photo cards should appear
4. Expected: Photo cards/thumbnails should load automatically
5. Actual: Right column remains empty or unpopulated

## Environment
- Browser: [To be filled - Chrome/Firefox/Safari version]
- OS: [To be filled - macOS/Windows/Linux]
- Backend status: Running on localhost:8000
- Frontend: http://localhost:3000
- Error messages: [To be determined from browser console]

## Investigation Notes
**Potential Components Involved:**
- **AlbumBrowser.js**: Responsible for album display and hierarchical navigation
- **PhotoGrid.js**: Handles photo card rendering and thumbnail display
- **NavigationManager.js**: Manages initial page display and routing
- **DataManager.js**: Handles data loading operations
- **EventBus**: Communication between components during initialization

**Potential Causes:**
1. **Initialization Race Condition**: PhotoGrid may be trying to render before data is loaded
2. **Event Timing Issue**: `albums:display` or `photos:display` events not firing during startup
3. **State Restoration Problem**: Application state not properly triggering UI updates
4. **Missing Default Display**: No fallback to show default content when no state exists

**Initial Analysis Areas:**
- Check if `showAlbumsView()` is being called correctly on initialization
- Verify EventBus communication between NavigationManager and display components
- Investigate timing of data loading vs UI rendering
- Review recent changes to initialization flow in app.js

## Browser Console Investigation Needed
- [ ] Check for JavaScript errors during page load
- [ ] Monitor EventBus events during initialization (`eventBus.listEvents()`)
- [ ] Verify API calls to backend for album/photo data
- [ ] Check DOM elements existence when components try to render

## Component Event Flow to Verify
```
NavigationManager.showPage('albums') 
→ app:show-albums-view event
→ showAlbumsView() 
→ albums:display event
→ AlbumBrowser/PhotoGrid rendering
```

## Testing Steps for Fix Verification
1. Fresh browser session (clear cache/localStorage)
2. Load application without existing state
3. Verify photo cards appear in right column within 3-5 seconds
4. Test with different browsers (Chrome, Firefox, Safari)
5. Test with backend running vs not running
6. Verify no JavaScript console errors

## Related Issues
- May be related to recent Phase 4 refactoring and initialization changes
- Could be connected to NavigationManager showing initial page logic
- Potentially linked to EventBus timing in component communication

## Priority Justification
**High Priority** because:
- Affects core user experience (empty interface on load)
- Impacts first impression of application functionality
- May indicate broader initialization or component communication issues
- Could affect user's ability to see and interact with their photos

## Next Steps
1. Add browser console logging to track component initialization order
2. Verify EventBus event emissions during startup
3. Check if data is being loaded but not displayed
4. Test initialization with different browser states (fresh vs cached)
5. Investigate timing between component loading and UI rendering