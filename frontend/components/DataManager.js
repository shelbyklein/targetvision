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
        
        this.setupEventListeners();
        console.log('DataManager initialized');
    }

    setupEventListeners() {
        // Data management events
        eventBus.on('data:confirm-processing-status', () => this.confirmProcessingStatus());
        eventBus.on('data:load-album-photos', (data) => this.loadAlbumPhotos(data.albumId, data.app));
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

    // Photo Loading Methods
    async loadAlbumPhotos(albumId, app) {
        // Reset state for new album load
        app.currentPhotos = [];
        app.photosMetadata = { totalCount: 0, loadedCount: 0, hasMore: false };
        
        // Check cache first
        const cachedPhotos = cacheManager.getCachedAlbumPhotos(albumId);
        if (cachedPhotos && Array.isArray(cachedPhotos) && cachedPhotos.length > 0) {
            // For cached photos, show immediately and load fresh data in background
            app.currentPhotos = cachedPhotos;
            app.photosMetadata = { 
                totalCount: cachedPhotos.length, 
                loadedCount: cachedPhotos.length, 
                hasMore: false 
            };
            eventBus.emit('photos:display', { photos: app.currentPhotos, isInitialLoad: true });
            this.refreshAlbumPhotosInBackground(albumId, app);
            return;
        }
        
        // Show loading state
        eventBus.emit('photos:loading:show');
        
        // Load first batch of photos (30 photos)
        await this.fetchPhotoBatch(albumId, app, 0, 30, true);
    }
    
    // New method for batch loading with pagination
    async fetchPhotoBatch(albumId, app, skip = 0, limit = 30, isInitialLoad = false) {
        try {
            const response = await fetch(`${this.apiBase}/smugmug/albums/${albumId}/photos?skip=${skip}&limit=${limit}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            const { photos, total_count, returned_count, has_more } = data;
            
            console.log(`📸 DataManager: Loaded batch - skip: ${skip}, limit: ${limit}, returned: ${returned_count}, total: ${total_count}, hasMore: ${has_more}`);
            
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
                console.log('📸 DataManager: Album changed, stopping background loading');
                break;
            }
            
            await this.fetchPhotoBatch(albumId, app, skip, batchSize, false);
            skip += batchSize;
        }
        
        console.log(`📸 DataManager: Background loading complete for album ${albumId}`);
    }
    
    // Legacy method - redirect to batch loading for compatibility
    async fetchAlbumPhotos(albumId, app) {
        console.log('📸 DataManager: fetchAlbumPhotos called - redirecting to batch loading');
        await this.fetchPhotoBatch(albumId, app, 0, 100, true); // Load larger first batch for legacy calls
    }
    
    async refreshAlbumPhotosInBackground(albumId, app) {
        try {
            console.log('📸 DataManager: Background refresh for album', albumId);
            // For background refresh, load all photos to compare with cache
            const response = await fetch(`${this.apiBase}/smugmug/albums/${albumId}/photos?skip=0&limit=100`);
            if (!response.ok) return;
            
            const data = await response.json();
            const freshPhotos = data.photos || data; // Handle both new and old API responses
            
            cacheManager.setCachedAlbumPhotos(albumId, freshPhotos);
            
            if (app.currentAlbum && (app.currentAlbum.smugmug_id === albumId || app.currentAlbum.album_key === albumId)) {
                if (JSON.stringify(app.currentPhotos) !== JSON.stringify(freshPhotos)) {
                    console.log('📸 DataManager: Photos changed in background, updating display');
                    app.currentPhotos = freshPhotos;
                    app.photosMetadata = {
                        totalCount: data.total_count || freshPhotos.length,
                        loadedCount: freshPhotos.length,
                        hasMore: data.has_more || false
                    };
                    eventBus.emit('photos:display', { photos: app.currentPhotos, isRefresh: true });
                }
            }
        } catch (error) {
            console.log('Background refresh failed (ignoring):', error.message);
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