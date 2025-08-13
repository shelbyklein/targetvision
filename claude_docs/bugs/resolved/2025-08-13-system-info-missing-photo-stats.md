# Bug Report: System Information Missing Photo Statistics

**Date Created:** 2025-08-13  
**Status:** Open  
**Priority:** Medium  
**Component:** SettingsManager, System Information Display  

## Description
System information panel is not showing processed photos count, total photos count, or processing queue status, leaving users without visibility into their photo processing progress.

## Expected Behavior
- System information should display:
  - Total photos in database
  - Number of processed photos (with AI metadata)
  - Number of unprocessed photos
  - Current processing queue status/count
  - Processing completion percentage

## Actual Behavior
- System information panel missing photo statistics
- No visibility into processing progress or photo counts
- Users cannot track AI processing status across their library

## Steps to Reproduce
1. Navigate to Settings page
2. View System Information section
3. Observe missing photo statistics:
   - No processed photos count
   - No total photos count  
   - No processing queue information

## Technical Details
- **Affected Component:** SettingsManager.js - updateSystemInfo method
- **Missing Data:** Photo counts and processing statistics
- **API Endpoint:** May need `/stats` or similar endpoint for photo metrics

## Impact
- **User Experience:** No visibility into photo processing progress
- **Functionality:** Cannot track AI processing completion status
- **Severity:** Medium - affects user awareness but doesn't break core functionality

## Potential Root Causes
1. **Missing API Endpoint:** No backend endpoint providing photo statistics
2. **Frontend Logic:** SettingsManager not requesting/displaying photo stats
3. **Database Queries:** Backend not calculating processed/total photo counts
4. **UI Missing:** System info template doesn't include photo statistics section

## Investigation Notes
- Check if backend provides photo statistics endpoint
- Review SettingsManager system info data fetching
- Verify database queries for photo counts and processing status
- Check system information UI template for missing stats section

## Required Statistics
- **Total Photos:** Count of all photos in database
- **Processed Photos:** Photos with AI metadata generated
- **Unprocessed Photos:** Photos without AI processing
- **Processing Queue:** Current queue size/status
- **Completion Rate:** Percentage of library processed

## Files to Investigate
- `/frontend/components/SettingsManager.js` - updateSystemInfo method
- `/backend/main.py` - System stats endpoint (may need creation)
- Database queries for photo counts and processing status
- Settings page HTML template for statistics display

## Related Features
- Photo processing progress tracking
- System monitoring and status reporting
- User feedback on processing completion