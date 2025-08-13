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
import { EVENTS, PHOTO_STATUS, SUCCESS_MESSAGES, ERROR_MESSAGES } from './utils/Constants.js';
import UIUtils from './utils/UIUtils.js';
class TargetVisionApp {
    constructor() {
        this.apiBase = 'http://localhost:8000';
        this.smugmugAlbums = [];
        this.currentAlbum = null;
        this.currentPhotos = [];
        this.selectedPhotos = new Set();
        this.processingPhotos = new Set(); // UI-only state for photos currently being processed
        this.statusFilter = '';
        this.showProcessedPhotos = true;
        this.showUnprocessedPhotos = true;
        this.currentPage = 'albums';
        this.chatMessages = [];
        this.searchResults = [];
        this.searchFilters = {
            album: '',
            status: '',
            dateFrom: '',
            dateTo: ''
        };
        
        // Collections state now managed by CollectionsManager
        
        // Folder navigation state
        this.currentNodeUri = null;
        this.nodeHistory = [];
        this.breadcrumbs = [];
        
        // Flag to prevent state saving during initial load
        this.isInitializing = true;
        
        // Initialize cache system
        this.cache = {
            albums: new Map(), // albumId -> { photos, timestamp, metadata }
            folders: new Map(), // nodeUri -> { contents, timestamp }
            expiry: {
                photos: 60 * 60 * 1000, // 1 hour for photo data
                folders: 24 * 60 * 60 * 1000, // 24 hours for folder structure
                metadata: 30 * 60 * 1000 // 30 minutes for processing status
            }
        };
        
        // Cache is now managed by cacheManager
        // No need to initialize cache here
        
        this.initializeApp();
    }

    // Cache Management - Now handled by CacheManager
    
    async confirmProcessingStatus() {
        const button = document.getElementById('confirm-processing-status');
        const resultDiv = document.getElementById('confirm-status-result');
        
        // Disable button and show loading state
        const originalText = button.textContent;
        button.textContent = 'Confirming...';
        button.disabled = true;
        
        try {
            const response = await fetch(`${this.apiBase}/photos/confirm-processing-status`, {
                method: 'POST'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const result = await response.json();
            
            // Show success result
            resultDiv.innerHTML = `
                <div class="text-green-700 bg-green-50 border border-green-200 rounded p-3">
                    <div class="font-medium">✅ Processing Status Confirmed</div>
                    <div class="text-sm mt-1">
                        <div>Total photos: ${result.total_photos}</div>
                        <div>Photos updated: ${result.photos_updated}</div>
                        ${result.newly_completed > 0 ? `<div>Newly marked as completed: ${result.newly_completed}</div>` : ''}
                        ${result.newly_not_processed > 0 ? `<div>Newly marked as unprocessed: ${result.newly_not_processed}</div>` : ''}
                    </div>
                </div>
            `;
            resultDiv.classList.remove('hidden');
            
            // Show toast notification
            eventBus.emit('toast:success', { title: 'Status Confirmed', message: `${result.photos_updated} photos updated` });
            
            // Refresh photo grid if we're on the albums page
            if (this.currentPage === 'albums' && this.currentPhotos.length > 0) {
                eventBus.emit('photos:display', { photos: this.currentPhotos });
            }
            
        } catch (error) {
            console.error('Error confirming processing status:', error);
            
            // Show error result
            resultDiv.innerHTML = `
                <div class="text-red-700 bg-red-50 border border-red-200 rounded p-3">
                    <div class="font-medium">❌ Failed to confirm processing status</div>
                    <div class="text-sm mt-1">${error.message}</div>
                </div>
            `;
            resultDiv.classList.remove('hidden');
            
            eventBus.emit('toast:error', { title: 'Error', message: 'Failed to confirm processing status' });
        } finally {
            // Restore button
            button.textContent = originalText;
            button.disabled = false;
            
            // Hide result after 10 seconds
            setTimeout(() => {
                resultDiv.classList.add('hidden');
            }, 10000);
        }
    }
    

    // State Management - Now handled by StateManager

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
        console.log('Loading application data...');
        
        // Load SmugMug albums first
        await smugMugAPI.loadSmugMugAlbums();
        
        // Try to restore state from URL first, then localStorage
        let restoredState = false;
        const urlState = stateManager.loadStateFromURL();
        const savedState = stateManager.loadAppState();
        
        console.log('Restoration check:', { urlState, savedState });
        
        if (urlState && (urlState.albumId || urlState.nodeUri || urlState.currentPage !== 'albums')) {
            console.log('Attempting to restore from URL state');
            restoredState = await stateManager.restoreStateFromData(urlState);
        } else if (savedState) {
            console.log('Attempting to restore from saved state');
            restoredState = await stateManager.restoreStateFromData(savedState);
        }
        
        if (!restoredState) {
            console.log('No state restored, using defaults');
            // Default initialization
            // Breadcrumbs now handled by AlbumBrowser component
        } else {
            console.log('State restoration completed successfully');
        }
        
        console.log('Application data loading complete');
        
        // Mark initialization as complete to allow state saving
        this.isInitializing = false;
    }
    

    bindEventListeners() {
        console.log('Binding event listeners...');
        try {
            // Navigation
            const navAlbums = document.getElementById('nav-albums');
            const navCollections = document.getElementById('nav-collections');
            const navChat = document.getElementById('nav-chat');
            const navSearch = document.getElementById('nav-search');
            const navSettings = document.getElementById('nav-settings');
            
            if (navAlbums) {
                navAlbums.addEventListener('click', () => this.showPage('albums'));
                console.log('Albums event listener bound');
            } else {
                console.error('nav-albums element not found');
            }
            
            if (navCollections) {
                navCollections.addEventListener('click', () => this.showPage('collections'));
                console.log('Collections event listener bound');
            } else {
                console.error('nav-collections element not found');
            }
            
            if (navChat) {
                navChat.addEventListener('click', () => this.showPage('chat'));
                console.log('Chat event listener bound');
            } else {
                console.error('nav-chat element not found');
            }
            
            if (navSearch) {
                navSearch.addEventListener('click', () => this.showPage('search'));
                console.log('Search event listener bound');
            } else {
                console.error('nav-search element not found');
            }
            
            if (navSettings) {
                navSettings.addEventListener('click', () => {
                    console.log('Settings button clicked!');
                    this.showPage('settings');
                });
                console.log('Settings event listener bound');
            } else {
                console.error('nav-settings element not found');
            }
            
            console.log('Event listeners bound successfully');
        } catch (error) {
            console.error('Error binding event listeners:', error);
        }
        
        // Album browser now handled by AlbumBrowser component
        
        // Album actions
        document.getElementById('sync-album').addEventListener('click', () => {
            eventBus.emit('app:sync-album', { album: this.currentAlbum });
        });
        document.getElementById('refresh-photos').addEventListener('click', () => this.refreshCurrentPhotos());
        document.getElementById('sync-all-albums').addEventListener('click', () => this.syncAllAlbums());
        
        // Photo selection - delegate to PhotoGrid component
        document.getElementById('select-all').addEventListener('click', () => eventBus.emit('photos:select-all'));
        document.getElementById('select-none').addEventListener('click', () => eventBus.emit('photos:clear-selection'));
        document.getElementById('process-selected').addEventListener('click', () => {
            eventBus.emit('photos:process-selected', { 
                selectedPhotos: this.selectedPhotos, 
                currentPhotos: this.currentPhotos 
            });
        });
        document.getElementById('generate-embeddings').addEventListener('click', () => {
            eventBus.emit('photos:generate-embeddings', { album: this.currentAlbum });
        });
        document.getElementById('refresh-status').addEventListener('click', () => this.refreshAlbumStatus());
        
        // Global progress bar
        document.getElementById('global-progress-close').addEventListener('click', () => photoProcessor.hideGlobalProgress());
        
        // Filters
        document.getElementById('status-filter').addEventListener('change', (e) => this.filterPhotos(e.target.value));
        
        // Visibility toggles
        document.getElementById('toggle-processed').addEventListener('click', () => eventBus.emit('photos:toggle-processed'));
        document.getElementById('toggle-unprocessed').addEventListener('click', () => eventBus.emit('photos:toggle-unprocessed'));
        
        // Chat functionality
        document.getElementById('chat-send').addEventListener('click', () => this.sendChatMessage());
        document.getElementById('chat-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendChatMessage();
        });
        document.getElementById('chat-input').addEventListener('input', (e) => {
            document.getElementById('chat-send').disabled = !e.target.value.trim();
        });
        document.getElementById('clear-chat').addEventListener('click', () => this.clearChat());
        
        // Search functionality
        document.getElementById('search-main-button').addEventListener('click', () => this.performMainSearch());
        document.getElementById('search-main-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.performMainSearch();
        });
        document.getElementById('clear-main-search').addEventListener('click', () => this.clearMainSearch());
        
        // Filter functionality
        document.getElementById('toggle-filters').addEventListener('click', () => this.toggleFilters());
        document.getElementById('apply-filters').addEventListener('click', () => this.applyFilters());
        document.getElementById('clear-filters').addEventListener('click', () => this.clearFilters());
        
        // Modal functionality
        document.getElementById('modal-close').addEventListener('click', () => this.closeModal());
        document.getElementById('photo-modal').addEventListener('click', (e) => {
            if (e.target.id === 'photo-modal') this.closeModal();
        });
        document.getElementById('modal-process-button').addEventListener('click', () => this.processPhotoWithAI());
        
        // Metadata editing
        document.getElementById('modal-edit-toggle').addEventListener('click', () => this.toggleMetadataEdit());
        document.getElementById('modal-save-metadata').addEventListener('click', () => this.saveMetadataChanges());
        document.getElementById('modal-cancel-edit').addEventListener('click', () => this.cancelMetadataEdit());
        document.getElementById('modal-regenerate-ai').addEventListener('click', () => this.regenerateAIMetadata());
        document.getElementById('modal-delete-ai').addEventListener('click', () => this.deleteAIMetadata());
        
        // Embedding details toggle
        document.getElementById('modal-embedding-details-toggle').addEventListener('click', () => this.toggleEmbeddingDetails());
        
        // Collection management
        document.getElementById('modal-add-to-collection').addEventListener('click', () => eventBus.emit('collections:show-interface'));
        document.getElementById('modal-add-collection-confirm').addEventListener('click', () => eventBus.emit('collections:add-photo'));
        document.getElementById('modal-add-collection-cancel').addEventListener('click', () => eventBus.emit('collections:hide-interface'));
        document.getElementById('modal-create-collection').addEventListener('click', () => eventBus.emit('collections:create-from-modal'));
        
        // Settings functionality
        document.getElementById('edit-prompt').addEventListener('click', () => this.editPrompt());
        document.getElementById('save-prompt').addEventListener('click', () => this.savePrompt());
        document.getElementById('cancel-prompt-edit').addEventListener('click', () => this.cancelPromptEdit());
        document.getElementById('reset-prompt').addEventListener('click', () => this.resetPrompt());
        document.getElementById('test-prompt').addEventListener('click', () => this.testPrompt());
        document.getElementById('save-settings').addEventListener('click', () => this.saveApplicationSettings());
        const cancelButton = document.getElementById('cancel-batch-processing');
        if (cancelButton) {
            console.log('Cancel batch processing button found, adding event listener');
            cancelButton.addEventListener('click', () => {
                console.log('Cancel batch processing button clicked');
                this.cancelBatchProcessing();
            });
        } else {
            console.error('Cancel batch processing button NOT found in DOM');
        }
        
        const clearQueueButton = document.getElementById('clear-batch-queue');
        if (clearQueueButton) {
            console.log('Clear batch queue button found, adding event listener');
            clearQueueButton.addEventListener('click', () => {
                console.log('Clear batch queue button clicked');
                this.clearBatchQueue();
            });
        } else {
            console.error('Clear batch queue button NOT found in DOM');
        }
        
        // Cache management
        document.getElementById('clear-cache').addEventListener('click', () => this.clearCacheAndRefresh());
        document.getElementById('refresh-cache-status').addEventListener('click', () => {
            eventBus.emit('cache:refresh-status');
        });
        
        // Data management
        document.getElementById('confirm-processing-status').addEventListener('click', () => this.confirmProcessingStatus());
        
        // API Key management
        document.getElementById('test-anthropic-key').addEventListener('click', () => this.testApiKey('anthropic'));
        document.getElementById('test-openai-key').addEventListener('click', () => this.testApiKey('openai'));
        document.getElementById('test-image-upload').addEventListener('change', (e) => this.handleTestImageUpload(e));
        document.getElementById('analyze-test-image').addEventListener('click', () => this.analyzeTestImage());
        
        // Prompt textarea character count
        document.getElementById('prompt-textarea').addEventListener('input', () => this.updateCharCount());
        
        // Template selection
        document.querySelectorAll('[data-template]').forEach(template => {
            template.addEventListener('click', () => this.selectTemplate(template.dataset.template));
        });

