# App.js Refactoring TODO List

## Phase 1: Extract Core Managers (Priority: High)

### Step 1.1: Setup Infrastructure ✅ COMPLETED
- [x] Create folder structure
- [x] Implement EventBus service
- [x] Create APIService base class
- [x] Setup Constants and UIUtils

### Step 1.2: Extract Core Managers
- [ ] Extract CacheManager (~200 lines)
  - [ ] `loadCache()`, `saveCache()`, `clearCache()`
  - [ ] `getCachedAlbumPhotos()`, `setCachedAlbumPhotos()`
  - [ ] `getCachedFolderContents()`, `setCachedFolderContents()`
  - [ ] `isCacheValid()`, `updateCacheStatus()`
  - [ ] Test cache integration

- [ ] Extract StateManager (~300 lines)
  - [ ] `saveAppState()`, `loadAppState()`, `loadStateFromURL()`
  - [ ] `updateURL()`, `restoreStateFromData()`
  - [ ] URL parameter handling and browser history management
  - [ ] Test state persistence

- [ ] Extract SmugMugAPI (~400 lines)
  - [ ] `checkAuthentication()`, `loadSmugMugAlbums()`
  - [ ] `loadFolderContents()`, `fetchFolderContents()`
  - [ ] `syncCurrentAlbum()`, OAuth handling
  - [ ] Test SmugMug integration

- [ ] Extract PhotoProcessor (~500 lines)
  - [ ] `processSelectedPhotos()`, `processSinglePhoto()`
  - [ ] `generateMissingEmbeddings()`, batch processing logic
  - [ ] Status updates, progress tracking
  - [ ] Test photo processing

### Step 1.3: Integration Testing
- [ ] Test manager integration with EventBus
- [ ] Verify no functionality regression
- [ ] Update main app.js to use new managers
- [ ] Test end-to-end workflows

## Phase 2: Extract UI Components (Priority: Medium)

### Step 2.1: Extract UI Components
- [ ] Extract AlbumBrowser (~800 lines)
  - [ ] `displayAlbums()`, `displayFolderContents()`
  - [ ] `createHierarchicalTree()`, folder navigation
  - [ ] `updateBreadcrumbs()`, breadcrumb management
  - [ ] Album/folder selection and hierarchy display

- [ ] Extract PhotoGrid (~600 lines)
  - [ ] `displayPhotos()`, `createPhotoCard()`
  - [ ] Photo selection, status indicators
  - [ ] Grid layout, thumbnail management
  - [ ] `updatePhotoThumbnailStatus()`, visual updates

- [ ] Extract ProgressManager (~200 lines)
  - [ ] `showBatchProgress()`, `showGlobalProgress()`
  - [ ] Progress bar updates, loading states
  - [ ] `updateGlobalProgress()`, visual feedback

- [ ] Extract ModalManager (~300 lines)
  - [ ] Photo modal display, metadata editing
  - [ ] Dialog management, overlay handling
  - [ ] Modal state management

- [ ] Extract ToastManager (~150 lines)
  - [ ] `showToast()`, `removeToast()`
  - [ ] `showSuccessMessage()`, `showErrorMessage()`
  - [ ] Notification queue management

### Step 2.2: Component Integration Testing
- [ ] Test component rendering
- [ ] Verify event-driven communication
- [ ] Test UI interactions
- [ ] Performance validation

## Phase 3: Extract Feature Modules (Priority: Low)

### Step 3.1: Extract Feature Modules
- [ ] Extract CollectionsManager (~400 lines)
  - [ ] Collection CRUD operations
  - [ ] Photo-collection associations
  - [ ] Collection display and management

- [ ] Extract SearchManager (~300 lines)
  - [ ] Search functionality, filtering
  - [ ] `populateAlbumFilter()`, search UI
  - [ ] Result display and pagination

- [ ] Extract ChatManager (~200 lines)
  - [ ] Chat interface, message handling
  - [ ] Natural language query processing
  - [ ] Chat UI and interaction

- [ ] Extract SettingsManager (~250 lines)
  - [ ] API key management, LLM status
  - [ ] `checkLLMStatus()`, `updateLLMStatusDisplay()`
  - [ ] Configuration persistence

### Step 3.2: Feature Integration Testing
- [ ] Test feature functionality
- [ ] Validate module communication
- [ ] End-to-end feature testing

## Phase 4: Final Integration & Testing

### Step 4.1: Refactor Main Controller
- [ ] Refactor main app.js controller (~500 lines target)
- [ ] Implement event-driven architecture
- [ ] Remove duplicate code
- [ ] Clean up interfaces

### Step 4.2: Comprehensive Testing
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Browser compatibility testing
- [ ] Memory leak detection

### Step 4.3: Documentation & Cleanup
- [ ] Update code documentation
- [ ] Create module usage examples
- [ ] Update CLAUDE.md instructions
- [ ] Archive old app.js as backup

## Success Metrics Tracking

### Code Quality Metrics
- [ ] Main app.js reduced to <500 lines (Current: 6,286 lines)
- [ ] Each module <1000 lines
- [ ] Single responsibility per module
- [ ] Clear module interfaces

### Performance Metrics
- [ ] Initial load time improvement
- [ ] Memory usage optimization
- [ ] Bundle size reduction
- [ ] Runtime performance validation

### Maintainability Metrics
- [ ] Easy functionality location
- [ ] Simplified feature additions
- [ ] Isolated bug fixes
- [ ] Improved code readability

## Notes & Decisions

### Completed Infrastructure (2025-01-12)
- ✅ Created modular directory structure
- ✅ Implemented EventBus for decoupled communication
- ✅ Built APIService with interceptors and error handling
- ✅ Setup comprehensive Constants for configuration
- ✅ Created UIUtils with DOM manipulation helpers

### Next Priority
Focus on Step 1.2: Extract Core Managers, starting with CacheManager as it has the fewest dependencies.

### Risk Mitigation
- Incremental extraction approach
- Maintain backward compatibility during transition
- Comprehensive testing at each step
- Keep rollback capability

---

**Status**: Phase 1.1 Complete - Ready for Manager Extraction  
**Last Updated**: 2025-01-12  
**Current Line Count**: 6,286 lines → Target: 500 lines