# Collection Dropdown Not Updating After Creation

**Date:** 2025-08-16
**Status:** Open
**Priority:** Medium
**Component:** ModalManager, CollectionsManager

## Description
When creating a new collection via the photo modal, the newly created collection does not appear in the collection dropdown menu within the modal. The collection is successfully created and appears in the collections tab after a page refresh, indicating the backend operation is working correctly but the frontend UI is not updating the dropdown state.

## Steps to Reproduce
1. Open a photo in the modal view
2. In the collections section, create a new collection
3. Observe that the new collection is not available in the dropdown
4. Navigate to the collections tab - collection does not appear
5. Refresh the page
6. Navigate to collections tab - collection now appears

## Expected Behavior
- New collection should immediately appear in the dropdown after creation
- Collection should be available for selection without requiring a page refresh
- Collections tab should show the new collection immediately

## Actual Behavior
- New collection is created successfully on backend
- Dropdown does not refresh to show the new collection
- Collections tab does not update until page refresh
- User must refresh page to see and use the new collection

## Impact
- Poor user experience requiring manual page refresh
- Breaks the seamless workflow of creating and immediately using collections
- May cause user confusion about whether collection creation succeeded

## Potential Root Cause
The CollectionsManager likely needs to emit an event after successful collection creation to update the dropdown state in ModalManager. The issue appears to be missing event communication between components after collection creation.

## Related Components
- `frontend/components/ModalManager.js` - Photo modal and collection dropdown
- `frontend/components/CollectionsManager.js` - Collection CRUD operations
- Event communication via EventBus for dropdown refresh