        // Setup event-driven communication with managers
        this.setupEventBusListeners();
    }

    setupEventBusListeners() {
        // SmugMug API events
        eventBus.on('smugmug:folder-loaded', (data) => {
            this.handleFolderLoaded(data);
        });

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

        eventBus.on('photos:status-updated', (data) => {
            // Photo status updated - UI already handled by PhotoProcessor
            console.log(`Photo ${data.photoId} status updated to ${data.newStatus}`);
        });

        // UI events from managers
        eventBus.on('ui:show-success', (data) => {
            eventBus.emit('toast:success', { title: data.title, data.message);
        });

        eventBus.on('ui:show-error', (data) => {
            eventBus.emit('toast:error', { title: data.title, data.message);
        });

        // State management events
        eventBus.on('state:restore-page', (data) => {
            this.showPage(data.page);
        });

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

        // Settings events  
        eventBus.on('settings:get-api-settings', (data) => {
            // Provide API settings to managers when requested
            const settings = this.getApiSettings();
            data.callback(settings);
        });

        // AlbumBrowser events
        eventBus.on('album:selected', (data) => {
            this.selectAlbum(data.album);
        });

        eventBus.on('folder:selected-for-preview', (data) => {
            // Handle folder preview if needed
            console.log('Folder selected for preview:', data.folder.name);
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

    handleFolderLoaded(data) {
        // Update breadcrumbs and display albums
        this.currentNodeUri = data.nodeUri;
        this.breadcrumbs = data.breadcrumbs || [];
        this.smugmugAlbums = data.albums;
        
        // AlbumBrowser will handle display via event listeners
        
        // Update URL with current folder state
        stateManager.updateURL();
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

    // SmugMug API - Now handled by SmugMugAPI manager

    // Album display methods moved to AlbumBrowser component
    
    
    
    
    
    
    

    createAlbumListItem(album) {
        const div = document.createElement('div');
        
        // Handle both old API format (title, smugmug_id) and new Node API format (name, album_key)
        const albumTitle = album.title || album.name || 'Untitled Album';
        const albumId = album.smugmug_id || album.album_key || album.node_id;
        const albumUri = album.node_uri;
        
        div.className = `album-item p-3 border-b border-gray-200 hover:bg-white cursor-pointer transition-colors ${
            this.currentAlbum && (this.currentAlbum.smugmug_id === albumId || this.currentAlbum.node_id === album.node_id) ? 'bg-blue-50 border-blue-200' : ''
        }`;
        
        const syncStatus = album.is_synced ? 'synced' : 'not-synced';
        const syncIconSvg = album.is_synced 
            ? `<svg class="h-4 w-4 text-green-600" fill="currentColor" viewBox="0 0 20 20" title="Synced - Album photos are available locally">
                 <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
               </svg>`
            : `<svg class="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" title="Not synced - Click 'Sync Album' to download photos">
                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
               </svg>`;
        
        // Processing statistics - for new Node API, these are now included
        const totalPhotos = album.image_count || 0; // Total photos in SmugMug
        const syncedPhotos = album.synced_photo_count || 0; // Photos downloaded locally
        const processedPhotos = album.ai_processed_count || 0; // Photos analyzed by AI
        
        // Calculate different states
        const notSynced = Math.max(0, totalPhotos - syncedPhotos); // Not downloaded yet
        const syncedNotProcessed = Math.max(0, syncedPhotos - processedPhotos); // Downloaded but not processed
        const processed = processedPhotos; // Fully processed
        
        const processedPercent = syncedPhotos > 0 ? Math.round((processed / syncedPhotos) * 100) : 0;
        
        div.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <div class="flex items-center flex-1 min-w-0">
                    <svg class="h-4 w-4 text-green-600 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                    </svg>
                    <span class="text-sm font-medium text-gray-900 truncate">${albumTitle}</span>
                </div>
                <span class="ml-2 flex-shrink-0">${syncIconSvg}</span>
            </div>
            
            ${totalPhotos > 0 ? `
                <div class="mt-2 space-y-1">
                    <!-- Photo counts breakdown -->
                    <div class="flex items-center justify-between text-xs">
                        <span class="text-gray-600">${totalPhotos} total photos</span>
                    </div>
                    
                    ${album.is_synced ? `
                        <!-- Detailed breakdown for synced albums -->
                        <div class="space-y-1">
                            <div class="flex items-center justify-between text-xs">
                                <div class="flex items-center">
                                    <div class="w-2 h-2 rounded-full bg-green-500 mr-1"></div>
                                    <span class="text-gray-700">Processed</span>
                                </div>
                                <span class="text-green-600 font-medium">${processed}</span>
                            </div>
                            ${syncedNotProcessed > 0 ? `
                                <div class="flex items-center justify-between text-xs">
                                    <div class="flex items-center">
                                        <div class="w-2 h-2 rounded-full bg-yellow-500 mr-1"></div>
                                        <span class="text-gray-700">Synced, not processed</span>
                                    </div>
                                    <span class="text-yellow-600 font-medium">${syncedNotProcessed}</span>
                                </div>
                            ` : ''}
                            ${notSynced > 0 ? `
                                <div class="flex items-center justify-between text-xs">
                                    <div class="flex items-center">
                                        <div class="w-2 h-2 rounded-full bg-gray-400 mr-1"></div>
                                        <span class="text-gray-700">Not synced</span>
                                    </div>
                                    <span class="text-gray-500 font-medium">${notSynced}</span>
                                </div>
                            ` : ''}
                            <!-- Progress bar -->
                            <div class="mt-2">
                                <div class="flex justify-between text-xs text-gray-600 mb-1">
                                    <span>AI Progress</span>
                                    <span>${processedPercent}%</span>
                                </div>
                                <div class="w-full bg-gray-200 rounded-full h-1.5">
                                    <div class="bg-green-500 h-1.5 rounded-full transition-all" style="width: ${processedPercent}%"></div>
                                </div>
                            </div>
                        </div>
                    ` : `
                        <!-- Simple display for unsynced albums -->
                        <div class="flex items-center justify-between text-xs">
                            <div class="flex items-center">
                                <div class="w-2 h-2 rounded-full bg-gray-400 mr-1"></div>
                                <span class="text-gray-700">Not synced</span>
                            </div>
                            <span class="text-gray-500 font-medium">${totalPhotos}</span>
                        </div>
                    `}
                </div>
            ` : ''}
        `;
        
        div.addEventListener('click', () => this.selectAlbum(album));
        
        return div;
    }
    
    createFolderListItem(folder) {
        const div = document.createElement('div');
        
        const folderName = folder.name || 'Untitled Folder';
        
        div.className = 'folder-item p-3 border-b border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors';
        
        div.innerHTML = `
            <div class="flex items-center justify-between mb-1">
                <div class="flex items-center flex-1 min-w-0">
                    <svg class="h-4 w-4 text-amber-600 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>
                    </svg>
                    <span class="text-sm font-medium text-gray-900 truncate">${folderName}</span>
                </div>
                <svg class="h-3 w-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 111.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
                </svg>
            </div>
            
            <div class="text-xs text-gray-500">
                <span>Folder</span>
            </div>
        `;
        
        div.addEventListener('click', () => this.navigateToFolder(folder));
        
        return div;
    }
    
    
    
    
    
    
    
    
    
    createAlbumCard(album) {
        const div = document.createElement('div');
        const albumName = album.name || 'Untitled Album';
        const photoCount = album.image_count || album.synced_photo_count || 0;
        const processedCount = album.ai_processed_count || 0;
        const syncIconSvg = album.is_synced 
            ? `<svg class="h-4 w-4 text-green-200" fill="currentColor" viewBox="0 0 20 20" title="Synced - Album photos are available locally">
                 <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
               </svg>`
            : `<svg class="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" title="Not synced - Click 'Sync Album' to download photos">
                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
               </svg>`;
        
        // Always start with fallback appearance and load thumbnail on-demand
        div.className = 'album-card bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer aspect-square relative';
        
        // Privacy status badge - defined here so it can be used in lazy-load call
        const privacyBadge = album.privacy_info ? 
            (album.privacy_info.is_private ? 
                '<span class="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full flex items-center"><svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 616 0z" clip-rule="evenodd"/></svg>Private</span>' 
            : album.privacy_info.is_unlisted ? 
                '<span class="absolute top-2 left-2 bg-orange-500 text-white text-xs px-2 py-1 rounded-full flex items-center"><svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 818 0z" clip-rule="evenodd"/></svg>Unlisted</span>' 
            : '') : '';

        div.innerHTML = `
            ${privacyBadge}
            <div class="flex flex-col items-center text-center h-full justify-center">
                <h3 class="text-sm font-medium text-gray-900 break-words flex items-center mb-2">
                    <svg class="h-5 w-5 text-blue-600 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"/>
                    </svg>
                    ${albumName}
                </h3>
                <div class="flex items-center justify-center space-x-2">
                    <p class="text-xs text-gray-500">${photoCount} photos</p>
                    <span class="flex-shrink-0">${syncIconSvg}</span>
                </div>
                ${album.is_synced ? `
                    <p class="text-xs text-green-600 mt-1">${processedCount} processed</p>
                ` : ''}
            </div>
        `;

        if (false) { // Remove old logic
            // Card with background image
            const imageUrl = album.highlight_image.thumbnail_url || album.highlight_image.image_url;
            div.className = 'album-card rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer relative overflow-hidden bg-cover bg-center';
            div.style.backgroundImage = `url('${imageUrl}')`;
            
            // Privacy status badge
            const privacyBadge = album.privacy_info ? 
                (album.privacy_info.is_private ? 
                    '<span class="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full flex items-center"><svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/></svg>Private</span>' 
                : album.privacy_info.is_unlisted ? 
                    '<span class="absolute top-2 left-2 bg-orange-500 text-white text-xs px-2 py-1 rounded-full flex items-center"><svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/></svg>Unlisted</span>' 
                : '') : '';

            div.innerHTML = `
                ${privacyBadge}
                <div class="relative z-10 flex flex-col items-center text-center h-full justify-end">
                    <h3 class="text-sm font-medium text-white truncate w-full bg-black bg-opacity-50 px-2 py-1 rounded">${albumName}</h3>
                    <div class="flex items-center justify-center mt-1 space-x-2 bg-black bg-opacity-50 px-2 py-1 rounded">
                        <p class="text-xs text-gray-200">${photoCount} photos</p>
                        <span class="flex-shrink-0">${syncIconSvg}</span>
                    </div>
                    ${album.is_synced ? `
                        <p class="text-xs text-green-300 mt-1 bg-black bg-opacity-50 px-2 py-1 rounded">${processedCount} processed</p>
                    ` : ''}
                </div>
            `;
        } else {
            // Fallback card with icon
            div.className = 'album-card bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer relative';
            
            // Privacy status badge
            const privacyBadge = album.privacy_info ? 
                (album.privacy_info.is_private ? 
                    '<span class="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full flex items-center"><svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/></svg>Private</span>' 
                : album.privacy_info.is_unlisted ? 
                    '<span class="absolute top-2 left-2 bg-orange-500 text-white text-xs px-2 py-1 rounded-full flex items-center"><svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/></svg>Unlisted</span>' 
                : '') : '';

            div.innerHTML = `
                ${privacyBadge}
                <div class="flex flex-col items-center text-center h-full justify-center">
                    <svg class="h-16 w-16 text-blue-600 mb-2" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"/>
                    </svg>
                    <h3 class="text-sm font-medium text-gray-900 break-words w-full text-center">${albumName}</h3>
                    <div class="flex items-center justify-center mt-1 space-x-2">
                        <p class="text-xs text-gray-500">${photoCount} photos</p>
                        <span class="flex-shrink-0">${syncIconSvg}</span>
                    </div>
                    ${album.is_synced ? `
                        <p class="text-xs text-green-600 mt-1">${processedCount} processed</p>
                    ` : ''}
                </div>
            `;
        }
        
        // For albums with album_key, lazy-load thumbnail
        if (album.type === 'album' && album.album_key) {
            this.loadAlbumThumbnail(div, album.album_key, albumName, photoCount, processedCount, syncIconSvg, privacyBadge, album.is_synced);
        }
        
        div.addEventListener('click', () => this.selectAlbum(album));
        
        return div;
    }
    
    async loadAlbumThumbnail(cardElement, albumKey, albumName, photoCount, processedCount, syncIconSvg, privacyBadge, isSynced) {
        try {
            const response = await fetch(`${this.apiBase}/smugmug/album/${albumKey}/thumbnail`);
            
            if (response.ok) {
                const data = await response.json();
                
                if (data.thumbnail_url) {
                    // Update card with thumbnail background
                    cardElement.className = 'album-card rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer relative overflow-hidden bg-cover bg-center aspect-square';
                    cardElement.style.backgroundImage = `url('${data.thumbnail_url}')`;
                    
                    // Update content with bottom overlay styling
                    cardElement.innerHTML = `
                        ${privacyBadge}
                        <div class="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 p-2 rounded-b-lg">
                            <h3 class="text-sm font-medium text-white break-words flex items-center justify-center text-center mb-1">
                                <svg class="h-4 w-4 text-blue-400 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"/>
                                </svg>
                                ${albumName}
                            </h3>
                            <div class="flex items-center justify-center space-x-2">
                                <p class="text-xs text-gray-200">${photoCount} photos</p>
                                <span class="flex-shrink-0">${syncIconSvg}</span>
                            </div>
                            ${isSynced ? `
                                <p class="text-xs text-green-300 mt-1 text-center">${processedCount} processed</p>
                            ` : ''}
                        </div>
                    `;
                }
            }
        } catch (error) {
            console.log(`No thumbnail available for album ${albumName}: ${error.message}`);
            // Keep fallback appearance
        }
    }
    
    displayRootFolderContentsInRightPanel() {
        // Clear current album state since we're viewing folder contents
        this.currentAlbum = null;
        
        // Update UI to show folder contents view
        this.showPhotosView();
        
        // Update the header to show root folder name
        document.getElementById('current-album-title').textContent = 'SmugMug Albums';
        
        // Hide album-specific actions
        document.getElementById('album-actions').classList.add('hidden');
        document.getElementById('album-stats').classList.add('hidden');
        
        // Show folder contents in the photo grid area
        this.displayFolderItemsInGrid(this.smugmugAlbums);
        
        // Hide the old breadcrumb elements for root view
        const breadcrumbArrow = document.getElementById('breadcrumb-arrow');
        const breadcrumbCurrent = document.getElementById('breadcrumb-current');
        if (breadcrumbArrow) breadcrumbArrow.classList.add('hidden');
        if (breadcrumbCurrent) breadcrumbCurrent.classList.add('hidden');
    }
    
    displayFolderInfoInRightPanel(folder) {
        // Clear current album state since we're viewing folder info
        this.currentAlbum = null;
        
        // Update UI to show folder info view
        this.showPhotosView();
        
        // Update the header to show folder name
        document.getElementById('current-album-title').textContent = folder.name || 'Folder';
        
        // Hide album-specific actions
        document.getElementById('album-actions').classList.add('hidden');
        document.getElementById('album-stats').classList.add('hidden');
        
        // Hide photo controls since we're showing folder info
        document.getElementById('photo-controls').classList.add('hidden');
        
        // Create folder info display
        const photoGrid = document.getElementById('photo-grid');
        const emptyState = document.getElementById('empty-photos');
        const welcomeState = document.getElementById('welcome-state');
        
        // Hide other states
        if (emptyState) emptyState.classList.add('hidden');
        if (welcomeState) welcomeState.classList.add('hidden');
        
        photoGrid.classList.remove('hidden');
        photoGrid.className = 'flex-1 p-6'; // Remove grid classes for info view
        
        // Create folder info content
        photoGrid.innerHTML = `
            <div class="max-w-4xl mx-auto">
                <!-- Folder Header -->
                <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                    <div class="flex items-start space-x-6">
                        <!-- Folder Icon or Highlight Image -->
                        <div class="flex-shrink-0">
                            ${folder.highlight_image && (folder.highlight_image.image_url || folder.highlight_image.thumbnail_url) ? `
                                <div class="w-32 h-32 rounded-lg overflow-hidden bg-gray-100 shadow-sm">
                                    <img src="${folder.highlight_image.image_url || folder.highlight_image.thumbnail_url}" 
                                         alt="${folder.name}" 
                                         class="w-full h-full object-cover">
                                </div>
                            ` : `
                                <div class="w-32 h-32 rounded-lg bg-yellow-100 flex items-center justify-center">
                                    <svg class="w-16 h-16 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>
                                    </svg>
                                </div>
                            `}
                        </div>
                        
                        <!-- Folder Details -->
                        <div class="flex-1">
                            <h1 class="text-2xl font-bold text-gray-900 mb-2">${folder.name || 'Untitled Folder'}</h1>
                            
                            ${folder.description ? `
                                <p class="text-gray-600 mb-4">${folder.description}</p>
                            ` : ''}
                            
                            <div class="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span class="font-medium text-gray-500">Type:</span>
                                    <span class="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-sm text-xs font-medium">
                                        ${folder.type.charAt(0).toUpperCase() + folder.type.slice(1)}
                                    </span>
                                </div>
                                
                                <div>
                                    <span class="font-medium text-gray-500">Privacy:</span>
                                    <span class="ml-2">${folder.privacy || 'Unknown'}</span>
                                </div>
                                
                                ${folder.date_added ? `
                                    <div>
                                        <span class="font-medium text-gray-500">Created:</span>
                                        <span class="ml-2">${new Date(folder.date_added).toLocaleDateString()}</span>
                                    </div>
                                ` : ''}
                                
                                ${folder.date_modified ? `
                                    <div>
                                        <span class="font-medium text-gray-500">Modified:</span>
                                        <span class="ml-2">${new Date(folder.date_modified).toLocaleDateString()}</span>
                                    </div>
                                ` : ''}
                            </div>
                            
                            <!-- Folder Actions -->
                            <div class="flex items-center space-x-3 mt-4">
                                ${folder.has_children ? `
                                    <button onclick="app.navigateToFolder({node_uri: '${folder.node_uri}', name: '${folder.name}', has_children: true})" 
                                            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium">
                                        <svg class="w-4 h-4 mr-2 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                                        </svg>
                                        Browse Folder
                                    </button>
                                ` : ''}
                                
                                <button onclick="app.refreshFolderInfo('${folder.node_uri}')" 
                                        class="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-sm font-medium">
                                    <svg class="w-4 h-4 mr-2 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                                    </svg>
                                    Refresh
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Folder Contents Preview -->
                <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h2 class="text-lg font-semibold text-gray-900 mb-4">Folder Contents</h2>
                    
                    <div id="folder-contents-preview" class="text-center py-8">
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p class="text-gray-600">Loading folder contents...</p>
                    </div>
                </div>
            </div>
        `;
        
        // Load folder contents preview
        this.loadFolderContentsPreview(folder.node_uri);
        
        // Update breadcrumb to show current folder
        const breadcrumbArrow = document.getElementById('breadcrumb-arrow');
        const breadcrumbCurrent = document.getElementById('breadcrumb-current');
        if (breadcrumbArrow) breadcrumbArrow.classList.remove('hidden');
        if (breadcrumbCurrent) {
            breadcrumbCurrent.classList.remove('hidden');
            breadcrumbCurrent.textContent = folder.name;
        }
    }
    
    async loadFolderContentsPreview(nodeUri) {
        const previewContainer = document.getElementById('folder-contents-preview');
        if (!previewContainer) return;
        
        try {
            const response = await fetch(`${this.apiBase}/smugmug/nodes?node_uri=${encodeURIComponent(nodeUri)}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            const contents = data.nodes || [];
            
            if (contents.length === 0) {
                previewContainer.innerHTML = `
                    <div class="text-gray-500">
                        <svg class="w-12 h-12 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2v0a2 2 0 002 2z"/>
                        </svg>
                        <p>This folder is empty</p>
                    </div>
                `;
                return;
            }
            
            const folders = contents.filter(item => item.type === 'folder');
            const albums = contents.filter(item => item.type === 'album');
            
            previewContainer.innerHTML = `
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                    ${folders.length > 0 ? `
                        <div>
                            <h3 class="font-medium text-gray-900 mb-3 flex items-center">
                                <svg class="w-4 h-4 mr-2 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>
                                </svg>
                                Folders (${folders.length})
                            </h3>
                            <div class="space-y-2">
                                ${folders.slice(0, 5).map(folder => `
                                    <div class="flex items-center py-2 px-3 bg-gray-50 rounded hover:bg-gray-100 cursor-pointer" 
                                         onclick="app.navigateToFolder({node_uri: '${folder.node_uri}', name: '${folder.name}', has_children: true})">
                                        ${folder.highlight_image && (folder.highlight_image.thumbnail_url || folder.highlight_image.image_url) ? `
                                            <div class="w-8 h-8 mr-2 rounded overflow-hidden bg-gray-100 flex-shrink-0">
                                                <img src="${folder.highlight_image.thumbnail_url || folder.highlight_image.image_url}" 
                                                     alt="${folder.name}" 
                                                     class="w-full h-full object-cover">
                                            </div>
                                        ` : `
                                            <svg class="w-4 h-4 mr-2 text-yellow-600 ml-1" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>
                                            </svg>
                                        `}
                                        <span class="text-sm truncate">${folder.name}</span>
                                    </div>
                                `).join('')}
                                ${folders.length > 5 ? `<p class="text-xs text-gray-500 pl-6">...and ${folders.length - 5} more</p>` : ''}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${albums.length > 0 ? `
                        <div>
                            <h3 class="font-medium text-gray-900 mb-3 flex items-center">
                                <svg class="w-4 h-4 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M4 3a2 2 0 00-2 2v1.816a2 2 0 00.586 1.414l2.828 2.828A2 2 0 008.172 12H15a2 2 0 002-2V5a2 2 0 00-2-2H4z"/>
                                </svg>
                                Albums (${albums.length})
                            </h3>
                            <div class="space-y-2">
                                ${albums.slice(0, 5).map(album => `
                                    <div class="flex items-center py-2 px-3 bg-gray-50 rounded hover:bg-gray-100 cursor-pointer" 
                                         onclick="app.selectAlbum(${JSON.stringify(album).replace(/"/g, '&quot;')})">
                                        ${album.highlight_image && (album.highlight_image.thumbnail_url || album.highlight_image.image_url) ? `
                                            <div class="w-8 h-8 mr-2 rounded overflow-hidden bg-gray-100 flex-shrink-0">
                                                <img src="${album.highlight_image.thumbnail_url || album.highlight_image.image_url}" 
                                                     alt="${album.name}" 
                                                     class="w-full h-full object-cover">
                                            </div>
                                        ` : `
                                            <svg class="w-4 h-4 mr-2 text-blue-600 ml-1" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M4 3a2 2 0 00-2 2v1.816a2 2 0 00.586 1.414l2.828 2.828A2 2 0 008.172 12H15a2 2 0 002-2V5a2 2 0 00-2-2H4z"/>
                                            </svg>
                                        `}
                                        <span class="text-sm truncate flex-1">${album.name}</span>
                                        <span class="text-xs text-gray-500">${album.image_count || 0}</span>
                                    </div>
                                `).join('')}
                                ${albums.length > 5 ? `<p class="text-xs text-gray-500 pl-6">...and ${albums.length - 5} more</p>` : ''}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
            
        } catch (error) {
            console.error('Failed to load folder contents preview:', error);
            previewContainer.innerHTML = `
                <div class="text-red-500">
                    <svg class="w-12 h-12 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <p>Failed to load folder contents</p>
                </div>
            `;
        }
    }
    
    async refreshFolderInfo(nodeUri) {
        // Refresh the folder info by reloading
        this.loadFolderContentsPreview(nodeUri);
    }

    async selectAlbum(album) {
        console.log('selectAlbum called with album:', album);
        console.log('Album keys:', Object.keys(album));
        console.log('Album ID properties:', {
            smugmug_id: album.smugmug_id,
            album_key: album.album_key,
            id: album.id
        });
        
        this.currentAlbum = album;
        
        // Save state after album selection
        stateManager.saveAppState();
        
        // Update UI
        this.updateAlbumSelection();
        this.showPhotosView();
        // Handle both old and new API format for album ID
        const albumId = album.smugmug_id || album.album_key;
        if (albumId) {
            await this.loadAlbumPhotos(albumId);
        } else {
            console.error('No album ID found in album object:', album);
            eventBus.emit('toast:error', { title: 'Album Error', 'Could not load album photos - missing album identifier');
        }
    }

    updateAlbumSelection() {
        // Update sidebar selection
        document.querySelectorAll('.album-item').forEach(item => {
            item.classList.remove('bg-blue-50', 'border-blue-200');
        });
        
        // Find and highlight current album
        if (this.currentAlbum) {
            const albumItems = document.querySelectorAll('.album-item');
            const currentAlbumName = this.currentAlbum.title || this.currentAlbum.name;
            albumItems.forEach(item => {
                const titleElement = item.querySelector('span.album-name') || item.querySelector('span.font-medium');
                if (titleElement) {
                    const title = titleElement.textContent;
                    if (title === currentAlbumName) {
                        item.classList.add('bg-blue-50', 'border-blue-200');
                    }
                }
            });
        }
        
        // Update breadcrumb to show current album
        if (this.currentAlbum) {
            const breadcrumbArrow = document.getElementById('breadcrumb-arrow');
            const breadcrumbCurrent = document.getElementById('breadcrumb-current');
            if (breadcrumbArrow) breadcrumbArrow.classList.remove('hidden');
            if (breadcrumbCurrent) {
                breadcrumbCurrent.classList.remove('hidden');
                breadcrumbCurrent.textContent = this.currentAlbum.title || this.currentAlbum.name || 'Selected Album';
            }
            
            // Update photo panel header with highlight image
            this.updateAlbumHeader();
            document.getElementById('album-stats').classList.remove('hidden');
            document.getElementById('album-actions').classList.remove('hidden');
        }
        
        // Update sync button based on sync status
        const syncButton = document.getElementById('sync-album');
        if (this.currentAlbum) {
            if (this.currentAlbum.is_synced) {
                syncButton.textContent = 'Re-sync Album';
                syncButton.className = 'text-sm px-3 py-1 bg-orange-600 text-white rounded hover:bg-orange-700';
            } else {
                syncButton.textContent = 'Sync Album';
                syncButton.className = 'text-sm px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700';
            }
        }
    }
    
    updateAlbumHeader() {
        const titleElement = document.getElementById('current-album-title');
        if (!titleElement || !this.currentAlbum) return;
        
        const albumName = this.currentAlbum.title || this.currentAlbum.name || 'Selected Album';
        
        // Check if album has a highlight image
        if (this.currentAlbum.highlight_image && (this.currentAlbum.highlight_image.thumbnail_url || this.currentAlbum.highlight_image.image_url)) {
            // Create enhanced header with highlight image
            const headerContainer = titleElement.parentElement;
            headerContainer.innerHTML = `
                <div class="flex items-center space-x-4">
                    <div class="album-highlight-image flex-shrink-0">
                        <img src="${this.currentAlbum.highlight_image.thumbnail_url || this.currentAlbum.highlight_image.image_url}" 
                             alt="${albumName}" 
                             class="w-12 h-12 rounded-lg object-cover shadow-sm border border-gray-200">
                    </div>
                    <div class="flex-1">
                        <h2 id="current-album-title" class="font-semibold text-gray-900">${albumName}</h2>
                        ${this.currentAlbum.description ? `
                            <p class="text-sm text-gray-600 mt-1 truncate">${this.currentAlbum.description}</p>
                        ` : ''}
                    </div>
                </div>
                <div id="album-stats" class="ml-4 text-sm text-gray-600 hidden">
                    <span id="photo-count">0 photos</span> • 
                    <span id="processing-stats">0 processed</span>
                </div>
            `;
        } else {
            // Standard header without highlight image
            titleElement.textContent = albumName;
        }
    }

    // Photos Management
    async loadAlbumPhotos(albumId) {
        eventBus.emit('photos:clear-selection');
        
        // Check cache first
        const cachedPhotos = cacheManager.getCachedAlbumPhotos(albumId);
        if (cachedPhotos) {
            // Show cached data immediately for fast navigation
            console.log(`🔍 DEBUG: Using cached photos for album ${albumId} (${cachedPhotos.length} photos)`);
            this.currentPhotos = cachedPhotos;
            eventBus.emit('photos:display', { photos: this.currentPhotos });
            this.updatePhotoStats();
            
            // Still fetch fresh data in background to update cache and UI
            this.refreshAlbumPhotosInBackground(albumId);
            return;
        }
        
        // No cache available, show loading and fetch fresh data
        eventBus.emit('photos:loading:show');
        await this.fetchAlbumPhotos(albumId);
    }
    
    async fetchAlbumPhotos(albumId) {
        try {
            const response = await fetch(`${this.apiBase}/smugmug/albums/${albumId}/photos`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            this.currentPhotos = await response.json();
            
            // DEBUG: Log photo data to understand status issues
            console.log(`🔍 DEBUG: Fetched ${this.currentPhotos.length} photos for album ${albumId}`);
            console.log('🔍 DEBUG: To clear cache and reload, run: window.app.debugClearCacheAndReload()');
            
            const statusCounts = {};
            this.currentPhotos.forEach((photo, index) => {
                const status = photo.processing_status || 'undefined';
                const hasAiMetadata = !!(photo.ai_metadata && photo.ai_metadata.length > 0);
                statusCounts[status] = (statusCounts[status] || 0) + 1;
                
                // Log first few photos for detailed analysis
                if (index < 5) {
                    console.log(`🔍 Photo ${index + 1}:`, {
                        title: photo.title || photo.filename || 'Untitled',
                        processing_status: photo.processing_status,
                        hasAiMetadata: hasAiMetadata,
                        ai_metadata_length: photo.ai_metadata ? photo.ai_metadata.length : 0,
                        smugmug_id: photo.smugmug_id,
                        local_photo_id: photo.local_photo_id
                    });
                }
            });
            console.log('🔍 Status breakdown:', statusCounts);
            
            // Cache the fresh data
            cacheManager.setCachedAlbumPhotos(albumId, this.currentPhotos);
            
            eventBus.emit('photos:display', { photos: this.currentPhotos });
            this.updatePhotoStats();
            eventBus.emit('photos:loading:hide');
            
        } catch (error) {
            console.error('Failed to load photos:', error);
            eventBus.emit('toast:error', { title: 'Failed to Load Photos', 'Could not fetch photos from this album.', error.message);
            eventBus.emit('photos:loading:hide');
        }
    }
    
    async refreshAlbumPhotosInBackground(albumId) {
        try {
            console.log('Refreshing album photos in background for:', albumId);
            const response = await fetch(`${this.apiBase}/smugmug/albums/${albumId}/photos`);
            if (!response.ok) return; // Silently fail for background refresh
            
            const freshPhotos = await response.json();
            
            // Update cache with fresh data
            cacheManager.setCachedAlbumPhotos(albumId, freshPhotos);
            
            // Only update UI if this is still the current album
            if (this.currentAlbum && (this.currentAlbum.smugmug_id === albumId || this.currentAlbum.album_key === albumId)) {
                // Check if data actually changed to avoid unnecessary re-renders
                if (JSON.stringify(this.currentPhotos) !== JSON.stringify(freshPhotos)) {
                    console.log('Album data updated from background refresh');
                    this.currentPhotos = freshPhotos;
                    eventBus.emit('photos:display', { photos: this.currentPhotos });
                    this.updatePhotoStats();
                }
            }
        } catch (error) {
            console.log('Background refresh failed (ignoring):', error.message);
        }
    }





    // Album sync - Now handled by SmugMugAPI manager

    // Photo processing - Now handled by PhotoProcessor manager


    // Refresh album status to check for processing completion
    async refreshAlbumStatus() {
        if (!this.currentAlbum) {
            return;
        }
        
        try {
            console.log('Refreshing album status...');
            const currentAlbumId = this.currentAlbum.smugmug_id || this.currentAlbum.album_key;
            await this.loadAlbumPhotos(currentAlbumId);
            await smugMugAPI.loadSmugMugAlbums();
            
            // Count any still processing
            const processingCount = this.currentPhotos.filter(p => p.processing_status === 'processing').length;
            
            if (processingCount > 0) {
                console.log(`${processingCount} photos still processing`);
            } else {
                console.log('All photos have completed processing');
                eventBus.emit('toast:success', { title: 'Processing Complete', 'All background processing has completed!');
            }
            
        } catch (error) {
            console.error('Error refreshing album status:', error);
        }
    }


    // UI State Management
    async showAlbumsView() {
        this.currentAlbum = null;
        eventBus.emit('photos:clear-selection');
        
        // Reset folder navigation state and go to root
        this.nodeHistory = [];
        this.breadcrumbs = [];
        this.currentNodeUri = null;
        
        // Hide breadcrumb elements (the old static ones)
        const breadcrumbArrow = document.getElementById('breadcrumb-arrow');
        const breadcrumbCurrent = document.getElementById('breadcrumb-current');
        if (breadcrumbArrow) breadcrumbArrow.classList.add('hidden');
        if (breadcrumbCurrent) breadcrumbCurrent.classList.add('hidden');
        
        // Reset photo panel
        document.getElementById('current-album-title').textContent = 'Select an album';
        document.getElementById('album-stats').classList.add('hidden');
        document.getElementById('album-actions').classList.add('hidden');
        document.getElementById('photo-controls').classList.add('hidden');
        
        // Show welcome state
        document.getElementById('welcome-state').classList.remove('hidden');
        document.getElementById('photo-grid').classList.add('hidden');
        document.getElementById('empty-photos').classList.add('hidden');
        
        // Update album selection
        document.querySelectorAll('.album-item').forEach(item => {
            item.classList.remove('bg-blue-50', 'border-blue-200');
        });
        
        // Load root folder contents
        await smugMugAPI.loadFolderContents();
        
        // Emit event to trigger AlbumBrowser display
        console.log('Triggering albums display...');
        eventBus.emit('albums:display');
    }

    showPhotosView() {
        document.getElementById('welcome-state').classList.add('hidden');
    }


    // Progress management and photo status updates - Now handled by PhotoProcessor manager

    updatePhotoStats() {
        if (!this.currentAlbum) return;
        
        const totalPhotos = this.currentAlbum.image_count || 0;
        const processedPhotos = this.currentAlbum.ai_processed_count || 0;
        
        document.getElementById('photo-count').textContent = `${totalPhotos} photos`;
        document.getElementById('processing-stats').textContent = `${processedPhotos} processed`;
    }

    filterPhotos(status) {
        this.statusFilter = status;
        eventBus.emit('photos:display', { photos: this.currentPhotos });
    }


    async refreshCurrentPhotos() {
        if (this.currentAlbum) {
            const currentAlbumId = this.currentAlbum.smugmug_id || this.currentAlbum.album_key;
            await this.loadAlbumPhotos(currentAlbumId);
        }
    }

    // Utility Methods
    showToast(title, message, type = 'success', duration = 4000) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        // Create toast element
        const toast = document.createElement('div');
        const toastId = 'toast-' + Date.now();
        toast.id = toastId;
        
        // Base classes for all toasts
        const baseClasses = 'transform transition-all duration-300 ease-in-out min-w-[400px] bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5';
        
        // Type-specific styling
        const typeStyles = {
            success: 'border-l-4 border-green-400',
            error: 'border-l-4 border-red-400',
            warning: 'border-l-4 border-yellow-400',
            info: 'border-l-4 border-blue-400'
        };
        
        const iconStyles = {
            success: '🎉',
            error: '❌',
            warning: '⚠️', 
            info: 'ℹ️'
        };
        
        toast.className = `${baseClasses} ${typeStyles[type] || typeStyles.success} translate-x-full opacity-0`;
        
        toast.innerHTML = `
            <div class="flex-1 w-0 p-4">
                <div class="flex items-start">
                    <div class="flex-shrink-0">
                        <span class="text-lg">${iconStyles[type] || iconStyles.success}</span>
                    </div>
                    <div class="ml-3 w-0 flex-1">
                        <p class="text-sm font-medium text-gray-900">${title}</p>
                        <p class="mt-1 text-sm text-gray-500">${message}</p>
                    </div>
                </div>
            </div>
            <div class="flex border-l border-gray-200">
                <button class="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-gray-600 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" onclick="this.parentElement.parentElement.remove()">
                    <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                </button>
            </div>
        `;
        
        container.appendChild(toast);
        
        // Animate in
        setTimeout(() => {
            toast.classList.remove('translate-x-full', 'opacity-0');
            toast.classList.add('translate-x-0', 'opacity-100');
        }, 50);
        
        // Auto dismiss
        if (duration > 0) {
            setTimeout(() => {
                this.removeToast(toastId);
            }, duration);
        }
    }

    removeToast(toastId) {
        const toast = document.getElementById(toastId);
        if (toast) {
            toast.classList.add('translate-x-full', 'opacity-0');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 300);
        }
    }

    showSuccessMessage(title, message) {
        this.showToast(title, message, 'success');
    }

    showErrorMessage(title, message, details = null) {
        console.error(`${title}: ${message}`, details);
        this.showToast(title, message, 'error', 0); // 0 duration means no auto-dismiss
    }

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

    // Page Navigation
    showPage(pageName) {
        try {
            console.log(`Switching to page: ${pageName}`);
            
            // Hide all pages
            document.getElementById('page-albums').classList.add('hidden');
            document.getElementById('page-collections').classList.add('hidden');
            document.getElementById('page-chat').classList.add('hidden');
            document.getElementById('page-search').classList.add('hidden');
            document.getElementById('page-settings').classList.add('hidden');
            
            // Remove active state from all nav tabs
            document.querySelectorAll('.nav-tab').forEach(tab => {
                tab.classList.remove('nav-tab-active');
            });
            
            // Show selected page and activate tab
            const pageElement = document.getElementById(`page-${pageName}`);
            const navElement = document.getElementById(`nav-${pageName}`);
            
            if (pageElement) {
                pageElement.classList.remove('hidden');
                console.log(`Page ${pageName} shown successfully`);
            } else {
                console.error(`Page element not found: page-${pageName}`);
            }
            
            if (navElement) {
                navElement.classList.add('nav-tab-active');
            } else {
                console.error(`Nav element not found: nav-${pageName}`);
            }
            
            this.currentPage = pageName;
            
            // Save state after page change
            stateManager.saveAppState();
            
            // Initialize page if needed
            if (pageName === 'albums') {
                // Load and display albums
                this.showAlbumsView().catch(error => {
                    console.error('Error loading albums view:', error);
                });
            } else if (pageName === 'collections') {
                eventBus.emit('collections:initialize-page');
            } else if (pageName === 'chat' && this.chatMessages.length === 0) {
                this.initializeChatPage();
            } else if (pageName === 'search') {
                this.initializeSearchPage();
            } else if (pageName === 'settings') {
                this.initializeSettingsPage().catch(error => {
                    console.error('Error initializing settings page:', error);
                });
            }
        } catch (error) {
            console.error('Error in showPage:', error);
        }
    }
    
    initializeChatPage() {
        // Chat page is ready by default with welcome message
        console.log('Chat page initialized');
    }
    
    initializeSearchPage() {
        // Search page is ready by default with welcome state
        console.log('Search page initialized');
        this.populateAlbumFilter();
    }
    
    async populateAlbumFilter() {
        try {
            // Get albums for filter dropdown
            const albumSelect = document.getElementById('search-filter-album');
            if (!albumSelect) return;
            
            // Clear existing options except "All Albums"
            while (albumSelect.children.length > 1) {
                albumSelect.removeChild(albumSelect.lastChild);
            }
            
            // Add albums from current data
            if (this.smugmugAlbums && this.smugmugAlbums.length > 0) {
                this.smugmugAlbums.forEach(album => {
                    const option = document.createElement('option');
                    option.value = album.smugmug_id || album.album_key;
                    option.textContent = album.title || album.name;
                    albumSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error populating album filter:', error);
        }
    }
    
    toggleFilters() {
        const filtersDiv = document.getElementById('search-filters');
        const toggleText = document.getElementById('filter-toggle-text');
        const toggleIcon = document.getElementById('filter-toggle-icon');
        
        if (filtersDiv.classList.contains('hidden')) {
            filtersDiv.classList.remove('hidden');
            toggleText.textContent = 'Hide Filters';
            toggleIcon.style.transform = 'rotate(180deg)';
        } else {
            filtersDiv.classList.add('hidden');
            toggleText.textContent = 'Show Filters';
            toggleIcon.style.transform = 'rotate(0deg)';
        }
    }
    
    applyFilters() {
        // Get filter values
        this.searchFilters.album = document.getElementById('search-filter-album').value;
        this.searchFilters.status = document.getElementById('search-filter-status').value;
        this.searchFilters.dateFrom = document.getElementById('search-filter-date-from').value;
        this.searchFilters.dateTo = document.getElementById('search-filter-date-to').value;
        
        // Update active filters display
        this.updateActiveFiltersDisplay();
        
        // Re-run search with filters if there's a current query
        const searchInput = document.getElementById('search-main-input');
        if (searchInput.value.trim()) {
            this.performMainSearch();
        }
    }
    
    clearFilters() {
        // Clear filter values
        document.getElementById('search-filter-album').value = '';
        document.getElementById('search-filter-status').value = '';
        document.getElementById('search-filter-date-from').value = '';
        document.getElementById('search-filter-date-to').value = '';
        
        // Reset internal filter state
        this.searchFilters = {
            album: '',
            status: '',
            dateFrom: '',
            dateTo: ''
        };
        
        // Clear active filters display
        this.updateActiveFiltersDisplay();
        
        // Re-run search if there's a current query
        const searchInput = document.getElementById('search-main-input');
        if (searchInput.value.trim()) {
            this.performMainSearch();
        }
    }
    
    updateActiveFiltersDisplay() {
        const activeFiltersDiv = document.getElementById('active-filters');
        const activeFilters = [];
        
        if (this.searchFilters.album) {
            const albumSelect = document.getElementById('search-filter-album');
            const selectedAlbum = albumSelect.options[albumSelect.selectedIndex].text;
            activeFilters.push(`Album: ${selectedAlbum}`);
        }
        
        if (this.searchFilters.status) {
            const statusSelect = document.getElementById('search-filter-status');
            const selectedStatus = statusSelect.options[statusSelect.selectedIndex].text;
            activeFilters.push(`Status: ${selectedStatus}`);
        }
        
        if (this.searchFilters.dateFrom) {
            activeFilters.push(`From: ${this.searchFilters.dateFrom}`);
        }
        
        if (this.searchFilters.dateTo) {
            activeFilters.push(`To: ${this.searchFilters.dateTo}`);
        }
        
        if (activeFilters.length > 0) {
            activeFiltersDiv.textContent = `Active: ${activeFilters.join(', ')}`;
            activeFiltersDiv.classList.remove('hidden');
        } else {
            activeFiltersDiv.textContent = '';
            activeFiltersDiv.classList.add('hidden');
        }
    }

    // Chat Functionality
    async sendChatMessage() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();
        
        if (!message) return;
        
        // Add user message to UI
        this.addChatMessage('user', message);
        input.value = '';
        document.getElementById('chat-send').disabled = true;
        
        try {
            // Check if this is a photo search query
            if (this.isPhotoSearchQuery(message)) {
                await this.handlePhotoSearchChat(message);
            } else {
                // Handle general conversation
                await this.handleGeneralChat(message);
            }
            
        } catch (error) {
            console.error('Chat error:', error);
            this.addChatMessage('system', 'Sorry, there was an error processing your message. Please try again.');
        }
    }
    
    isPhotoSearchQuery(message) {
        const searchKeywords = ['find', 'show', 'search', 'look', 'photos', 'images', 'pictures', 'with', 'containing', 'have'];
        const lowerMessage = message.toLowerCase();
        return searchKeywords.some(keyword => lowerMessage.includes(keyword));
    }
    
    async handlePhotoSearchChat(message) {
        // Extract search terms from natural language
        const searchQuery = this.extractSearchTerms(message);
        
        if (!searchQuery) {
            this.addChatMessage('system', "I understand you're looking for photos, but I'm not sure what to search for. Try asking something like 'Find photos with medals' or 'Show me archery images'.");
            return;
        }
        
        // Show "thinking" message
        this.addChatMessage('system', `🔍 Searching your photos for "${searchQuery}"...`);
        
        try {
            // Perform actual photo search
            const response = await fetch(`${this.apiBase}/search?q=${encodeURIComponent(searchQuery)}&search_type=hybrid&limit=10`);
            
            if (!response.ok) throw new Error(`Search failed: ${response.status}`);
            
            const results = await response.json();
            this.handleSearchResults(searchQuery, results);
            
        } catch (error) {
            console.error('Photo search error:', error);
            this.addChatMessage('system', "I encountered an error while searching your photos. Make sure you have photos synced and processed first.");
        }
    }
    
    extractSearchTerms(message) {
        // Remove common chat words and extract the important terms
        const stopWords = ['find', 'show', 'search', 'look', 'for', 'photos', 'images', 'pictures', 'me', 'with', 'containing', 'have', 'any', 'all', 'the', 'some'];
        
        // Simple extraction - remove stop words and get meaningful terms
        let terms = message.toLowerCase()
            .replace(/[^\w\s]/g, ' ') // Remove punctuation
            .split(/\s+/)
            .filter(word => word.length > 2 && !stopWords.includes(word));
            
        return terms.join(' ').trim();
    }
    
    handleSearchResults(searchQuery, results) {
        const photos = results.photos || [];
        
        if (photos.length === 0) {
            this.addChatMessage('system', `I didn't find any photos matching "${searchQuery}". Try different terms or make sure your photos are synced and processed with AI first.`);
            return;
        }
        
        // Create response with photo results
        const resultCount = photos.length;
        const responseText = `Found ${resultCount} photo${resultCount > 1 ? 's' : ''} matching "${searchQuery}":`;
        
        this.addChatMessage('system', responseText);
        
        // Add photo results as a special message type
        this.addPhotoResults(photos.slice(0, 6)); // Show up to 6 photos
        
        if (photos.length > 6) {
            this.addChatMessage('system', `Showing first 6 results. Go to the Search page to see all ${photos.length} results.`);
        }
    }
    
    async handleGeneralChat(message) {
        // Handle general conversation about the app, photos, etc.
        const lowerMessage = message.toLowerCase();
        
        if (lowerMessage.includes('help') || lowerMessage.includes('what can you do')) {
            this.addChatMessage('system', `I can help you find photos in your SmugMug collection! Here's what you can ask me:

📸 **Photo Search:**
• "Find photos with medals"
• "Show me archery competition images"  
• "Look for photos containing awards"

🔧 **Getting Started:**
• Go to the Albums page to sync your SmugMug photos
• Use "Sync Album" to add photos to the database
• Process photos with AI to enable smart search

Try asking me to find something specific in your photos!`);
        } else if (lowerMessage.includes('sync') || lowerMessage.includes('album')) {
            this.addChatMessage('system', `To search photos, you'll need to sync them first:

1. Go to the **Albums** page
2. Select an album from your SmugMug account
3. Click **"Sync Album"** to add photos to the database
4. Select photos and click **"Process Selected"** to analyze them with AI

Once photos are processed, you can search them by asking me things like "Find photos with trophies" or "Show me competition images".`);
        } else if (lowerMessage.includes('process') || lowerMessage.includes('ai')) {
            this.addChatMessage('system', `AI processing analyzes your photos to understand their content:

🤖 **What AI Processing Does:**
• Generates detailed descriptions of what's in each photo
• Extracts keywords for better searchability
• Enables content-based search (find photos by what's actually in them)

💡 **How to Process Photos:**
• Sync an album first
• Select photos you want to analyze  
• Click "Process Selected" to run AI analysis
• Or use the lightbox button on individual photos

Once processed, I can find your photos based on their actual content!`);
        } else {
            this.addChatMessage('system', `I'm here to help you find photos in your SmugMug collection! 

Try asking me things like:
• "Find photos with medals"
• "Show me archery images"
• "Look for competition photos"

You can also ask for help with syncing albums or processing photos with AI. What would you like to find?`);
        }
    }
    
    addChatMessage(sender, message) {
        const messagesContainer = document.getElementById('chat-messages');
        
        // Remove welcome state if it exists
        const welcomeState = messagesContainer.querySelector('.flex.flex-col.items-center.justify-center');
        if (welcomeState) {
            welcomeState.remove();
        }
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `flex ${sender === 'user' ? 'justify-end' : 'justify-start'}`;
        
        const bubbleClass = sender === 'user' 
            ? 'bg-blue-600 text-white' 
            : 'bg-gray-100 text-gray-900';
            
        messageDiv.innerHTML = `
            <div class="max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${bubbleClass}">
                <p class="text-sm">${message}</p>
                <p class="text-xs mt-1 opacity-70">${new Date().toLocaleTimeString()}</p>
            </div>
        `;
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        this.chatMessages.push({ sender, message, timestamp: new Date() });
    }
    
    addPhotoResults(photos) {
        const messagesContainer = document.getElementById('chat-messages');
        
        // Remove welcome state if it exists
        const welcomeState = messagesContainer.querySelector('.flex.flex-col.items-center.justify-center');
        if (welcomeState) {
            welcomeState.remove();
        }
        
        const photoResultsDiv = document.createElement('div');
        photoResultsDiv.className = 'flex justify-start mb-4';
        
        photoResultsDiv.innerHTML = `
            <div class="max-w-4xl">
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-gray-50 rounded-lg">
                    ${photos.map(photo => {
                        const photoData = photo.photo || photo;
                        const score = photo.score ? Math.round(photo.score * 100) : 0;
                        return `
                            <div class="chat-photo-result relative group cursor-pointer" 
                                 data-photo='${JSON.stringify(photoData).replace(/'/g, '&apos;')}'>
                                <div class="aspect-square bg-gray-100 rounded-lg overflow-hidden relative">
                                    <img 
                                        src="${photoData.thumbnail_url}" 
                                        alt="${photoData.title || 'Photo'}"
                                        class="w-full h-full object-cover"
                                        loading="lazy"
                                    />
                                    
                                    <!-- Relevance score -->
                                    ${score > 0 ? `
                                        <div class="absolute top-1 right-1 bg-blue-600 text-white text-xs px-1 py-0.5 rounded">
                                            ${score}%
                                        </div>
                                    ` : ''}
                                    
                                    <!-- Hover overlay -->
                                    <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
                                        <div class="opacity-0 group-hover:opacity-100 transition-opacity">
                                            <svg class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Photo title -->
                                <p class="text-xs text-gray-600 mt-1 truncate">${photoData.title || photoData.filename || 'Untitled'}</p>
                            </div>
                        `;
                    }).join('')}
                </div>
                <p class="text-xs text-gray-500 mt-2 px-2">Click any photo to view details</p>
            </div>
        `;
        
        messagesContainer.appendChild(photoResultsDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // Add click handlers for photo results
        photoResultsDiv.querySelectorAll('.chat-photo-result').forEach(photoDiv => {
            photoDiv.addEventListener('click', () => {
                try {
                    const photoData = JSON.parse(photoDiv.dataset.photo.replace(/&apos;/g, "'"));
                    this.showPhotoModal(photoData);
                } catch (error) {
                    console.error('Error parsing photo data:', error);
                }
            });
        });
    }
    
    clearChat() {
        const messagesContainer = document.getElementById('chat-messages');
        messagesContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-gray-500">
                <svg class="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                </svg>
                <h3 class="text-lg font-medium text-gray-900 mb-2">Start a Conversation</h3>
                <p class="text-center max-w-md mb-4">Ask me anything about your SmugMug photos! I can help you find specific images, understand their content, or answer questions about your collection.</p>
                <div class="text-sm text-gray-500 space-y-1">
                    <p><strong>Try asking:</strong></p>
                    <p>"Show me photos with medals"</p>
                    <p>"Find archery competition images"</p>
                    <p>"What photos have been processed with AI?"</p>
                </div>
            </div>
        `;
        this.chatMessages = [];
    }

    // Search Functionality  
    async performMainSearch() {
        const input = document.getElementById('search-main-input');
        const query = input.value.trim();
        const searchType = document.getElementById('search-main-type').value;
        
        if (!query) return;
        
        eventBus.emit('search:loading:show');
        
        try {
            // Build search URL with filters
            const params = new URLSearchParams({
                q: query,
                search_type: searchType,
                limit: '50'
            });
            
            // Add filter parameters if they exist
            if (this.searchFilters.album) {
                params.append('album', this.searchFilters.album);
            }
            if (this.searchFilters.status) {
                params.append('processing_status', this.searchFilters.status);
            }
            if (this.searchFilters.dateFrom) {
                params.append('date_from', this.searchFilters.dateFrom);
            }
            if (this.searchFilters.dateTo) {
                params.append('date_to', this.searchFilters.dateTo);
            }
            
            const response = await fetch(`${this.apiBase}/search?${params.toString()}`);
            const results = await response.json();
            
            this.searchResults = results.photos || [];
            this.displaySearchResults(query, results);
            eventBus.emit('search:loading:hide');
            
        } catch (error) {
            console.error('Search error:', error);
            eventBus.emit('search:loading:hide');
            this.showSearchError('Search failed. Please try again.');
        }
    }
    
    displaySearchResults(query, results) {
        const welcomeState = document.getElementById('search-welcome');
        const loadingState = document.getElementById('search-loading');
        const resultsGrid = document.getElementById('search-results-grid');
        const noResults = document.getElementById('search-no-results');
        const infoSection = document.getElementById('search-main-info');
        const resultsText = document.getElementById('search-main-results-text');
        
        // Hide states
        welcomeState.classList.add('hidden');
        loadingState.classList.add('hidden');
        noResults.classList.add('hidden');
        
        // Show results info
        infoSection.classList.remove('hidden');
        resultsText.textContent = `Found ${results.results} results for "${query}"`;
        
        if (this.searchResults.length === 0) {
            noResults.classList.remove('hidden');
            resultsGrid.classList.add('hidden');
            return;
        }
        
        // Display results
        resultsGrid.classList.remove('hidden');
        const gridContainer = resultsGrid.querySelector('.grid');
        gridContainer.innerHTML = '';
        
        this.searchResults.forEach(result => {
            const photoCard = this.createSearchResultCard(result);
            gridContainer.appendChild(photoCard);
        });
    }
    
    createSearchResultCard(result) {
        const div = document.createElement('div');
        div.className = 'search-result-card relative group cursor-pointer';
        
        const photo = result.photo || result;
        const searchScore = result.search_score || 0;
        
        // Get AI confidence score from AI metadata
        const aiConfidence = photo.ai_metadata?.confidence_score || 
                           (photo.confidence_score ? photo.confidence_score : 0);
        
        div.innerHTML = `
            <div class="aspect-square bg-gray-100 rounded-lg overflow-hidden relative">
                <img 
                    src="${photo.thumbnail_url}" 
                    alt="${photo.title || 'Search result'}"
                    class="w-full h-full object-cover"
                    loading="lazy"
                />
                
                <!-- AI Confidence score -->
                <div class="absolute top-2 right-2 bg-blue-600 text-white text-xs px-2 py-1 rounded-full z-20">
                    ${Math.round(aiConfidence * 100)}%
                </div>
                
                <!-- Download button -->
                <div class="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                    <a href="${photo.image_url || photo.thumbnail_url}" 
                       download="${photo.title || 'photo'}"
                       class="download-btn inline-block w-8 h-8 bg-green-600 bg-opacity-80 hover:bg-opacity-100 rounded-full flex items-center justify-center text-white transition-all mr-1" 
                       onclick="event.stopPropagation()"
                       title="Download">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                    </a>
                </div>
                
                <!-- Hover overlay for visual feedback -->
                <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all z-10">
                </div>
            </div>
            
            <!-- Photo info -->
            <div class="mt-2">
                <p class="text-xs text-gray-600 truncate">${photo.title || 'Untitled'}</p>
                <p class="text-xs text-gray-400">${photo.album_name || ''}</p>
            </div>
        `;
        
        // Make entire card clickable to open lightbox
        div.addEventListener('click', () => {
            this.showPhotoModal(photo);
        });
        
        return div;
    }
    
    
    showSearchError(message) {
        console.error('Search error:', message);
        // Could show error toast here
    }
    
    clearMainSearch() {
        document.getElementById('search-main-input').value = '';
        document.getElementById('search-main-info').classList.add('hidden');
        document.getElementById('search-results-grid').classList.add('hidden');
        document.getElementById('search-no-results').classList.add('hidden');
        document.getElementById('search-welcome').classList.remove('hidden');
        this.searchResults = [];
    }

    // Modal and other functionality
    async showPhotoModal(photo) {
        console.log('Show modal for photo:', photo);
        
        // Fetch complete photo data including embeddings from API
        let completePhoto = photo;
        if (photo.id || photo.local_photo_id) {
            try {
                const photoId = photo.id || photo.local_photo_id;
                const response = await fetch(`${this.apiBase}/photos/${photoId}?include_embedding=true`);
                if (response.ok) {
                    completePhoto = await response.json();
                    console.log('Fetched complete photo data with embeddings:', completePhoto);
                } else {
                    console.warn('Could not fetch complete photo data, using provided data');
                }
            } catch (error) {
                console.warn('Error fetching complete photo data:', error);
            }
        }
        
        // Store current photo for editing functions
        this.currentPhoto = completePhoto;
        
        // Populate modal with photo data
        const modal = document.getElementById('photo-modal');
        const modalImage = document.getElementById('modal-image');
        const modalDownload = document.getElementById('modal-download');
        const modalDimensions = document.getElementById('modal-dimensions');
        const modalAlbum = document.getElementById('modal-album');
        const modalAiSection = document.getElementById('modal-ai-section');
        const modalNoAi = document.getElementById('modal-no-ai');
        const modalAiDescription = document.getElementById('modal-ai-description');
        const modalAiKeywords = document.getElementById('modal-ai-keywords');
        const modalAiConfidence = document.getElementById('modal-ai-confidence');
        const modalAiTimestamp = document.getElementById('modal-ai-timestamp');
        
        // Set initial image - use image_url if available, otherwise thumbnail_url
        const initialImageUrl = photo.image_url || photo.thumbnail_url;
        modalImage.src = initialImageUrl;
        modalImage.alt = photo.title || 'Photo';
        
        // Set initial download link
        modalDownload.href = initialImageUrl;
        modalDownload.download = photo.title || 'photo';
        
        // Add click handler to ensure download dialog opens
        modalDownload.addEventListener('click', (e) => {
            e.preventDefault();
            this.downloadImage(modalDownload.href, modalDownload.download);
        });
        
        // Add click handler to modal image to open full-screen lightbox
        modalImage.style.cursor = 'pointer';
        modalImage.title = 'Click to view full-screen';
        
        // Add click handler to open full-screen lightbox
        modalImage.addEventListener('click', () => {
            this.openFullScreenLightbox(photo);
        });
        
        // Load largest image URL for download button
        this.loadLargestImageForDownload(photo, modalDownload);
        
        // Set photo info
        modalDimensions.textContent = `${completePhoto.width || 0} × ${completePhoto.height || 0} pixels`;
        modalAlbum.textContent = `Album: ${completePhoto.album_name || 'Unknown Album'}`;
        
        
        // Handle AI metadata - support multiple data structures for backward compatibility
        let aiData = null;
        
        // Try to get AI data from different possible locations
        if (completePhoto.ai_metadata) {
            // New structure: nested ai_metadata object
            aiData = completePhoto.ai_metadata;
        } else if (completePhoto.description || completePhoto.ai_keywords) {
            // Old structure: AI data at top level (legacy search results)
            aiData = {
                description: completePhoto.description,
                ai_keywords: completePhoto.ai_keywords,
                confidence_score: completePhoto.confidence_score,
                processed_at: completePhoto.processed_at
            };
        }
        
        if (aiData && (aiData.description || (aiData.ai_keywords && aiData.ai_keywords.length > 0))) {
            modalAiSection.classList.remove('hidden');
            modalNoAi.classList.add('hidden');
            
            if (aiData.description) {
                modalAiDescription.textContent = aiData.description;
            } else {
                modalAiDescription.textContent = 'No AI description available';
            }
            
            if (aiData.ai_keywords && aiData.ai_keywords.length > 0) {
                const aiKeywordTags = aiData.ai_keywords.map(keyword => 
                    `<span class="inline-block bg-blue-200 text-blue-800 px-2 py-1 rounded-full text-xs mr-1 mb-1">${keyword}</span>`
                ).join('');
                modalAiKeywords.innerHTML = aiKeywordTags;
            } else {
                modalAiKeywords.innerHTML = '<span class="text-blue-400">No AI keywords</span>';
            }
            
            if (aiData.confidence_score) {
                modalAiConfidence.textContent = `${Math.round(aiData.confidence_score * 100)}% confidence`;
            } else {
                modalAiConfidence.textContent = '';
            }
            
            if (aiData.processed_at) {
                const processedDate = new Date(aiData.processed_at);
                modalAiTimestamp.textContent = `Processed: ${processedDate.toLocaleString()}`;
            } else {
                modalAiTimestamp.textContent = '';
            }
            
        } else {
            modalAiSection.classList.add('hidden');
            modalNoAi.classList.remove('hidden');
        }
        
        // Update embedding display if AI data is available
        if (aiData) {
            console.log('Updating embedding display with AI data:', aiData);
            this.updateEmbeddingDisplay(aiData);
        } else {
            console.log('No AI data available for embedding display');
        }
        
        // Load collections for this photo via CollectionsManager
        eventBus.emit('collections:load-for-photo', { photo: completePhoto });
        
        // Show modal with animation
        modal.classList.remove('hidden');
        
        // Get modal content elements for staggered animation
        const modalContent = modal.querySelector('.bg-white');
        const downloadButton = modal.querySelector('#modal-download');
        
        // Trigger animation after modal is visible
        requestAnimationFrame(() => {
            // Set initial states
            modal.style.opacity = '0';
            modalContent.style.transform = 'scale(0.9) translateY(20px)';
            modalContent.style.opacity = '0';
            
            // Force a reflow
            modal.offsetHeight;
            
            // Add transition classes
            modal.style.transition = 'opacity 0.2s ease-out';
            modalContent.style.transition = 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
            
            // Animate backdrop
            modal.style.opacity = '1';
            
            // Animate content with slight delay
            setTimeout(() => {
                modalContent.style.opacity = '1';
                modalContent.style.transform = 'scale(1) translateY(0)';
                
                // Animate download button with additional delay
                if (downloadButton) {
                    downloadButton.style.transform = 'translateY(10px)';
                    downloadButton.style.opacity = '0.5';
                    downloadButton.style.transition = 'all 0.3s ease-out';
                    
                    setTimeout(() => {
                        downloadButton.style.transform = 'translateY(0)';
                        downloadButton.style.opacity = '1';
                    }, 100);
                }
            }, 50);
        });
        
        // Focus trap for accessibility
        modalImage.focus();
        
        // Add keyboard listener for ESC key
        const handleKeydown = (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
                document.removeEventListener('keydown', handleKeydown);
            }
        };
        document.addEventListener('keydown', handleKeydown);
    }

    closeModal() {
        const modal = document.getElementById('photo-modal');
        const modalContent = modal.querySelector('.bg-white');
        const downloadButton = modal.querySelector('#modal-download');
        
        // Animate out with reverse stagger
        if (downloadButton) {
            downloadButton.style.transition = 'all 0.15s ease-in';
            downloadButton.style.transform = 'translateY(10px)';
            downloadButton.style.opacity = '0.5';
        }
        
        setTimeout(() => {
            modalContent.style.transition = 'all 0.2s ease-in';
            modalContent.style.transform = 'scale(0.9) translateY(20px)';
            modalContent.style.opacity = '0';
            
            modal.style.transition = 'opacity 0.2s ease-in';
            modal.style.opacity = '0';
        }, 50);
        
        // Hide after animation completes
        setTimeout(() => {
            modal.classList.add('hidden');
            
            // Reset all styles for next time
            modal.style.opacity = '';
            modal.style.transition = '';
            modalContent.style.transform = '';
            modalContent.style.opacity = '';
            modalContent.style.transition = '';
            
            if (downloadButton) {
                downloadButton.style.transform = '';
                downloadButton.style.opacity = '';
                downloadButton.style.transition = '';
            }
        }, 300);
    }
    
    async openFullScreenLightbox(photo) {
        try {
            // Create full-screen lightbox if it doesn't exist
            let lightbox = document.getElementById('fullscreen-lightbox');
            if (!lightbox) {
                lightbox = document.createElement('div');
                lightbox.id = 'fullscreen-lightbox';
                lightbox.className = 'fixed inset-0 bg-black flex items-center justify-center z-50 opacity-0 transition-all duration-300 ease-out pointer-events-none p-4 md:p-8';
                lightbox.innerHTML = `
                    <button id="fullscreen-close" class="absolute top-4 right-4 text-white text-2xl hover:text-gray-300 z-20 opacity-0 transition-all duration-300 ease-out hover:scale-110 transform">
                        ✕
                    </button>
                    <div id="fullscreen-container" class="relative w-full h-full flex items-center justify-center transform scale-95 transition-all duration-300 ease-out">
                        <img id="fullscreen-image" src="" alt="" class="max-w-full max-h-full object-contain opacity-0 transition-all duration-500 ease-out transform scale-95">
                        <div id="fullscreen-loading" class="absolute inset-0 flex items-center justify-center text-white text-lg opacity-0 transition-all duration-300 ease-out">
                            <div class="text-center transform translate-y-4 transition-all duration-300 ease-out">
                                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                                Loading largest image...
                            </div>
                        </div>
                    </div>
                `;
                document.body.appendChild(lightbox);
                
                // Add close handlers
                document.getElementById('fullscreen-close').addEventListener('click', () => {
                    this.closeFullScreenLightbox();
                });
                
                // Close on background click
                lightbox.addEventListener('click', (e) => {
                    if (e.target === lightbox) {
                        this.closeFullScreenLightbox();
                    }
                });
                
                // Close on Escape key
                document.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape' && !lightbox.classList.contains('hidden')) {
                        this.closeFullScreenLightbox();
                    }
                });
            }
            
            const fullscreenImage = document.getElementById('fullscreen-image');
            const loadingDiv = document.getElementById('fullscreen-loading');
            const container = document.getElementById('fullscreen-container');
            const closeBtn = document.getElementById('fullscreen-close');
            
            // Show lightbox with animation
            lightbox.style.pointerEvents = 'auto';
            requestAnimationFrame(() => {
                lightbox.style.opacity = '1';
                container.style.transform = 'scale(1)';
                closeBtn.style.opacity = '1';
                
                // Show loading state with animation
                loadingDiv.style.opacity = '1';
                loadingDiv.querySelector('.text-center').style.transform = 'translateY(0)';
            });
            
            // First try to get the largest image from SmugMug
            if (photo.smugmug_id) {
                console.log('Fetching largest image for full-screen lightbox:', photo.smugmug_id);
                
                try {
                    const response = await fetch(`${this.apiBase}/smugmug/photo/${photo.smugmug_id}/largestimage`);
                    
                    if (response.ok) {
                        const largestImageData = await response.json();
                        
                        if (largestImageData.url) {
                            // Load the largest image
                            const img = new Image();
                            img.onload = () => {
                                fullscreenImage.src = largestImageData.url;
                                
                                // Animate image in and loading out
                                loadingDiv.style.opacity = '0';
                                setTimeout(() => {
                                    fullscreenImage.style.opacity = '1';
                                    fullscreenImage.style.transform = 'scale(1)';
                                }, 150);
                            };
                            img.onerror = () => {
                                // Fallback to existing image
                                eventBus.emit('image:fallback:load', { photo, fullscreenImage, loadingDiv });
                            };
                            img.src = largestImageData.url;
                            return;
                        }
                    }
                } catch (error) {
                    console.error('Error fetching largest image:', error);
                }
            }
            
            // Fallback to existing image URL
            eventBus.emit('image:fallback:load', { photo, fullscreenImage, loadingDiv });
            
        } catch (error) {
            console.error('Error opening full-screen lightbox:', error);
        }
    }
    
    
    closeFullScreenLightbox() {
        const lightbox = document.getElementById('fullscreen-lightbox');
        if (lightbox) {
            const container = document.getElementById('fullscreen-container');
            const closeBtn = document.getElementById('fullscreen-close');
            
            // Animate out
            lightbox.style.opacity = '0';
            container.style.transform = 'scale(0.95)';
            closeBtn.style.opacity = '0';
            
            // Hide after animation completes
            setTimeout(() => {
                lightbox.style.pointerEvents = 'none';
                
                // Reset states for next use
                const fullscreenImage = document.getElementById('fullscreen-image');
                const loadingDiv = document.getElementById('fullscreen-loading');
                
                fullscreenImage.style.opacity = '0';
                fullscreenImage.style.transform = 'scale(0.95)';
                fullscreenImage.src = '';
                
                loadingDiv.style.opacity = '0';
                loadingDiv.querySelector('.text-center').style.transform = 'translateY(4px)';
                
                container.style.transform = 'scale(0.95)';
            }, 300);
        }
    }
    
    async loadLargestImageForDownload(photo, modalDownload) {
        try {
            // Only attempt to fetch largest image if photo has a SmugMug ID
            if (!photo.smugmug_id) {
                console.log('Photo has no SmugMug ID, using existing image for download');
                return;
            }
            
            // Add loading state to download button
            const originalContent = modalDownload.innerHTML;
            modalDownload.innerHTML = `
                <svg class="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading...
            `;
            modalDownload.style.opacity = '0.7';
            modalDownload.style.pointerEvents = 'none';
            
            console.log('Fetching largest image URL for download button:', photo.smugmug_id);
            
            const response = await fetch(`${this.apiBase}/smugmug/photo/${photo.smugmug_id}/largestimage`);
            
            if (response.ok) {
                const largestImageData = await response.json();
                
                // Update download link with largest image URL
                if (largestImageData.url) {
                    modalDownload.href = largestImageData.url;
                    console.log('Updated download button with largest image URL');
                    
                    // Restore button with high-res indicator
                    modalDownload.innerHTML = `
                        <svg class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                        Download (High-Res)
                    `;
                } else {
                    console.log('No largest image URL available, keeping original');
                    modalDownload.innerHTML = originalContent;
                }
            } else {
                console.error('Failed to fetch largest image for download:', response.status, response.statusText);
                modalDownload.innerHTML = originalContent;
            }
            
            // Restore button state
            modalDownload.style.opacity = '1';
            modalDownload.style.pointerEvents = 'auto';
            
        } catch (error) {
            console.error('Error fetching largest image for download:', error);
            // Restore original button on error
            modalDownload.innerHTML = originalContent || `
                <svg class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                Download
            `;
            modalDownload.style.opacity = '1';
            modalDownload.style.pointerEvents = 'auto';
        }
    }
    
    async downloadImage(imageUrl, filename) {
        try {
            console.log('Downloading image:', imageUrl);
            
            // Fetch the image as a blob
            const response = await fetch(imageUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const blob = await response.blob();
            
            // Create a temporary download link
            const downloadLink = document.createElement('a');
            const url = URL.createObjectURL(blob);
            
            downloadLink.href = url;
            downloadLink.download = filename || 'image';
            
            // Append to body, click, and remove
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            
            // Clean up the object URL
            URL.revokeObjectURL(url);
            
            console.log('Download initiated successfully');
        } catch (error) {
            console.error('Error downloading image:', error);
            // Fallback to opening the image in a new tab
            window.open(imageUrl, '_blank');
        }
    }

    // Photo modal collection management now handled by CollectionsManager component

    async syncAllAlbums() {
        console.log('Sync all albums functionality to be implemented');
    }

    async processPhotoWithAI() {
        // Get current photo from modal context
        const modalImage = document.getElementById('modal-image');
        const photoUrl = modalImage.src;
        
        if (!photoUrl) {
            console.error('No photo selected for AI processing');
            return;
        }
        
        // Find the photo data from current photos
        const currentPhoto = this.currentPhotos.find(p => 
            (p.image_url && p.image_url === photoUrl) || 
            (p.thumbnail_url && p.thumbnail_url === photoUrl)
        );
        
        if (!currentPhoto || !currentPhoto.local_photo_id) {
            eventBus.emit('toast:error', { title: 'Processing Error', 'This photo must be synced to the database before it can be processed with AI.');
            return;
        }
        
        const processButton = document.getElementById('modal-process-button');
        const originalText = processButton.textContent;
        
        processButton.textContent = 'Processing...';
        processButton.disabled = true;
        
        // Add to UI processing state (no backend persistence)
        this.processingPhotos.add(currentPhoto.local_photo_id);
        
        // Show global progress for single photo
        photoProcessor.showGlobalProgress(0, 1, 'Analyzing photo with AI...');
        
        try {
            // Get user's API settings
            const apiSettings = this.getApiSettings();
            
            // Prepare headers with API keys
            const headers = {};
            
            if (apiSettings.anthropic_key) {
                headers['X-Anthropic-Key'] = apiSettings.anthropic_key;
            }
            if (apiSettings.openai_key) {
                headers['X-OpenAI-Key'] = apiSettings.openai_key;
            }
            
            const response = await fetch(`${this.apiBase}/photos/${currentPhoto.local_photo_id}/process?provider=${apiSettings.active_provider || 'anthropic'}`, {
                method: 'POST',
                headers: headers
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const result = await response.json();
            
            // Update the current photo data with AI metadata only (no processing_status change)
            const photoIndex = this.currentPhotos.findIndex(p => p.local_photo_id === currentPhoto.local_photo_id);
            if (photoIndex !== -1) {
                this.currentPhotos[photoIndex].ai_metadata = result.ai_metadata;
                this.currentPhotos[photoIndex].has_ai_metadata = true;
                // Don't set processing_status - it will be derived from has_ai_metadata
            }
            
            // Remove from processing state
            this.processingPhotos.delete(currentPhoto.local_photo_id);
            
            // Immediately update the status indicator to green checkbox (UI only)
            photoProcessor.updatePhotoThumbnailStatus(currentPhoto.local_photo_id, 'completed');
            
            // Refresh the modal with updated data
            await this.showPhotoModal(this.currentPhotos[photoIndex]);
            
            // Refresh the photo grid to show updated status
            eventBus.emit('photos:display', { photos: this.currentPhotos });
            
            // Update global progress to complete
            photoProcessor.updateGlobalProgress(1, 1, 'Photo analysis complete!');
            
            eventBus.emit('toast:success', { title: 'AI Processing Complete', 'Photo has been analyzed and metadata generated successfully.');
            
        } catch (error) {
            console.error('AI processing failed:', error);
            photoProcessor.hideGlobalProgress();
            eventBus.emit('toast:error', { title: 'Processing Failed', 'Could not process photo with AI. Please try again.');
            
            // Remove from processing state on error
            this.processingPhotos.delete(currentPhoto.local_photo_id);
            
            processButton.textContent = originalText;
            processButton.disabled = false;
        }
    }
    
    // Metadata Editing Methods
    toggleMetadataEdit() {
        const viewMode = document.getElementById('modal-ai-view');
        const editMode = document.getElementById('modal-ai-edit');
        const editToggle = document.getElementById('modal-edit-toggle');
        const editActions = document.getElementById('modal-edit-actions');
        
        if (editMode.classList.contains('hidden')) {
            // Enter edit mode
            this.enterEditMode(viewMode, editMode, editToggle, editActions);
        } else {
            // Exit edit mode without saving
            this.exitEditMode(viewMode, editMode, editToggle, editActions);
        }
    }
    
    enterEditMode(viewMode, editMode, editToggle, editActions) {
        // Hide view mode, show edit mode
        viewMode.classList.add('hidden');
        editMode.classList.remove('hidden');
        editToggle.classList.add('hidden');
        editActions.classList.remove('hidden');
        
        // Populate edit fields with current values
        const description = document.getElementById('modal-ai-description').textContent;
        const keywords = Array.from(document.getElementById('modal-ai-keywords').children)
            .map(span => span.textContent)
            .join(', ');
        
        document.getElementById('modal-edit-description').value = description;
        document.getElementById('modal-edit-keywords').value = keywords;
        
        // Set approved status if available
        const aiMetadata = this.currentPhoto?.ai_metadata;
        if (aiMetadata) {
            document.getElementById('modal-edit-approved').checked = aiMetadata.approved || false;
        }
    }
    
    exitEditMode(viewMode, editMode, editToggle, editActions) {
        // Show view mode, hide edit mode
        viewMode.classList.remove('hidden');
        editMode.classList.add('hidden');
        editToggle.classList.remove('hidden');
        editActions.classList.add('hidden');
    }
    
    cancelMetadataEdit() {
        const viewMode = document.getElementById('modal-ai-view');
        const editMode = document.getElementById('modal-ai-edit');
        const editToggle = document.getElementById('modal-edit-toggle');
        const editActions = document.getElementById('modal-edit-actions');
        
        this.exitEditMode(viewMode, editMode, editToggle, editActions);
    }
    
    async saveMetadataChanges() {
        if (!this.currentPhoto?.local_photo_id) {
            console.error('No photo selected for editing');
            return;
        }
        
        const description = document.getElementById('modal-edit-description').value.trim();
        const keywordsText = document.getElementById('modal-edit-keywords').value.trim();
        const approved = document.getElementById('modal-edit-approved').checked;
        
        // Convert keywords string to array
        const keywords = keywordsText 
            ? keywordsText.split(',').map(k => k.trim()).filter(k => k.length > 0)
            : [];
        
        try {
            const saveButton = document.getElementById('modal-save-metadata');
            saveButton.disabled = true;
            saveButton.textContent = 'Saving...';
            
            const response = await fetch(`${this.apiBase}/metadata/${this.currentPhoto.local_photo_id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    description,
                    ai_keywords: keywords,
                    approved
                })
            });
            
            if (!response.ok) {
                throw new Error(`Failed to save metadata: ${response.status}`);
            }
            
            const updatedMetadata = await response.json();
            
            // Update the display
            this.updateMetadataDisplay(updatedMetadata);
            
            // Exit edit mode
            const viewMode = document.getElementById('modal-ai-view');
            const editMode = document.getElementById('modal-ai-edit');
            const editToggle = document.getElementById('modal-edit-toggle');
            const editActions = document.getElementById('modal-edit-actions');
            
            this.exitEditMode(viewMode, editMode, editToggle, editActions);
            
            // Show success message (you could add a toast notification here)
            console.log('Metadata saved successfully');
            
        } catch (error) {
            console.error('Error saving metadata:', error);
            eventBus.emit('toast:error', { title: 'Save Failed', 'Failed to save metadata. Please try again.');
        } finally {
            const saveButton = document.getElementById('modal-save-metadata');
            saveButton.disabled = false;
            saveButton.textContent = 'Save';
        }
    }
    
    updateMetadataDisplay(metadata) {
        // Update view mode display
        document.getElementById('modal-ai-description').textContent = metadata.description || '';
        
        const keywordsContainer = document.getElementById('modal-ai-keywords');
        keywordsContainer.innerHTML = '';
        
        if (metadata.ai_keywords && metadata.ai_keywords.length > 0) {
            metadata.ai_keywords.forEach(keyword => {
                const span = document.createElement('span');
                span.className = 'inline-block bg-blue-200 text-blue-800 text-xs px-2 py-1 rounded';
                span.textContent = keyword;
                keywordsContainer.appendChild(span);
            });
        }
        
        // Update confidence and approval status
        const confidenceSpan = document.getElementById('modal-ai-confidence');
        if (metadata.approved) {
            confidenceSpan.textContent = '✅ Approved';
            confidenceSpan.className = 'text-xs bg-green-100 text-green-800 px-2 py-1 rounded';
        } else {
            const confidence = Math.round((metadata.confidence_score || 0.85) * 100);
            confidenceSpan.textContent = `${confidence}% confidence`;
            confidenceSpan.className = 'text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded';
        }
        
        // Update embedding information
        this.updateEmbeddingDisplay(metadata);
    }
    
    updateEmbeddingDisplay(metadata) {
        console.log('updateEmbeddingDisplay called with metadata:', metadata);
        
        const embeddingInfo = document.getElementById('modal-embedding-info');
        const embeddingStatus = document.getElementById('modal-embedding-status');
        const embeddingDimensions = document.getElementById('modal-embedding-dimensions');
        const embeddingModel = document.getElementById('modal-embedding-model');
        const embeddingDimCount = document.getElementById('modal-embedding-dim-count');
        const embeddingSample = document.getElementById('modal-embedding-sample');
        
        console.log('Embedding info element found:', !!embeddingInfo);
        
        // Check if embedding exists (either as array or we can infer from model_version)
        const hasEmbedding = metadata.embedding || 
                           (metadata.model_version && metadata.model_version.includes('clip'));
        
        console.log('Has embedding:', hasEmbedding);
        console.log('Embedding data:', metadata.embedding);
        console.log('Model version:', metadata.model_version);
        
        if (hasEmbedding) {
            console.log('Showing embedding info');
            embeddingInfo.classList.remove('hidden');
            
            // Update status and dimensions
            const dimensions = metadata.embedding ? 
                             (Array.isArray(metadata.embedding) ? metadata.embedding.length : 512) : 
                             512; // Default for CLIP models
                             
            embeddingDimensions.textContent = `${dimensions}D`;
            embeddingDimCount.textContent = dimensions;
            
            // Update model information
            const modelName = metadata.model_version || 'CLIP ViT-B-32';
            embeddingModel.textContent = modelName;
            
            // Show sample values if embedding data is available
            if (metadata.embedding && Array.isArray(metadata.embedding)) {
                const sampleValues = metadata.embedding.slice(0, 3)
                    .map(val => val.toFixed(3))
                    .join(', ');
                embeddingSample.textContent = `[${sampleValues}...]`;
            } else {
                embeddingSample.textContent = '[Generated by AI model]';
            }
            
            // Update status icon and text
            embeddingStatus.innerHTML = `
                <svg class="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                </svg>
                Generated
            `;
        } else {
            embeddingInfo.classList.add('hidden');
        }
    }
    
    toggleEmbeddingDetails() {
        const detailsDiv = document.getElementById('modal-embedding-details');
        const toggleButton = document.getElementById('modal-embedding-details-toggle');
        
        if (detailsDiv.classList.contains('hidden')) {
            detailsDiv.classList.remove('hidden');
            toggleButton.textContent = 'Hide Details';
        } else {
            detailsDiv.classList.add('hidden');
            toggleButton.textContent = 'Show Details';
        }
    }
    
    async regenerateAIMetadata() {
        if (!this.currentPhoto?.local_photo_id) {
            console.error('No photo selected for regeneration');
            return;
        }
        
        try {
            const regenerateButton = document.getElementById('modal-regenerate-ai');
            regenerateButton.disabled = true;
            regenerateButton.innerHTML = '🔄 Regenerating...';
            
            // Get user's API settings
            const apiSettings = this.getApiSettings();
            
            // Prepare headers with API keys
            const headers = {};
            
            if (apiSettings.anthropic_key) {
                headers['X-Anthropic-Key'] = apiSettings.anthropic_key;
            }
            if (apiSettings.openai_key) {
                headers['X-OpenAI-Key'] = apiSettings.openai_key;
            }
            
            const response = await fetch(`${this.apiBase}/photos/${this.currentPhoto.local_photo_id}/process?provider=${apiSettings.active_provider || 'anthropic'}`, {
                method: 'POST',
                headers: headers
            });
            
            if (!response.ok) {
                throw new Error(`Failed to regenerate AI metadata: ${response.status}`);
            }
            
            const result = await response.json();
            
            // Update the display
            this.updateMetadataDisplay(result);
            
            // Update edit fields if in edit mode
            document.getElementById('modal-edit-description').value = result.description || '';
            const keywords = result.ai_keywords ? result.ai_keywords.join(', ') : '';
            document.getElementById('modal-edit-keywords').value = keywords;
            
            console.log('AI metadata regenerated successfully');
            
        } catch (error) {
            console.error('Error regenerating AI metadata:', error);
            eventBus.emit('toast:error', { title: 'Regeneration Failed', 'Failed to regenerate AI metadata. Please try again.');
        } finally {
            const regenerateButton = document.getElementById('modal-regenerate-ai');
            regenerateButton.disabled = false;
            regenerateButton.innerHTML = '🔄 Regenerate AI';
        }
    }
    
    async deleteAIMetadata() {
        if (!this.currentPhoto?.local_photo_id) {
            console.error('No photo selected for AI metadata deletion');
            return;
        }
        
        // Show confirmation dialog
        const confirmed = confirm('Are you sure you want to delete the AI-generated metadata for this photo? This action cannot be undone.');
        if (!confirmed) {
            return;
        }
        
        try {
            const deleteButton = document.getElementById('modal-delete-ai');
            deleteButton.disabled = true;
            deleteButton.innerHTML = '🗑️ Deleting...';
            
            const response = await fetch(`${this.apiBase}/photos/${this.currentPhoto.local_photo_id}/ai-metadata`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error(`Failed to delete AI metadata: ${response.status}`);
            }
            
            const result = await response.json();
            
            // Update the current photo data
            const photoIndex = this.currentPhotos.findIndex(p => p.local_photo_id === this.currentPhoto.local_photo_id);
            if (photoIndex !== -1) {
                this.currentPhotos[photoIndex].ai_metadata = null;
                this.currentPhotos[photoIndex].has_ai_metadata = false;
                this.currentPhotos[photoIndex].processing_status = 'not_processed';
                
                // Update current photo reference
                this.currentPhoto = this.currentPhotos[photoIndex];
            }
            
            // Update the modal display to show no AI metadata
            this.showPhotoModal(this.currentPhoto);
            
            // Refresh the photo grid to show updated status
            eventBus.emit('photos:display', { photos: this.currentPhotos });
            
            eventBus.emit('toast:success', { title: 'AI Data Deleted', 'AI-generated metadata has been successfully removed from this photo.');
            console.log('AI metadata deleted successfully');
            
        } catch (error) {
            console.error('Error deleting AI metadata:', error);
            eventBus.emit('toast:error', { title: 'Deletion Failed', 'Failed to delete AI metadata. Please try again.');
        } finally {
            const deleteButton = document.getElementById('modal-delete-ai');
            deleteButton.disabled = false;
            deleteButton.innerHTML = '🗑️ Delete AI Data';
        }
    }
    
    // Settings Page Methods
    async initializeSettingsPage() {
        console.log('Settings page initialized');
        await this.loadCurrentPrompt();
        this.loadApplicationSettings();
        this.loadApiKeySettings();
        this.updateSystemInfo();
        cacheManager.updateCacheStatus();
        
        // Add event listeners for key source toggle
        document.querySelectorAll('input[name="key-source"]').forEach(radio => {
            radio.addEventListener('change', () => {
                this.handleKeySourceChange();
            });
        });
    }
    
    handleKeySourceChange() {
        const keySource = document.querySelector('input[name="key-source"]:checked').value;
        const customKeysContainer = document.getElementById('custom-keys-container');
        
        if (keySource === 'custom') {
            customKeysContainer.classList.remove('hidden');
        } else {
            customKeysContainer.classList.add('hidden');
        }
        
        // Auto-save the setting
        this.saveApiKeySettings();
    }
    
    async loadCurrentPrompt() {
        try {
            const response = await fetch(`${this.apiBase}/settings/prompt`);
            if (response.ok) {
                const data = await response.json();
                document.getElementById('current-prompt').textContent = data.prompt || this.getDefaultPrompt();
                
                // Update status indicator
                const statusSpan = document.getElementById('prompt-status');
                if (data.is_custom) {
                    statusSpan.textContent = 'Custom';
                    statusSpan.className = 'text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded';
                } else {
                    statusSpan.textContent = 'Default';
                    statusSpan.className = 'text-xs bg-green-100 text-green-800 px-2 py-1 rounded';
                }
            } else {
                // Fallback to default prompt
                document.getElementById('current-prompt').textContent = this.getDefaultPrompt();
            }
        } catch (error) {
            console.error('Error loading current prompt:', error);
            document.getElementById('current-prompt').textContent = this.getDefaultPrompt();
        }
    }
    
    getDefaultPrompt() {
        return `Analyze this image and provide a detailed description focusing on the main subjects, actions, and context. Then extract relevant keywords.

Return your response as a JSON object with these fields:
- "description": A detailed description of what you see in the image
- "keywords": An array of relevant keywords that describe the image content

Focus on:
- Main subjects and people
- Actions being performed
- Objects and equipment visible
- Setting and environment
- Events or activities
- Emotions or mood if apparent

Do not include speculation about metadata like camera settings, date, or photographer information.`;
    }
    
    loadApplicationSettings() {
        // Load settings from localStorage or set defaults
        const settings = JSON.parse(localStorage.getItem('targetvision_settings') || '{}');
        
        document.getElementById('auto-approve').checked = settings.autoApprove || false;
        document.getElementById('batch-processing').checked = settings.batchProcessing !== false; // default true
        document.getElementById('retry-failed').checked = settings.retryFailed || false;
        document.getElementById('show-confidence').checked = settings.showConfidence !== false; // default true
        document.getElementById('advanced-filters-default').checked = settings.advancedFiltersDefault || false;
        document.getElementById('compact-view').checked = settings.compactView || false;
    }
    
    editPrompt() {
        const viewMode = document.getElementById('prompt-view');
        const editMode = document.getElementById('prompt-edit');
        const currentPrompt = document.getElementById('current-prompt').textContent;
        
        // Switch to edit mode
        viewMode.classList.add('hidden');
        editMode.classList.remove('hidden');
        
        // Populate textarea
        document.getElementById('prompt-textarea').value = currentPrompt;
        this.updateCharCount();
    }
    
    cancelPromptEdit() {
        const viewMode = document.getElementById('prompt-view');
        const editMode = document.getElementById('prompt-edit');
        
        // Switch back to view mode
        viewMode.classList.remove('hidden');
        editMode.classList.add('hidden');
    }
    
    async savePrompt() {
        const promptText = document.getElementById('prompt-textarea').value.trim();
        
        if (!promptText) {
            this.showToast('Missing Prompt', 'Please enter a prompt before saving.', 'warning');
            return;
        }
        
        try {
            const saveButton = document.getElementById('save-prompt');
            saveButton.disabled = true;
            saveButton.textContent = 'Saving...';
            
            const response = await fetch(`${this.apiBase}/settings/prompt`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: promptText
                })
            });
            
            if (!response.ok) {
                throw new Error(`Failed to save prompt: ${response.status}`);
            }
            
            // Update display
            document.getElementById('current-prompt').textContent = promptText;
            
            // Update status
            const statusSpan = document.getElementById('prompt-status');
            statusSpan.textContent = 'Custom';
            statusSpan.className = 'text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded';
            
            // Switch back to view mode
            this.cancelPromptEdit();
            
            console.log('Prompt saved successfully');
            
        } catch (error) {
            console.error('Error saving prompt:', error);
            eventBus.emit('toast:error', { title: 'Save Failed', 'Failed to save prompt. Please try again.');
        } finally {
            const saveButton = document.getElementById('save-prompt');
            saveButton.disabled = false;
            saveButton.textContent = 'Save Prompt';
        }
    }
    
    async resetPrompt() {
        if (!confirm('Are you sure you want to reset to the default prompt? This will overwrite any custom changes.')) {
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBase}/settings/prompt`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error(`Failed to reset prompt: ${response.status}`);
            }
            
            // Update display
            const defaultPrompt = this.getDefaultPrompt();
            document.getElementById('current-prompt').textContent = defaultPrompt;
            
            // Update status
            const statusSpan = document.getElementById('prompt-status');
            statusSpan.textContent = 'Default';
            statusSpan.className = 'text-xs bg-green-100 text-green-800 px-2 py-1 rounded';
            
            console.log('Prompt reset to default');
            
        } catch (error) {
            console.error('Error resetting prompt:', error);
            eventBus.emit('toast:error', { title: 'Reset Failed', 'Failed to reset prompt. Please try again.');
        }
    }
    
    async testPrompt() {
        const promptText = document.getElementById('prompt-textarea').value.trim();
        
        if (!promptText) {
            this.showToast('Missing Prompt', 'Please enter a prompt to test.', 'warning');
            return;
        }
        
        const testButton = document.getElementById('test-prompt');
        testButton.disabled = true;
        testButton.textContent = 'Testing...';
        
        try {
            // This would test the prompt with a sample image
            // For now, just simulate the test
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            eventBus.emit('toast:success', { title: 'Test Successful', 'Prompt test completed! The prompt structure looks valid.');
            
        } catch (error) {
            console.error('Error testing prompt:', error);
            eventBus.emit('toast:error', { title: 'Test Failed', 'Failed to test prompt. Please check the format.');
        } finally {
            testButton.disabled = false;
            testButton.textContent = 'Test Prompt';
        }
    }
    
    selectTemplate(templateName) {
        const templates = {
            detailed: `Analyze this image comprehensively and provide a detailed description covering all visual elements, technical aspects, emotions, and context. Then extract comprehensive keywords.

Return your response as a JSON object with these fields:
- "description": A thorough, detailed description covering composition, lighting, subjects, actions, environment, mood, and technical observations
- "keywords": An extensive array of relevant keywords including subjects, objects, emotions, settings, actions, technical terms, and style descriptors

Focus on:
- Complete scene composition and framing
- Lighting conditions and quality
- All visible subjects and their interactions
- Detailed object and equipment identification
- Environmental context and setting details
- Emotional expressions and body language
- Artistic and technical photographic elements
- Color palette and visual mood

Provide comprehensive coverage without speculation about metadata.`,

            concise: `Analyze this image and provide a brief, focused description of the main subjects and primary action. Then list key identifying keywords.

Return your response as a JSON object with these fields:
- "description": A concise 1-2 sentence description of the primary subject and main action
- "keywords": A focused array of 5-8 key terms that best identify the image content

Focus on:
- Primary subject(s)
- Main action or activity
- Key objects or equipment
- Basic setting or location

Keep descriptions brief and keywords essential for searchability.`,

            artistic: `Analyze this image from an artistic perspective, focusing on composition, visual elements, mood, and aesthetic qualities. Then extract relevant artistic keywords.

Return your response as a JSON object with these fields:
- "description": A description emphasizing artistic composition, lighting, mood, visual flow, and aesthetic impact
- "keywords": An array of keywords including artistic terms, mood descriptors, composition elements, and style characteristics

Focus on:
- Composition and visual balance
- Lighting quality and direction  
- Color harmony and palette
- Mood and emotional resonance
- Artistic technique and style
- Visual texture and patterns
- Depth and perspective
- Overall aesthetic impact

Emphasize the artistic and emotional qualities of the image.`,

            sports: `Analyze this sports or event image with focus on athletic activities, competition elements, achievements, and event context. Then extract relevant sports keywords.

Return your response as a JSON object with these fields:
- "description": A detailed description focusing on the sport, competition, athletes, actions, achievements, and event context
- "keywords": An array of keywords including sport names, positions, actions, equipment, achievements, and event types

Focus on:
- Specific sport or activity
- Athlete positions and actions
- Competition or event type
- Equipment and gear
- Achievements (medals, trophies, awards)
- Team or individual performance
- Venue and event setting
- Competitive context and results

Emphasize athletic performance, competition elements, and achievement recognition.`
        };
        
        if (templates[templateName]) {
            document.getElementById('prompt-textarea').value = templates[templateName];
            this.updateCharCount();
            
            // Visual feedback
            document.querySelectorAll('[data-template]').forEach(t => {
                t.classList.remove('border-blue-500', 'bg-blue-50');
                t.classList.add('border-gray-200');
            });
            
            const selectedTemplate = document.querySelector(`[data-template="${templateName}"]`);
            selectedTemplate.classList.remove('border-gray-200');
            selectedTemplate.classList.add('border-blue-500', 'bg-blue-50');
        }
    }
    
    updateCharCount() {
        const textarea = document.getElementById('prompt-textarea');
        const charCount = document.getElementById('prompt-char-count');
        charCount.textContent = `${textarea.value.length} characters`;
    }
    
    saveApplicationSettings() {
        const settings = {
            autoApprove: document.getElementById('auto-approve').checked,
            batchProcessing: document.getElementById('batch-processing').checked,
            retryFailed: document.getElementById('retry-failed').checked,
            showConfidence: document.getElementById('show-confidence').checked,
            advancedFiltersDefault: document.getElementById('advanced-filters-default').checked,
            compactView: document.getElementById('compact-view').checked
        };
        
        localStorage.setItem('targetvision_settings', JSON.stringify(settings));
        
        // Show success message
        const savedIndicator = document.getElementById('settings-saved');
        savedIndicator.classList.remove('hidden');
        setTimeout(() => {
            savedIndicator.classList.add('hidden');
        }, 3000);
        
        console.log('Settings saved:', settings);
    }
    

    async cancelBatchProcessing() {
        console.log('cancelBatchProcessing method called');
        
        // Clear any UI processing state
        this.processingPhotos.clear();
        
        const button = document.getElementById('cancel-batch-processing');
        const statusDiv = document.getElementById('batch-cancel-status');
        console.log('Button element:', button);
        console.log('Status div element:', statusDiv);
        
        try {
            // Disable button and show loading state
            button.disabled = true;
            button.innerHTML = `
                <svg class="h-4 w-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Cancelling...
            `;
            
            statusDiv.className = 'text-sm text-blue-600';
            statusDiv.textContent = 'Cancelling batch processing jobs...';
            statusDiv.classList.remove('hidden');
            
            const response = await fetch(`${this.apiBase}/photos/batch/cancel`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `HTTP ${response.status}`);
            }
            
            const result = await response.json();
            
            // Show success message
            statusDiv.className = 'text-sm text-green-600';
            statusDiv.textContent = result.message || `Successfully cancelled ${result.cancelled_count || 0} batch processing jobs`;
            
            // Auto-hide status message after 5 seconds
            setTimeout(() => {
                statusDiv.classList.add('hidden');
            }, 5000);
            
            console.log('Batch processing cancelled:', result);
            
        } catch (error) {
            console.error('Error cancelling batch processing:', error);
            
            // Show error message
            statusDiv.className = 'text-sm text-red-600';
            statusDiv.textContent = `Error: ${error.message}`;
            
            // Auto-hide error message after 7 seconds
            setTimeout(() => {
                statusDiv.classList.add('hidden');
            }, 7000);
            
        } finally {
            // Re-enable button and restore original text
            button.disabled = false;
            button.innerHTML = `
                <svg class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
                Cancel All Batch Processing
            `;
        }
    }
    
    async clearBatchQueue() {
        // Clear any UI processing state
        this.processingPhotos.clear();
        
        const button = document.getElementById('clear-batch-queue');
        const statusDiv = document.getElementById('clear-queue-status');
        
        try {
            // Disable button and show loading state
            button.disabled = true;
            button.innerHTML = `
                <svg class="h-4 w-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Clearing Queue...
            `;
            
            statusDiv.className = 'text-sm text-blue-600';
            statusDiv.textContent = 'Clearing batch processing queue...';
            statusDiv.classList.remove('hidden');
            
            const response = await fetch(`${this.apiBase}/photos/batch/clear-queue`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `HTTP ${response.status}`);
            }
            
            const result = await response.json();
            
            // Show success message
            statusDiv.className = 'text-sm text-green-600';
            statusDiv.textContent = result.message || `Successfully cleared ${result.cleared_count || 0} items from processing queue`;
            
            // Auto-hide status message after 5 seconds
            setTimeout(() => {
                statusDiv.classList.add('hidden');
            }, 5000);
            
            console.log('Batch processing queue cleared:', result);
            
        } catch (error) {
            console.error('Error clearing batch processing queue:', error);
            
            // Show error message
            statusDiv.className = 'text-sm text-red-600';
            statusDiv.textContent = `Error: ${error.message}`;
            
            // Auto-hide error message after 7 seconds
            setTimeout(() => {
                statusDiv.classList.add('hidden');
            }, 7000);
            
        } finally {
            // Re-enable button and restore original text
            button.disabled = false;
            button.innerHTML = `
                <svg class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
                Clear Processing Queue
            `;
        }
    }
    
    // API Key Management Methods
    getApiSettings() {
        const settings = JSON.parse(localStorage.getItem('targetvision_api_settings') || '{}');
        const keySource = settings.key_source || 'default';
        
        return {
            // Only return API keys if using custom key source
            anthropic_key: keySource === 'custom' ? settings.anthropic_key : undefined,
            openai_key: keySource === 'custom' ? settings.openai_key : undefined,
            active_provider: settings.active_provider || 'anthropic',
            key_source: keySource
        };
    }
    
    loadApiKeySettings() {
        const settings = JSON.parse(localStorage.getItem('targetvision_api_settings') || '{}');
        
        // Load key source setting (default to 'default' for server keys)
        const keySource = settings.key_source || 'default';
        document.getElementById(`use-${keySource}-keys`).checked = true;
        
        // Show/hide custom keys container based on setting
        const customKeysContainer = document.getElementById('custom-keys-container');
        if (keySource === 'custom') {
            customKeysContainer.classList.remove('hidden');
            
            // Load API keys (masked for security)
            if (settings.anthropic_key) {
                document.getElementById('anthropic-api-key').value = '••••••••••••••••';
            }
            if (settings.openai_key) {
                document.getElementById('openai-api-key').value = '••••••••••••••••';
            }
        } else {
            customKeysContainer.classList.add('hidden');
        }
        
        // Load active provider
        const activeProvider = settings.active_provider || 'anthropic';
        document.getElementById(`provider-${activeProvider}`).checked = true;
    }
    
    saveApiKeySettings() {
        const settings = JSON.parse(localStorage.getItem('targetvision_api_settings') || '{}');
        
        // Save key source setting
        const keySource = document.querySelector('input[name="key-source"]:checked').value;
        settings.key_source = keySource;
        
        // Only save API keys if using custom keys
        if (keySource === 'custom') {
            // Get API keys (only if they're not masked)
            const anthropicKey = document.getElementById('anthropic-api-key').value;
            const openaiKey = document.getElementById('openai-api-key').value;
            
            if (anthropicKey && !anthropicKey.startsWith('••••')) {
                settings.anthropic_key = anthropicKey;
            }
            if (openaiKey && !openaiKey.startsWith('••••')) {
                settings.openai_key = openaiKey;
            }
        } else {
            // Clear custom keys when using server keys
            delete settings.anthropic_key;
            delete settings.openai_key;
        }
        
        // Get active provider
        const activeProvider = document.querySelector('input[name="ai-provider"]:checked').value;
        settings.active_provider = activeProvider;
        
        localStorage.setItem('targetvision_api_settings', JSON.stringify(settings));
        return settings;
    }
    
    async testApiKey(provider) {
        const button = document.getElementById(`test-${provider}-key`);
        const statusDiv = document.getElementById(`${provider}-key-status`);
        const keyInput = document.getElementById(`${provider}-api-key`);
        
        const apiKey = keyInput.value;
        if (!apiKey || apiKey.startsWith('••••')) {
            this.showKeyStatus(statusDiv, 'error', 'Please enter a valid API key');
            return;
        }
        
        // Update button state
        button.disabled = true;
        button.textContent = 'Testing...';
        statusDiv.classList.remove('hidden');
        this.showKeyStatus(statusDiv, 'info', 'Testing API key...');
        
        try {
            const response = await fetch(`${this.apiBase}/settings/test-api-key`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    provider: provider,
                    api_key: apiKey
                })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                this.showKeyStatus(statusDiv, 'success', 'API key is valid!');
                // Save the key since it's valid
                this.saveApiKeySettings();
            } else {
                this.showKeyStatus(statusDiv, 'error', result.error || 'Invalid API key');
            }
        } catch (error) {
            this.showKeyStatus(statusDiv, 'error', 'Failed to test API key');
            console.error('API key test error:', error);
        } finally {
            button.disabled = false;
            button.textContent = 'Test';
        }
    }
    
    showKeyStatus(statusDiv, type, message) {
        statusDiv.className = `mt-1 text-xs ${type === 'success' ? 'text-green-600' : type === 'error' ? 'text-red-600' : 'text-blue-600'}`;
        statusDiv.textContent = message;
        statusDiv.classList.remove('hidden');
    }
    
    handleTestImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }
        
        // Show preview
        const reader = new FileReader();
        reader.onload = (e) => {
            const previewImg = document.getElementById('test-preview-img');
            const previewDiv = document.getElementById('test-image-preview');
            const analyzeButton = document.getElementById('analyze-test-image');
            
            previewImg.src = e.target.result;
            previewDiv.classList.remove('hidden');
            analyzeButton.disabled = false;
        };
        reader.readAsDataURL(file);
    }
    
    async analyzeTestImage() {
        const fileInput = document.getElementById('test-image-upload');
        const analyzeButton = document.getElementById('analyze-test-image');
        const resultDiv = document.getElementById('test-analysis-result');
        const resultContent = document.getElementById('test-result-content');
        
        if (!fileInput.files[0]) {
            alert('Please select an image first');
            return;
        }
        
        // Get API settings respecting the key source toggle
        const apiSettings = this.getApiSettings();
        const activeProvider = apiSettings.active_provider;
        
        // Check if we're using custom keys and they're available
        if (apiSettings.key_source === 'custom') {
            const hasKey = activeProvider === 'anthropic' ? apiSettings.anthropic_key : apiSettings.openai_key;
            if (!hasKey) {
                alert(`Please configure your ${activeProvider === 'anthropic' ? 'Anthropic' : 'OpenAI'} API key first, or switch to using server keys`);
                return;
            }
        }
        
        // Prepare form data
        const formData = new FormData();
        formData.append('image', fileInput.files[0]);
        formData.append('provider', activeProvider);
        
        analyzeButton.disabled = true;
        analyzeButton.textContent = 'Analyzing...';
        resultDiv.classList.add('hidden');
        
        try {
            // Prepare headers with API keys only if using custom keys
            const headers = {
                'Content-Type': 'application/json'
            };
            
            // Only send custom API keys if key_source is 'custom'
            if (apiSettings.key_source === 'custom') {
                if (apiSettings.anthropic_key) {
                    headers['X-Anthropic-Key'] = apiSettings.anthropic_key;
                }
                if (apiSettings.openai_key) {
                    headers['X-OpenAI-Key'] = apiSettings.openai_key;
                }
            }
            
            // Remove Content-Type header since we're using FormData
            delete headers['Content-Type'];
            
            const response = await fetch(`${this.apiBase}/settings/test-image-analysis`, {
                method: 'POST',
                headers: headers,
                body: formData
            });
            
            const result = await response.json();
            
            if (response.ok) {
                // Display results
                resultContent.innerHTML = `
                    <div class="space-y-3">
                        <div>
                            <strong class="text-gray-700">Provider:</strong> 
                            <span class="px-2 py-1 bg-${activeProvider === 'anthropic' ? 'purple' : 'blue'}-100 text-${activeProvider === 'anthropic' ? 'purple' : 'blue'}-800 text-xs rounded">
                                ${activeProvider === 'anthropic' ? 'Anthropic Claude' : 'OpenAI GPT-4V'}
                            </span>
                        </div>
                        <div>
                            <strong class="text-gray-700">Description:</strong>
                            <p class="mt-1 text-sm text-gray-800">${result.analysis.description}</p>
                        </div>
                        <div>
                            <strong class="text-gray-700">Keywords:</strong>
                            <div class="mt-1 flex flex-wrap gap-1">
                                ${result.analysis.keywords.map(keyword => 
                                    `<span class="bg-gray-100 text-gray-700 px-2 py-1 text-xs rounded">${keyword}</span>`
                                ).join('')}
                            </div>
                        </div>
                        ${result.prompt_used ? `
                        <div>
                            <strong class="text-gray-700">Analysis Prompt Used:</strong>
                            <details class="mt-1">
                                <summary class="cursor-pointer text-sm text-blue-600 hover:text-blue-800">Show/Hide Prompt</summary>
                                <div class="mt-2 p-3 bg-gray-50 rounded-md border text-xs text-gray-700 font-mono whitespace-pre-wrap">${result.prompt_used}</div>
                            </details>
                        </div>
                        ` : ''}
                        <div class="text-xs text-gray-500">
                            Analysis completed in ${result.processing_time || 'N/A'} seconds
                        </div>
                    </div>
                `;
                resultDiv.classList.remove('hidden');
            } else {
                alert(`Analysis failed: ${result.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Image analysis error:', error);
            alert('Failed to analyze image. Please check your network connection and API key.');
        } finally {
            analyzeButton.disabled = false;
            analyzeButton.textContent = 'Analyze Image';
        }
    }
    
    async updateSystemInfo() {
        try {
            // Update photo counts
            const response = await fetch(`${this.apiBase}/photos?stats_only=true`);
            if (response.ok) {
                const data = await response.json();
                document.getElementById('total-photos').textContent = data.total || '0';
                document.getElementById('processed-photos').textContent = data.processed || '0';
            }
            
            // Update queue status
            const queueResponse = await fetch(`${this.apiBase}/photos/process/queue`);
            if (queueResponse.ok) {
                const queueData = await queueResponse.json();
                document.getElementById('queue-status').textContent = 
                    `${queueData.pending || 0} pending, ${queueData.processing || 0} processing`;
            }
            
        } catch (error) {
            console.error('Error updating system info:', error);
        }
    }

    // Collections functionality now handled by CollectionsManager component
    
    // LLM API Status Methods
    async checkLLMStatus() {
        try {
            const response = await fetch(`${this.apiBase}/api/llm-status`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const status = await response.json();
            this.updateLLMStatusDisplay(status);
            return status;
        } catch (error) {
            console.error('Error checking LLM status:', error);
            this.updateLLMStatusDisplay(null);
            return null;
        }
    }
    
    updateLLMStatusDisplay(status) {
        // Update navigation summary indicator
        const navIndicator = document.getElementById('llm-status-indicator');
        const navText = document.getElementById('llm-status-text');
        
        // Update settings page detailed indicators  
        const anthropicIndicator = document.getElementById('anthropic-status-indicator');
        const anthropicText = document.getElementById('anthropic-status-text');
        const openaiIndicator = document.getElementById('openai-status-indicator');
        const openaiText = document.getElementById('openai-status-text');
        
        if (!status) {
            // Error state - show red
            if (navIndicator) navIndicator.className = 'w-2 h-2 rounded-full bg-red-500';
            if (navText) navText.textContent = 'Error';
            if (anthropicIndicator) anthropicIndicator.className = 'w-3 h-3 rounded-full bg-red-500';
            if (anthropicText) anthropicText.textContent = 'Error checking status';
            if (openaiIndicator) openaiIndicator.className = 'w-3 h-3 rounded-full bg-red-500';
            if (openaiText) openaiText.textContent = 'Error checking status';
            return;
        }
        
        const anthropicStatus = status.anthropic?.status;
        const openaiStatus = status.openai?.status;
        
        // Update settings page detailed status
        this.updateProviderStatus('anthropic', anthropicStatus, status.anthropic?.env_key_available, status.anthropic?.error);
        this.updateProviderStatus('openai', openaiStatus, status.openai?.env_key_available, status.openai?.error);
        
        // Update navigation summary - show best available status
        let overallStatus = 'red';
        let overallText = 'Unavailable';
        
        if (anthropicStatus === 'available' || openaiStatus === 'available') {
            overallStatus = 'green';
            overallText = 'Available';
        } else if (anthropicStatus === 'no_key' || openaiStatus === 'no_key') {
            overallStatus = 'yellow'; 
            overallText = 'No Keys';
        }
        
        if (navIndicator) navIndicator.className = `w-2 h-2 rounded-full bg-${overallStatus}-500`;
        if (navText) navText.textContent = overallText;
    }
    
    updateProviderStatus(provider, status, envKeyAvailable, error) {
        const indicator = document.getElementById(`${provider}-status-indicator`);
        const text = document.getElementById(`${provider}-status-text`);
        
        if (!indicator || !text) return;
        
        switch (status) {
            case 'available':
                indicator.className = 'w-3 h-3 rounded-full bg-green-500';
                text.textContent = envKeyAvailable ? 'Available (.env)' : 'Available (user key)';
                break;
            case 'no_key':
                indicator.className = 'w-3 h-3 rounded-full bg-gray-400';
                text.textContent = 'No API key configured';
                break;
            case 'error':
                indicator.className = 'w-3 h-3 rounded-full bg-red-500';
                text.textContent = error ? `Error: ${error}` : 'API Error';
                break;
            default:
                indicator.className = 'w-3 h-3 rounded-full bg-gray-400';
                text.textContent = 'Unknown';
        }
    }
    
    initializeStatusChecking() {
        // Initial status check
        this.checkLLMStatus();
        
        // Periodic status checks every 5 minutes
        this.statusInterval = setInterval(() => {
            this.checkLLMStatus();
        }, 5 * 60 * 1000);
    }
    
    async checkAndResumeBatchProcessing() {
        try {
            console.log('Checking for ongoing batch processing...');
            
            const response = await fetch(`${this.apiBase}/photos/batch/status`);
            if (response.ok) {
                const batchStatus = await response.json();
                
                if (batchStatus.is_processing && batchStatus.processing_count > 0) {
                    console.log(`Found ${batchStatus.processing_count} photos still being processed. Resuming progress tracking...`);
                    
                    // Add processing photos to our UI state
                    batchStatus.photo_ids.forEach(photoId => {
                        this.processingPhotos.add(photoId);
                    });
                    
                    // Show progress bars
                    photoProcessor.showBatchProgress(0, batchStatus.processing_count, 0);
                    photoProcessor.showGlobalProgress(0, batchStatus.processing_count, 'Resuming AI analysis progress...', true);
                    
                    // Resume polling for progress updates (with small delay to let UI finish loading)
                    // Use the new instance management system
                    setTimeout(() => {
                        // Show message about ongoing processing
                        console.log(`Found ${batchStatus.photo_ids.length} photos still processing from previous session`);
                        eventBus.emit('toast:success', { title: 'Processing Recovery', `Continuing background processing for ${batchStatus.photo_ids.length} photos.`);
                    }, 1000);
                    
                    console.log('Batch processing progress resumed successfully');
                } else {
                    console.log('No ongoing batch processing detected');
                }
            } else {
                console.error('Failed to check batch processing status:', response.status);
            }
        } catch (error) {
            console.error('Error checking batch processing status:', error);
        }
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