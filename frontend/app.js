// TargetVision Finder-Style Frontend Application

// Import managers and services
import eventBus from './services/EventBus.js';
import apiService from './services/APIService.js';
import cacheManager from './managers/CacheManager.js';
import stateManager from './managers/StateManager.js';
import smugMugAPI from './managers/SmugMugAPI.js';
import photoProcessor from './managers/PhotoProcessor.js';
import albumBrowser from './components/AlbumBrowser.js';
import photoGrid from './components/PhotoGrid.js';
import progressManager from './components/ProgressManager.js';
import modalManager from './components/ModalManager.js';
import toastManager from './components/ToastManager.js';
import collectionsManager from './components/CollectionsManager.js';
import searchManager from './components/SearchManager.js';
import chatManager from './components/ChatManager.js';
import settingsManager from './components/SettingsManager.js';
import navigationManager from './components/NavigationManager.js';
import dataManager from './components/DataManager.js';
import folderGrid from './components/FolderGrid.js';
import { EVENTS, PHOTO_STATUS, SUCCESS_MESSAGES, ERROR_MESSAGES } from './utils/Constants.js';
import UIUtils from './utils/UIUtils.js';
class TargetVisionApp {
    constructor() {
        this.apiBase = 'http://localhost:8000';
        this.currentAlbum = null;
        this.currentPhotos = [];
        this.currentPage = 'albums';
        this.isInitializing = true;
        
        this.initializeApp();
    }

    // Cache and State Management handled by respective managers

    async initializeApp() {
        console.log('Starting app initialization...');
        
        // Phase 1: Immediate UI setup (non-blocking)
        this.bindEventListeners();
        console.log('Event listeners bound, checking connection...');
        await this.checkConnectionStatus();
        await smugMugAPI.checkAuthentication();
        
        // Initialize LLM status checking
        this.initializeStatusChecking();
        
        // Check for ongoing batch processing and resume if needed (non-blocking)
        this.checkAndResumeBatchProcessing().catch(error => {
            console.error('Error checking batch processing status during init:', error);
        });
        
        // Phase 2: Load data progressively in background
        this.loadApplicationData().catch(error => {
            console.error('Error loading application data:', error);
            eventBus.emit('toast:error', { title: 'Initialization Error', message: 'Failed to load application data. Please refresh the page.' });
        });
        
        console.log('Phase 1 initialization complete - UI is ready');
    }
    
    async loadApplicationData() {
        await smugMugAPI.loadSmugMugAlbums();
        
        // Try to restore state from URL first, then localStorage
        const urlState = stateManager.loadStateFromURL();
        const savedState = stateManager.loadAppState();
        
        let restoredState = false;
        if (urlState && (urlState.albumId || urlState.nodeUri || urlState.currentPage !== 'albums')) {
            restoredState = await stateManager.restoreStateFromData(urlState);
        } else if (savedState) {
            restoredState = await stateManager.restoreStateFromData(savedState);
        }
        
        // If no state was restored, show the default albums page
        if (!restoredState) {
            console.log('No state restored, showing default albums page');
            eventBus.emit('navigation:show-page', { pageName: 'albums' });
        }
        
        this.isInitializing = false;
    }
    

