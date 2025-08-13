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

class FolderGrid {
    constructor() {
        this.currentItems = [];
        this.setupEventListeners();
        
        console.log('FolderGrid initialized');
    }

    setupEventListeners() {
        // Listen for folder/album display requests
        eventBus.on('folders:display-grid', (data) => {
            this.currentItems = data.items || [];
            this.displayFolderGrid();
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
                <!-- Folder Icon or Thumbnail -->
                <div class="flex justify-center mb-3">
                    ${thumbnailUrl ? `
                        <img src="${thumbnailUrl}" 
                             alt="${folder.name}" 
                             class="h-16 w-16 object-cover rounded-lg border border-gray-200"
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                        <svg class="h-16 w-16 text-blue-500" fill="currentColor" viewBox="0 0 20 20" style="display: none;">
                            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>
                        </svg>
                    ` : `
                        <svg class="h-16 w-16 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>
                        </svg>
                    `}
                </div>
                
                <!-- Folder Info -->
                <h3 class="text-sm font-medium text-gray-900 mb-1 truncate" title="${folder.name}">
                    ${folder.name}
                </h3>
                <p class="text-xs text-gray-500">
                    ${folder.has_children ? 'Folder' : 'Empty Folder'}
                </p>
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
        const thumbnailUrl = album.thumbnail_url || (album.highlight_image && album.highlight_image.thumbnail_url);
        
        card.innerHTML = `
            <div class="p-4 text-center">
                <!-- Album Icon or Thumbnail -->
                <div class="flex justify-center mb-3">
                    ${thumbnailUrl ? `
                        <img src="${thumbnailUrl}" 
                             alt="${album.name || album.title}" 
                             class="h-16 w-16 object-cover rounded-lg border border-gray-200"
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                        <svg class="h-16 w-16 text-green-500" fill="currentColor" viewBox="0 0 20 20" style="display: none;">
                            <path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"/>
                        </svg>
                    ` : `
                        <svg class="h-16 w-16 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"/>
                        </svg>
                    `}
                </div>
                
                <!-- Album Info -->
                <h3 class="text-sm font-medium text-gray-900 mb-1 truncate" title="${album.name || album.title}">
                    ${album.name || album.title}
                </h3>
                <div class="text-xs text-gray-500">
                    <p>${imageCount} photo${imageCount !== 1 ? 's' : ''}</p>
                    <p class="flex items-center justify-center mt-1">
                        ${isSynced ? `
                            <svg class="h-3 w-3 mr-1 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                            </svg>
                            Synced
                        ` : `
                            <svg class="h-3 w-3 mr-1 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-5a1 1 0 011-1h1a1 1 0 110 2H9a1 1 0 01-1-1zm1-9a1 1 0 011 1v6a1 1 0 11-2 0V5a1 1 0 011-1z" clip-rule="evenodd"/>
                            </svg>
                            Not synced
                        `}
                    </p>
                </div>
            </div>
        `;
        
        // Add click handler
        card.addEventListener('click', () => {
            this.selectAlbum(album);
        });
        
        return card;
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
}

// Create and export singleton instance
const folderGrid = new FolderGrid();
export default folderGrid;