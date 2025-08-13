# Bug Report: AI API Status Down When Using Server Keys

**Date Created:** 2025-08-13  
**Status:** Open  
**Priority:** High  
**Component:** SettingsManager, AI API Integration  

## Description
AI is not connected when using server-side API keys. The API status shows as "down" even when server has valid keys configured, preventing AI processing functionality.

## Expected Behavior
- AI should connect successfully when server has valid API keys configured
- API status should show "connected" or "ready" when server keys are working
- AI processing should be available without requiring client-side key entry

## Actual Behavior
- API status shows as "down" despite server having valid keys
- AI connection fails when relying on server-side configuration
- AI processing functionality is unavailable

## Steps to Reproduce
1. Configure valid API keys on the server side
2. Do not enter API keys in client-side settings
3. Check AI API status in settings page
4. Observe status shows as "down"
5. Attempt AI photo processing - fails due to connection issue

## Technical Details
- **Affected Component:** SettingsManager.js - API status checking
- **Server Config:** Server has valid Anthropic/OpenAI keys configured
- **Client Config:** No client-side keys entered (relying on server)
- **API Status Check:** Status endpoint may not properly detect server keys

## Impact
- **User Experience:** Cannot use AI features with server-side key configuration
- **Functionality:** AI processing completely unavailable
- **Severity:** High - breaks core AI functionality for server-deployed setups

## Potential Root Causes
1. **Status Check Logic:** API status endpoint only checks client-side keys
2. **Server Key Detection:** Backend doesn't properly indicate server key availability
3. **Frontend Logic:** SettingsManager assumes client-side keys are required
4. **API Endpoint Issue:** Status endpoint doesn't account for server configuration
5. **Key Validation:** Server key validation failing or not reported to frontend

## Investigation Notes
- Check API status endpoint logic for server key detection
- Review SettingsManager status checking for server vs client key handling
- Verify server-side key configuration and validation
- Check if status endpoint returns server key availability
- Review AI processing endpoint authentication logic

## Files to Investigate
- `/frontend/components/SettingsManager.js` - API status checking logic
- `/backend/main.py` - API status endpoint implementation
- Server-side key configuration and validation
- AI processing authentication flow
- Status reporting for server vs client key modes

## Related Issues
- AI photo processing fails when using server keys
- Settings page incorrectly shows API as unavailable
- Server deployment configuration not properly handled

## Additional Context
This affects server deployments where administrators configure API keys server-side rather than requiring users to enter their own keys.