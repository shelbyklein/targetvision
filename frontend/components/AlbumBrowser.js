import eventBus from '../services/EventBus.js';
import smugMugAPI from '../managers/SmugMugAPI.js';
import UIUtils from '../utils/UIUtils.js';

class AlbumBrowser {
    constructor() {
        this.smugmugAlbums = [];
        this.currentNodeUri = null;
        this.breadcrumbs = [];
        this.nodeHistory = [];
        this.currentAlbum = null; // Track currently selected album
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Listen for folder loading events from SmugMugAPI
        eventBus.on('smugmug:folder-loaded', (data) => {
            this.handleFolderLoaded(data);
        });

        eventBus.on('smugmug:folder-updated', (data) => {
            this.handleFolderLoaded(data);
        });

        // Listen for display requests
        eventBus.on('albums:display', () => {
            this.displayAlbums();
        });

        eventBus.on('folders:display', () => {
            this.displayFolderContents();
        });

        // Listen for album selection events to update breadcrumbs
        eventBus.on('app:album-selected', (data) => {
            this.handleAlbumSelected(data.album);
        });

        // Listen for individual album sync completion to update status without folder refresh
        eventBus.on('smugmug:album-sync-complete', (data) => {
            this.handleAlbumSyncComplete(data);
        });
    }

    handleFolderLoaded(data) {
        // Check if we're currently in album view using the app's view mode
        const wasInAlbumView = window.app && window.app.getCurrentViewMode() === 'album';
        
        this.currentNodeUri = data.nodeUri;
        this.breadcrumbs = data.breadcrumbs || [];
        this.smugmugAlbums = data.albums;
        
        // Clear current album when navigating to folder view
        this.currentAlbum = null;
        
        // Clear any selected album in app state to prevent photo grid display
        if (window.app) {
            window.app.currentAlbum = null;
        }
        
        // Always ensure photo grid is hidden when loading folder contents
        // This prevents the photo grid from remaining visible after album-to-folder navigation
        const photoGrid = document.getElementById('photo-grid');
        if (photoGrid) {
            photoGrid.classList.add('hidden');
        }
        
        // Clear photo selection and hide photo controls
        eventBus.emit('photos:clear-selection');
        const photoControls = document.getElementById('photo-controls');
        const albumActions = document.getElementById('album-actions');
        if (photoControls) photoControls.classList.add('hidden');
        if (albumActions) albumActions.classList.add('hidden');
        
        // If we were in album view and now loading folder contents,
        // we need to switch back to albums/folder view mode
        if (wasInAlbumView) {
            // Switching from album to folder view
            eventBus.emit('app:show-albums-view');
            // Note: displayFolderContents() will be called via the albums:display event
            return;
        }
        
        this.displayFolderContents();
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
            // Also emit empty state for right column
            eventBus.emit('folders:display-grid', { items: [] });
            return;
        }
        
        // Create hierarchical tree structure in left column
        this.createHierarchicalTree(this.smugmugAlbums, albumsList);
        
