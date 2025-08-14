import eventBus from '../services/EventBus.js';
import UIUtils from '../utils/UIUtils.js';

class PhotoGrid {
    constructor() {
        this.currentPhotos = [];
        this.selectedPhotos = new Set();
        this.processingPhotos = new Set();
        this.statusFilter = null;
        this.showProcessedPhotos = true;
        this.showUnprocessedPhotos = true;
        this.isLoadingPhotos = false;
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Listen for photo display requests
        eventBus.on('photos:display', (data) => {
            this.currentPhotos = data.photos || [];
            this.displayPhotos(data.isInitialLoad, data.isRefresh);
        });
        
        // Listen for progressive photo loading
        eventBus.on('photos:append', (data) => {
            this.appendPhotos(data.photos, data.allPhotos);
        });

        // Listen for photo status updates
        eventBus.on('photos:status-updated', (data) => {
            this.updatePhotoStatus(data.photoId, data.newStatus);
        });

        // Listen for selection events
        eventBus.on('photos:select-all', () => {
            this.selectAllPhotos();
        });

        eventBus.on('photos:clear-selection', () => {
            this.clearSelection();
        });

        // Listen for visibility toggle events
        eventBus.on('photos:toggle-processed', () => {
            this.toggleProcessedVisibility();
        });

        eventBus.on('photos:toggle-unprocessed', () => {
            this.toggleUnprocessedVisibility();
        });

        // Listen for filter changes
        eventBus.on('photos:filter-changed', (data) => {
            this.statusFilter = data.filter;
            this.displayPhotos();
        });

        // Listen for processing status changes
        eventBus.on('photos:processing-started', (data) => {
            this.processingPhotos.add(data.photoId);
            this.displayPhotos();
        });

        eventBus.on('photos:processing-completed', (data) => {
            this.processingPhotos.delete(data.photoId);
            this.displayPhotos();
        });

        // Handle image loading progress (moved from ProgressManager)
        eventBus.on('photos:batch-loading:show', (data) => this.showBatchLoading(data));
        eventBus.on('photos:batch-loading:progress', (data) => this.updateBatchLoading(data));
        eventBus.on('photos:batch-loading:complete', () => this.hideBatchLoading());
        eventBus.on('photos:batch-loading:error', () => this.hideBatchLoading());

        // DOM event listeners for photo grid functionality (moved from app.js)
        this.bindDOMEventListeners();
    }

