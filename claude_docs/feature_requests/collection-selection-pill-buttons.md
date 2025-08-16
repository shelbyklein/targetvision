# Collection Selection via Pill Buttons

**Date**: 2025-08-16  
**Status**: Requested  
**Priority**: Medium  
**Component**: CollectionsManager, UI/UX  

## Feature Request

Replace the current collection dropdown selection with pill-style buttons that display all collections visually, providing a more intuitive and accessible way to select collections.

## Current Implementation

- Collections are selected via dropdown menu
- Dropdown may hide available options
- Requires multiple clicks to see and select collections
- Limited visual feedback about available collections

## Proposed Implementation

### UI Design
- Display all collections as pill/badge buttons
- Highlight selected collection(s) with different styling
- Allow single or multiple collection selection
- Responsive layout that wraps pills on smaller screens

### Visual Elements
- **Pill Style**: Rounded buttons with collection names
- **Active State**: Highlighted background (blue/accent color)
- **Inactive State**: Neutral background (gray/white)
- **Hover State**: Subtle highlight on hover
- **Badge Count**: Optional photo count in each collection

### Interaction Patterns
1. **Single Selection**: Click to select one collection at a time
2. **Multi-Selection**: Ctrl/Cmd+click for multiple collections
3. **Clear Selection**: Click selected pill to deselect
4. **Quick Access**: All options visible without dropdown interaction

### Layout Considerations
- Horizontal scrolling for many collections
- Wrap to multiple rows on smaller screens
- Maximum width constraints for long collection names
- Consistent spacing and alignment

### Implementation Details
- Modify CollectionsManager component
- Update collection selection state management
- Enhance visual feedback with CSS transitions
- Maintain keyboard navigation support
- Add tooltips for truncated collection names

### Technical Requirements
- Replace dropdown `<select>` with button grid
- Update event handling for pill button clicks
- Modify CSS for pill button styling
- Ensure accessibility with proper ARIA labels
- Support keyboard navigation (Tab, Space, Enter)

### User Experience Benefits
- **Immediate Visibility**: See all collections at once
- **Faster Selection**: Single-click selection
- **Visual Feedback**: Clear indication of selected state
- **Mobile Friendly**: Better touch interaction than dropdowns
- **Discoverability**: Users can see all available collections

### Responsive Design
- **Desktop**: Horizontal pill layout
- **Tablet**: Wrap pills to multiple rows as needed
- **Mobile**: Stack pills vertically or allow horizontal scroll

## Business Value
- Improved user experience and workflow efficiency
- Better collection discoverability
- Enhanced visual design consistency
- Reduced interaction friction
- More intuitive collection management