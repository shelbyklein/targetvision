import eventBus from '../services/EventBus.js';
import apiService from '../services/APIService.js';
import cacheManager from './CacheManager.js';
import { EVENTS, API_ENDPOINTS } from '../utils/Constants.js';
import UIUtils from '../utils/UIUtils.js';

class SmugMugAPI {
    constructor() {
        this.apiBase = 'http://localhost:8000';
        this.smugmugAlbums = [];
        this.currentNodeUri = null;
        this.breadcrumbs = [];
        this.nodeHistory = [];
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        eventBus.on('app:sync-album', (data) => {
            this.syncCurrentAlbum(data.album);
        });

        eventBus.on('albums:sync-all', () => {
            this.syncAllAlbums();
        });

        eventBus.on('state:restore-folder', async (data) => {
            await this.loadFolderContents(data.nodeUri);
        });
    }

    async checkAuthentication() {
        try {
            const authStatus = await apiService.get('/auth/status');
            
            const loading = document.getElementById('auth-loading');
            const success = document.getElementById('auth-success');
            const error = document.getElementById('auth-error');
            const username = document.getElementById('auth-username');
            
            if (loading) UIUtils.hide(loading);
            
            if (authStatus.authenticated) {
                if (success) UIUtils.show(success);
                if (username) username.textContent = `(@${authStatus.username})`;
                
                eventBus.emit('smugmug:auth-success', { username: authStatus.username });
            } else {
                if (error) UIUtils.show(error);
                eventBus.emit('smugmug:auth-failed');
            }
            
            return authStatus;
            
        } catch (err) {
            console.error('Authentication check failed:', err);
            const loading = document.getElementById('auth-loading');
            const error = document.getElementById('auth-error');
            
            if (loading) UIUtils.hide(loading);
            if (error) UIUtils.show(error);
            
            eventBus.emit('smugmug:auth-error', { error: err });
            throw err;
        }
    }

    async loadSmugMugAlbums() {
        await this.loadFolderContents();
    }
    
    async loadFolderContents(nodeUri = null) {
        // Check cache first for instant loading
        const cachedContents = cacheManager.getCachedFolderContents(nodeUri);
        if (cachedContents) {
            console.log('Using cached folder contents');
            this.smugmugAlbums = cachedContents.nodes || [];
            this.currentNodeUri = nodeUri;
            
            // Update breadcrumbs from cache
            if (cachedContents.breadcrumbs) {
                this.breadcrumbs = cachedContents.breadcrumbs;
            } else {
                this.breadcrumbs = [];
            }
            
            eventBus.emit('smugmug:folder-loaded', {
                nodeUri,
                albums: this.smugmugAlbums,
                breadcrumbs: this.breadcrumbs,
                fromCache: true
            });
            
            // Emit folder change for state management
            eventBus.emit('app:folder-changed', {
                nodeUri,
                breadcrumbs: this.breadcrumbs,
                nodeHistory: this.nodeHistory || []
            });
            
            // Refresh in background to ensure cache is up to date
            this.refreshFolderContentsInBackground(nodeUri);
            return this.smugmugAlbums;
        }
        
        // No cache, show loading and fetch fresh data
        eventBus.emit('smugmug:loading-start', { nodeUri });
        eventBus.emit('folders:loading:show');
        return await this.fetchFolderContents(nodeUri);
    }
    
    async fetchFolderContents(nodeUri = null) {
        try {
            const endpoint = nodeUri 
                ? `/smugmug/nodes?node_uri=${encodeURIComponent(nodeUri)}`
                : '/smugmug/nodes';
            
            const data = await apiService.get(endpoint);
            
            // Cache the fresh data
            cacheManager.setCachedFolderContents(nodeUri, data);
            
            this.smugmugAlbums = data.nodes || [];
            this.currentNodeUri = nodeUri;
            
            // Update breadcrumbs
            if (data.breadcrumbs) {
                this.breadcrumbs = data.breadcrumbs;
            } else {
                this.breadcrumbs = [];
            }
            
            eventBus.emit('smugmug:folder-loaded', {
                nodeUri,
                albums: this.smugmugAlbums,
                breadcrumbs: this.breadcrumbs,
                fromCache: false
            });
            
            // Emit folder change for state management
            eventBus.emit('app:folder-changed', {
                nodeUri,
                breadcrumbs: this.breadcrumbs,
                nodeHistory: this.nodeHistory || []
            });
            
            // Hide loading state
            eventBus.emit('folders:loading:hide');
            
            return this.smugmugAlbums;
            
        } catch (error) {
            console.error('Error fetching folder contents:', error);
            eventBus.emit('smugmug:folder-error', { nodeUri, error });
            // Hide loading state on error
            eventBus.emit('folders:loading:hide');
            throw error;
        }
    }

