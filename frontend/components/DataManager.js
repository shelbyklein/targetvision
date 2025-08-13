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
        // Check cache first
        const cachedPhotos = cacheManager.getCachedAlbumPhotos(albumId);
        if (cachedPhotos) {
            app.currentPhotos = cachedPhotos;
            eventBus.emit('photos:display', { photos: app.currentPhotos });
            this.refreshAlbumPhotosInBackground(albumId, app);
            return;
        }
        
        eventBus.emit('photos:loading:show');
        await this.fetchAlbumPhotos(albumId, app);
    }
    
    async fetchAlbumPhotos(albumId, app) {
        try {
            const response = await fetch(`${this.apiBase}/smugmug/albums/${albumId}/photos`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            app.currentPhotos = await response.json();
            cacheManager.setCachedAlbumPhotos(albumId, app.currentPhotos);
            
            eventBus.emit('photos:display', { photos: app.currentPhotos });
            eventBus.emit('photos:loading:hide');
            
            // Clear album item loading indicator if it exists
            if (app.currentAlbum) {
                const albumId = app.currentAlbum.album_key || app.currentAlbum.node_id;
                eventBus.emit('progress:hide-item-loading', { itemId: albumId });
            }
            
        } catch (error) {
            console.error('Failed to load photos:', error);
            eventBus.emit('toast:error', { title: 'Failed to Load Photos', message: `Could not fetch photos from this album. ${error.message}` });
            eventBus.emit('photos:loading:hide');
            
            // Clear album item loading indicator on error
            if (app.currentAlbum) {
                const albumId = app.currentAlbum.album_key || app.currentAlbum.node_id;
                eventBus.emit('progress:hide-item-loading', { itemId: albumId });
            }
        }
    }
    
    async refreshAlbumPhotosInBackground(albumId, app) {
        try {
            const response = await fetch(`${this.apiBase}/smugmug/albums/${albumId}/photos`);
            if (!response.ok) return;
            
            const freshPhotos = await response.json();
            cacheManager.setCachedAlbumPhotos(albumId, freshPhotos);
            
            if (app.currentAlbum && (app.currentAlbum.smugmug_id === albumId || app.currentAlbum.album_key === albumId)) {
                if (JSON.stringify(app.currentPhotos) !== JSON.stringify(freshPhotos)) {
                    app.currentPhotos = freshPhotos;
                    eventBus.emit('photos:display', { photos: app.currentPhotos });
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