import eventBus from '../services/EventBus.js';
import { CACHE_KEYS, EVENTS } from '../utils/Constants.js';

class StateManager {
    constructor() {
        this.isInitializing = true;
        this.state = {
            currentPage: 'albums',
            currentAlbum: null,
            currentNodeUri: null,
            breadcrumbs: [],
            nodeHistory: [],
            statusFilter: '',
            showProcessedPhotos: true,
            showUnprocessedPhotos: true,
            timestamp: null
        };
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        eventBus.on('app:page-changed', (data) => {
            this.state.currentPage = data.page;
            this.saveAppState();
        });

        eventBus.on('app:album-selected', (data) => {
            this.state.currentAlbum = data.album;
            this.saveAppState();
            this.updateURL();
        });

        eventBus.on('app:folder-changed', (data) => {
            this.state.currentNodeUri = data.nodeUri;
            this.state.breadcrumbs = data.breadcrumbs || this.state.breadcrumbs;
            this.state.nodeHistory = data.nodeHistory || this.state.nodeHistory;
            this.saveAppState();
            this.updateURL();
        });

        eventBus.on('app:filter-changed', (data) => {
            this.state.statusFilter = data.statusFilter || this.state.statusFilter;
            this.state.showProcessedPhotos = data.showProcessedPhotos ?? this.state.showProcessedPhotos;
            this.state.showUnprocessedPhotos = data.showUnprocessedPhotos ?? this.state.showUnprocessedPhotos;
            this.saveAppState();
        });

        eventBus.on('app:initialization-complete', () => {
            this.isInitializing = false;
        });
        
        eventBus.on('state:page-changed', (data) => {
            this.state.currentPage = data.currentPage;
            this.saveAppState();
            this.updateURL();
        });
    }

    saveAppState() {
        try {
            if (this.isInitializing) {
                return;
            }
            
            const state = {
                ...this.state,
                timestamp: Date.now()
            };
            
            
            localStorage.setItem(CACHE_KEYS.APP_STATE, JSON.stringify(state));
            
            this.updateURL();
            
            eventBus.emit(EVENTS.STATE_CHANGED, {
                type: 'saved',
                state: { ...state }
            });
            
        } catch (error) {
            console.error('Error saving app state:', error);
        }
    }
    
    loadAppState() {
        try {
            const savedState = localStorage.getItem(CACHE_KEYS.APP_STATE);
            if (!savedState) return null;
            
            const state = JSON.parse(savedState);
            
            // Check if state is not too old (24 hours)
            if (Date.now() - state.timestamp > 24 * 60 * 60 * 1000) {
                localStorage.removeItem(CACHE_KEYS.APP_STATE);
                return null;
            }
            
            eventBus.emit(EVENTS.STATE_CHANGED, {
                type: 'loaded',
                state: { ...state }
            });
            
            return state;
            
        } catch (error) {
            console.error('Error loading app state:', error);
            localStorage.removeItem(CACHE_KEYS.APP_STATE);
            return null;
        }
    }
    
    updateURL() {
        try {
            if (this.isInitializing) {
                return;
            }
            
            const params = new URLSearchParams();
            
            if (this.state.currentPage !== 'albums') {
                params.set('page', this.state.currentPage);
            }
            
            if (this.state.currentAlbum) {
                params.set('album', this.state.currentAlbum.smugmug_id || this.state.currentAlbum.album_key);
            }
            
            if (this.state.currentNodeUri) {
                params.set('node', encodeURIComponent(this.state.currentNodeUri));
            }
            
            // Update URL without page reload
            const newURL = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
            window.history.replaceState(null, '', newURL);
            
        } catch (error) {
            console.error('Error updating URL:', error);
        }
    }
    
    loadStateFromURL() {
        try {
            const params = new URLSearchParams(window.location.search);
            const state = {
                currentPage: params.get('page') || 'albums',
                albumId: params.get('album'),
                nodeUri: params.get('node') ? decodeURIComponent(params.get('node')) : null
            };
            return state;
        } catch (error) {
            console.error('Error loading state from URL:', error);
            return null;
        }
    }