    bindDOMEventListeners() {
        // Photo selection DOM events
        const selectAllButton = document.getElementById('select-all');
        const selectNoneButton = document.getElementById('select-none');
        
        if (selectAllButton) {
            selectAllButton.addEventListener('click', () => eventBus.emit('photos:select-all'));
        }

        if (selectNoneButton) {
            selectNoneButton.addEventListener('click', () => eventBus.emit('photos:clear-selection'));
        }

        // Photo filtering DOM events
        const statusFilter = document.getElementById('status-filter');
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => eventBus.emit('photos:set-filter', { filter: e.target.value }));
        }

        // Visibility toggle DOM events
        const toggleProcessed = document.getElementById('toggle-processed');
        const toggleUnprocessed = document.getElementById('toggle-unprocessed');

        if (toggleProcessed) {
            toggleProcessed.addEventListener('click', () => eventBus.emit('photos:toggle-processed'));
        }

        if (toggleUnprocessed) {
            toggleUnprocessed.addEventListener('click', () => eventBus.emit('photos:toggle-unprocessed'));
        }
    }

    displayPhotos(isInitialLoad = false, isRefresh = false) {
        const photoGrid = document.getElementById('photo-grid');
        const emptyState = document.getElementById('empty-photos');
        const welcomeState = document.getElementById('welcome-state');
        
        // Hide states - this means an album is selected
        welcomeState.classList.add('hidden');
        emptyState.classList.add('hidden');
        
        if (this.currentPhotos.length === 0) {
            photoGrid.classList.add('hidden');
            emptyState.classList.remove('hidden');
            // Hide album actions when no photos
            document.getElementById('album-actions').classList.add('hidden');
            return;
        }
        
        // Show photo controls
        document.getElementById('photo-controls').classList.remove('hidden');
        
        // Show album actions (includes Sync Album button)
        document.getElementById('album-actions').classList.remove('hidden');
        
        // Filter photos if needed
        let photosToShow = this.currentPhotos;
        
        // Apply status filter first
        if (this.statusFilter) {
            if (this.statusFilter === 'processed') {
                // Show photos that have AI metadata
                photosToShow = photosToShow.filter(photo => photo.ai_metadata && photo.ai_metadata.length > 0);
            } else if (this.statusFilter === 'unprocessed') {
                // Show photos that don't have AI metadata
                photosToShow = photosToShow.filter(photo => !photo.ai_metadata || photo.ai_metadata.length === 0);
            } else {
                // Standard status filtering
                photosToShow = photosToShow.filter(photo => photo.processing_status === this.statusFilter);
            }
        }
        
        // Apply visibility toggles
        photosToShow = photosToShow.filter(photo => {
            const isProcessed = photo.processing_status === 'processed' || photo.processing_status === 'completed' || (photo.ai_metadata && photo.ai_metadata.length > 0);
            const isUnprocessed = !isProcessed;
            
            if (isProcessed && !this.showProcessedPhotos) return false;
            if (isUnprocessed && !this.showUnprocessedPhotos) return false;
            
            return true;
        });
        
        // Check if we're still in album view mode before showing photo grid
        if (window.app && window.app.getCurrentViewMode() !== 'album') {
            // Not in album view mode, ensure photo grid stays hidden
            photoGrid.classList.add('hidden');
            return;
        }
        
        // Double-check: only show photo grid if we actually have a current album
        if (!window.app || !window.app.currentAlbum) {
            // No current album selected, keep photo grid hidden
            photoGrid.classList.add('hidden');
            return;
        }
        
        photoGrid.classList.remove('hidden');
        
        // Only clear grid for initial loads or refreshes, not for progressive updates
        if (isInitialLoad || isRefresh) {
            photoGrid.innerHTML = '';
            // Rendering photos
        }
        
        photosToShow.forEach(photo => {
            const photoElement = this.createPhotoCard(photo);
            photoElement.classList.add('photo-fade-in'); // Add animation class
            photoGrid.appendChild(photoElement);
        });
        
        // Update toggle button styles to reflect current state
        this.updateToggleButtonStyles();
    }
    
    // Progressive loading - append new photos without clearing existing ones
    appendPhotos(newPhotos, allPhotos) {
        // Appending new photos
        
        // Update current photos reference
        this.currentPhotos = allPhotos || [...this.currentPhotos, ...newPhotos];
        
        const photoGrid = document.getElementById('photo-grid');
        if (!photoGrid) return;
        
        // Apply same filtering logic as displayPhotos
        let photosToShow = newPhotos;
        
        // Apply status filter
        if (this.statusFilter) {
            if (this.statusFilter === 'processed') {
                photosToShow = photosToShow.filter(photo => photo.ai_metadata && photo.ai_metadata.length > 0);
            } else if (this.statusFilter === 'unprocessed') {
                photosToShow = photosToShow.filter(photo => !photo.ai_metadata || photo.ai_metadata.length === 0);
            } else {
                photosToShow = photosToShow.filter(photo => photo.processing_status === this.statusFilter);
            }
        }
        
        // Apply visibility toggles
        photosToShow = photosToShow.filter(photo => {
            const isProcessed = photo.processing_status === 'processed' || photo.processing_status === 'completed' || (photo.ai_metadata && photo.ai_metadata.length > 0);
            const isUnprocessed = !isProcessed;
            
            if (isProcessed && !this.showProcessedPhotos) return false;
            if (isUnprocessed && !this.showUnprocessedPhotos) return false;
            
            return true;
        });
        
        // Append filtered photos with fade-in animation
        photosToShow.forEach((photo, index) => {
            const photoElement = this.createPhotoCard(photo);
            photoElement.classList.add('photo-fade-in');
            
            // Stagger the fade-in animation for smooth appearance
            setTimeout(() => {
                photoGrid.appendChild(photoElement);
            }, index * 50); // 50ms delay between each photo
        });
        
        // Update photo selection visuals after adding new photos
        this.updatePhotoSelectionVisuals();
    }

    // Helper function to determine consistent photo processing status
    getPhotoProcessingStatus(photo) {
        // Check if photo is currently being processed (UI-only state)
        const photoId = photo.smugmug_id || photo.image_key || photo.local_photo_id;
        if (this.processingPhotos.has(photoId)) {
            return 'processing'; // Temporary UI state
        }
        
        let status = photo.processing_status || 'not_synced';
        const originalStatus = status;
        
        // If photo has AI metadata, it should show as processed regardless of processing_status
        // Exception: respect 'failed' status even if AI metadata exists (edge case)
        if (photo.ai_metadata && photo.ai_metadata.length > 0) {
            if (photo.processing_status !== 'failed') {
                status = 'processed';
            }
        }
        
        // DEBUG: Log status changes for debugging
        if (status !== originalStatus || (photo.processing_status === 'processed' && photo.title)) {
            console.log('🔍 Status determination:', {
                title: photo.title || photo.filename || 'Untitled',
                originalStatus: photo.processing_status,
                finalStatus: status,
                hasAiMetadata: !!(photo.ai_metadata && photo.ai_metadata.length > 0),
                aiMetadataCount: photo.ai_metadata ? photo.ai_metadata.length : 0
            });
        }
        
        return status;
    }

    createPhotoCard(photo) {
        const div = document.createElement('div');
        const cursorClass = photo.is_synced ? 'cursor-pointer' : 'cursor-not-allowed';
        const opacityClass = photo.is_synced ? '' : 'opacity-60';
        div.className = `photo-card relative group ${cursorClass} ${opacityClass}`;
        
        // Use consistent photo ID - prefer smugmug_id, fallback to image_key, then local_photo_id
        const photoId = photo.smugmug_id || photo.image_key || photo.local_photo_id;
        div.setAttribute('data-photo-id', photoId);
        
        // Status indicator styling - supports both backend database values and frontend PHOTO_STATUS constants
        const statusConfig = {
            // Frontend PHOTO_STATUS constants (used by PhotoProcessor)
            'processed': { color: 'bg-green-500', icon: '✓', text: 'Processed' },
            'unprocessed': { color: 'bg-orange-500', icon: '○', text: 'Not Processed' },
            
            // Backend database values (received from API)
            'completed': { color: 'bg-green-500', icon: '✓', text: 'Processed' },
            'not_processed': { color: 'bg-orange-500', icon: '○', text: 'Not Processed' },
            
            // Common values that match between both systems
            'processing': { color: 'bg-yellow-500', icon: '⏳', text: 'Processing' },
            'failed': { color: 'bg-red-500', icon: '✗', text: 'Failed' },
            'not_synced': { color: 'bg-gray-400', icon: '○', text: 'Not Synced' }
        };
        
        // Determine status consistently with filtering logic
        const status = this.getPhotoProcessingStatus(photo);
        const statusInfo = statusConfig[status];
        
        // Check if photo is selected
        const isSelected = this.selectedPhotos.has(photo.smugmug_id);
        const selectionBorder = isSelected ? 'ring-4 ring-blue-500' : '';
        
        div.innerHTML = `
            <div class="photo-container aspect-square bg-gray-100 rounded-lg overflow-hidden relative ${selectionBorder}">
                <img 
                    src="${photo.thumbnail_url}" 
                    alt="${photo.title || 'Photo'}"
                    class="photo-thumbnail w-full h-full object-cover"
                    loading="lazy"
                />
                
                <!-- Selection hover checkmark (shows on hover when not selected) -->
                <div class="selection-hover-checkmark absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity z-19 ${isSelected ? 'hidden' : ''} flex items-center justify-center">
                    <div class="w-8 h-8 bg-white bg-opacity-90 hover:bg-opacity-100 rounded-full flex items-center justify-center text-gray-700 shadow-lg transition-all cursor-pointer">
                        <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                        </svg>
                    </div>
                </div>
                
                <!-- Selection overlay (shows when selected) -->
                ${isSelected ? `
                    <div class="selection-overlay absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center z-15">
                        <div class="selection-checkmark bg-blue-500 text-white rounded-full p-2 shadow-lg">
                            <svg class="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                            </svg>
                        </div>
                    </div>
                ` : ''}
                
                <!-- Collection indicator -->
                ${photo.collections && photo.collections.length > 0 ? `
                    <div class="collection-indicator absolute top-2 left-2 z-20">
                        <div class="w-7 h-7 bg-black bg-opacity-60 rounded-full flex items-center justify-center text-yellow-400">
                            <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                            </svg>
                        </div>
                    </div>
                ` : ''}
                
                <!-- Status indicator (top-right) -->
                <div class="status-indicator absolute top-2 right-2 w-7 h-7 ${statusInfo.color} text-white text-xs rounded-full flex items-center justify-center z-20">
                    <span class="status-icon">${statusInfo.icon}</span>
                </div>
                
                <!-- Lightbox button (moved to bottom-right) -->
                <div class="lightbox-button-container absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                    <button class="lightbox-btn w-7 h-7 bg-black bg-opacity-60 hover:bg-opacity-80 rounded-full flex items-center justify-center text-white transition-all" 
                            onclick="event.stopPropagation()">
                        <svg class="lightbox-icon h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                        </svg>
                    </button>
                </div>
                
                
                <!-- Hover overlay for visual feedback -->
                <div class="hover-overlay absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all z-10">
                    ${!photo.is_synced ? `
                        <div class="sync-tooltip-container absolute inset-0 flex items-center justify-center">
                            <div class="sync-tooltip bg-black bg-opacity-70 text-white text-xs px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                Sync album to enable selection
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        // Add click handler - clicking thumbnail selects photo
        div.addEventListener('click', (e) => {
            // Don't select if clicking on buttons or checkboxes
            if (e.target.type === 'checkbox' || e.target.closest('button')) return;
            
            // If photo is synced, toggle selection
            if (photo.is_synced) {
                const isCurrentlySelected = this.selectedPhotos.has(photo.smugmug_id);
                this.togglePhotoSelection(photo.smugmug_id, !isCurrentlySelected);
            } else {
                // Show message for non-synced photos
                eventBus.emit('ui:show-error', {
                    title: 'Sync Required',
                    message: 'This photo must be synced to the database before it can be selected for processing. Use the "Sync Album" button first.'
                });
            }
        });
        
        // Add lightbox button handler
        const lightboxBtn = div.querySelector('.lightbox-btn');
        if (lightboxBtn) {
            lightboxBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                eventBus.emit('photo:show-modal', { photo });
            });
        }
        
        // Add selection hover checkmark handler
        const hoverCheckmark = div.querySelector('.selection-hover-checkmark');
        if (hoverCheckmark) {
            hoverCheckmark.addEventListener('click', (e) => {
                e.stopPropagation();
                if (photo.is_synced) {
                    this.togglePhotoSelection(photo.smugmug_id, true);
                } else {
                    eventBus.emit('ui:show-error', {
                        title: 'Sync Required',
                        message: 'This photo must be synced to the database before it can be selected for processing. Use the "Sync Album" button first.'
                    });
                }
            });
        }
        
        // Add status indicator click handler for processing
        const statusIndicator = div.querySelector('.status-indicator');
        if (statusIndicator) {
            statusIndicator.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // Prevent processing if photos are still loading
                if (this.isLoadingPhotos) {
                    eventBus.emit('toast:warning', {
                        title: 'Loading in Progress',
                        message: 'Please wait for photos to finish loading before processing.'
                    });
                    return;
                }
                
                eventBus.emit('photos:process-single', { photo });
            });
            
            // Update cursor and hover effects based on loading state
            if (this.isLoadingPhotos) {
                statusIndicator.style.cursor = 'not-allowed';
                statusIndicator.title = 'Cannot process while photos are loading';
                // Remove hover effects during loading
                statusIndicator.classList.remove('hover:scale-110', 'hover:brightness-110');
            } else {
                statusIndicator.style.cursor = 'pointer';
                
                // Add hover effect only for unprocessed photos
                if (status === 'unprocessed' || status === 'not_processed') {
                    statusIndicator.classList.add('hover:scale-110', 'hover:brightness-110', 'transition-all', 'duration-200');
                    statusIndicator.title = 'Click to process with AI';
                } else if (status === 'processed' || status === 'completed') {
                    statusIndicator.title = 'Processed - click to reprocess';
                } else if (status === 'failed') {
                    statusIndicator.title = 'Processing failed - click to retry';
                } else if (status === 'processing') {
                    statusIndicator.title = 'Processing in progress...';
                    statusIndicator.style.cursor = 'default';
                }
            }
        }
        
        return div;
    }

    // Selection Management
    togglePhotoSelection(photoId, isSelected) {
        console.log('togglePhotoSelection called:', { photoId, isSelected, selectedCount: this.selectedPhotos.size });
        if (isSelected) {
            this.selectedPhotos.add(photoId);
        } else {
            this.selectedPhotos.delete(photoId);
        }
        console.log('After toggle, selectedPhotos:', Array.from(this.selectedPhotos));
        this.updateSelectionUI();
    }

    selectAllPhotos() {
        const syncedPhotos = this.currentPhotos.filter(p => p.is_synced);
        syncedPhotos.forEach(photo => {
            this.selectedPhotos.add(photo.smugmug_id);
        });
        this.updateSelectionUI();
    }

    clearSelection() {
        this.selectedPhotos.clear();
        this.updateSelectionUI();
    }

    updateSelectionUI() {
        const count = this.selectedPhotos.size;
        const processButton = document.getElementById('process-selected');
        
        // Update selection count display
        document.getElementById('selection-count').textContent = `${count} selected`;
        
        // Disable button if no photos selected OR if photos are still loading
        const shouldDisable = count === 0 || this.isLoadingPhotos;
        processButton.disabled = shouldDisable;
        
        // Update button text/tooltip based on state
        if (this.isLoadingPhotos) {
            processButton.title = 'Cannot process photos while loading is in progress';
            processButton.textContent = 'Loading Photos...';
        } else if (count === 0) {
            processButton.title = 'Select photos to process';
            processButton.textContent = 'Process Selected';
        } else {
            processButton.title = `Process ${count} selected photo${count > 1 ? 's' : ''}`;
            processButton.textContent = 'Process Selected';
        }
        
        // Update visual indicators for all photos
        this.updatePhotoSelectionVisuals();
        
        // Emit selection change event for other components
        eventBus.emit('photos:selection-changed', {
            selectedPhotos: Array.from(this.selectedPhotos),
            count: count,
            isLoadingPhotos: this.isLoadingPhotos
        });
    }
    
    updatePhotoSelectionVisuals() {
        console.log('updatePhotoSelectionVisuals called, selectedPhotos:', Array.from(this.selectedPhotos));
        // Update visual indicators for each photo
        document.querySelectorAll('.photo-card').forEach(photoCard => {
            const photoId = photoCard.getAttribute('data-photo-id');
            if (!photoId) return;
            
            const isSelected = this.selectedPhotos.has(photoId);
            const imageContainer = photoCard.querySelector('.aspect-square');
            // console.log(`Photo ${photoId}: isSelected=${isSelected}, imageContainer exists=${!!imageContainer}`);
            
            // Update selection border
            if (isSelected) {
                imageContainer.classList.add('ring-4', 'ring-blue-500');
            } else {
                imageContainer.classList.remove('ring-4', 'ring-blue-500');
            }
            
            // Update selection overlay
            let selectionOverlay = photoCard.querySelector('.selection-overlay');
            if (isSelected && !selectionOverlay) {
                // Create selection overlay
                selectionOverlay = document.createElement('div');
                selectionOverlay.className = 'selection-overlay absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center z-15';
                selectionOverlay.innerHTML = `
                    <div class="bg-blue-500 text-white rounded-full p-2 shadow-lg">
                        <svg class="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                        </svg>
                    </div>
                `;
                imageContainer.appendChild(selectionOverlay);
            } else if (!isSelected && selectionOverlay) {
                // Remove selection overlay
                selectionOverlay.remove();
            }
            
            // Update hover checkmark visibility
            const hoverCheckmark = photoCard.querySelector('.selection-hover-checkmark');
            if (hoverCheckmark) {
                if (isSelected) {
                    hoverCheckmark.classList.add('hidden');
                } else {
                    hoverCheckmark.classList.remove('hidden');
                }
            }
        });
    }

    toggleProcessedVisibility() {
        this.showProcessedPhotos = !this.showProcessedPhotos;
        this.updateToggleButtonStyles();
        this.displayPhotos();
    }

    toggleUnprocessedVisibility() {
        this.showUnprocessedPhotos = !this.showUnprocessedPhotos;
        this.updateToggleButtonStyles();
        this.displayPhotos();
    }

    updateToggleButtonStyles() {
        const processedBtn = document.getElementById('toggle-processed');
        const unprocessedBtn = document.getElementById('toggle-unprocessed');

        // Update processed button style
        if (this.showProcessedPhotos) {
            processedBtn.className = 'text-xs px-2 py-1 rounded transition-colors bg-blue-100 text-blue-800 hover:bg-blue-200';
        } else {
            processedBtn.className = 'text-xs px-2 py-1 rounded transition-colors bg-gray-200 text-gray-500 hover:bg-gray-300';
        }

        // Update unprocessed button style - now uses same blue theme when active for consistency
        if (this.showUnprocessedPhotos) {
            unprocessedBtn.className = 'text-xs px-2 py-1 rounded transition-colors bg-blue-100 text-blue-800 hover:bg-blue-200';
        } else {
            unprocessedBtn.className = 'text-xs px-2 py-1 rounded transition-colors bg-gray-200 text-gray-500 hover:bg-gray-300';
        }
    }

    updatePhotoStatus(photoId, newStatus) {
        // Find and update the photo in currentPhotos
        const photo = this.currentPhotos.find(p => 
            (p.smugmug_id && p.smugmug_id === photoId) ||
            (p.image_key && p.image_key === photoId) ||
            (p.local_photo_id && p.local_photo_id === photoId)
        );
        
        if (photo) {
            photo.processing_status = newStatus;
            this.displayPhotos(); // Refresh the display
        }
    }

    // Public API methods
    getCurrentPhotos() {
        return [...this.currentPhotos];
    }

    getSelectedPhotos() {
        return Array.from(this.selectedPhotos);
    }

    getSelectedPhotoCount() {
        return this.selectedPhotos.size;
    }

    setPhotos(photos) {
        this.currentPhotos = photos;
        this.displayPhotos();
    }

    setStatusFilter(filter) {
        this.statusFilter = filter;
        this.displayPhotos();
    }

    setVisibilitySettings(showProcessed, showUnprocessed) {
        this.showProcessedPhotos = showProcessed;
        this.showUnprocessedPhotos = showUnprocessed;
        this.updateToggleButtonStyles();
        this.displayPhotos();
    }

    // Image loading progress methods (moved from ProgressManager)
    showBatchLoading(data) {
        this.isLoadingPhotos = true;
        
        const indicator = document.getElementById('batch-loading-indicator');
        const textElement = document.getElementById('batch-loading-text');
        const fillElement = document.getElementById('batch-progress-fill');
        
        if (!indicator || !textElement || !fillElement) return;
        
        const { loaded, total, progress } = data;
        
        textElement.textContent = `Loading ${loaded} of ${total} photos...`;
        fillElement.style.width = `${progress}%`;
        
        indicator.classList.remove('hidden');
        
        // Update UI to reflect loading state
        this.updateLoadingState();
        
        console.log(`📸 PhotoGrid: Showing photo loading progress - ${loaded}/${total} (${progress}%)`);
    }

    updateBatchLoading(data) {
        const textElement = document.getElementById('batch-loading-text');
        const fillElement = document.getElementById('batch-progress-fill');
        
        if (!textElement || !fillElement) return;
        
        const { loaded, total, progress } = data;
        
        textElement.textContent = `Loading ${loaded} of ${total} photos...`;
        fillElement.style.width = `${progress}%`;
        
        console.log(`📸 PhotoGrid: Updated photo loading progress - ${loaded}/${total} (${progress}%)`);
    }

    hideBatchLoading() {
        this.isLoadingPhotos = false;
        
        const indicator = document.getElementById('batch-loading-indicator');
        if (!indicator) return;
        
        // Update UI to reflect loading complete state
        this.updateLoadingState();
        
        // Smooth fade out
        setTimeout(() => {
            indicator.classList.add('hidden');
            console.log('📸 PhotoGrid: Photo loading complete - hiding indicator');
        }, 1000); // Show completion for 1 second before hiding
    }

    // Check if photos are currently loading
    isPhotoLoadingInProgress() {
        return this.isLoadingPhotos;
    }

    // Update UI elements based on loading state
    updateLoadingState() {
        // Update selection UI to reflect loading state
        this.updateSelectionUI();
        
        // Emit event for other components that might need to know about loading state
        eventBus.emit('photos:loading-state-changed', { 
            isLoading: this.isLoadingPhotos 
        });
    }
}

const photoGrid = new PhotoGrid();
export default photoGrid;