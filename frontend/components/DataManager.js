/**
 * DataManager Component
 * 
 * Handles data validation, status confirmation, and data integrity operations.
 * 
 * Key Responsibilities:
 * - Processing status confirmation and validation
 * - Data synchronization between frontend and backend
 * - Data integrity checks
 * - Background data operations
 */

import eventBus from '../services/EventBus.js';
import cacheManager from '../managers/CacheManager.js';

class DataManager {
    constructor() {
        this.apiBase = 'http://localhost:8000';
        this.currentLoadingController = null; // AbortController for cancelling photo loading
        this.isLoadingPhotos = false; // Flag to freeze operations during loading
        
        this.setupEventListeners();
        // Component initialized
    }

    setupEventListeners() {
        // Data management events
        eventBus.on('data:confirm-processing-status', () => this.confirmProcessingStatus());
        eventBus.on('data:load-album-photos', (data) => this.loadAlbumPhotos(data.albumId, data.app));
        
        // Photo loading cancellation
        eventBus.on('data:cancel-photo-loading', () => this.cancelPhotoLoading());
        
        // Check if operations should be blocked
        eventBus.on('data:check-loading-state', (callback) => {
            if (typeof callback === 'function') {
                callback(this.isLoadingPhotos);
            }
        });
    }

    // Method to set loading state and emit events
    setLoadingState(isLoading) {
        this.isLoadingPhotos = isLoading;
        eventBus.emit('data:loading-state-changed', { isLoading });
        
        if (isLoading) {
            eventBus.emit('ui:freeze-navigation', { reason: 'Loading photos...' });
        } else {
            eventBus.emit('ui:unfreeze-navigation');
        }
    }