    async restoreStateFromData(stateData) {
        try {
            let restored = false;
            
            // Update internal state first
            if (stateData.currentPage) {
                this.state.currentPage = stateData.currentPage;
            }
            if (stateData.currentAlbum) {
                this.state.currentAlbum = stateData.currentAlbum;
            }
            if (stateData.currentNodeUri || stateData.nodeUri) {
                this.state.currentNodeUri = stateData.currentNodeUri || stateData.nodeUri;
            }
            if (stateData.breadcrumbs) {
                this.state.breadcrumbs = stateData.breadcrumbs;
            }
            if (stateData.nodeHistory) {
                this.state.nodeHistory = stateData.nodeHistory;
            }
            if (stateData.statusFilter) {
                this.state.statusFilter = stateData.statusFilter;
            }
            if (typeof stateData.showProcessedPhotos !== 'undefined') {
                this.state.showProcessedPhotos = stateData.showProcessedPhotos;
            }
            if (typeof stateData.showUnprocessedPhotos !== 'undefined') {
                this.state.showUnprocessedPhotos = stateData.showUnprocessedPhotos;
            }
            
            // Emit restoration events for other components to handle
            if (stateData.currentPage && stateData.currentPage !== 'albums') {
                eventBus.emit('state:restore-page', { page: stateData.currentPage });
                restored = true;
            }
            
            // Restore folder navigation FIRST (sets folder context)
            if (stateData.nodeUri || stateData.currentNodeUri) {
                const nodeUri = stateData.nodeUri || stateData.currentNodeUri;
                if (nodeUri) {
                    eventBus.emit('state:restore-folder', { nodeUri });
                    restored = true;
                    
                    // Clear any album state when restoring folder state to prevent conflicts
                    this.state.currentAlbum = null;
                    this.updateURL();
                }
            }
            
            // Only restore album selection if NOT restoring folder state
            // This prevents both folder and album views from displaying simultaneously
            else if (stateData.albumId || stateData.currentAlbum) {
                const albumId = stateData.albumId || (stateData.currentAlbum ? 
                    stateData.currentAlbum.smugmug_id || stateData.currentAlbum.album_key : null);
                
                if (albumId) {
                    eventBus.emit('state:restore-album', { albumId });
                    restored = true;
                }
            }
            
            // Emit breadcrumbs update
            eventBus.emit('state:restore-breadcrumbs', {
                breadcrumbs: this.state.breadcrumbs
            });
            
            eventBus.emit(EVENTS.STATE_CHANGED, {
                type: 'restored',
                state: { ...this.state },
                restored
            });
            
            return restored;
            
        } catch (error) {
            console.error('Error restoring state:', error);
            return false;
        }
    }

    // Public API methods
    getCurrentState() {
        return { ...this.state };
    }

    updateState(updates) {
        const prevState = { ...this.state };
        this.state = { ...this.state, ...updates };
        
        eventBus.emit(EVENTS.STATE_CHANGED, {
            type: 'updated',
            prevState,
            newState: { ...this.state },
            updates
        });
        
        this.saveAppState();
    }

    clearState() {
        localStorage.removeItem(CACHE_KEYS.APP_STATE);
        this.state = {
            currentPage: 'albums',
            currentAlbum: null,
            currentNodeUri: null,
            breadcrumbs: [],
            nodeHistory: [],
            statusFilter: '',
            showProcessedPhotos: true,
            showUnprocessedPhotos: true,
            timestamp: null
        };
        
        eventBus.emit(EVENTS.STATE_CHANGED, {
            type: 'cleared',
            state: { ...this.state }
        });
    }

    setInitializingFlag(isInitializing) {
        this.isInitializing = isInitializing;
        if (!isInitializing) {
            eventBus.emit('app:initialization-complete');
            // After initialization is complete, update URL to reflect current state
            this.updateURL();
        }
    }

    // Utility methods for state restoration
    async loadAndRestoreState() {
        
        let restoredState = false;
        const urlState = this.loadStateFromURL();
        const savedState = this.loadAppState();
        
        if (urlState && (urlState.albumId || urlState.nodeUri || urlState.currentPage !== 'albums')) {
            restoredState = await this.restoreStateFromData(urlState);
        } else if (savedState) {
            restoredState = await this.restoreStateFromData(savedState);
        }
        
        return restoredState;
    }
}

const stateManager = new StateManager();
export default stateManager;