    // Event listeners
    bindEventListeners() {
        // Album actions
        document.getElementById('sync-album').addEventListener('click', () => {
            eventBus.emit('app:sync-album', { album: this.currentAlbum });
        });
        document.getElementById('refresh-photos').addEventListener('click', () => this.refreshCurrentPhotos());
        document.getElementById('sync-all-albums').addEventListener('click', () => this.syncAllAlbums());
        
        // Photo selection and visibility - moved to PhotoGrid component
        // select-all, select-none, status-filter, toggle-processed, toggle-unprocessed
        
        document.getElementById('process-selected').addEventListener('click', () => {
            eventBus.emit('photos:process-selected', { 
                selectedPhotos: this.selectedPhotos, 
                currentPhotos: this.currentPhotos 
            });
        });
        document.getElementById('refresh-status').addEventListener('click', () => this.refreshAlbumStatus());
        
        // Global progress bar
        document.getElementById('global-progress-close').addEventListener('click', () => photoProcessor.hideGlobalProgress());
        
        // Chat functionality - moved to ChatManager component
        // chat-send, chat-input, clear-chat
        
        // Search and filter functionality - moved to SearchManager component
        // search-main-button, search-main-input, clear-main-search, toggle-filters, apply-filters, clear-filters
        
        // Modal functionality - delegate to ModalManager
        document.getElementById('modal-close').addEventListener('click', () => eventBus.emit('modal:close'));
        document.getElementById('photo-modal').addEventListener('click', (e) => {
            if (e.target.id === 'photo-modal') eventBus.emit('modal:close');
        });
        document.getElementById('modal-process-button').addEventListener('click', () => eventBus.emit('modal:process-photo'));
        
        // Metadata editing - delegate to ModalManager
        document.getElementById('modal-edit-toggle').addEventListener('click', () => eventBus.emit('metadata:edit:toggle'));
        document.getElementById('modal-save-metadata').addEventListener('click', () => eventBus.emit('metadata:edit:save'));
        document.getElementById('modal-cancel-edit').addEventListener('click', () => eventBus.emit('metadata:edit:cancel'));
        document.getElementById('modal-regenerate-ai').addEventListener('click', () => eventBus.emit('metadata:ai:regenerate'));
        document.getElementById('modal-delete-ai').addEventListener('click', () => eventBus.emit('metadata:ai:delete'));
        
        
        // Collection management
        document.getElementById('modal-add-to-collection').addEventListener('click', () => eventBus.emit('collections:show-interface'));
        document.getElementById('modal-add-collection-confirm').addEventListener('click', () => eventBus.emit('collections:add-photo'));
        document.getElementById('modal-add-collection-cancel').addEventListener('click', () => eventBus.emit('collections:hide-interface'));
        document.getElementById('modal-create-collection').addEventListener('click', () => eventBus.emit('collections:create-from-modal'));
        
        // Settings functionality - moved to SettingsManager component
        // edit-prompt, save-prompt, cancel-prompt-edit, reset-prompt, test-prompt, save-settings
        // Batch processing - delegate to PhotoProcessor
        const cancelButton = document.getElementById('cancel-batch-processing');
        if (cancelButton) {
            console.log('Cancel batch processing button found, adding event listener');
            cancelButton.addEventListener('click', () => {
                console.log('Cancel batch processing button clicked');
                eventBus.emit('photos:cancel-batch-processing');
            });
        } else {
            console.error('Cancel batch processing button NOT found in DOM');
        }
        
        const clearQueueButton = document.getElementById('clear-batch-queue');
        if (clearQueueButton) {
            console.log('Clear batch queue button found, adding event listener');
            clearQueueButton.addEventListener('click', () => {
                console.log('Clear batch queue button clicked');
                eventBus.emit('photos:clear-batch-queue');
            });
        } else {
            console.error('Clear batch queue button NOT found in DOM');
        }
        
        // Cache management - delegate to CacheManager
        document.getElementById('clear-cache').addEventListener('click', () => eventBus.emit('cache:clear'));
        document.getElementById('refresh-cache-status').addEventListener('click', () => {
            eventBus.emit('cache:refresh-status');
        });
        
        // Data management
        document.getElementById('confirm-processing-status').addEventListener('click', () => eventBus.emit('data:confirm-processing-status'));
        
        // API Key management, prompt editing, and templates - moved to SettingsManager component
        // test-anthropic-key, test-openai-key, test-image-upload, analyze-test-image
        // prompt-textarea, [data-template] elements

        // Setup event-driven communication with managers
        this.setupEventBusListeners();
    }

