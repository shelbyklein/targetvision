# Settings Server Keys Status Indicator Bug

**Date:** 2025-08-16
**Status:** Resolved
**Priority:** Medium
**Category:** UI/Visual Bug

## Description
In settings, when using server keys, the status indicator should show a yellow dot in both the header and the "API status" module to indicate server-provided keys are being used. Currently, it incorrectly shows "green" as available.

## Expected Behavior
- Header status indicator: Yellow dot when using server keys
- API status module: Yellow dot when using server keys
- Green should only appear when user-provided API keys are configured and working

## Current Behavior
- Both header and API status module show green dot even when using server keys
- No visual distinction between user-provided keys and server keys

## Impact
- Users cannot visually distinguish between server keys and their own API keys
- Misleading status indication may cause confusion about API key configuration

## Affected Components
- SettingsManager.js (API status display logic)
- Header status indicator
- API status module in settings panel

## Reproduction Steps
1. Navigate to settings
2. Observe that server keys are being used (no user API keys configured)
3. Notice both header and API status show green instead of yellow

## Technical Notes
- Status indicator logic needs to differentiate between server keys and user keys
- Color coding: Green = user keys working, Yellow = server keys, Red = no keys/error