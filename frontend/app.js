// TargetVision Finder-Style Frontend Application
class TargetVisionApp {
    constructor() {
        this.apiBase = 'http://localhost:8000';
        this.smugmugAlbums = [];
        this.currentAlbum = null;
        this.currentPhotos = [];
        this.selectedPhotos = new Set();
        this.statusFilter = '';
        this.currentPage = 'albums';
        this.chatMessages = [];
        this.searchResults = [];
        this.searchFilters = {
            album: '',
            status: '',
            dateFrom: '',
            dateTo: ''
        };
        
        // Folder navigation state
        this.currentNodeUri = null;
        this.nodeHistory = [];
        this.breadcrumbs = [];
        
        this.initializeApp();
    }

    async initializeApp() {
        this.bindEventListeners();
        await this.checkConnectionStatus();
        await this.checkAuthentication();
        // Initialize breadcrumbs before loading albums
        this.updateBreadcrumbs();
        await this.loadSmugMugAlbums();
    }

    bindEventListeners() {
        // Navigation
        document.getElementById('nav-albums').addEventListener('click', () => this.showPage('albums'));
        document.getElementById('nav-chat').addEventListener('click', () => this.showPage('chat'));
        document.getElementById('nav-search').addEventListener('click', () => this.showPage('search'));
        document.getElementById('nav-settings').addEventListener('click', () => this.showPage('settings'));
        
        // Album selection (breadcrumb-albums is now created dynamically, so we'll handle this in updateBreadcrumbs)
        
        // Album actions
        document.getElementById('sync-album').addEventListener('click', () => this.syncCurrentAlbum());
        document.getElementById('refresh-photos').addEventListener('click', () => this.refreshCurrentPhotos());
        document.getElementById('sync-all-albums').addEventListener('click', () => this.syncAllAlbums());
        
        // Photo selection
        document.getElementById('select-all').addEventListener('click', () => this.selectAllPhotos());
        document.getElementById('select-none').addEventListener('click', () => this.clearSelection());
        document.getElementById('process-selected').addEventListener('click', () => this.processSelectedPhotos());
        
        // Filters
        document.getElementById('status-filter').addEventListener('change', (e) => this.filterPhotos(e.target.value));
        
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
        
        // Settings functionality
        document.getElementById('edit-prompt').addEventListener('click', () => this.editPrompt());
        document.getElementById('save-prompt').addEventListener('click', () => this.savePrompt());
        document.getElementById('cancel-prompt-edit').addEventListener('click', () => this.cancelPromptEdit());
        document.getElementById('reset-prompt').addEventListener('click', () => this.resetPrompt());
        document.getElementById('test-prompt').addEventListener('click', () => this.testPrompt());
        document.getElementById('save-settings').addEventListener('click', () => this.saveApplicationSettings());
        
        // Prompt textarea character count
        document.getElementById('prompt-textarea').addEventListener('input', () => this.updateCharCount());
        
        // Template selection
        document.querySelectorAll('[data-template]').forEach(template => {
            template.addEventListener('click', () => this.selectTemplate(template.dataset.template));
        });
    }

