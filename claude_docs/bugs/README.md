# Bug Tracking System

## Overview
This directory tracks bugs, issues, and fixes for the TargetVision application using a simple file-based system.

## Directory Structure
```
bugs/
├── README.md           # This file - tracking guidelines
├── open/              # Newly discovered bugs awaiting triage
├── in-progress/       # Bugs currently being worked on
└── resolved/          # Fixed bugs for reference and patterns
```

## Bug Report Format

### File Naming Convention
`YYYY-MM-DD-brief-description.md`

Example: `2025-08-13-modal-not-closing.md`

### Bug Report Template
```markdown
# Bug Title

**Date Reported**: YYYY-MM-DD
**Reporter**: Name or Role
**Priority**: Critical | High | Medium | Low
**Component**: Affected component (e.g., ModalManager, PhotoGrid, etc.)
**Status**: Open | In Progress | Testing | Resolved

## Description
Brief description of the issue

## Steps to Reproduce
1. Step one
2. Step two
3. Expected vs actual behavior

## Environment
- Browser: Chrome/Firefox/Safari version
- OS: Windows/macOS/Linux
- Backend status: Running/Not running
- Error messages: Any console errors

## Investigation Notes
- Initial analysis
- Potential causes
- Related components

## Resolution (when resolved)
- Root cause identified
- Fix implemented
- Testing completed
- Verification steps

## Related Issues
- Links to similar bugs
- Dependencies or blockers
```

## Workflow

### 1. Bug Discovery
- Create new file in `bugs/open/`
- Use standard template
- Set initial priority

### 2. Bug Triage
- Review and prioritize
- Move to appropriate folder
- Assign if needed

### 3. Work in Progress
- Move to `bugs/in-progress/`
- Update status and investigation notes
- Document fix attempts

### 4. Resolution
- Move to `bugs/resolved/`
- Update with final resolution
- Include verification steps

## Bug Categories

### Component-Specific Bugs
- **AlbumBrowser**: Navigation, breadcrumbs, folder display
- **PhotoGrid**: Photo rendering, selection, status indicators
- **ModalManager**: Photo modals, lightbox, metadata editing
- **SearchManager**: Search functionality, filtering, results
- **CollectionsManager**: Collection CRUD, photo organization
- **ChatManager**: Chat interface, natural language queries
- **SettingsManager**: Configuration, API keys, LLM status
- **ToastManager**: Notifications, message display
- **ProgressManager**: Loading states, progress indicators
- **NavigationManager**: Page routing, navigation state
- **DataManager**: Data validation, status confirmation

### System-Wide Issues
- **EventBus**: Event communication, listener management
- **Performance**: Loading times, memory usage, responsiveness
- **Authentication**: SmugMug OAuth, session management
- **API**: Backend communication, error handling
- **UI/UX**: Layout, styling, responsive design

## Priority Guidelines

### Critical
- Application won't start
- Data loss possible
- Security vulnerabilities
- Complete feature failure

### High
- Major feature broken
- Affects core workflow
- Multiple users impacted
- Workaround difficult

### Medium
- Minor feature issue
- Workaround available
- Limited user impact
- Cosmetic but noticeable

### Low
- Minor cosmetic issues
- Edge case scenarios
- Enhancement requests
- Documentation issues

## Best Practices

1. **Be Specific**: Include exact error messages and steps
2. **Screenshots**: Add screenshots for UI issues
3. **Console Logs**: Include relevant browser console output
4. **Component Isolation**: Test if issue is component-specific
5. **EventBus Debugging**: Use `eventBus.listEvents()` for communication issues
6. **Version Information**: Note which commit/version exhibits the bug
7. **Cross-Reference**: Link related bugs and issues

## Integration with Development

### Code Comments
Reference bug reports in code:
```javascript
// TODO: Fix modal closing issue - see bugs/2025-08-13-modal-not-closing.md
// HACK: Temporary workaround for PhotoGrid selection bug
```

### Git Commits
Reference bugs in commit messages:
```
Fix: Resolve modal closing issue

- Fixed event listener cleanup in ModalManager
- Resolves bug reported in bugs/2025-08-13-modal-not-closing.md
- Added proper cleanup in component destructor
```

### Testing
- Verify fixes with steps from bug reports
- Add regression tests for critical bugs
- Update documentation with lessons learned