/**
 * FolderGrid Component
 * 
 * Displays folders and albums in a card-based grid layout in the right column.
 * Similar to PhotoGrid but for browsing folder/album structure.
 * 
 * Key Responsibilities:
 * - Display folder and album cards in grid layout
 * - Handle folder/album selection from grid
 * - Visual differentiation between folders and albums
 * - Responsive grid layout
 */

import eventBus from '../services/EventBus.js';
import UIUtils from '../utils/UIUtils.js';
import apiService from '../services/APIService.js';

class FolderGrid {
    constructor() {
        this.currentItems = [];
        this.navigationFrozen = false;
        this.setupEventListeners();
        
        // FolderGrid initialized
    }

    setupEventListeners() {
        // Listen for folder/album display requests
        eventBus.on('folders:display-grid', (data) => {
            this.currentItems = data.items || [];
            this.displayFolderGrid();
        });

        // Note: Removed duplicate smugmug:folder-loaded listener
        // The AlbumBrowser handles this event and emits folders:display-grid
        // This prevents duplicate calls to displayFolderGrid()

        // Listen for navigation freeze/unfreeze events
        eventBus.on('ui:freeze-navigation', (data) => {
            this.freezeNavigation(data.reason);
        });

        eventBus.on('ui:unfreeze-navigation', () => {
            this.unfreezeNavigation();
        });

        // Listen for photo processing events to update album statistics
        eventBus.on('photos:processing-complete', (data) => {
            this.updateAlbumProcessingStats(data);
        });

        eventBus.on('photos:batch-complete', (data) => {
            this.updateAlbumProcessingStats(data);
        });

        // Listen for album sync completion to refresh statistics
        eventBus.on('smugmug:album-sync-complete', (data) => {
            this.refreshAlbumStats(data.albumId);
        });
    }

    displayFolderGrid() {
        // Hide all other right column states
        this.hideAllStates();
        
        const folderGrid = document.getElementById('folder-grid');
        if (!folderGrid) {
            console.error('Folder grid element not found');
            return;
        }
        
        folderGrid.classList.remove('hidden');
        folderGrid.innerHTML = '';
        
        if (this.currentItems.length === 0) {
            folderGrid.innerHTML = `
                <div class="col-span-full flex flex-col items-center justify-center h-64 text-gray-500">
                    <svg class="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2v0a2 2 0 002 2z"/>
                    </svg>
                    <h3 class="text-lg font-medium text-gray-900 mb-2">No Folders or Albums</h3>
                    <p class="text-center">This location appears to be empty.</p>
                </div>
            `;
            return;
        }
        
        // Update album title to show browse mode
        document.getElementById('current-album-title').textContent = 'Browse Folders & Albums';
        
        // Hide photo-specific controls
        document.getElementById('photo-controls').classList.add('hidden');
        document.getElementById('album-actions').classList.add('hidden');
        document.getElementById('album-stats').classList.add('hidden');
        
        // Separate folders and albums
        const folders = this.currentItems.filter(item => item.type === 'folder');
        const albums = this.currentItems.filter(item => item.type === 'album');
        
        // Display folders first
        folders.forEach(folder => {
            const folderCard = this.createFolderCard(folder);
            folderGrid.appendChild(folderCard);
        });
        
        // Then display albums
        albums.forEach(album => {
            const albumCard = this.createAlbumCard(album);
            folderGrid.appendChild(albumCard);
        });
    }
    
    createFolderCard(folder) {
        const card = document.createElement('div');
        card.className = 'folder-card bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow cursor-pointer';
        card.setAttribute('data-folder-id', folder.node_id);
        
        // Get thumbnail URL from highlight image if available
        const thumbnailUrl = folder.highlight_image && folder.highlight_image.thumbnail_url;
        
        card.innerHTML = `
            <div class="p-4 text-center">
                <!-- Folder Thumbnail Container - 1:1 aspect ratio -->
                <div class="aspect-square w-full bg-gray-100 rounded-lg overflow-hidden relative mb-3 mx-auto">
                    ${thumbnailUrl ? `
                        <img src="${thumbnailUrl}" 
                             alt="${folder.name}" 
                             class="w-full h-full object-cover"
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <div class="absolute inset-0 flex items-center justify-center bg-gray-100" style="display: none;">
                            <svg class="h-8 w-8 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>
                            </svg>
                        </div>
                    ` : `
                        <div class="w-full h-full flex items-center justify-center">
                            <svg class="h-8 w-8 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>
                            </svg>
                        </div>
                    `}
                </div>
                
                <!-- Folder Info - Below thumbnail -->
                <div class="text-center">
                    <h3 class="text-sm font-medium text-gray-900 mb-1 truncate" title="${folder.name}">
                        ${folder.name}
                    </h3>
                    <p class="text-xs text-gray-500">
                        ${folder.has_children ? 'Folder' : 'Empty Folder'}
                    </p>
                </div>
            </div>
        `;
        
        // Add click handler
        card.addEventListener('click', () => {
            this.selectFolder(folder);
        });
        
        return card;
    }
    