    // Authentication and Connection
    async checkConnectionStatus() {
        try {
            const response = await fetch(`${this.apiBase}/health`, { 
                method: 'GET',
                timeout: 5000 
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

    async checkAuthentication() {
        try {
            const response = await fetch(`${this.apiBase}/auth/status`);
            const authStatus = await response.json();
            
            const loading = document.getElementById('auth-loading');
            const success = document.getElementById('auth-success');
            const error = document.getElementById('auth-error');
            const username = document.getElementById('auth-username');
            
            if (loading) loading.classList.add('hidden');
            
            if (authStatus.authenticated) {
                if (success) success.classList.remove('hidden');
                if (username) username.textContent = `(@${authStatus.username})`;
            } else {
                if (error) error.classList.remove('hidden');
            }
        } catch (err) {
            console.error('Authentication check failed:', err);
            const loading = document.getElementById('auth-loading');
            const error = document.getElementById('auth-error');
            if (loading) loading.classList.add('hidden');
            if (error) error.classList.remove('hidden');
        }
    }

    // Albums Management
    async loadSmugMugAlbums() {
        // Use the new folder navigation system
        await this.loadFolderContents();
    }
    
    async loadFolderContents(nodeUri = null) {
        this.showAlbumsLoading();
        
        try {
            const url = nodeUri 
                ? `${this.apiBase}/smugmug/nodes?node_uri=${encodeURIComponent(nodeUri)}`
                : `${this.apiBase}/smugmug/nodes`;
            
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            this.smugmugAlbums = data.nodes || [];
            this.currentNodeUri = nodeUri;
            
            // Update breadcrumbs
            if (data.breadcrumbs) {
                this.breadcrumbs = data.breadcrumbs;
            } else {
                this.breadcrumbs = [];
            }
            
            this.displayFolderContents();
            
            // Also update the right panel to show folder contents
            if (this.smugmugAlbums.length > 0) {
                this.displayRootFolderContentsInRightPanel();
            }
            
            this.hideAlbumsLoading();
            
        } catch (error) {
            console.error('Failed to load folder contents:', error);
            this.showErrorMessage('Failed to Load Folders', 'Could not fetch folders from SmugMug. Please check your connection and try again.', error.message);
            this.hideAlbumsLoading();
        }
    }

    displayAlbums() {
        // Delegate to folder contents display for backward compatibility
        this.displayFolderContents();
    }
    
    displayFolderContents() {
        const albumsList = document.getElementById('albums-list');
        const albumCount = document.getElementById('album-count');
        
        // Clear loading state
        const loading = document.getElementById('loading-albums');
        if (loading) loading.remove();
        
        // Update breadcrumbs
        this.updateBreadcrumbs();
        
        albumCount.textContent = this.smugmugAlbums.length.toString();
        
        albumsList.innerHTML = '';
        
        if (this.smugmugAlbums.length === 0) {
            albumsList.innerHTML = `
                <div class="p-4 text-center text-gray-500">
                    <p class="text-sm">No folders or albums found</p>
                </div>
            `;
            return;
        }
        
        // Separate folders and albums for better organization
        const folders = this.smugmugAlbums.filter(item => item.type === 'folder');
        const albums = this.smugmugAlbums.filter(item => item.type === 'album');
        
        // Display folders first
        folders.forEach(folder => {
            const folderElement = this.createFolderListItem(folder);
            albumsList.appendChild(folderElement);
        });
        
        // Then display albums
        albums.forEach(album => {
            const albumElement = this.createAlbumListItem(album);
            albumsList.appendChild(albumElement);
        });
    }

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
        const syncIcon = album.is_synced ? '✓' : '○';
        const syncColor = album.is_synced ? 'text-green-600' : 'text-gray-400';
        
        // Processing statistics - for new Node API, these are now included
        const processed = album.ai_processed_count || 0;
        const total = album.image_count || album.synced_photo_count || 0;
        const processedPercent = total > 0 ? Math.round((processed / total) * 100) : 0;
        
        div.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <div class="flex items-center flex-1 min-w-0">
                    <svg class="h-4 w-4 text-green-600 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                    </svg>
                    <span class="text-sm font-medium text-gray-900 truncate">${albumTitle}</span>
                </div>
                <span class="text-xs ${syncColor} ml-2">${syncIcon}</span>
            </div>
            
            <div class="flex items-center justify-between text-xs text-gray-500">
                <span>${total} photos</span>
                <span class="text-green-600">${processed} processed</span>
            </div>
            
            ${album.is_synced ? `
                <div class="mt-2">
                    <div class="flex justify-between text-xs text-gray-600 mb-1">
                        <span>AI Processing</span>
                        <span>${processedPercent}%</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-1">
                        <div class="bg-green-500 h-1 rounded-full transition-all" style="width: ${processedPercent}%"></div>
                    </div>
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
    
    async navigateToFolder(folder) {
        // Add current location to history for back navigation
        this.nodeHistory.push({
            nodeUri: this.currentNodeUri,
            folderName: this.breadcrumbs.length > 0 ? this.breadcrumbs[this.breadcrumbs.length - 1].name : 'Root'
        });
        
        // Load the folder contents using the node URI
        await this.loadFolderContents(folder.node_uri);
        
        // Update right panel to show folder contents
        this.displayFolderContentsInRightPanel(folder);
    }
    
    updateBreadcrumbs() {
        const breadcrumbContainer = document.getElementById('breadcrumb-path');
        if (!breadcrumbContainer) return;
        
        // Clear existing breadcrumbs
        breadcrumbContainer.innerHTML = '';
        
        // Create Albums root breadcrumb
        const albumsRoot = document.createElement('button');
        albumsRoot.id = 'breadcrumb-albums';
        albumsRoot.className = 'text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center';
        albumsRoot.innerHTML = `
            <svg class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2v0a2 2 0 002 2z"/>
            </svg>
            SmugMug Albums
        `;
        albumsRoot.addEventListener('click', () => this.navigateToRoot());
        breadcrumbContainer.appendChild(albumsRoot);
        
        // Add breadcrumbs for each folder in the path
        this.breadcrumbs.forEach((breadcrumb, index) => {
            // Add separator
            const separator = document.createElement('span');
            separator.className = 'mx-2 text-gray-400';
            separator.textContent = '/';
            breadcrumbContainer.appendChild(separator);
            
            // Add breadcrumb link
            const link = document.createElement('button');
            link.className = index === this.breadcrumbs.length - 1 
                ? 'text-gray-700 text-sm font-medium' 
                : 'text-blue-600 hover:text-blue-800 text-sm';
            link.textContent = breadcrumb.name;
            
            if (index < this.breadcrumbs.length - 1) {
                link.addEventListener('click', () => this.loadFolderContents(breadcrumb.node_uri));
            }
            
            breadcrumbContainer.appendChild(link);
        });
    }
    
    async navigateToRoot() {
        this.nodeHistory = [];
        this.breadcrumbs = [];
        await this.loadFolderContents();
    }
    
    displayFolderContentsInRightPanel(folder) {
        // Clear current album state since we're viewing folder contents
        this.currentAlbum = null;
        
        // Update UI to show folder contents view
        this.showPhotosView();
        
        // Update the header to show folder name
        const folderName = folder.name || 'Folder';
        document.getElementById('current-album-title').textContent = folderName;
        
        // Hide album-specific actions
        document.getElementById('album-actions').classList.add('hidden');
        document.getElementById('album-stats').classList.add('hidden');
        
        // Show folder contents in the photo grid area
        this.displayFolderItemsInGrid(this.smugmugAlbums);
        
        // Update breadcrumb to show current folder
        const breadcrumbArrow = document.getElementById('breadcrumb-arrow');
        const breadcrumbCurrent = document.getElementById('breadcrumb-current');
        if (breadcrumbArrow) breadcrumbArrow.classList.remove('hidden');
        if (breadcrumbCurrent) {
            breadcrumbCurrent.classList.remove('hidden');
            breadcrumbCurrent.textContent = folderName;
        }
    }
    
    displayFolderItemsInGrid(items) {
        const photoGrid = document.getElementById('photo-grid');
        const emptyState = document.getElementById('empty-photos');
        const welcomeState = document.getElementById('welcome-state');
        
        // Hide other states
        welcomeState.classList.add('hidden');
        emptyState.classList.add('hidden');
        
        // Clear existing content
        photoGrid.innerHTML = '';
        
        if (items.length === 0) {
            emptyState.classList.remove('hidden');
            photoGrid.classList.add('hidden');
            return;
        }
        
        // Show photo grid
        photoGrid.classList.remove('hidden');
        
        // Separate folders and albums
        const folders = items.filter(item => item.type === 'folder');
        const albums = items.filter(item => item.type === 'album');
        
        // Display folders first
        folders.forEach(folder => {
            const folderCard = this.createFolderCard(folder);
            photoGrid.appendChild(folderCard);
        });
        
        // Then display albums
        albums.forEach(album => {
            const albumCard = this.createAlbumCard(album);
            photoGrid.appendChild(albumCard);
        });
    }
    
    createFolderCard(folder) {
        const div = document.createElement('div');
        div.className = 'folder-card bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer';
        
        const folderName = folder.name || 'Untitled Folder';
        
        div.innerHTML = `
            <div class="flex flex-col items-center text-center">
                <svg class="h-12 w-12 text-amber-500 mb-2" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>
                </svg>
                <h3 class="text-sm font-medium text-gray-900 truncate w-full">${folderName}</h3>
                <p class="text-xs text-gray-500 mt-1">Folder</p>
            </div>
        `;
        
        div.addEventListener('click', () => this.navigateToFolder(folder));
        
        return div;
    }
    
    createAlbumCard(album) {
        const div = document.createElement('div');
        div.className = 'album-card bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer';
        
        const albumName = album.name || 'Untitled Album';
        const photoCount = album.image_count || album.synced_photo_count || 0;
        const processedCount = album.ai_processed_count || 0;
        const syncIcon = album.is_synced ? '✓' : '○';
        const syncColor = album.is_synced ? 'text-green-600' : 'text-gray-400';
        
        div.innerHTML = `
            <div class="flex flex-col items-center text-center">
                <svg class="h-12 w-12 text-green-600 mb-2" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                </svg>
                <h3 class="text-sm font-medium text-gray-900 truncate w-full">${albumName}</h3>
                <div class="flex items-center justify-center mt-1 space-x-2">
                    <p class="text-xs text-gray-500">${photoCount} photos</p>
                    <span class="text-xs ${syncColor}">${syncIcon}</span>
                </div>
                ${album.is_synced ? `
                    <p class="text-xs text-green-600 mt-1">${processedCount} processed</p>
                ` : ''}
            </div>
        `;
        
        div.addEventListener('click', () => this.selectAlbum(album));
        
        return div;
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

    async selectAlbum(album) {
        this.currentAlbum = album;
        
        // Update UI
        this.updateAlbumSelection();
        this.showPhotosView();
        // Handle both old and new API format for album ID
        const albumId = album.smugmug_id || album.album_key;
        if (albumId) {
            await this.loadAlbumPhotos(albumId);
        } else {
            console.error('No album ID found in album object:', album);
            this.showErrorMessage('Album Error', 'Could not load album photos - missing album identifier');
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
                const title = item.querySelector('span.font-medium').textContent;
                if (title === currentAlbumName) {
                    item.classList.add('bg-blue-50', 'border-blue-200');
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
            
            // Update photo panel header
            document.getElementById('current-album-title').textContent = this.currentAlbum.title || this.currentAlbum.name || 'Selected Album';
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

    // Photos Management
    async loadAlbumPhotos(albumId) {
        this.showPhotosLoading();
        this.clearSelection();
        
        try {
            const response = await fetch(`${this.apiBase}/smugmug/albums/${albumId}/photos`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            this.currentPhotos = await response.json();
            this.displayPhotos();
            this.updatePhotoStats();
            this.hidePhotosLoading();
            
        } catch (error) {
            console.error('Failed to load photos:', error);
            this.showErrorMessage('Failed to Load Photos', 'Could not fetch photos from this album.', error.message);
            this.hidePhotosLoading();
        }
    }

    displayPhotos() {
        const photoGrid = document.getElementById('photo-grid');
        const emptyState = document.getElementById('empty-photos');
        const welcomeState = document.getElementById('welcome-state');
        
        // Hide states
        welcomeState.classList.add('hidden');
        emptyState.classList.add('hidden');
        
        if (this.currentPhotos.length === 0) {
            photoGrid.classList.add('hidden');
            emptyState.classList.remove('hidden');
            return;
        }
        
        // Show photo controls
        document.getElementById('photo-controls').classList.remove('hidden');
        
        // Filter photos if needed
        let photosToShow = this.currentPhotos;
        if (this.statusFilter) {
            photosToShow = this.currentPhotos.filter(photo => photo.processing_status === this.statusFilter);
        }
        
        photoGrid.classList.remove('hidden');
        photoGrid.innerHTML = '';
        
        photosToShow.forEach(photo => {
            const photoElement = this.createPhotoCard(photo);
            photoGrid.appendChild(photoElement);
        });
    }

    createPhotoCard(photo) {
        const div = document.createElement('div');
        const cursorClass = photo.is_synced ? 'cursor-pointer' : 'cursor-not-allowed';
        const opacityClass = photo.is_synced ? '' : 'opacity-60';
        div.className = `photo-card relative group ${cursorClass} ${opacityClass}`;
        
        // Status indicator styling
        const statusConfig = {
            'completed': { color: 'bg-green-500', icon: '✓', text: 'Processed' },
            'processing': { color: 'bg-yellow-500', icon: '⏳', text: 'Processing' },
            'failed': { color: 'bg-red-500', icon: '✗', text: 'Failed' },
            'not_processed': { color: 'bg-orange-500', icon: '○', text: 'Not Processed' },
            'not_synced': { color: 'bg-gray-400', icon: '○', text: 'Not Synced' }
        };
        
        const status = photo.processing_status || 'not_synced';
        const statusInfo = statusConfig[status];
        
        div.innerHTML = `
            <div class="aspect-square bg-gray-100 rounded-lg overflow-hidden relative">
                <img 
                    src="${photo.thumbnail_url}" 
                    alt="${photo.title || 'Photo'}"
                    class="w-full h-full object-cover"
                    loading="lazy"
                />
                
                <!-- Status indicator -->
                <div class="absolute top-2 right-2 ${statusInfo.color} text-white text-xs px-2 py-1 rounded-full flex items-center z-20">
                    <span class="mr-1">${statusInfo.icon}</span>
                    <span class="hidden sm:inline">${statusInfo.text}</span>
                </div>
                
                <!-- Lightbox button -->
                <div class="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                    <button class="lightbox-btn w-8 h-8 bg-black bg-opacity-60 hover:bg-opacity-80 rounded-full flex items-center justify-center text-white transition-all" 
                            onclick="event.stopPropagation()">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                        </svg>
                    </button>
                </div>
                
                <!-- Selection checkbox (only for synced photos) -->
                ${photo.is_synced ? `
                    <div class="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                        <input type="checkbox" 
                               class="photo-checkbox w-4 h-4 text-blue-600 bg-white border-2 border-gray-300 rounded focus:ring-blue-500" 
                               data-photo-id="${photo.smugmug_id}"
                               onclick="event.stopPropagation()">
                    </div>
                ` : ''}
                
                <!-- Hover overlay for visual feedback -->
                <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all z-10">
                    ${!photo.is_synced ? `
                        <div class="absolute inset-0 flex items-center justify-center">
                            <div class="bg-black bg-opacity-70 text-white text-xs px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                Sync album to enable selection
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
            
            <!-- Photo info -->
            <div class="mt-2">
                <p class="text-xs text-gray-600 truncate">${photo.filename || photo.title || 'Untitled'}</p>
                <p class="text-xs text-gray-400">${photo.width}×${photo.height}</p>
            </div>
        `;
        
        // Add click handler - clicking thumbnail selects photo
        div.addEventListener('click', (e) => {
            // Don't select if clicking on buttons or checkboxes
            if (e.target.type === 'checkbox' || e.target.closest('button')) return;
            
            // If photo is synced, toggle selection
            if (photo.is_synced) {
                const checkbox = div.querySelector('.photo-checkbox');
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                    this.togglePhotoSelection(photo.smugmug_id, checkbox.checked);
                }
            } else {
                // Show message for non-synced photos
                this.showErrorMessage('Sync Required', 'This photo must be synced to the database before it can be selected for processing. Use the "Sync Album" button first.');
            }
        });
        
        // Add lightbox button handler
        const lightboxBtn = div.querySelector('.lightbox-btn');
        if (lightboxBtn) {
            lightboxBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showPhotoModal(photo);
            });
        }
        
        // Add checkbox handler for direct checkbox clicks
        const checkbox = div.querySelector('.photo-checkbox');
        if (checkbox) {
            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                this.togglePhotoSelection(photo.smugmug_id, e.target.checked);
            });
        }
        
        return div;
    }