    async refreshFolderContentsInBackground(nodeUri = null) {
        try {
            console.log('Refreshing folder contents in background for:', nodeUri || 'root');
            
            const endpoint = nodeUri 
                ? `/smugmug/nodes?node_uri=${encodeURIComponent(nodeUri)}`
                : '/smugmug/nodes';
            
            const freshData = await apiService.get(endpoint);
            
            // Update cache with fresh data
            cacheManager.setCachedFolderContents(nodeUri, freshData);
            
            // Only update UI if this is still the current folder
            if (this.currentNodeUri === nodeUri) {
                // Check if data actually changed to avoid unnecessary re-renders
                const hasChanged = JSON.stringify(this.smugmugAlbums) !== JSON.stringify(freshData.nodes || []);
                
                if (hasChanged) {
                    console.log('Folder data updated from background refresh');
                    this.smugmugAlbums = freshData.nodes || [];
                    
                    // Update breadcrumbs if they changed
                    if (freshData.breadcrumbs) {
                        this.breadcrumbs = freshData.breadcrumbs;
                    }
                    
                    eventBus.emit('smugmug:folder-updated', {
                        nodeUri,
                        albums: this.smugmugAlbums,
                        breadcrumbs: this.breadcrumbs
                    });
                }
            }
            
        } catch (error) {
            console.log('Background folder refresh failed (ignoring):', error.message);
        }
    }

    async syncCurrentAlbum(album) {
        if (!album) {
            console.error('❌ [SYNC-ALBUM] No album provided for sync');
            return;
        }
        
        const albumId = album.smugmug_id || album.album_key;
        const albumName = album.name || album.title || 'Unknown Album';
        
        if (!albumId) {
            console.error('❌ [SYNC-ALBUM] Album missing required ID:', album);
            return;
        }
        
        const startTime = performance.now();
        console.log(`🔄 [SYNC-ALBUM] Starting sync for album: "${albumName}" (ID: ${albumId})`);
        console.log(`🔄 [SYNC-ALBUM] Timestamp: ${new Date().toISOString()}`);
        
        // Show progress toast for single album
        let progressToastId = null;
        const toastCreatedHandler = (data) => {
            progressToastId = data.toastId;
            eventBus.off('toast:progress-created', toastCreatedHandler);
        };
        eventBus.on('toast:progress-created', toastCreatedHandler);
        
        eventBus.emit('toast:progress', {
            title: `Syncing Album`,
            message: `Synchronizing "${albumName}"...`
        });
        
        eventBus.emit('smugmug:sync-start', { album });
        
        try {
            // Save current navigation state
            const savedState = {
                currentNodeUri: this.currentNodeUri,
                breadcrumbs: [...this.breadcrumbs],
                nodeHistory: [...this.nodeHistory],
                selectedAlbumId: albumId
            };
            
            console.log(`🔄 [SYNC-ALBUM] Calling POST /smugmug/albums/${albumId}/sync`);
            const result = await apiService.post(`/smugmug/albums/${albumId}/sync`);
            
            const endTime = performance.now();
            const durationMs = endTime - startTime;
            const durationSeconds = (durationMs / 1000).toFixed(2);
            
            // Log detailed results
            console.log(`✅ [SYNC-ALBUM] Album "${albumName}" sync completed successfully`);
            console.log(`✅ [SYNC-ALBUM] Duration: ${durationSeconds} seconds`);
            console.log(`✅ [SYNC-ALBUM] Photos synced: ${result.synced_photos || 'unknown'}`);
            console.log(`✅ [SYNC-ALBUM] Album name: ${result.album_name || albumName}`);
            console.log(`✅ [SYNC-ALBUM] Performance: ${result.synced_photos ? (result.synced_photos / parseFloat(durationSeconds)).toFixed(1) : 'N/A'} photos/second`);
            console.log(`✅ [SYNC-ALBUM] End timestamp: ${new Date().toISOString()}`);
            
            // Update progress toast to completion
            if (progressToastId) {
                eventBus.emit('toast:progress-complete', {
                    toastId: progressToastId,
                    title: 'Album Synced',
                    message: `"${result.album_name || albumName}" synced: ${result.synced_photos || 0} photos in ${durationSeconds}s`
                });
            }
            
            // For single album sync, just emit update events instead of refreshing folder contents
            // This preserves the current album view instead of backing out to parent folder
            eventBus.emit('smugmug:album-sync-complete', {
                album: {
                    ...album,
                    sync_status: 'synced',
                    synced_photos: result.synced_photos,
                    last_sync: new Date().toISOString()
                },
                result,
                albumId,
                savedState
            });
            
            eventBus.emit('smugmug:sync-success', { 
                album, 
                result,
                duration: durationSeconds,
                message: `Successfully synced ${result.synced_photos} photos from "${result.album_name}"`
            });
            
            // Show success toast
            eventBus.emit('toast:success', {
                title: 'Album Synced',
                message: `Successfully synced ${result.synced_photos || 0} photos from "${result.album_name || albumName}" in ${durationSeconds} seconds`
            });
            
            return result;
            
        } catch (error) {
            const endTime = performance.now();
            const durationMs = endTime - startTime;
            const durationSeconds = (durationMs / 1000).toFixed(2);
            
            // Log detailed error information
            console.error(`❌ [SYNC-ALBUM] Sync failed for album "${albumName}"`);
            console.error(`❌ [SYNC-ALBUM] Error after ${durationSeconds} seconds`);
            console.error(`❌ [SYNC-ALBUM] Error details:`, error);
            console.error(`❌ [SYNC-ALBUM] Error stack trace:`, error.stack);
            console.error(`❌ [SYNC-ALBUM] Failure timestamp: ${new Date().toISOString()}`);
            
            // Remove progress toast and show error
            if (progressToastId) {
                eventBus.emit('toast:remove', { toastId: progressToastId });
            }
            
            eventBus.emit('smugmug:sync-error', { 
                album, 
                error,
                duration: durationSeconds,
                message: error.message || 'Unknown sync error'
            });
            
            // Show error toast with no auto-dismiss
            eventBus.emit('toast:error', {
                title: 'Album Sync Failed',
                message: `Sync failed for "${albumName}" after ${durationSeconds} seconds: ${error.message || 'Unknown error'}`,
                details: error.response ? JSON.stringify(error.response.data, null, 2) : error.stack
            });
            
            throw error;
        }
    }

