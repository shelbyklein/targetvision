# Select All Filtering Issues

**Date:** 2025-08-16
**Status:** Open
**Priority:** High
**Category:** Functionality Bug

## Description
When looking at an album and filtering processed vs unprocessed photos, the "select all" functionality has two major issues:
1. Only selects 100 photos (pagination limit)
2. Selects photos that have already been processed

## Expected Behavior
- "Select all" should respect the current filter (processed/unprocessed)
- When filtering for unprocessed photos, "select all" should only select unprocessed photos
- Should select all filtered photos, not just the first 100

## Current Behavior
- "Select all" ignores the current filter and selects processed photos
- Limited to 100 photos due to pagination
- Does not respect the processing status filter

## Impact
- Users cannot efficiently select all unprocessed photos for batch processing
- Confusion when processed photos are selected despite filtering for unprocessed
- Workflow inefficiency when dealing with large albums

## Affected Components
- PhotoGrid.js (selection logic)
- Filter system (processed/unprocessed toggle)
- Select all functionality

## Reproduction Steps
1. Navigate to an album with both processed and unprocessed photos
2. Filter to show only unprocessed photos
3. Click "select all"
4. Observe that processed photos are also selected
5. Notice only 100 photos are selected regardless of filter results

## Technical Notes
- Select all logic needs to respect current filter state
- Pagination handling required for selecting all filtered photos
- Filter state should be considered in selection operations