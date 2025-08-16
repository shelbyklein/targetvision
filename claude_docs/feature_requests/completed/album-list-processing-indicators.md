# Album List Processing Indicators

**Date**: 2025-08-16  
**Status**: Requested  
**Priority**: Medium  
**Component**: AlbumBrowser  

## Feature Request

Add visual indicators in the album list view (left column) showing how many images have been processed in each album, providing users with quick processing status overview without needing to enter each album.

## Proposed Implementation

### UI Components
- Processing status icon next to album name
- Text indicator showing "X/Y processed" format
- Color-coded progress indicators
- Optional progress bar for visual completion percentage

### Visual Design Options
1. **Icon + Text**: `🔄 15/23 processed`
2. **Badge Style**: Album name with colored badge showing ratio
3. **Progress Bar**: Mini progress bar under album name
4. **Status Icon**: Color-coded icon (green=complete, yellow=partial, gray=none)

### Data Requirements
- Count of total photos per album
- Count of processed photos per album
- Real-time updates when processing completes
- Efficient querying to avoid performance impact

### Technical Implementation
- Extend album data structure to include processing counts
- Add database queries for photo processing statistics
- Update AlbumBrowser component to display counts
- Implement real-time updates via EventBus
- Cache counts for performance optimization

### Integration Points
- **AlbumBrowser**: Primary display component
- **PhotoProcessor**: Update counts when processing completes
- **Database**: Efficient count queries
- **CacheManager**: Cache processing statistics
- **EventBus**: Real-time count updates

### User Experience Benefits
- Quick overview of album processing status
- Identify albums needing attention
- Track processing progress across entire library
- Reduce need to open each album to check status

## Business Value
- Improved workflow efficiency
- Better progress visibility
- Enhanced user experience
- Reduced time spent navigating between albums