        // Also emit event to display folder/album cards in right column
        eventBus.emit('folders:display-grid', { items: this.smugmugAlbums });
    }

    createHierarchicalTree(items, container, level = 0) {
        const folders = items.filter(item => item.type === 'folder');
        const albums = items.filter(item => item.type === 'album');
        
        // Display folders first
        folders.forEach(folder => {
            const folderElement = this.createFolderTreeItem(folder, level);
            container.appendChild(folderElement);
            
            // If folder has children, create a container for them
            if (folder.has_children) {
                const childrenContainer = document.createElement('div');
                childrenContainer.className = 'ml-4 hidden'; // Initially hidden
                childrenContainer.setAttribute('data-folder-children', folder.node_id);
                container.appendChild(childrenContainer);
                
                // Load and display children if they exist in our current data
                const children = items.filter(item => 
                    item.parent_node_id === folder.node_id ||
                    (folder.children && folder.children.some(child => child.node_id === item.node_id))
                );
                
                if (children.length > 0) {
                    this.createHierarchicalTree(children, childrenContainer, 1);
                }
            }
        });
        
        // Display albums after folders
        albums.forEach(album => {
            const albumElement = this.createAlbumTreeItem(album, level);
            container.appendChild(albumElement);
        });
    }

    createFolderTreeItem(folder, level = 0) {
        const div = document.createElement('div');
        div.className = 'folder-tree-item';
        div.setAttribute('data-folder-id', folder.node_id);
        
        const hasChildren = folder.has_children;
        const paddingLeft = level * 20;
        
        div.innerHTML = `
            <div class="folder-item flex items-center p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100" 
                 style="padding-left: ${paddingLeft + 12}px">
                
                ${hasChildren ? `
                    <button class="folder-toggle mr-2 text-gray-400 hover:text-gray-600 transition-colors" 
                            aria-label="Toggle folder">
                        <svg class="h-4 w-4 transform transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                ` : '<div class="w-6 mr-2"></div>'}
                
                <div class="flex items-center flex-1">
                    <svg class="h-5 w-5 text-blue-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>
                    </svg>
                    
                    <div class="flex-1">
                        <h3 class="text-sm font-medium text-gray-900">${folder.name}</h3>
                        <p class="text-xs text-gray-500">
                            ${folder.has_children ? 'Folder' : 'Empty Folder'}
                        </p>
                    </div>
                </div>
            </div>
        `;
        
        // Add click handlers
        const folderItem = div.querySelector('.folder-item');
        
        // Single click to navigate to folder contents
        folderItem.addEventListener('click', (e) => {
            if (e.target.closest('.folder-toggle')) return; // Don't handle if toggle was clicked
            this.selectFolderItem(folder, div);
        });
        
        // Toggle dropdown for folders with children
        if (folder.has_children) {
            const folderToggle = div.querySelector('.folder-toggle');
            folderToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleFolderExpansion(folder, div, folderToggle);
            });
        }
        
        return div;
    }

    createAlbumTreeItem(album, level = 0) {
        const div = document.createElement('div');
        div.className = 'album-tree-item';
        div.setAttribute('data-album-id', album.album_key || album.node_id);
        
        const paddingLeft = level * 20;
        
        div.innerHTML = `
            <div class="album-item flex items-center p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100"
                 style="padding-left: ${paddingLeft + 12}px">
                
                <div class="w-6 mr-2"></div> <!-- Spacer for alignment with folders -->
                
                <div class="flex items-center flex-1">
                    <svg class="h-5 w-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"/>
                    </svg>
                    
                    <div class="flex-1">
                        <h3 class="text-sm font-medium text-gray-900">${album.name || album.title}</h3>
                        <p class="text-xs text-gray-500">
                            ${album.image_count || 0} photos
                            ${album.is_synced ? '• Synced' : '• Not synced'}
                        </p>
                    </div>
                </div>
            </div>
        `;
        
        // Add click handler
        const albumItem = div.querySelector('.album-item');
        albumItem.addEventListener('click', () => {
            this.selectAlbumFromTree(album, div);
        });
        
        return div;
    }

    selectFolderItem(folder, element) {
        // Remove selection from other items
        document.querySelectorAll('.folder-item, .album-item').forEach(item => {
            item.classList.remove('bg-blue-100', 'border-l-4', 'border-blue-500');
        });
        
        // Add selection to current item
        const folderItem = element.querySelector('.folder-item');
        folderItem.classList.add('bg-blue-100', 'border-l-4', 'border-blue-500');
        
        // Show loading state immediately for visual feedback
        eventBus.emit('progress:show-item-loading', { 
            itemId: folder.node_id, 
            itemType: 'folder-tree' 
        });
        
        // Navigate to folder contents instead of showing folder info
        this.navigateToFolder(folder, element);
    }
    
    selectAlbumFromTree(album, element) {
        // Remove selection from other items
        document.querySelectorAll('.folder-item, .album-item').forEach(item => {
            item.classList.remove('bg-blue-100', 'border-l-4', 'border-blue-500');
        });
        
        // Add selection to current item
        const albumItem = element.querySelector('.album-item');
        albumItem.classList.add('bg-blue-100', 'border-l-4', 'border-blue-500');
        
        // Show loading state for album selection
        eventBus.emit('progress:show-item-loading', { 
            itemId: album.album_key || album.node_id, 
            itemType: 'album-tree' 
        });
        
        // Emit event to select album (photos loading handled by DataManager)
        eventBus.emit('album:selected', { album });
    }

    async navigateToFolder(folder, element = null) {
        try {
            // Show loading state for folder grid
            eventBus.emit('folders:loading:show');
            
            // Add current location to history for back navigation
            this.nodeHistory.push({
                nodeUri: this.currentNodeUri,
                folderName: this.breadcrumbs.length > 0 ? this.breadcrumbs[this.breadcrumbs.length - 1].name : 'Root'
            });
            
            // Load the folder contents using the node URI
            await smugMugAPI.loadFolderContents(folder.node_uri);
            
            // Note: No need to manually trigger grid update here because:
            // 1. smugMugAPI.loadFolderContents() will emit 'smugmug:folder-loaded'
            // 2. This triggers handleFolderLoaded() which updates this.smugmugAlbums
            // 3. handleFolderLoaded() calls displayFolderContents() which emits 'folders:display-grid'
            // 4. FolderGrid listens for 'folders:display-grid' and updates accordingly
            
        } catch (error) {
            console.error('Error navigating to folder:', error);
            eventBus.emit('toast:error', {
                title: 'Navigation Error',
                message: `Failed to load folder: ${error.message}`
            });
        } finally {
            // Clear loading states
            eventBus.emit('folders:loading:hide');
            eventBus.emit('progress:hide-item-loading', { itemId: folder.node_id });
        }
    }
    
    updateBreadcrumbs() {
        const breadcrumbContainer = document.getElementById('breadcrumb-path');
        if (!breadcrumbContainer) return;
        
        // Clear existing breadcrumbs
        breadcrumbContainer.innerHTML = '';
        
        // Create Albums root breadcrumb (simple clickable)
        const rootButton = this.createBreadcrumbLink('SmugMug Albums', null, true);
        breadcrumbContainer.appendChild(rootButton);
        
        // Add breadcrumbs for each folder in the path (skip first one as it's the root)
        this.breadcrumbs.forEach((breadcrumb, index) => {
            // Skip the first breadcrumb as it's the root (already showing "SmugMug Albums")
            if (index === 0 && !breadcrumb.name) {
                return;
            }
            
            // Add separator
            const separator = document.createElement('span');
            separator.className = 'mx-2 text-gray-400';
            separator.textContent = '/';
            breadcrumbContainer.appendChild(separator);
            
            // Create simple clickable link for each breadcrumb
            // If we have a current album and this is the last breadcrumb, it's not the final one
            const isLast = index === this.breadcrumbs.length - 1 && !this.currentAlbum;
            const link = this.createBreadcrumbLink(
                breadcrumb.name || 'Folder',
                breadcrumb.node_uri,
                false,
                isLast
            );
            breadcrumbContainer.appendChild(link);
        });

        // Add album breadcrumb if we have a currently selected album
        if (this.currentAlbum) {
            // Add separator
            const separator = document.createElement('span');
            separator.className = 'mx-2 text-gray-400';
            separator.textContent = '/';
            breadcrumbContainer.appendChild(separator);
            
            // Create album breadcrumb (non-clickable as it's the current page)
            const albumLink = this.createBreadcrumbLink(
                this.currentAlbum.name || this.currentAlbum.title || 'Album',
                null,
                false,
                true // This is the last breadcrumb
            );
            breadcrumbContainer.appendChild(albumLink);
        }
    }
    
    createBreadcrumbLink(name, nodeUri, isRoot = false, isLast = false) {
        const button = document.createElement('button');
        button.className = isLast 
            ? 'text-gray-700 text-sm font-medium flex items-center' 
            : 'text-blue-600 hover:text-blue-800 text-sm flex items-center hover:bg-blue-50 rounded px-1 py-1 transition-colors';
        
        // Add folder icon for root
        const icon = isRoot ? `
            <svg class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2v0a2 2 0 002 2z"/>
            </svg>
        ` : '';
        
        button.innerHTML = `${icon}<span>${name}</span>`;
        
        // Add click handler for navigation (except for last breadcrumb)
        if (!isLast) {
            button.addEventListener('click', async () => {
                // Breadcrumb navigation - always navigating to a folder
                try {
                    // Immediately hide photo grid since breadcrumb navigation is always to folders
                    const photoGrid = document.getElementById('photo-grid');
                    if (photoGrid) {
                        photoGrid.classList.add('hidden');
                    }
                    
                    // Clear album state and hide photo-related UI elements
                    if (window.app) {
                        window.app.currentAlbum = null;
                    }
                    const photoControls = document.getElementById('photo-controls');
                    const albumActions = document.getElementById('album-actions');
                    if (photoControls) photoControls.classList.add('hidden');
                    if (albumActions) albumActions.classList.add('hidden');
                    
                    // Clear photo selection
                    eventBus.emit('photos:clear-selection');
                    
                    // Show loading states
                    eventBus.emit('folders:loading:show');
                    
                    // Use consistent navigation flow - let smugMugAPI handle the loading
                    // This will emit 'smugmug:folder-loaded' which triggers proper updates
                    await smugMugAPI.loadFolderContents(nodeUri);
                    
                } catch (error) {
                    console.error('Error loading folder contents:', error);
                    eventBus.emit('toast:error', {
                        title: 'Navigation Error',
                        message: `Failed to load folder: ${error.message}`
                    });
                } finally {
                    // Clear loading states
                    eventBus.emit('folders:loading:hide');
                }
            });
        }
        
        return button;
    }
    

    toggleFolderExpansion(folder, folderElement, toggleButton) {
        const childrenContainer = document.querySelector(`[data-folder-children="${folder.node_id}"]`);
        if (!childrenContainer) return;
        
        const isExpanded = !childrenContainer.classList.contains('hidden');
        const arrow = toggleButton.querySelector('svg');
        
        if (isExpanded) {
            // Collapse
            childrenContainer.classList.add('hidden');
            arrow.style.transform = 'rotate(0deg)';
        } else {
            // Expand
            childrenContainer.classList.remove('hidden');
            arrow.style.transform = 'rotate(90deg)';
        }
    }


    handleAlbumSelected(album) {
        // Store the currently selected album
        this.currentAlbum = album;
        
        // Update breadcrumbs to include the album name
        this.updateBreadcrumbs();
    }

    handleAlbumSyncComplete(data) {
        const { album, result, albumId } = data;
        
        console.log(`🔄 [ALBUM-BROWSER] Handling sync completion for album: ${album.name || albumId}`);
        
        // Update the album in our local cache
        const albumIndex = this.smugmugAlbums.findIndex(a => 
            (a.smugmug_id && a.smugmug_id === albumId) ||
            (a.album_key && a.album_key === albumId)
        );
        
        if (albumIndex !== -1) {
            // Update the album object with new sync status
            this.smugmugAlbums[albumIndex] = {
                ...this.smugmugAlbums[albumIndex],
                sync_status: 'synced',
                synced_photos: result.synced_photos,
                last_sync: new Date().toISOString()
            };
            
            console.log(`✅ [ALBUM-BROWSER] Updated album sync status in cache`);
        }
        
        // Update any visible album status indicators in the sidebar
        const albumElements = document.querySelectorAll(`[data-album-id="${albumId}"]`);
        albumElements.forEach(element => {
            const statusElement = element.querySelector('.album-sync-status');
            if (statusElement) {
                statusElement.innerHTML = `
                    <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M5 13l4 4L19 7'%3E%3C/path%3E%3C/svg%3E" class="w-4 h-4 text-green-600">
                    <span class="text-green-600">Synced</span>
                `;
                console.log(`✅ [ALBUM-BROWSER] Updated UI status indicator for album ${albumId}`);
            }
            
            // Update photo count if visible
            const photoCountElement = element.querySelector('.album-photo-count');
            if (photoCountElement && result.synced_photos) {
                const currentText = photoCountElement.textContent;
                if (currentText.includes('photos')) {
                    photoCountElement.textContent = `${result.synced_photos} photos`;
                    console.log(`✅ [ALBUM-BROWSER] Updated photo count to ${result.synced_photos}`);
                }
            }
        });
        
        // If this was the currently selected album, update the current album reference
        if (this.currentAlbum && 
            ((this.currentAlbum.smugmug_id && this.currentAlbum.smugmug_id === albumId) ||
             (this.currentAlbum.album_key && this.currentAlbum.album_key === albumId))) {
            this.currentAlbum = {
                ...this.currentAlbum,
                sync_status: 'synced',
                synced_photos: result.synced_photos,
                last_sync: new Date().toISOString()
            };
            console.log(`✅ [ALBUM-BROWSER] Updated current album reference`);
        }
        
        console.log(`🎉 [ALBUM-BROWSER] Album sync UI update complete - staying in album view`);
    }

    // Public API methods
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

    findFolder(nodeUri) {
        return this.smugmugAlbums.find(item => 
            item.type === 'folder' && item.node_uri === nodeUri
        );
    }

    getFolders() {
        return this.smugmugAlbums.filter(item => item.type === 'folder');
    }

    getAlbums() {
        return this.smugmugAlbums.filter(item => item.type === 'album');
    }
}

const albumBrowser = new AlbumBrowser();
export default albumBrowser;