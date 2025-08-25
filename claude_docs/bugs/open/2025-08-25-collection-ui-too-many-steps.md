# Collection UI - Too Many Steps for Adding Photos

**Date:** 2025-08-25  
**Status:** Open  
**Component:** CollectionsManager / Photo Modal  
**Priority:** Medium  
**Type:** UX Improvement  

## Description
Adding a photo to a collection has too many steps. Currently the user needs to:
1. Click 'Add to Collection' button
2. Click on a pill to select a collection
3. Click 'Add' button to confirm

This is unnecessarily complex and creates friction in the user workflow.

## Expected Behavior (Proposed UX Improvement)
- Display collection pills that show which collections the photo is currently in
- Pills should be toggle-able (click to add/remove photo from collection)
- Active collections should be visually distinct (highlighted/checked)
- Add a "+" button to create a new collection directly
- Remove the multi-step "Add to Collection" workflow entirely

## Current Behavior
- Multi-step process requiring multiple clicks and confirmations
- User must explicitly enter "add mode" before selecting collections
- Separate confirmation step required after selection

## Affected Areas
- Photo modal collection interface
- Collection management UX
- User workflow efficiency

## Technical Notes
- Needs modification to CollectionsManager.js collection pill rendering
- Simplify event handlers to directly toggle collection membership
- Add inline collection creation workflow
- Remove confirmation step and make actions immediate
- Update visual design to show current membership status