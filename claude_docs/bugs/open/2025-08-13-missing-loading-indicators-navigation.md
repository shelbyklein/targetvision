# Bug Report: Missing Loading Indicators During Folder/Album Navigation

**Date Created:** 2025-08-13  
**Status:** Open  
**Priority:** Medium  
**Component:** Navigation, UI Feedback, AlbumBrowser, FolderGrid  

## Description
When clicking on folders or albums to navigate, there is no visual feedback indicating that content is loading. Users experience a delay with no indication that their click was registered or that new content is being fetched.

## Expected Behavior
- Immediate visual feedback when clicking folder/album items
- Loading spinner or skeleton UI while content loads
- Clear indication that navigation is in progress
- Smooth transition between loading and content display
- Loading states for both left sidebar and right grid content

## Actual Behavior
- No loading indicator appears after clicking folders/albums
- UI appears unresponsive during content loading
- Users may click multiple times thinking their click didn't register
- Abrupt transition from old content to new content
- No visual feedback during network requests

## Steps to Reproduce
1. Navigate to Albums page
2. Click on any folder in the left sidebar tree
3. Observe lack of loading indication
4. Click on folder/album cards in the right grid
5. Notice no loading feedback during content fetch
6. Experience delay without visual confirmation

## Technical Details
- **Affected Components**: AlbumBrowser.js, FolderGrid.js, ProgressManager.js
- **Missing Loading States**: Folder navigation, album selection, content fetching
- **Expected Feedback**: Spinners, skeleton UI, progress indicators
- **Navigation Flow**: Click → Load → Display (missing middle step feedback)

## Impact
- **User Experience**: Poor perceived performance and responsiveness
- **Usability**: Users unsure if interface is working
- **Workflow**: May cause repeated clicks or frustration
- **Severity**: Medium - affects navigation experience but doesn't break functionality

## Potential Root Causes
1. **Missing Loading Logic**: No loading state management during navigation
2. **Event Handling**: Click handlers don't trigger loading indicators
3. **Component Integration**: ProgressManager not connected to navigation events
4. **State Management**: No loading state tracked during content fetching
5. **UI Implementation**: Missing loading UI components for navigation

## Investigation Areas
- Check AlbumBrowser folder/album click handlers
- Verify FolderGrid selection event handling
- Review ProgressManager loading state management
- Examine SmugMugAPI loading indicators
- Search for existing loading state implementations

## Technical Requirements
- **Immediate Feedback**: Loading state starts on click
- **Visual Indicators**: Spinners, skeleton UI, or progress bars
- **Event Integration**: Use EventBus for loading state coordination
- **Component Updates**: Both sidebar and grid show loading states
- **Performance**: Lightweight loading indicators

## Suggested Implementation
1. **Loading Events**: Emit loading start/stop events on navigation
2. **ProgressManager Integration**: Handle navigation loading states
3. **Visual Feedback**: Add spinners to clicked items
4. **Grid Loading**: Show skeleton cards while content loads
5. **State Coordination**: Coordinate loading between left/right panels

## Expected Loading States
- **Folder Click**: Show spinner on clicked folder item
- **Album Selection**: Loading indicator on selected album
- **Grid Loading**: Skeleton cards or spinner in right panel
- **Content Transition**: Smooth fade or transition effects
- **Error Handling**: Loading state clears on errors

## Files to Investigate
- `/frontend/components/AlbumBrowser.js` - Folder click handlers (selectFolderItem, navigateToFolder)
- `/frontend/components/FolderGrid.js` - Album/folder selection handlers
- `/frontend/components/ProgressManager.js` - Loading state management
- `/frontend/managers/SmugMugAPI.js` - API loading indicators
- `/frontend/services/EventBus.js` - Loading event coordination

## Event Flow Analysis
```
Current: Click → [delay] → Content Display
Expected: Click → Loading UI → Content Display
```

## Related Features
- Navigation responsiveness
- User feedback systems
- Progress indication
- State management
- Performance perception

## Priority Justification
Medium priority because while this doesn't break functionality, it significantly impacts user experience and perceived performance during navigation operations.