    async refreshCurrentContext(savedState) {
        try {
            // Restore navigation state
            this.currentNodeUri = savedState.currentNodeUri;
            this.breadcrumbs = savedState.breadcrumbs;
            this.nodeHistory = savedState.nodeHistory;
            
            // Refresh current folder contents (which includes updated album data)
            await this.loadFolderContents(this.currentNodeUri);
            
            // Find and restore the current album selection with updated data
            const currentAlbumId = savedState.selectedAlbumId;
            const currentAlbum = this.smugmugAlbums.find(a => 
                (a.smugmug_id && a.smugmug_id === currentAlbumId) || 
                (a.album_key && a.album_key === currentAlbumId)
            );
            
            eventBus.emit('smugmug:context-refreshed', {
                savedState,
                currentAlbum,
                albums: this.smugmugAlbums
            });
            
        } catch (error) {
            console.error('Error refreshing context:', error);
            // Fallback to full reload if context refresh fails
            await this.loadSmugMugAlbums();
            
            eventBus.emit('smugmug:context-refresh-error', { 
                savedState, 
                error 
            });
        }
    }

    async syncAllAlbums() {
        const startTime = performance.now();
        console.log('🔄 [SYNC-ALL] Starting sync of all albums');
        console.log(`🔄 [SYNC-ALL] Timestamp: ${new Date().toISOString()}`);
        
        // Show progress toast
        let progressToastId = null;
        const toastCreatedHandler = (data) => {
            progressToastId = data.toastId;
            eventBus.off('toast:progress-created', toastCreatedHandler);
        };
        eventBus.on('toast:progress-created', toastCreatedHandler);
        
        eventBus.emit('toast:progress', {
            title: 'Syncing All Albums',
            message: 'Synchronizing all albums and photos...'
        });

        try {
            // Get album stats for logging
            const albums = this.getAlbums();
            const albumCount = albums.length;
            console.log(`🔄 [SYNC-ALL] Found ${albumCount} albums to sync`);
            
            eventBus.emit('smugmug:sync-all-start', { 
                albumCount,
                startTime: Date.now()
            });
            
            // Call the backend sync endpoint
            console.log('🔄 [SYNC-ALL] Calling POST /photos/sync endpoint');
            const result = await apiService.post('/photos/sync', { limit: 1000 });
            
            const endTime = performance.now();
            const durationMs = endTime - startTime;
            const durationSeconds = (durationMs / 1000).toFixed(2);
            
            // Log detailed results
            console.log('✅ [SYNC-ALL] Sync completed successfully');
            console.log(`✅ [SYNC-ALL] Duration: ${durationSeconds} seconds`);
            console.log(`✅ [SYNC-ALL] Photos synced: ${result.synced_photos || 'unknown'}`);
            console.log(`✅ [SYNC-ALL] Albums processed: ${result.albums_processed || 'unknown'}`);
            console.log(`✅ [SYNC-ALL] Performance: ${result.synced_photos ? (result.synced_photos / parseFloat(durationSeconds)).toFixed(1) : 'N/A'} photos/second`);
            console.log(`✅ [SYNC-ALL] End timestamp: ${new Date().toISOString()}`);
            
            // Update progress toast to completion
            eventBus.emit('toast:progress-complete', {
                toastId: progressToastId,
                title: 'Sync Complete',
                message: `Successfully synced ${result.synced_photos || 'all'} photos in ${durationSeconds}s`
            });
            
            // Refresh current context to show updated sync statuses
            await this.refreshCurrentContext({
                currentNodeUri: this.currentNodeUri,
                breadcrumbs: [...this.breadcrumbs],
                nodeHistory: [...this.nodeHistory]
            });
            
            // Emit success event for other components
            eventBus.emit('smugmug:sync-all-success', { 
                result,
                duration: durationSeconds,
                albumsProcessed: result.albums_processed,
                photosSync: result.synced_photos
            });
            
            // Show success toast
            eventBus.emit('toast:success', {
                title: 'All Albums Synced',
                message: `Successfully synced ${result.synced_photos || 'all'} photos from ${result.albums_processed || albumCount} albums in ${durationSeconds} seconds`
            });
            
            return result;
            
        } catch (error) {
            const endTime = performance.now();
            const durationMs = endTime - startTime;
            const durationSeconds = (durationMs / 1000).toFixed(2);
            
            // Log detailed error information
            console.error('❌ [SYNC-ALL] Sync failed');
            console.error(`❌ [SYNC-ALL] Error after ${durationSeconds} seconds`);
            console.error(`❌ [SYNC-ALL] Error details:`, error);
            console.error(`❌ [SYNC-ALL] Error stack trace:`, error.stack);
            console.error(`❌ [SYNC-ALL] Failure timestamp: ${new Date().toISOString()}`);
            
            // Remove progress toast and show error
            eventBus.emit('toast:remove', { toastId: progressToastId });
            
            eventBus.emit('smugmug:sync-all-error', { 
                error, 
                duration: durationSeconds,
                message: error.message || 'Unknown sync error'
            });
            
            // Show error toast with no auto-dismiss
            eventBus.emit('toast:error', {
                title: 'Sync All Failed',
                message: `Album sync failed after ${durationSeconds} seconds: ${error.message || 'Unknown error'}`,
                details: error.response ? JSON.stringify(error.response.data, null, 2) : error.stack
            });
            
            throw error;
        }
    }