    setupEventBusListeners() {
        // SmugMug API events
        // Folder loading handled by AlbumBrowser component

        eventBus.on('smugmug:sync-success', (data) => {
            eventBus.emit('toast:success', { title: 'Sync Complete', message: data.message });
            this.refreshCurrentPhotos();
        });

        eventBus.on('smugmug:sync-error', (data) => {
            eventBus.emit('toast:error', { title: 'Sync Failed', message: `Failed to sync album: ${data.error.message}` });
        });

        eventBus.on('smugmug:folder-error', (data) => {
            console.error('SmugMug folder loading error:', data);
            eventBus.emit('toast:error', { title: 'Folder Loading Error', message: `Failed to load folder: ${data.error.message}` });
        });

        // Photo processing events
        eventBus.on('photos:single-processing-success', (data) => {
            eventBus.emit('toast:success', { title: 'Processing Complete', message: data.message });
            // Refresh photo grid via PhotoGrid component
            eventBus.emit('photos:display', { photos: this.currentPhotos });
        });

        eventBus.on('photos:single-processing-error', (data) => {
            eventBus.emit('toast:error', { title: 'Processing Failed', message: 'Could not process photo with AI. Please try again.' });
        });

        eventBus.on('photos:batch-processing-started', (data) => {
            eventBus.emit('toast:success', { title: 'Batch Processing Started', message: data.message });
        });

        // Photo status updates handled by PhotoProcessor and PhotoGrid components

        // UI events from managers
        eventBus.on('ui:show-success', (data) => {
            eventBus.emit('toast:success', { title: data.title, message: data.message });
        });

        eventBus.on('ui:show-error', (data) => {
            eventBus.emit('toast:error', { title: data.title, message: data.message });
        });

        // State management events
        eventBus.on('state:restore-page', (data) => {
            eventBus.emit('navigation:show-page', { pageName: data.page });
        });

        // Navigation events
        eventBus.on('app:show-albums-view', () => this.showAlbumsView());

        eventBus.on('state:restore-folder', async (data) => {
            await smugMugAPI.loadFolderContents(data.nodeUri);
        });

        eventBus.on('state:restore-album', (data) => {
            const album = smugMugAPI.findAlbum(data.albumId);
            if (album) {
                this.selectAlbum(album);
            }
        });

        // Cache events
        eventBus.on('cache:updated', (data) => {
            console.log('Cache updated:', data.action);
        });


        // AlbumBrowser events
        eventBus.on('album:selected', (data) => {
            this.selectAlbum(data.album);
        });

        eventBus.on('folder:selected-for-preview', (data) => {
            // Handle folder preview if needed
            console.log('Folder selected for preview:', data.folder.name);
        });

        eventBus.on('folder:navigate', async (data) => {
            // Handle folder navigation from grid view
            console.log('Navigating to folder from grid:', data.folder.name);
            await smugMugAPI.loadFolderContents(data.folder.node_uri);
        });

        // PhotoGrid events
        eventBus.on('photos:selection-changed', (data) => {
            // Update main app state when photo selection changes
            this.selectedPhotos = new Set(data.selectedPhotos);
        });

        // Photo modal events are now handled by ModalManager
        eventBus.on('photo:show-modal', (data) => {
            // Set current photo for collections manager
            eventBus.emit('photo:set-current', { photo: data.photo });
        });

    }

    // Authentication and Connection
    async checkConnectionStatus() {
        try {
            const response = await fetch(`${this.apiBase}/health`, { 
                method: 'GET'
            });
            
            if (response.ok) {
                this.connectionStatus = 'connected';
                document.getElementById('connection-status')?.classList.add('hidden');
            } else {
                throw new Error('Server responded with error');
            }
        } catch (error) {
            this.connectionStatus = 'disconnected';
            this.showConnectionError();
        }
    }

    // Album thumbnail loading moved to AlbumBrowser component
    
    // Unused display methods removed - functionality moved to components

    async selectAlbum(album) {
        // Debug logging removed
        
        this.currentAlbum = album;
        
        stateManager.saveAppState();
        this.showPhotosView();
        const albumId = album.smugmug_id || album.album_key;
        if (albumId) {
            await this.loadAlbumPhotos(albumId);
        } else {
            console.error('No album ID found in album object:', album);
            eventBus.emit('toast:error', { title: 'Album Error', message: 'Could not load album photos - missing album identifier' });
        }
    }