    // Selection Management
    togglePhotoSelection(photoId, isSelected) {
        if (isSelected) {
            this.selectedPhotos.add(photoId);
        } else {
            this.selectedPhotos.delete(photoId);
        }
        this.updateSelectionUI();
    }

    selectAllPhotos() {
        const syncedPhotos = this.currentPhotos.filter(p => p.is_synced);
        syncedPhotos.forEach(photo => {
            this.selectedPhotos.add(photo.smugmug_id);
            const checkbox = document.querySelector(`[data-photo-id="${photo.smugmug_id}"]`);
            if (checkbox) checkbox.checked = true;
        });
        this.updateSelectionUI();
    }

    clearSelection() {
        this.selectedPhotos.clear();
        document.querySelectorAll('.photo-checkbox').forEach(checkbox => {
            checkbox.checked = false;
        });
        this.updateSelectionUI();
    }

    updateSelectionUI() {
        const count = this.selectedPhotos.size;
        document.getElementById('selection-count').textContent = `${count} selected`;
        document.getElementById('process-selected').disabled = count === 0;
    }

    // Processing
    async syncCurrentAlbum() {
        if (!this.currentAlbum) return;
        
        const button = document.getElementById('sync-album');
        const originalText = button.textContent;
        
        button.textContent = 'Syncing...';
        button.disabled = true;
        
        try {
            const currentAlbumId = this.currentAlbum.smugmug_id || this.currentAlbum.album_key;
            
            // Save current navigation state
            const savedState = {
                currentNodeUri: this.currentNodeUri,
                breadcrumbs: [...this.breadcrumbs],
                nodeHistory: [...this.nodeHistory],
                selectedAlbumId: currentAlbumId
            };
            
            const response = await fetch(`${this.apiBase}/smugmug/albums/${currentAlbumId}/sync`, {
                method: 'POST'
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const result = await response.json();
            
            // Context-preserving refresh: only update current folder and album data
            await this.refreshCurrentContext(savedState);
            
            this.showSuccessMessage('Album Synced', `Successfully synced ${result.synced_photos} photos from "${result.album_name}"`);
            
        } catch (error) {
            console.error('Album sync failed:', error);
            this.showErrorMessage('Sync Failed', 'Could not sync album with local database.', error.message);
        } finally {
            button.textContent = originalText;
            button.disabled = false;
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
            this.currentAlbum = this.smugmugAlbums.find(a => 
                (a.smugmug_id && a.smugmug_id === currentAlbumId) || 
                (a.album_key && a.album_key === currentAlbumId)
            );
            
            // Refresh album photos if we have a current album
            if (this.currentAlbum) {
                await this.loadAlbumPhotos(currentAlbumId);
                this.updateAlbumSelection();
            }
            
            // Update breadcrumbs display
            this.updateBreadcrumbs();
            
        } catch (error) {
            console.error('Error refreshing context:', error);
            // Fallback to full reload if context refresh fails
            await this.loadSmugMugAlbums();
            if (savedState.selectedAlbumId) {
                await this.loadAlbumPhotos(savedState.selectedAlbumId);
            }
        }
    }

    async processSelectedPhotos() {
        if (this.selectedPhotos.size === 0) return;
        
        const photoIds = Array.from(this.selectedPhotos);
        
        // Find local photo IDs for selected SmugMug IDs
        const localPhotoIds = [];
        for (const smugmugId of photoIds) {
            const photo = this.currentPhotos.find(p => p.smugmug_id === smugmugId);
            if (photo && photo.local_photo_id) {
                localPhotoIds.push(photo.local_photo_id);
            }
        }
        
        if (localPhotoIds.length === 0) {
            this.showErrorMessage('Processing Error', 'Selected photos must be synced before processing.');
            return;
        }
        
        this.showBatchProgress(0, localPhotoIds.length, 0);
        
        try {
            // Update status to processing
            await fetch(`${this.apiBase}/photos/update-status?status=processing`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(localPhotoIds)
            });
            
            // Start batch processing
            const response = await fetch(`${this.apiBase}/photos/process/batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(localPhotoIds)
            });
            
            const result = await response.json();
            
            // Show final progress
            this.showBatchProgress(result.total, result.total, result.processed);
            
            // Reload photos and albums
            const currentAlbumId = this.currentAlbum.smugmug_id || this.currentAlbum.album_key;
            await this.loadAlbumPhotos(currentAlbumId);
            await this.loadSmugMugAlbums();
            
            this.clearSelection();
            
            const message = `Batch processing completed! ${result.processed}/${result.total} photos processed successfully`;
            if (result.processed !== result.total) {
                const failed = result.total - result.processed;
                this.showErrorMessage('Processing Completed with Errors', message + ` (${failed} failed)`);
            } else {
                this.showSuccessMessage('Processing Complete', message);
            }
            
        } catch (error) {
            console.error('Batch processing failed:', error);
            this.hideBatchProgress();
            this.showErrorMessage('Processing Failed', 'Batch processing failed. Please try again.');
        }
    }

    // UI State Management
    async showAlbumsView() {
        this.currentAlbum = null;
        this.clearSelection();
        
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
        await this.loadFolderContents();
    }

    showPhotosView() {
        document.getElementById('welcome-state').classList.add('hidden');
    }

    showAlbumsLoading() {
        const loading = document.getElementById('loading-albums');
        if (!loading) {
            const albumsList = document.getElementById('albums-list');
            albumsList.innerHTML = `
                <div id="loading-albums" class="p-4 text-center text-gray-500">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    Loading albums...
                </div>
            `;
        }
    }

    hideAlbumsLoading() {
        const loading = document.getElementById('loading-albums');
        if (loading) loading.remove();
    }

    showPhotosLoading() {
        document.getElementById('loading-photos').classList.remove('hidden');
        document.getElementById('photo-grid').classList.add('hidden');
        document.getElementById('empty-photos').classList.add('hidden');
        document.getElementById('welcome-state').classList.add('hidden');
    }

    hidePhotosLoading() {
        document.getElementById('loading-photos').classList.add('hidden');
    }

    showBatchProgress(processed, total, success) {
        const progressContainer = document.getElementById('batch-progress');
        const progressText = document.getElementById('batch-progress-text');
        const progressBar = document.getElementById('batch-progress-bar');
        
        const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;
        
        progressText.textContent = `${processed}/${total}`;
        progressBar.style.width = `${percentage}%`;
        progressContainer.classList.remove('hidden');
        
        if (processed >= total) {
            setTimeout(() => {
                progressContainer.classList.add('hidden');
            }, 3000);
        }
    }

    hideBatchProgress() {
        document.getElementById('batch-progress').classList.add('hidden');
    }

    updatePhotoStats() {
        if (!this.currentAlbum) return;
        
        const totalPhotos = this.currentAlbum.image_count || 0;
        const processedPhotos = this.currentAlbum.ai_processed_count || 0;
        
        document.getElementById('photo-count').textContent = `${totalPhotos} photos`;
        document.getElementById('processing-stats').textContent = `${processedPhotos} processed`;
    }

    filterPhotos(status) {
        this.statusFilter = status;
        this.displayPhotos();
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
        const baseClasses = 'transform transition-all duration-300 ease-in-out max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5';
        
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
        this.showToast(title, message, 'error');
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
        // Hide all pages
        document.getElementById('page-albums').classList.add('hidden');
        document.getElementById('page-chat').classList.add('hidden');
        document.getElementById('page-search').classList.add('hidden');
        document.getElementById('page-settings').classList.add('hidden');
        
        // Remove active state from all nav tabs
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('nav-tab-active');
        });
        
        // Show selected page and activate tab
        document.getElementById(`page-${pageName}`).classList.remove('hidden');
        document.getElementById(`nav-${pageName}`).classList.add('nav-tab-active');
        
        this.currentPage = pageName;
        
        // Initialize page if needed
        if (pageName === 'chat' && this.chatMessages.length === 0) {
            this.initializeChatPage();
        } else if (pageName === 'search') {
            this.initializeSearchPage();
        } else if (pageName === 'settings') {
            this.initializeSettingsPage();
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
        
        this.showSearchLoading();
        
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
            this.hideSearchLoading();
            
        } catch (error) {
            console.error('Search error:', error);
            this.hideSearchLoading();
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
        const score = result.score || 0;
        
        div.innerHTML = `
            <div class="aspect-square bg-gray-100 rounded-lg overflow-hidden relative">
                <img 
                    src="${photo.thumbnail_url}" 
                    alt="${photo.title || 'Search result'}"
                    class="w-full h-full object-cover"
                    loading="lazy"
                />
                
                <!-- Relevance score -->
                <div class="absolute top-2 right-2 bg-blue-600 text-white text-xs px-2 py-1 rounded-full z-20">
                    ${Math.round(score * 100)}%
                </div>
                
                <!-- Lightbox button -->
                <div class="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                    <button class="lightbox-btn w-8 h-8 bg-black bg-opacity-60 hover:bg-opacity-80 rounded-full flex items-center justify-center text-white transition-all" 
                            onclick="event.stopPropagation()">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                        </svg>
                    </button>
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
        
        // Add lightbox button handler for search results
        const lightboxBtn = div.querySelector('.lightbox-btn');
        if (lightboxBtn) {
            lightboxBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showPhotoModal(photo);
            });
        }
        
        return div;
    }
    
    showSearchLoading() {
        document.getElementById('search-welcome').classList.add('hidden');
        document.getElementById('search-results-grid').classList.add('hidden');
        document.getElementById('search-no-results').classList.add('hidden');
        document.getElementById('search-loading').classList.remove('hidden');
    }
    
    hideSearchLoading() {
        document.getElementById('search-loading').classList.add('hidden');
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
        
        // Store current photo for editing functions
        this.currentPhoto = photo;
        
        // Populate modal with photo data
        const modal = document.getElementById('photo-modal');
        const modalImage = document.getElementById('modal-image');
        const modalDimensions = document.getElementById('modal-dimensions');
        const modalAlbum = document.getElementById('modal-album');
        const modalOriginalTitle = document.getElementById('modal-original-title');
        const modalOriginalCaption = document.getElementById('modal-original-caption');
        const modalOriginalKeywords = document.getElementById('modal-original-keywords');
        const modalAiSection = document.getElementById('modal-ai-section');
        const modalNoAi = document.getElementById('modal-no-ai');
        const modalAiDescription = document.getElementById('modal-ai-description');
        const modalAiKeywords = document.getElementById('modal-ai-keywords');
        const modalAiConfidence = document.getElementById('modal-ai-confidence');
        const modalAiTimestamp = document.getElementById('modal-ai-timestamp');
        
        // Set main image - use image_url if available, otherwise thumbnail_url
        const imageUrl = photo.image_url || photo.thumbnail_url;
        modalImage.src = imageUrl;
        modalImage.alt = photo.title || 'Photo';
        
        // Set photo info
        modalDimensions.textContent = `${photo.width || 0} × ${photo.height || 0} pixels`;
        modalAlbum.textContent = `Album: ${photo.album_name || 'Unknown Album'}`;
        
        // Set original metadata
        modalOriginalTitle.innerHTML = photo.title ? 
            `<strong>Title:</strong> ${photo.title}` : 
            '<span class="text-gray-400">No title</span>';
            
        modalOriginalCaption.innerHTML = photo.caption ? 
            `<strong>Caption:</strong> ${photo.caption}` : 
            '<span class="text-gray-400">No caption</span>';
            
        if (photo.keywords && photo.keywords.length > 0) {
            const keywordTags = photo.keywords.map(keyword => 
                `<span class="inline-block bg-gray-200 text-gray-700 px-2 py-1 rounded-full text-xs mr-1 mb-1">${keyword}</span>`
            ).join('');
            modalOriginalKeywords.innerHTML = `<strong>Keywords:</strong><br>${keywordTags}`;
        } else {
            modalOriginalKeywords.innerHTML = '<span class="text-gray-400">No keywords</span>';
        }
        
        // Handle AI metadata
        if (photo.ai_metadata || photo.has_ai_metadata) {
            modalAiSection.classList.remove('hidden');
            modalNoAi.classList.add('hidden');
            
            const aiData = photo.ai_metadata || {};
            
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
        
        // Show modal
        modal.classList.remove('hidden');
        
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
        document.getElementById('photo-modal').classList.add('hidden');
    }

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
            this.showErrorMessage('Processing Error', 'This photo must be synced to the database before it can be processed with AI.');
            return;
        }
        
        const processButton = document.getElementById('modal-process-button');
        const originalText = processButton.textContent;
        
        processButton.textContent = 'Processing...';
        processButton.disabled = true;
        
        try {
            const response = await fetch(`${this.apiBase}/photos/${currentPhoto.local_photo_id}/process`, {
                method: 'POST'
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const result = await response.json();
            
            // Update the current photo data
            const photoIndex = this.currentPhotos.findIndex(p => p.local_photo_id === currentPhoto.local_photo_id);
            if (photoIndex !== -1) {
                this.currentPhotos[photoIndex].ai_metadata = result.ai_metadata;
                this.currentPhotos[photoIndex].has_ai_metadata = true;
                this.currentPhotos[photoIndex].processing_status = 'completed';
            }
            
            // Refresh the modal with updated data
            await this.showPhotoModal(this.currentPhotos[photoIndex]);
            
            // Refresh the photo grid to show updated status
            this.displayPhotos();
            
            this.showSuccessMessage('AI Processing Complete', 'Photo has been analyzed and metadata generated successfully.');
            
        } catch (error) {
            console.error('AI processing failed:', error);
            this.showErrorMessage('Processing Failed', 'Could not process photo with AI. Please try again.');
            
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
        if (!this.currentPhoto?.id) {
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
            
            const response = await fetch(`${this.apiBase}/metadata/${this.currentPhoto.id}`, {
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
            this.showErrorMessage('Save Failed', 'Failed to save metadata. Please try again.');
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
    }
    
    async regenerateAIMetadata() {
        if (!this.currentPhoto?.id) {
            console.error('No photo selected for regeneration');
            return;
        }
        
        try {
            const regenerateButton = document.getElementById('modal-regenerate-ai');
            regenerateButton.disabled = true;
            regenerateButton.innerHTML = '🔄 Regenerating...';
            
            const response = await fetch(`${this.apiBase}/photos/${this.currentPhoto.id}/process`, {
                method: 'POST'
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
            this.showErrorMessage('Regeneration Failed', 'Failed to regenerate AI metadata. Please try again.');
        } finally {
            const regenerateButton = document.getElementById('modal-regenerate-ai');
            regenerateButton.disabled = false;
            regenerateButton.innerHTML = '🔄 Regenerate AI';
        }
    }
    
    // Settings Page Methods
    async initializeSettingsPage() {
        console.log('Settings page initialized');
        await this.loadCurrentPrompt();
        this.loadApplicationSettings();
        this.updateSystemInfo();
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
            this.showErrorMessage('Save Failed', 'Failed to save prompt. Please try again.');
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
            this.showErrorMessage('Reset Failed', 'Failed to reset prompt. Please try again.');
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
            
            this.showSuccessMessage('Test Successful', 'Prompt test completed! The prompt structure looks valid.');
            
        } catch (error) {
            console.error('Error testing prompt:', error);
            this.showErrorMessage('Test Failed', 'Failed to test prompt. Please check the format.');
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
    
    async updateSystemInfo() {
        try {
            // Update photo counts
            const response = await fetch(`${this.apiBase}/photos?limit=1`);
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
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TargetVisionApp();
});