    createAlbumCard(album) {
        const card = document.createElement('div');
        card.className = 'album-card bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow cursor-pointer';
        card.setAttribute('data-album-id', album.album_key || album.node_id);
        
        const imageCount = album.image_count || 0;
        const isSynced = album.is_synced;
        
        // Get thumbnail URL from different possible locations
        let thumbnailUrl = album.thumbnail_url || (album.highlight_image && album.highlight_image.thumbnail_url);
        
        // If no thumbnail URL and it's not synced, we'll try to fetch it from the API
        const needsThumbnailFetch = !thumbnailUrl && !isSynced && (album.album_key || album.smugmug_id);
        
        card.innerHTML = `
            <div class="p-4 text-center">
                <!-- Album Thumbnail Container - 1:1 aspect ratio -->
                <div class="aspect-square w-full bg-gray-100 rounded-lg overflow-hidden relative mb-3 mx-auto" data-thumbnail-container>
                    ${thumbnailUrl ? `
                        <img src="${thumbnailUrl}" 
                             alt="${album.name || album.title}" 
                             class="w-full h-full object-cover"
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <div class="absolute inset-0 flex items-center justify-center bg-gray-100" style="display: none;">
                            <svg class="h-8 w-8 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"/>
                            </svg>
                        </div>
                    ` : needsThumbnailFetch ? `
                        <div class="w-full h-full flex items-center justify-center" data-loading-thumbnail>
                            <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500"></div>
                        </div>
                    ` : `
                        <div class="w-full h-full flex items-center justify-center">
                            <svg class="h-8 w-8 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"/>
                            </svg>
                        </div>
                    `}
                </div>
                
                <!-- Album Info - Below thumbnail -->
                <div class="text-center">
                    <h3 class="text-sm font-medium text-gray-900 mb-2 truncate" title="${album.name || album.title}">
                        ${album.name || album.title}
                    </h3>
                    <div class="text-xs text-gray-500">
                        <p class="mb-1">${imageCount} photo${imageCount !== 1 ? 's' : ''}</p>
                        <div class="flex items-center justify-center mb-2">
                            ${isSynced ? `
                                <svg class="h-3 w-3 text-green-500" fill="currentColor" viewBox="0 0 20 20" title="Synced">
                                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                                </svg>
                            ` : `
                                <svg class="h-3 w-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20" title="Not synced">
                                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16z" clip-rule="evenodd"/>
                                </svg>
                            `}
                        </div>
                        
                        ${isSynced ? this.renderProcessingStats(album) : ''}
                    </div>
                </div>
            </div>
        `;
        
        // Add click handler
        card.addEventListener('click', () => {
            this.selectAlbum(album);
        });
        
        // Fetch thumbnail if needed
        if (needsThumbnailFetch) {
            this.fetchAlbumThumbnail(album, card);
        }
        
        return card;
    }
    
    async fetchAlbumThumbnail(album, cardElement) {
        const albumKey = album.album_key || album.smugmug_id;
        if (!albumKey) return;
        
        try {
            const thumbnailContainer = cardElement.querySelector('[data-thumbnail-container]');
            if (!thumbnailContainer) return;
            
            // Fetch thumbnail from API
            const response = await apiService.get(`/smugmug/album/${albumKey}/thumbnail`);
            
            if (response && response.thumbnail_url) {
                // Replace loading spinner with actual image
                thumbnailContainer.innerHTML = `
                    <img src="${response.thumbnail_url}" 
                         alt="${album.name || album.title}" 
                         class="w-full h-full object-cover"
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div class="absolute inset-0 flex items-center justify-center bg-gray-100" style="display: none;">
                        <svg class="h-8 w-8 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"/>
                        </svg>
                    </div>
                `;
            } else {
                // Fallback to album icon if no thumbnail available
                thumbnailContainer.innerHTML = `
                    <div class="w-full h-full flex items-center justify-center">
                        <svg class="h-8 w-8 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"/>
                        </svg>
                    </div>
                `;
            }
        } catch (error) {
            // Only log non-404 errors to reduce console spam
            if (error.status !== 404) {
                console.warn('Failed to fetch album thumbnail:', error);
            }
            
            // Fallback to album icon on error
            const thumbnailContainer = cardElement.querySelector('[data-thumbnail-container]');
            if (thumbnailContainer) {
                thumbnailContainer.innerHTML = `
                    <div class="w-full h-full flex items-center justify-center">
                        <svg class="h-8 w-8 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"/>
                        </svg>
                    </div>
                `;
            }
        }
    }
    
