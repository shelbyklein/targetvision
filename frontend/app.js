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
        
        this.initializeApp();
    }

    async initializeApp() {
        this.bindEventListeners();
        await this.checkConnectionStatus();
        await this.checkAuthentication();
        await this.loadSmugMugAlbums();
    }

    bindEventListeners() {
        // Navigation
        document.getElementById('nav-albums').addEventListener('click', () => this.showPage('albums'));
        document.getElementById('nav-chat').addEventListener('click', () => this.showPage('chat'));
        document.getElementById('nav-search').addEventListener('click', () => this.showPage('search'));
        
        // Album selection
        document.getElementById('breadcrumb-albums').addEventListener('click', () => this.showAlbumsView());
        
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
        
        // Modal functionality
        document.getElementById('modal-close').addEventListener('click', () => this.closeModal());
        document.getElementById('photo-modal').addEventListener('click', (e) => {
            if (e.target.id === 'photo-modal') this.closeModal();
        });
        document.getElementById('modal-process-button').addEventListener('click', () => this.processPhotoWithAI());
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
        this.showAlbumsLoading();
        
        try {
            const response = await fetch(`${this.apiBase}/smugmug/albums`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            this.smugmugAlbums = await response.json();
            this.displayAlbums();
            this.hideAlbumsLoading();
            
        } catch (error) {
            console.error('Failed to load SmugMug albums:', error);
            this.showErrorMessage('Failed to Load Albums', 'Could not fetch albums from SmugMug. Please check your connection and try again.', error.message);
            this.hideAlbumsLoading();
        }
    }

    displayAlbums() {
        const albumsList = document.getElementById('albums-list');
        const albumCount = document.getElementById('album-count');
        
        // Clear loading state
        const loading = document.getElementById('loading-albums');
        if (loading) loading.remove();
        
        albumCount.textContent = this.smugmugAlbums.length.toString();
        
        albumsList.innerHTML = '';
        
        if (this.smugmugAlbums.length === 0) {
            albumsList.innerHTML = `
                <div class="p-4 text-center text-gray-500">
                    <p class="text-sm">No albums found</p>
                </div>
            `;
            return;
        }
        
        this.smugmugAlbums.forEach(album => {
            const albumElement = this.createAlbumListItem(album);
            albumsList.appendChild(albumElement);
        });
    }

    createAlbumListItem(album) {
        const div = document.createElement('div');
        div.className = `album-item p-3 border-b border-gray-200 hover:bg-white cursor-pointer transition-colors ${
            this.currentAlbum && this.currentAlbum.smugmug_id === album.smugmug_id ? 'bg-blue-50 border-blue-200' : ''
        }`;
        
        const syncStatus = album.is_synced ? 'synced' : 'not-synced';
        const syncIcon = album.is_synced ? '✓' : '○';
        const syncColor = album.is_synced ? 'text-green-600' : 'text-gray-400';
        
        // Processing statistics
        const processed = album.ai_processed_count || 0;
        const total = album.image_count || 0;
        const processedPercent = total > 0 ? Math.round((processed / total) * 100) : 0;
        
        div.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <div class="flex items-center flex-1 min-w-0">
                    <svg class="h-4 w-4 text-blue-600 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>
                    </svg>
                    <span class="text-sm font-medium text-gray-900 truncate">${album.title}</span>
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

    async selectAlbum(album) {
        this.currentAlbum = album;
        
        // Update UI
        this.updateAlbumSelection();
        this.showPhotosView();
        await this.loadAlbumPhotos(album.smugmug_id);
    }

    updateAlbumSelection() {
        // Update sidebar selection
        document.querySelectorAll('.album-item').forEach(item => {
            item.classList.remove('bg-blue-50', 'border-blue-200');
        });
        
        // Find and highlight current album
        const albumItems = document.querySelectorAll('.album-item');
        albumItems.forEach(item => {
            const title = item.querySelector('span.font-medium').textContent;
            if (title === this.currentAlbum.title) {
                item.classList.add('bg-blue-50', 'border-blue-200');
            }
        });
        
        // Update breadcrumb
        document.getElementById('breadcrumb-arrow').classList.remove('hidden');
        document.getElementById('breadcrumb-current').classList.remove('hidden');
        document.getElementById('breadcrumb-current').textContent = this.currentAlbum.title;
        
        // Update photo panel header
        document.getElementById('current-album-title').textContent = this.currentAlbum.title;
        document.getElementById('album-stats').classList.remove('hidden');
        document.getElementById('album-actions').classList.remove('hidden');
        
        // Update sync button based on sync status
        const syncButton = document.getElementById('sync-album');
        if (this.currentAlbum.is_synced) {
            syncButton.textContent = 'Re-sync Album';
            syncButton.className = 'text-sm px-3 py-1 bg-orange-600 text-white rounded hover:bg-orange-700';
        } else {
            syncButton.textContent = 'Sync Album';
            syncButton.className = 'text-sm px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700';
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
        div.className = 'photo-card relative group cursor-pointer';
        
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
                <div class="absolute top-2 right-2 ${statusInfo.color} text-white text-xs px-2 py-1 rounded-full flex items-center">
                    <span class="mr-1">${statusInfo.icon}</span>
                    <span class="hidden sm:inline">${statusInfo.text}</span>
                </div>
                
                <!-- Selection checkbox (only for synced photos) -->
                ${photo.is_synced ? `
                    <div class="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <input type="checkbox" 
                               class="photo-checkbox w-4 h-4 text-blue-600 bg-white border-2 border-gray-300 rounded focus:ring-blue-500" 
                               data-photo-id="${photo.smugmug_id}"
                               onclick="event.stopPropagation()">
                    </div>
                ` : ''}
                
                <!-- Hover overlay -->
                <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
                    <div class="opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                        </svg>
                    </div>
                </div>
            </div>
            
            <!-- Photo info -->
            <div class="mt-2">
                <p class="text-xs text-gray-600 truncate">${photo.filename || photo.title || 'Untitled'}</p>
                <p class="text-xs text-gray-400">${photo.width}×${photo.height}</p>
            </div>
        `;
        
        // Add click handler
        div.addEventListener('click', (e) => {
            if (e.target.type === 'checkbox') return;
            this.showPhotoModal(photo);
        });
        
        // Add checkbox handler
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
            const response = await fetch(`${this.apiBase}/smugmug/albums/${this.currentAlbum.smugmug_id}/sync`, {
                method: 'POST'
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const result = await response.json();
            
            // Reload albums and photos
            await this.loadSmugMugAlbums();
            await this.loadAlbumPhotos(this.currentAlbum.smugmug_id);
            
            // Update current album reference
            this.currentAlbum = this.smugmugAlbums.find(a => a.smugmug_id === this.currentAlbum.smugmug_id);
            this.updateAlbumSelection();
            
            this.showSuccessMessage('Album Synced', `Successfully synced ${result.synced_photos} photos from "${result.album_name}"`);
            
        } catch (error) {
            console.error('Album sync failed:', error);
            this.showErrorMessage('Sync Failed', 'Could not sync album with local database.', error.message);
        } finally {
            button.textContent = originalText;
            button.disabled = false;
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
            await this.loadAlbumPhotos(this.currentAlbum.smugmug_id);
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
    showAlbumsView() {
        this.currentAlbum = null;
        this.clearSelection();
        
        // Hide breadcrumb elements
        document.getElementById('breadcrumb-arrow').classList.add('hidden');
        document.getElementById('breadcrumb-current').classList.add('hidden');
        
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
            await this.loadAlbumPhotos(this.currentAlbum.smugmug_id);
        }
    }

    // Utility Methods
    showSuccessMessage(title, message) {
        // Could implement toast notification here
        alert(`${title}: ${message}`);
    }

    showErrorMessage(title, message, details = null) {
        console.error(`${title}: ${message}`, details);
        // Could implement proper error toast here
        alert(`${title}: ${message}`);
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
        }
    }
    
    initializeChatPage() {
        // Chat page is ready by default with welcome message
        console.log('Chat page initialized');
    }
    
    initializeSearchPage() {
        // Search page is ready by default with welcome state
        console.log('Search page initialized');
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
            // Call chat API (placeholder for now)
            this.addChatMessage('system', 'Chat functionality is not yet implemented. This will connect to your photo search and AI analysis system.');
            
        } catch (error) {
            console.error('Chat error:', error);
            this.addChatMessage('system', 'Sorry, there was an error processing your message.');
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
            const response = await fetch(`${this.apiBase}/search?q=${encodeURIComponent(query)}&search_type=${searchType}&limit=50`);
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
                <div class="absolute top-2 right-2 bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                    ${Math.round(score * 100)}%
                </div>
                
                <!-- Hover overlay -->
                <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
                    <div class="opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                        </svg>
                    </div>
                </div>
            </div>
            
            <!-- Photo info -->
            <div class="mt-2">
                <p class="text-xs text-gray-600 truncate">${photo.title || 'Untitled'}</p>
                <p class="text-xs text-gray-400">${photo.album_name || ''}</p>
            </div>
        `;
        
        div.addEventListener('click', () => this.showPhotoModal(photo));
        
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
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TargetVisionApp();
});