    // Album UI methods moved to AlbumBrowser component

    // Photo loading methods moved to DataManager component
    async loadAlbumPhotos(albumId) {
        eventBus.emit('photos:clear-selection');
        eventBus.emit('data:load-album-photos', { albumId, app: this });
    }





    // Album sync - Now handled by SmugMugAPI manager

    // Photo processing - Now handled by PhotoProcessor manager


    async refreshAlbumStatus() {
        if (!this.currentAlbum) return;
        eventBus.emit('photos:refresh-album-status', { album: this.currentAlbum });
    }


    // UI State Management
    async showAlbumsView() {
        console.log('Showing albums view');
        this.currentAlbum = null;
        eventBus.emit('photos:clear-selection');
        eventBus.emit('navigation:show-albums-view');
        
        // Ensure albums are displayed - AlbumBrowser will emit folders:display-grid
        // which will show folder/album cards in the right column
        eventBus.emit('albums:display');
    }

    showWelcomeState() {
        // Hide all photo-related states
        document.getElementById('loading-photos').classList.add('hidden');
        document.getElementById('photo-grid').classList.add('hidden');
        document.getElementById('folder-grid').classList.add('hidden');
        document.getElementById('empty-photos').classList.add('hidden');
        document.getElementById('photo-controls').classList.add('hidden');
        document.getElementById('album-actions').classList.add('hidden');
        document.getElementById('album-stats').classList.add('hidden');
        
        // Show welcome state
        document.getElementById('welcome-state').classList.remove('hidden');
        
        // Reset album title
        document.getElementById('current-album-title').textContent = 'Select an album';
    }

    showPhotosView() {
        document.getElementById('welcome-state').classList.add('hidden');
        document.getElementById('folder-grid').classList.add('hidden');
    }


    // Progress management and photo status updates - Now handled by PhotoProcessor manager

    // Photo stats methods removed - functionality handled by PhotoGrid component

    // filterPhotos - Removed (functionality now handled by PhotoGrid component)


    async refreshCurrentPhotos() {
        if (this.currentAlbum) {
            const currentAlbumId = this.currentAlbum.smugmug_id || this.currentAlbum.album_key;
            await this.loadAlbumPhotos(currentAlbumId);
        }
    }

    // Legacy toast methods removed - now handled by ToastManager via EventBus

    showConnectionError() {
        const statusElement = document.getElementById('connection-status');
        if (statusElement) {
            statusElement.innerHTML = `
                <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
                    <span class="text-yellow-800 text-sm">⚠️ Connection issues detected. Some features may not work properly.</span>
                </div>
            `;
            statusElement.classList.remove('hidden');
        }
    }

    // Page navigation moved to NavigationManager component
    


    // Modal and other functionality
    // Modal functionality methods removed - fully handled by ModalManager component via EventBus

    
    
    
    
    

    // Photo modal collection management now handled by CollectionsManager component

    async syncAllAlbums() {
        eventBus.emit('albums:sync-all');
    }

    
    // Modal metadata methods removed - functionality moved to ModalManager component
    
    
    
    
    
    async checkAndResumeBatchProcessing() {
        // Batch processing resume moved to PhotoProcessor component
        eventBus.emit('photos:check-and-resume-batch-processing');
    }
    initializeStatusChecking() {
        // Trigger initial LLM status check
        eventBus.emit('settings:check-llm-status');
    }
    
    stopStatusChecking() {
        if (this.statusInterval) {
            clearInterval(this.statusInterval);
            this.statusInterval = null;
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing TargetVisionApp...');
    try {
        window.app = new TargetVisionApp();
        console.log('TargetVisionApp initialized successfully');
        
        // Make emergency stop globally accessible from browser console
        // Application initialized successfully
        console.log('TargetVision application initialized successfully');
    } catch (error) {
        console.error('Error initializing TargetVisionApp:', error);
    }
});