    renderProcessingStats(album) {
        // Extract processing statistics
        const totalPhotos = album.synced_photo_count || 0;
        const processedPhotos = album.ai_processed_count || 0;
        const processingProgress = album.processing_progress || 0;
        
        // Don't show stats if no photos are synced
        if (totalPhotos === 0) {
            return '';
        }
        
        // Determine progress bar color based on completion percentage
        let progressBarColor = '';
        if (processingProgress === 100) {
            progressBarColor = 'bg-green-500'; // Green for 100%
        } else if (processingProgress > 0) {
            progressBarColor = 'bg-blue-500'; // Blue for 1-99%
        } else {
            progressBarColor = 'bg-gray-400'; // Gray for 0%
        }
        
        return `
            <div class="processing-stats mt-2 w-full">
                <!-- Progress Bar -->
                <div class="progress-bar w-full h-1 bg-gray-200 rounded-full mb-1">
                    <div class="progress-fill h-full ${progressBarColor} rounded-full transition-all duration-300" 
                         style="width: ${processingProgress}%"></div>
                </div>
                
                <!-- Stats Text -->
                <div class="stats-text text-xs">
                    <span class="text-gray-600">${processedPhotos}/${totalPhotos} processed</span>
                    <span class="text-gray-500 ml-1">(${Math.round(processingProgress)}%)</span>
                </div>
            </div>
        `;
    }
    
    selectFolder(folder) {
        console.log('Folder selected from grid:', folder.name);
        
        // Add visual feedback
        this.highlightCard('folder', folder.node_id);
        
        // Show loading indicator on clicked folder card
        eventBus.emit('progress:show-item-loading', { 
            itemId: folder.node_id, 
            itemType: 'folder' 
        });
        
        // Show folder grid loading overlay
        eventBus.emit('folders:loading:show');
        
        // Emit event to navigate to folder (this will update left sidebar and right column)
        eventBus.emit('folder:navigate', { folder });
    }
    
    selectAlbum(album) {
        // Check if navigation is frozen
        if (this.navigationFrozen) {
            eventBus.emit('toast:warning', { 
                title: 'Navigation Blocked', 
                message: 'Please wait for current operation to complete' 
            });
            return;
        }

        console.log('Album selected from grid:', album.name || album.title);
        
        // Add visual feedback
        this.highlightCard('album', album.album_key || album.node_id);
        
        // Show loading indicator on clicked album card
        eventBus.emit('progress:show-item-loading', { 
            itemId: album.album_key || album.node_id, 
            itemType: 'album' 
        });
        
        // Emit event to select album (this will show photos, loading handled by DataManager)
        eventBus.emit('album:selected', { album });
    }
    
    highlightCard(type, id) {
        // Remove highlight from all cards
        document.querySelectorAll('.folder-card, .album-card').forEach(card => {
            card.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-50');
        });
        
        // Add highlight to selected card
        const selector = type === 'folder' ? 
            `[data-folder-id="${id}"]` : 
            `[data-album-id="${id}"]`;
        const selectedCard = document.querySelector(selector);
        if (selectedCard) {
            selectedCard.classList.add('ring-2', 'ring-blue-500', 'bg-blue-50');
        }
    }
    
    hideAllStates() {
        // Hide all other right column states
        document.getElementById('welcome-state').classList.add('hidden');
        document.getElementById('loading-photos').classList.add('hidden');
        document.getElementById('photo-grid').classList.add('hidden');
        document.getElementById('empty-photos').classList.add('hidden');
        // Note: don't hide folder-grid here since this method is called by folder-grid itself
    }
    
    // Public API methods
    getCurrentItems() {
        return [...this.currentItems];
    }