    // Processing Status Confirmation
    async confirmProcessingStatus() {
        try {
            const response = await fetch(`${this.apiBase}/photos/confirm-processing-status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (response.ok) {
                const result = await response.json();
                console.log('Processing status confirmation result:', result);
                
                // Emit success event
                eventBus.emit('toast:success', { 
                    title: 'Status Confirmed', 
                    message: `${result.photos_updated} photos updated` 
                });
                
                // Trigger photo grid refresh
                eventBus.emit('photos:refresh-display');
                
                return result;
            } else {
                const errorData = await response.json();
                console.error('Failed to confirm processing status:', errorData);
                
                eventBus.emit('toast:error', { 
                    title: 'Error', 
                    message: 'Failed to confirm processing status' 
                });
                
                return null;
            }
        } catch (error) {
            console.error('Error confirming processing status:', error);
            eventBus.emit('toast:error', { 
                title: 'Error', 
                message: 'Failed to confirm processing status' 
            });
            return null;
        }
    }

    // Data Validation Methods
    async validateDataIntegrity() {
        try {
            const response = await fetch(`${this.apiBase}/data/validate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (response.ok) {
                const result = await response.json();
                console.log('Data integrity validation result:', result);
                return result;
            } else {
                console.error('Data integrity validation failed');
                return null;
            }
        } catch (error) {
            console.error('Error validating data integrity:', error);
            return null;
        }
    }

    // Photo Loading Cancellation
    cancelPhotoLoading() {
        if (this.currentLoadingController) {
            // Cancelling photo loading
            this.currentLoadingController.abort();
            this.currentLoadingController = null;
            eventBus.emit('photos:loading:cancelled');
        }
        // Always unfreeze operations when cancelling
        this.setLoadingState(false);
    }

    // Photo Loading Methods
    async loadAlbumPhotos(albumId, app) {
        // Check if already loading - if so, ignore new requests
        if (this.isLoadingPhotos) {
            eventBus.emit('toast:warning', { 
                title: 'Loading in Progress', 
                message: 'Please wait for current photos to finish loading' 
            });
            return;
        }

        // Set loading state to freeze operations
        this.setLoadingState(true);
        
        // Cancel any existing photo loading
        this.cancelPhotoLoading();
        
        // Create new AbortController for this loading operation
        this.currentLoadingController = new AbortController();
        // Reset state for new album load
        app.currentPhotos = [];
        app.photosMetadata = { totalCount: 0, loadedCount: 0, hasMore: false };
        
        // Check cache first
        const cachedPhotos = cacheManager.getCachedAlbumPhotos(albumId);
        if (cachedPhotos && Array.isArray(cachedPhotos) && cachedPhotos.length > 0) {
            // For cached photos, show immediately but still freeze during background refresh
            app.currentPhotos = cachedPhotos;
            app.photosMetadata = { 
                totalCount: cachedPhotos.length, 
                loadedCount: cachedPhotos.length, 
                hasMore: false 
            };
            eventBus.emit('photos:display', { photos: app.currentPhotos, isInitialLoad: true });
            await this.refreshAlbumPhotosInBackground(albumId, app);
            this.setLoadingState(false); // Unfreeze after background refresh
            return;
        }
        
        // Show loading state
        eventBus.emit('photos:loading:show');
        
        try {
            // Load first batch of photos (30 photos)
            await this.fetchPhotoBatch(albumId, app, 0, 30, true);
        } finally {
            // Always unfreeze operations when loading completes or fails
            this.setLoadingState(false);
        }
    }
    
    // New method for batch loading with pagination
    async fetchPhotoBatch(albumId, app, skip = 0, limit = 30, isInitialLoad = false) {
        try {
            // Check if loading was cancelled before making request
            if (!this.currentLoadingController) {
                // Photo loading cancelled
                return;
            }

            const response = await fetch(`${this.apiBase}/smugmug/albums/${albumId}/photos?skip=${skip}&limit=${limit}`, {
                signal: this.currentLoadingController.signal
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            const { photos, total_count, returned_count, has_more } = data;
            
            // Photo batch loaded
            
            // Update app state
            if (isInitialLoad) {
                // First batch - replace current photos
                app.currentPhotos = photos;
                app.photosMetadata = {
                    totalCount: total_count,
                    loadedCount: returned_count,
                    hasMore: has_more
                };
                
                // Cache the first batch
                cacheManager.setCachedAlbumPhotos(albumId, photos);
                
                // Display first batch immediately
                eventBus.emit('photos:display', { photos: app.currentPhotos, isInitialLoad: true });
                eventBus.emit('photos:loading:hide');
                
                // Show loading progress for remaining photos
                if (has_more) {
                    eventBus.emit('photos:batch-loading:show', {
                        loaded: returned_count,
                        total: total_count,
                        progress: Math.round((returned_count / total_count) * 100)
                    });
                    
                    // Start loading remaining batches in background
                    this.loadRemainingPhotos(albumId, app, returned_count, total_count);
                }
            } else {
                // Subsequent batch - append to existing photos
                app.currentPhotos = [...app.currentPhotos, ...photos];
                app.photosMetadata.loadedCount += returned_count;
                app.photosMetadata.hasMore = has_more;
                
                // Update cache with all photos
                cacheManager.setCachedAlbumPhotos(albumId, app.currentPhotos);
                
                // Append new photos to display
                eventBus.emit('photos:append', { photos: photos, allPhotos: app.currentPhotos });
                
                // Update progress
                eventBus.emit('photos:batch-loading:progress', {
                    loaded: app.photosMetadata.loadedCount,
                    total: app.photosMetadata.totalCount,
                    progress: Math.round((app.photosMetadata.loadedCount / app.photosMetadata.totalCount) * 100)
                });
                
                if (!has_more) {
                    eventBus.emit('photos:batch-loading:complete');
                }
            }
            
            // Clear album item loading indicator
            if (app.currentAlbum) {
                const albumIdForProgress = app.currentAlbum.album_key || app.currentAlbum.node_id;
                eventBus.emit('progress:hide-item-loading', { itemId: albumIdForProgress });
            }
            
        } catch (error) {
            // Handle abort errors gracefully (user navigated away)
            if (error.name === 'AbortError') {
                // Photo batch loading cancelled
                return; // Don't show error messages for user-initiated cancellation
            }
            
            console.error('Failed to load photo batch:', error);
            eventBus.emit('toast:error', { 
                title: 'Failed to Load Photos', 
                message: `Could not fetch photos from this album. ${error.message}` 
            });
            eventBus.emit('photos:loading:hide');
            eventBus.emit('photos:batch-loading:error');
            
            // Clear album item loading indicator on error
            if (app.currentAlbum) {
                const albumIdForProgress = app.currentAlbum.album_key || app.currentAlbum.node_id;
                eventBus.emit('progress:hide-item-loading', { itemId: albumIdForProgress });
            }
        }
    }
    
    // Load remaining photos in background after initial batch
    async loadRemainingPhotos(albumId, app, currentCount, totalCount) {
        const batchSize = 30;
        let skip = currentCount;
        
        while (skip < totalCount && app.photosMetadata.hasMore) {
            // Small delay between batches to avoid overwhelming the system
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Check if we're still viewing the same album
            const currentAlbumId = app.currentAlbum?.smugmug_id || app.currentAlbum?.album_key;
            if (currentAlbumId !== albumId) {
                // Album changed, stopping background loading
                break;
            }
            
            await this.fetchPhotoBatch(albumId, app, skip, batchSize, false);
            skip += batchSize;
        }
        
        // Background loading complete
    }
    
    // Legacy method - redirect to batch loading for compatibility
    async fetchAlbumPhotos(albumId, app) {
        // Redirecting to batch loading
        await this.fetchPhotoBatch(albumId, app, 0, 100, true); // Load larger first batch for legacy calls
    }
    
    async refreshAlbumPhotosInBackground(albumId, app) {
        try {
            // Check if this background refresh is still relevant (loading not cancelled)
            if (!this.currentLoadingController) {
                return; // Loading was cancelled, don't continue with background refresh
            }

            // Background refresh - load all photos in batches to compare with cache
            let allFreshPhotos = [];
            let skip = 0;
            const batchSize = 100;
            let hasMore = true;
            let totalCount = 0;
            let isFirstBatch = true;
            
            while (hasMore) {
                const response = await fetch(`${this.apiBase}/smugmug/albums/${albumId}/photos?skip=${skip}&limit=${batchSize}`, {
                    signal: this.currentLoadingController.signal
                });
                if (!response.ok) return;
                
                const data = await response.json();
                const batchPhotos = data.photos || [];
                
                // Set total count from first batch
                if (isFirstBatch) {
                    totalCount = data.total_count || 0;
                    
                    // Only show UI indicator if there are more photos to load beyond first batch
                    if (totalCount > batchSize) {
                        eventBus.emit('photos:batch-loading:show', {
                            loaded: Math.min(batchSize, totalCount),
                            total: totalCount,
                            progress: Math.round((Math.min(batchSize, totalCount) / totalCount) * 100)
                        });
                    }
                    isFirstBatch = false;
                }
                
                allFreshPhotos = [...allFreshPhotos, ...batchPhotos];
                
                hasMore = data.has_more && batchPhotos.length === batchSize;
                skip += batchSize;
                
                // Update progress indicator for subsequent batches
                if (totalCount > batchSize) {
                    eventBus.emit('photos:batch-loading:progress', {
                        loaded: allFreshPhotos.length,
                        total: totalCount,
                        progress: Math.round((allFreshPhotos.length / totalCount) * 100)
                    });
                }
                
                // Add small delay between batches to avoid overwhelming the system
                if (hasMore) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
                
                // Check if we're still in the same context
                if (!this.currentLoadingController) {
                    return; // Loading was cancelled
                }
            }
            
            // Hide loading indicator when complete
            if (totalCount > batchSize) {
                eventBus.emit('photos:batch-loading:complete');
            }
            
            const freshPhotos = allFreshPhotos;
            
            cacheManager.setCachedAlbumPhotos(albumId, freshPhotos);
            
            // Double-check that this album is still the current album before updating UI
            if (app.currentAlbum && (app.currentAlbum.smugmug_id === albumId || app.currentAlbum.album_key === albumId) && this.currentLoadingController) {
                if (JSON.stringify(app.currentPhotos) !== JSON.stringify(freshPhotos)) {
                    // Photos updated from background refresh
                    app.currentPhotos = freshPhotos;
                    app.photosMetadata = {
                        totalCount: freshPhotos.length,
                        loadedCount: freshPhotos.length,
                        hasMore: false // All photos loaded during background refresh
                    };
                    eventBus.emit('photos:display', { photos: app.currentPhotos, isRefresh: true });
                }
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                // Background refresh cancelled - this is normal
                return;
            }
            console.log('Background refresh failed (ignoring):', error.message);
            // Hide any active batch loading indicator on error
            eventBus.emit('photos:batch-loading:error');
        }
    }

    // Background Data Sync
    async syncDataInBackground() {
        try {
            await this.confirmProcessingStatus();
        } catch (error) {
            console.error('Background data sync failed:', error);
        }
    }
}

// Create and export singleton instance
const dataManager = new DataManager();
export default dataManager;