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
            console.error('No album provided for sync');
            return;
        }
        
        const albumId = album.smugmug_id || album.album_key;
        if (!albumId) {
            console.error('Album missing required ID');
            return;
        }
        
        eventBus.emit('smugmug:sync-start', { album });
        
        try {
            // Save current navigation state
            const savedState = {
                currentNodeUri: this.currentNodeUri,
                breadcrumbs: [...this.breadcrumbs],
                nodeHistory: [...this.nodeHistory],
                selectedAlbumId: albumId
            };
            
            const result = await apiService.post(`/smugmug/albums/${albumId}/sync`);
            
            // Context-preserving refresh: only update current folder and album data
            await this.refreshCurrentContext(savedState);
            
            eventBus.emit('smugmug:sync-success', { 
                album, 
                result,
                message: `Successfully synced ${result.synced_photos} photos from "${result.album_name}"`
            });
            
            return result;
            
        } catch (error) {
            console.error('Album sync failed:', error);
            eventBus.emit('smugmug:sync-error', { album, error });
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