    // Navigation Freeze/Unfreeze Methods
    freezeNavigation(reason = 'Operation in progress...') {
        this.navigationFrozen = true;
        
        // Add visual indicators to show navigation is frozen
        const folderCards = document.querySelectorAll('.folder-card, .album-card');
        folderCards.forEach(card => {
            card.classList.add('opacity-50', 'cursor-not-allowed');
            card.setAttribute('data-frozen', 'true');
        });

        // Show loading overlay on grid
        const folderGrid = document.getElementById('folder-grid');
        if (folderGrid) {
            const existingOverlay = folderGrid.querySelector('.navigation-frozen-overlay');
            if (!existingOverlay) {
                const overlay = document.createElement('div');
                overlay.className = 'navigation-frozen-overlay absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10';
                overlay.innerHTML = `
                    <div class="text-center">
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                        <div class="text-sm text-gray-600">${reason}</div>
                    </div>
                `;
                // Make sure the parent has relative positioning
                if (folderGrid.style.position !== 'relative') {
                    folderGrid.style.position = 'relative';
                }
                folderGrid.appendChild(overlay);
            }
        }
    }

    unfreezeNavigation() {
        this.navigationFrozen = false;
        
        // Remove visual indicators
        const frozenCards = document.querySelectorAll('[data-frozen="true"]');
        frozenCards.forEach(card => {
            card.classList.remove('opacity-50', 'cursor-not-allowed');
            card.removeAttribute('data-frozen');
        });

        // Remove loading overlay
        const overlay = document.querySelector('.navigation-frozen-overlay');
        if (overlay) {
            overlay.remove();
        }
    }

    updateAlbumProcessingStats(data) {
        // Update album statistics when photos are processed
        if (!data.albumId) return;

        // Find the album card in the current display
        const albumCard = document.querySelector(`[data-album-id="${data.albumId}"]`);
        if (!albumCard) return;

        // Find the corresponding album in currentItems
        const album = this.currentItems.find(item => 
            item.type === 'album' && 
            (item.album_key === data.albumId || 
             item.local_album_id === data.albumId || 
             item.smugmug_id === data.albumId)
        );
        
        if (!album) return;

        // Update album data with new processing stats
        if (data.updatedStats) {
            album.ai_processed_count = data.updatedStats.ai_processed_count || album.ai_processed_count;
            album.processed_count = data.updatedStats.processed_count || album.processed_count;
            album.processing_progress = data.updatedStats.processing_progress || album.processing_progress;
        } else {
            // Increment processed count for single photo processing
            album.ai_processed_count = (album.ai_processed_count || 0) + 1;
            album.processed_count = (album.processed_count || 0) + 1;
            const totalPhotos = album.synced_photo_count || 1;
            album.processing_progress = Math.round((album.ai_processed_count / totalPhotos) * 100);
        }

        // Re-render the processing stats for this album card
        this.updateAlbumCardStats(albumCard, album);
    }

    updateAlbumCardStats(albumCard, album) {
        // Find the processing stats container in the album card
        const statsContainer = albumCard.querySelector('.processing-stats');
        if (!statsContainer) return;

        // Generate new processing stats HTML
        const newStatsHTML = this.renderProcessingStats(album);
        
        // Update the stats container
        if (newStatsHTML) {
            statsContainer.outerHTML = newStatsHTML;
        } else {
            statsContainer.remove();
        }
    }

    async refreshAlbumStats(albumId) {
        // Refresh album statistics from the backend after sync
        try {
            // Find the album card
            const albumCard = document.querySelector(`[data-album-id="${albumId}"]`);
            if (!albumCard) return;

            // Find the album in currentItems
            const albumIndex = this.currentItems.findIndex(item => 
                item.type === 'album' && 
                (item.album_key === albumId || 
                 item.local_album_id === albumId || 
                 item.smugmug_id === albumId)
            );
            
            if (albumIndex === -1) return;

            // Fetch fresh album data from the API
            const response = await apiService.get(`/albums/${albumId}`);
            if (response) {
                // Update the album data in currentItems
                Object.assign(this.currentItems[albumIndex], {
                    synced_photo_count: response.actual_photo_count,
                    processed_count: response.processed_count,
                    ai_processed_count: response.ai_processed_count,
                    processing_progress: response.processing_progress,
                    is_synced: true
                });

                // Update the visual display
                this.updateAlbumCardStats(albumCard, this.currentItems[albumIndex]);
            }
        } catch (error) {
            console.warn('Failed to refresh album stats:', error);
        }
    }
}

// Create and export singleton instance
const folderGrid = new FolderGrid();
export default folderGrid;