    // Navigation helpers
    navigateToFolder(nodeUri) {
        this.nodeHistory.push(this.currentNodeUri);
        return this.loadFolderContents(nodeUri);
    }

    navigateBack() {
        if (this.nodeHistory.length > 0) {
            const previousNode = this.nodeHistory.pop();
            return this.loadFolderContents(previousNode);
        } else {
            // Go to root
            return this.loadFolderContents(null);
        }
    }

    navigateToRoot() {
        this.nodeHistory = [];
        return this.loadFolderContents(null);
    }

    // Data getters
    getCurrentAlbums() {
        return [...this.smugmugAlbums];
    }

    getCurrentNodeUri() {
        return this.currentNodeUri;
    }

    getBreadcrumbs() {
        return [...this.breadcrumbs];
    }

    getNodeHistory() {
        return [...this.nodeHistory];
    }

    // Album finder
    findAlbum(albumId) {
        return this.smugmugAlbums.find(album => 
            (album.smugmug_id && album.smugmug_id === albumId) ||
            (album.album_key && album.album_key === albumId)
        );
    }

    // Folder finder
    findFolder(nodeUri) {
        return this.smugmugAlbums.find(item => 
            item.type === 'folder' && item.node_uri === nodeUri
        );
    }

    // Album type filters
    getFolders() {
        return this.smugmugAlbums.filter(item => item.type === 'folder');
    }

    getAlbums() {
        return this.smugmugAlbums.filter(item => item.type === 'album');
    }

    // Stats
    getStats() {
        const folders = this.getFolders();
        const albums = this.getAlbums();
        
        return {
            totalItems: this.smugmugAlbums.length,
            folders: folders.length,
            albums: albums.length,
            currentPath: this.breadcrumbs.map(b => b.name || b.title).join(' > ') || 'Root'
        };
    }
}

const smugMugAPI = new SmugMugAPI();
export default smugMugAPI;