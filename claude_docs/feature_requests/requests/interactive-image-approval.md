# Interactive Image Selection/Approval Mode

**Date**: 2025-08-16  
**Status**: Requested  
**Priority**: Medium  
**Component**: PhotoGrid, ModalManager  

## Feature Request

Add an interactive photo selection mode that allows users to interactively select or skip images in an album using a lighbox, similar to how tinder works

## Proposed Implementation

### UI Components
- button to enter "interactive selection Mode" (lightbox slideshow)
- Visual indicators for approved/unapproved status (checkmarks, X marks, or color coding)
- Keyboard shortcuts for rapid approval (spacebar = approve, X = reject)

### User Experience
1. User enters interactive selection mode via button on photo grid view, next to "process selected" button
2. Photos display with clear approve/reject visual states
3. Single click toggles selection status and goes to next image
5. Progress indicator showing selection percentage
6. "process selected" button in bottom right of modal

### Technical Considerations
- use selection state from image cards in photo grid
- Update photo card status indicators to show selection state
- Integrate with existing selection system
- Add approval status to search/filter capabilities

### Integration Points
- **PhotoGrid**: Primary component for interactions
- **ModalManager**: Support selection actions in photo modal view