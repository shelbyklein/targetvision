import eventBus from '../services/EventBus.js';
import smugMugAPI from '../managers/SmugMugAPI.js';
import UIUtils from '../utils/UIUtils.js';

class AlbumBrowser {
    constructor() {
        this.smugmugAlbums = [];
        this.currentNodeUri = null;
        this.breadcrumbs = [];
        this.nodeHistory = [];
        
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
    }

    handleFolderLoaded(data) {
        this.currentNodeUri = data.nodeUri;
        this.breadcrumbs = data.breadcrumbs || [];
        this.smugmugAlbums = data.albums;
        
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
            
            // Update right panel to show folder contents
            this.displayFolderContentsInRightPanel(folder);
            
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
        
        // Add breadcrumbs for each folder in the path (simple clickable)
        this.breadcrumbs.forEach((breadcrumb, index) => {
            // Add separator
            const separator = document.createElement('span');
            separator.className = 'mx-2 text-gray-400';
            separator.textContent = '/';
            breadcrumbContainer.appendChild(separator);
            
            // Create simple clickable link for each breadcrumb
            const isLast = index === this.breadcrumbs.length - 1;
            const link = this.createBreadcrumbLink(
                breadcrumb.name || 'Folder',
                breadcrumb.node_uri,
                false,
                isLast
            );
            breadcrumbContainer.appendChild(link);
        });
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
            button.addEventListener('click', () => {
                console.log('Breadcrumb clicked:', { name, nodeUri, isRoot });
                try {
                    smugMugAPI.loadFolderContents(nodeUri);
                } catch (error) {
                    console.error('Error loading folder contents:', error);
                    eventBus.emit('toast:error', {
                        title: 'Navigation Error',
                        message: `Failed to load folder: ${error.message}`
                    });
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

    displayFolderContentsInRightPanel(folder) {
        // This method updates the right panel to show the folder's contents
        // Since the folder contents have already been loaded and are in this.smugmugAlbums,
        // we should trigger the grid display with the current folder contents
        eventBus.emit('folders:display-grid', { items: this.smugmugAlbums });
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