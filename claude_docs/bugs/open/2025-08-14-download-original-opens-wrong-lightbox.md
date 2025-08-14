# Bug: Download Original Opens Lightbox with Wrong Photo

**Date:** 2025-08-14  
**Status:** Open  
**Priority:** High  
**Component:** Photo Modal - Download Original Feature  

## Issue Description
Clicking "Download Original" immediately opens the lightbox and displays the wrong photo before the correct image has finished loading. This creates confusion and poor user experience.

## Expected Behavior
1. User clicks "Download Original"
2. System waits for the original image to load completely
3. Lightbox opens displaying the correct original image
4. Download functionality is available in the lightbox state

## Current Behavior
1. User clicks "Download Original" 
2. Lightbox opens immediately showing incorrect/placeholder image
3. Correct image may load later, causing jarring content swap
4. Poor user experience with visual inconsistency

## Impact
- Confusing user experience
- Users may think they're downloading the wrong photo
- Visual jarring when content changes after lightbox opens
- Reduced confidence in download functionality

## Suggested Fix

### Phase 1: Prevent Premature Lightbox Opening
- Add loading state when "Download Original" is clicked
- Hold lightbox opening until target image is fully loaded
- Show loading indicator during image fetch process
- Only open lightbox once correct image is confirmed loaded

### Phase 2: Enhanced Download State
- Add dedicated download button in the loading state
- Allow users to download without viewing if preferred
- Provide clear feedback about download progress
- Maintain download functionality even if lightbox viewing fails

## Technical Requirements
1. **Image Preloading**: Load original image before lightbox display
2. **Loading States**: Visual feedback during image loading
3. **Error Handling**: Graceful fallback if original image fails to load
4. **Download Integration**: Direct download option during loading state
5. **Progress Feedback**: Clear indication of loading progress

## User Stories
- **As a user**, I want to see the correct photo when the lightbox opens after clicking "Download Original"
- **As a user**, I want a download option even if the image is still loading
- **As a user**, I want clear feedback that the system is working when loading takes time
- **As a user**, I want the option to download without waiting for lightbox preview

## Acceptance Criteria
- [ ] Lightbox waits for correct image to load before opening
- [ ] Loading indicator shows during image fetch
- [ ] Download button available in loading state
- [ ] Error handling for failed image loads
- [ ] No jarring content swaps in lightbox
- [ ] Consistent behavior across all photo sizes