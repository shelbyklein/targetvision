/**
 * CollectionsManager Component
 * 
 * Handles all collection functionality across the application including collection CRUD operations,
 * photo-collection associations, collection display and management.
 * 
 * Key Responsibilities:
 * - Collection creation, editing, and deletion
 * - Collection listing and rendering
 * - Photo-collection associations and management
 * - Collection photo display and grid rendering
 * - Modal-based collection operations from photo modal
 * - Collection page initialization and management
 */

import eventBus from '../services/EventBus.js';
import apiService from '../services/APIService.js';

class CollectionsManager {
    constructor() {
        this.collections = [];
        this.currentCollection = null;
        this.currentCollectionPhotos = [];
        this.currentPhoto = null; // For modal operations
        this.apiBase = 'http://localhost:8000';
        this.domListenersBound = false; // Prevent double-binding DOM listeners
        this.modalListenersBound = false; // Prevent double-binding modal listeners
        
        this.setupEventListeners();
        
        // Bind DOM event listeners immediately (for direct page loads)
        this.ensureDOMEventListeners();
        
        // Load collections initially for modal functionality
        this.loadCollections();
        
        // Component initialized
    }

    ensureDOMEventListeners() {
        // Bind DOM event listeners immediately if DOM is ready, otherwise wait
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.bindCollectionEventListeners());
        } else {
            // DOM is already loaded, bind immediately
            this.bindCollectionEventListeners();
        }
    }

    setupEventListeners() {
        // Collections page events
        eventBus.on('collections:initialize-page', () => this.initializeCollectionsPage());
        eventBus.on('collections:load', () => this.loadCollections());
        eventBus.on('collections:select', (data) => this.selectCollection(data.collectionId));
        eventBus.on('collections:refresh', () => this.loadCollections());
        
        // Collection CRUD events
        eventBus.on('collections:create', (data) => this.handleCreateCollection(data.event));
        eventBus.on('collections:edit', (data) => this.handleEditCollection(data.event));
        eventBus.on('collections:delete', () => this.handleDeleteCollection());
        
        // Collection modal events
        eventBus.on('collections:show-create-modal', () => this.showCreateCollectionModal());
        eventBus.on('collections:hide-create-modal', () => this.hideCreateCollectionModal());
        eventBus.on('collections:show-edit-modal', () => this.showEditCollectionModal());
        eventBus.on('collections:hide-edit-modal', () => this.hideEditCollectionModal());
        
        // Photo-collection association events (from photo modal)
        eventBus.on('collections:load-for-photo', (data) => this.loadPhotoCollections(data.photo));
        eventBus.on('collections:add-photo', () => this.addPhotoToCollection());
        eventBus.on('collections:remove-photo', (data) => this.removePhotoFromCollection(data.collectionId));
        eventBus.on('collections:show-interface', () => this.showCollectionInterface());
        eventBus.on('collections:hide-interface', () => this.hideCollectionInterface());
        eventBus.on('collections:create-from-modal', () => this.createCollectionFromModal());
        
        // Set current photo for modal operations
        eventBus.on('photo:set-current', (data) => {
            this.currentPhoto = data.photo;
        });

        // Listen for collection creation to refresh displays
        eventBus.on('collections:created', (data) => {
            this.handleCollectionCreated(data);
        });
        
        // Listen for requests to refresh modal dropdown
        eventBus.on('collections:refresh-modal-dropdown', () => {
            console.log('Received request to refresh modal dropdown');
            // Add a small delay to ensure any modal state changes have processed
            setTimeout(() => {
                this.populateCollectionSelect();
            }, 50);
        });
    }

    // Collections Page Management
    async initializeCollectionsPage() {
        console.log('Initializing collections page...');
        
        // Bind collection event listeners
        this.bindCollectionEventListeners();
        
        // Load collections
        await this.loadCollections();
        
        // Clear current selection
        this.currentCollection = null;
        this.currentCollectionPhotos = [];
        this.showCollectionPlaceholder();
    }

    bindCollectionEventListeners() {
        // Prevent double-binding
        if (this.domListenersBound) return;
        
        // Create collection button
        const createBtn = document.getElementById('create-collection');
        if (createBtn) {
            createBtn.addEventListener('click', () => this.showCreateCollectionModal());
        }

        // Collection action buttons (these exist on page load)
        const editBtn = document.getElementById('edit-collection');
        const deleteBtn = document.getElementById('delete-collection');

        if (editBtn) editBtn.addEventListener('click', () => this.showEditCollectionModal());
        if (deleteBtn) deleteBtn.addEventListener('click', () => this.handleDeleteCollection());
        
        // Mark DOM listeners as bound
        this.domListenersBound = true;
    }

    bindModalEventListeners() {
        // Prevent double-binding modal listeners
        if (this.modalListenersBound) return;

        // Create collection modal events
        const createForm = document.getElementById('create-collection-form');
        const createCloseBtn = document.getElementById('create-collection-close');
        const createCancelBtn = document.getElementById('create-collection-cancel');

        if (createCloseBtn) createCloseBtn.addEventListener('click', () => this.hideCreateCollectionModal());
        if (createCancelBtn) createCancelBtn.addEventListener('click', () => this.hideCreateCollectionModal());
        if (createForm) createForm.addEventListener('submit', (e) => this.handleCreateCollection(e));

        // Edit collection modal events
        const editModal = document.getElementById('edit-collection-modal');
        const editForm = document.getElementById('edit-collection-form');
        const editCloseBtn = document.getElementById('edit-collection-close');
        const editCancelBtn = document.getElementById('edit-collection-cancel');

        if (editCloseBtn) editCloseBtn.addEventListener('click', () => this.hideEditCollectionModal());
        if (editCancelBtn) editCancelBtn.addEventListener('click', () => this.hideEditCollectionModal());
        if (editForm) editForm.addEventListener('submit', (e) => this.handleEditCollection(e));
        
        // Mark modal listeners as bound
        this.modalListenersBound = true;
    }

    // Collection Loading and Rendering
    async loadCollections() {
        try {
            const response = await fetch(`${this.apiBase}/collections`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            this.collections = await response.json();
            this.renderCollectionsList();
            
        } catch (error) {
            console.error('Error loading collections:', error);
            eventBus.emit('toast:error', { title: 'Error', message: 'Failed to load collections' });
        }
    }

    renderCollectionsList() {
        const collectionsList = document.getElementById('collections-list');
        const collectionCount = document.getElementById('collection-count');
        const loadingEl = document.getElementById('loading-collections');

        if (!collectionsList) return;

        // Hide loading indicator
        if (loadingEl) loadingEl.style.display = 'none';

        // Update count
        if (collectionCount) {
            collectionCount.textContent = this.collections.length;
        }

        if (this.collections.length === 0) {
            collectionsList.innerHTML = `
                <div class="p-4 text-center text-gray-500">
                    <svg class="h-12 w-12 mx-auto mb-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                    </svg>
                    <p class="text-sm text-gray-600 mb-3">No collections yet</p>
                    <p class="text-xs text-gray-500">Create your first collection to get started</p>
                </div>
            `;
            return;
        }

        // Render collections
        const collectionsHtml = this.collections.map(collection => {
            const coverImageUrl = collection.cover_photo?.thumbnail_url || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMCA0MEgyNEwyOCAzNkgzNkMzNy4xIDM2IDM4IDM1LjEgMzggMzRWMjJDMzggMjAuOSAzNy4xIDIwIDM2IDIwSDI0QzIyLjkgMjAgMjIgMjAuOSAyMiAyMlYzNEgyMFY0MFoiIGZpbGw9IiM5Q0EzQUYiLz4KPC9zdmc+';

            return `
                <div class="collection-item p-3 border-b border-gray-200 hover:bg-gray-100 cursor-pointer transition-colors" 
                     data-collection-id="${collection.id}"
                     onclick="eventBus.emit('collections:select', {collectionId: ${collection.id}})">
                    <div class="flex items-center space-x-3">
                        <div class="w-12 h-12 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                            <img src="${coverImageUrl}" alt="${collection.name}" 
                                 class="w-full h-full object-cover" 
                                 onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMCA0MEgyNEwyOCAzNkgzNkMzNy4xIDM2IDM4IDM1LjEgMzggMzRWMjJDMzggMjAuOSAzNy4xIDIwIDM2IDIwSDI0QzIyLjkgMjAgMjIgMjAuOSAyMiAyMlYzNEgyMFY0MFoiIGZpbGw9IiM5Q0EzQUYiLz4KPC9zdmc+'">
                        </div>
                        <div class="flex-1 min-w-0">
                            <h3 class="text-sm font-medium text-gray-900 truncate">${collection.name}</h3>
                            <p class="text-xs text-gray-500 mt-1">${collection.photo_count} photos</p>
                            ${collection.description ? `<p class="text-xs text-gray-400 truncate mt-1">${collection.description}</p>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        collectionsList.innerHTML = collectionsHtml;
    }

    async selectCollection(collectionId) {
        try {
            const response = await fetch(`${this.apiBase}/collections/${collectionId}?include_photos=true`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            this.currentCollection = await response.json();
            this.currentCollectionPhotos = this.currentCollection.photos || [];
            
            // Update UI
            this.updateCollectionHeader();
            this.renderCollectionPhotos();
            
            // Update active state in sidebar
            document.querySelectorAll('.collection-item').forEach(item => {
                item.classList.remove('bg-blue-50', 'border-blue-200');
            });
            
            const selectedItem = document.querySelector(`[data-collection-id="${collectionId}"]`);
            if (selectedItem) {
                selectedItem.classList.add('bg-blue-50', 'border-blue-200');
            }
            
        } catch (error) {
            console.error('Error selecting collection:', error);
            eventBus.emit('toast:error', { title: 'Error', message: 'Failed to load collection' });
        }
    }

    updateCollectionHeader() {
        const titleEl = document.getElementById('current-collection-title');
        const statsEl = document.getElementById('collection-stats');
        const photoCountEl = document.getElementById('collection-photo-count');
        const createdEl = document.getElementById('collection-created');
        const actionsEl = document.getElementById('collection-actions');

        if (this.currentCollection) {
            if (titleEl) titleEl.textContent = this.currentCollection.name;
            
            if (photoCountEl) {
                photoCountEl.textContent = `${this.currentCollection.photo_count} photos`;
            }
            
            if (createdEl && this.currentCollection.created_at) {
                const createdDate = new Date(this.currentCollection.created_at);
                createdEl.textContent = `Created ${createdDate.toLocaleDateString()}`;
            }
            
            if (statsEl) statsEl.classList.remove('hidden');
            if (actionsEl) actionsEl.classList.remove('hidden');
        } else {
            this.showCollectionPlaceholder();
        }
    }

    showCollectionPlaceholder() {
        const titleEl = document.getElementById('current-collection-title');
        const statsEl = document.getElementById('collection-stats');
        const actionsEl = document.getElementById('collection-actions');
        const photosGrid = document.getElementById('collection-photos-grid');
        const placeholder = document.getElementById('collection-photos-placeholder');

        if (titleEl) titleEl.textContent = 'Select a collection';
        if (statsEl) statsEl.classList.add('hidden');
        if (actionsEl) actionsEl.classList.add('hidden');
        if (photosGrid) photosGrid.classList.add('hidden');
        if (placeholder) placeholder.classList.remove('hidden');
    }

    renderCollectionPhotos() {
        const photosGrid = document.getElementById('collection-photos-grid');
        const placeholder = document.getElementById('collection-photos-placeholder');

        if (!photosGrid) return;

        if (!this.currentCollectionPhotos || this.currentCollectionPhotos.length === 0) {
            photosGrid.classList.add('hidden');
            if (placeholder) placeholder.classList.remove('hidden');
            return;
        }

        photosGrid.classList.remove('hidden');
        if (placeholder) placeholder.classList.add('hidden');

        const photosHtml = this.currentCollectionPhotos.map(photo => `
            <div class="photo-thumbnail group relative bg-gray-100 aspect-square rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                 onclick="eventBus.emit('photo:show-modal', {photo: ${JSON.stringify(photo).replace(/"/g, '&quot;')}})">
                <img src="${photo.thumbnail_url}" 
                     alt="${photo.title || 'Photo'}" 
                     class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                     onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y0ZjRmNCIvPjx0ZXh0IHg9IjEwMCIgeT0iMTAwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM2NjYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuNGVtIj5JbWFnZSBOb3QgRm91bmQ8L3RleHQ+PC9zdmc+'" />
                
                ${this.currentCollection.cover_photo_id === photo.id ? `
                    <div class="absolute top-2 left-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded">
                        Cover
                    </div>
                ` : ''}
                
                <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                    <div class="opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                        </svg>
                    </div>
                </div>
            </div>
        `).join('');

        photosGrid.innerHTML = photosHtml;
    }

    // Collection Modal Management
    showCreateCollectionModal() {
        const modal = document.getElementById('create-collection-modal');
        const nameInput = document.getElementById('collection-name');
        const descInput = document.getElementById('collection-description');
        
        if (modal) {
            modal.classList.remove('hidden');
            if (nameInput) {
                nameInput.value = '';
                nameInput.focus();
            }
            if (descInput) descInput.value = '';
            
            // Bind modal event listeners when modal is shown
            this.bindModalEventListeners();
        }
    }

    hideCreateCollectionModal() {
        const modal = document.getElementById('create-collection-modal');
        if (modal) modal.classList.add('hidden');
    }

    async handleCreateCollection(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const name = formData.get('name');
        const description = formData.get('description');

        try {
            const params = new URLSearchParams();
            params.append('name', name);
            if (description) params.append('description', description);

            const response = await fetch(`${this.apiBase}/collections?${params}`, {
                method: 'POST'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to create collection');
            }

            const result = await response.json();
            
            // Hide modal and reload collections
            this.hideCreateCollectionModal();
            await this.loadCollections();
            
            // Emit event to refresh collections display in other components
            eventBus.emit('collections:created', { 
                collection: result,
                message: `Collection "${name}" created successfully` 
            });
            
            // Update the collection dropdown in photo modal if it exists
            // Add a small delay to ensure modal events have processed
            setTimeout(() => {
                this.populateCollectionSelect();
            }, 100);
            
            eventBus.emit('toast:success', { title: 'Success', message: `Collection "${name}" created successfully` });

        } catch (error) {
            console.error('Error creating collection:', error);
            eventBus.emit('toast:error', { title: 'Error', message: error.message });
        }
    }

    showEditCollectionModal() {
        if (!this.currentCollection) return;

        const modal = document.getElementById('edit-collection-modal');
        const nameInput = document.getElementById('edit-collection-name');
        const descInput = document.getElementById('edit-collection-description');
        
        if (modal) {
            modal.classList.remove('hidden');
            if (nameInput) {
                nameInput.value = this.currentCollection.name;
                nameInput.focus();
            }
            if (descInput) {
                descInput.value = this.currentCollection.description || '';
            }
        }
    }

    hideEditCollectionModal() {
        const modal = document.getElementById('edit-collection-modal');
        if (modal) modal.classList.add('hidden');
    }

    async handleEditCollection(e) {
        e.preventDefault();
        if (!this.currentCollection) return;
        
        const formData = new FormData(e.target);
        const name = formData.get('name');
        const description = formData.get('description');

        try {
            const params = new URLSearchParams();
            params.append('name', name);
            params.append('description', description || '');

            const response = await fetch(`${this.apiBase}/collections/${this.currentCollection.id}?${params}`, {
                method: 'PUT'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to update collection');
            }

            const result = await response.json();
            
            // Update current collection and reload
            this.currentCollection = result.collection;
            this.hideEditCollectionModal();
            await this.loadCollections();
            this.updateCollectionHeader();
            
            eventBus.emit('toast:success', { title: 'Success', message: 'Collection updated successfully' });

        } catch (error) {
            console.error('Error updating collection:', error);
            eventBus.emit('toast:error', { title: 'Error', message: error.message });
        }
    }

    async handleDeleteCollection() {
        if (!this.currentCollection) return;

        const confirmed = confirm(`Are you sure you want to delete the collection "${this.currentCollection.name}"? This action cannot be undone.`);
        if (!confirmed) return;

        try {
            const response = await fetch(`${this.apiBase}/collections/${this.currentCollection.id}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to delete collection');
            }

            // Clear current selection and reload
            this.currentCollection = null;
            this.currentCollectionPhotos = [];
            this.showCollectionPlaceholder();
            await this.loadCollections();
            
            eventBus.emit('toast:success', { title: 'Success', message: 'Collection deleted successfully' });

        } catch (error) {
            console.error('Error deleting collection:', error);
            eventBus.emit('toast:error', { title: 'Error', message: error.message });
        }
    }

    // Photo-Collection Association Methods (for photo modal)
    async loadPhotoCollections(photo) {
        try {
            // Store current photo for modal operations
            this.currentPhoto = photo;
            
            // Load all collections to populate the dropdown
            await this.loadCollections();
            
            // First, ensure this photo exists in our local database
            const localPhoto = await this.ensurePhotoInDatabase(photo);
            
            if (!localPhoto || !localPhoto.id) {
                console.error('Could not get local photo ID for:', photo);
                this.renderPhotoCollections([]);
                this.populateCollectionSelect();
                return;
            }
            
            console.log('Loading collections for local photo ID:', localPhoto.id);
            
            // Get collections this photo is in using the local photo ID
            const response = await fetch(`${this.apiBase}/photos/${localPhoto.id}/collections`);
            if (response.ok) {
                const data = await response.json();
                this.renderPhotoCollections(data || []);
                this.populateCollectionSelect();
            } else {
                console.error('Failed to load photo collections:', response.status, response.statusText);
                this.renderPhotoCollections([]);
                this.populateCollectionSelect();
            }
        } catch (error) {
            console.error('Error loading photo collections:', error);
            this.renderPhotoCollections([]);
            this.populateCollectionSelect();
        }
    }
    
    // Ensure a photo exists in our local database and return the local photo object
    async ensurePhotoInDatabase(photo) {
        try {
            // If photo already has a local ID, return it
            if (photo.id) {
                return photo;
            }
            
            // Try to find the photo in local database by SmugMug ID
            const smugmugId = photo.ImageKey || photo.smugmug_id;
            if (!smugmugId) {
                console.error('No SmugMug ID found for photo:', photo);
                return null;
            }
            
            // Query local database for this photo
            const response = await fetch(`${this.apiBase}/photos?smugmug_id=${smugmugId}`);
            if (response.ok) {
                const data = await response.json();
                if (data.length > 0) {
                    // Found existing photo in local database
                    return data[0];
                }
            }
            
            // Photo doesn't exist locally, we need to sync it first
            console.log('Photo not found in local database, syncing from SmugMug:', smugmugId);
            
            // For now, return null - we could implement auto-sync here if needed
            return null;
            
        } catch (error) {
            console.error('Error ensuring photo in database:', error);
            return null;
        }
    }
    
    renderPhotoCollections(collections) {
        const collectionsList = document.getElementById('modal-collections-list');
        
        if (collections.length === 0) {
            collectionsList.innerHTML = '<span class="text-sm text-gray-500 italic">No collections</span>';
            return;
        }
        
        collectionsList.innerHTML = collections.map(collection => `
            <div class="flex items-center bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs">
                <span>${collection.name}</span>
                <button onclick="eventBus.emit('collections:remove-photo', {collectionId: ${collection.id}})" class="ml-1 text-purple-600 hover:text-purple-800">
                    <svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                    </svg>
                </button>
            </div>
        `).join('');
    }
    
    populateCollectionSelect() {
        const select = document.getElementById('modal-collection-select');
        if (!select) {
            console.log('Collection dropdown not found - modal may not be open');
            return;
        }
        
        console.log('Populating collection dropdown with', this.collections.length, 'collections');
        
        select.innerHTML = '<option value="">Choose a collection...</option>';
        
        this.collections.forEach(collection => {
            const option = document.createElement('option');
            option.value = collection.id;
            option.textContent = collection.name;
            select.appendChild(option);
        });
        
        console.log('Collection dropdown populated successfully');
    }
    
    showCollectionInterface() {
        const interfaceEl = document.getElementById('modal-collection-interface');
        if (interfaceEl) interfaceEl.classList.remove('hidden');
    }
    
    hideCollectionInterface() {
        const interfaceEl = document.getElementById('modal-collection-interface');
        const select = document.getElementById('modal-collection-select');
        
        if (interfaceEl) interfaceEl.classList.add('hidden');
        if (select) select.value = '';
    }
    
    async addPhotoToCollection() {
        const collectionId = document.getElementById('modal-collection-select')?.value;
        if (!collectionId) {
            eventBus.emit('toast:error', { title: 'Error', message: 'Please select a collection' });
            return;
        }
        
        if (!this.currentPhoto) {
            eventBus.emit('toast:error', { title: 'Error', message: 'No photo selected' });
            return;
        }
        
        // First, ensure this photo exists in our local database
        const localPhoto = await this.ensurePhotoInDatabase(this.currentPhoto);
        
        if (!localPhoto || !localPhoto.id) {
            eventBus.emit('toast:error', { title: 'Error', message: 'Photo must be synced to database before adding to collections' });
            console.error('Could not get local photo ID for:', this.currentPhoto);
            return;
        }
        
        try {
            console.log('Adding photo to collection:', {collectionId, photoId: localPhoto.id, photo: localPhoto});
            
            const response = await fetch(`${this.apiBase}/collections/${collectionId}/photos`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    photo_ids: [localPhoto.id]
                })
            });
            
            if (response.ok) {
                eventBus.emit('toast:success', { title: 'Success', message: 'Photo added to collection successfully' });
                this.hideCollectionInterface();
                await this.loadPhotoCollections(this.currentPhoto);
            } else {
                console.error('Server response:', response.status, response.statusText);
                const errorText = await response.text();
                console.error('Server error text:', errorText);
                eventBus.emit('toast:error', { title: 'Error', message: 'Failed to add photo to collection' });
            }
        } catch (error) {
            console.error('Error adding photo to collection:', error);
            eventBus.emit('toast:error', { title: 'Error', message: 'Failed to add photo to collection' });
        }
    }
    
    async removePhotoFromCollection(collectionId) {
        if (!this.currentPhoto) {
            eventBus.emit('toast:error', { title: 'Error', message: 'No photo selected' });
            return;
        }
        
        // First, ensure this photo exists in our local database
        const localPhoto = await this.ensurePhotoInDatabase(this.currentPhoto);
        
        if (!localPhoto || !localPhoto.id) {
            eventBus.emit('toast:error', { title: 'Error', message: 'Photo not found in database' });
            console.error('Could not get local photo ID for:', this.currentPhoto);
            return;
        }
        
        try {
            console.log('Removing photo from collection:', {collectionId, photoId: localPhoto.id, photo: localPhoto});
            
            const response = await fetch(`${this.apiBase}/collections/${collectionId}/photos/${localPhoto.id}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                eventBus.emit('toast:success', { title: 'Success', message: 'Photo removed from collection' });
                await this.loadPhotoCollections(this.currentPhoto);
            } else {
                console.error('Server response:', response.status, response.statusText);
                const errorText = await response.text();
                console.error('Server error text:', errorText);
                eventBus.emit('toast:error', { title: 'Error', message: 'Failed to remove photo from collection' });
            }
        } catch (error) {
            console.error('Error removing photo from collection:', error);
            eventBus.emit('toast:error', { title: 'Error', message: 'Failed to remove photo from collection' });
        }
    }
    
    createCollectionFromModal() {
        // Show the collection creation modal instead of using a prompt dialog
        this.showCreateCollectionModal();
    }

    handleCollectionCreated(data) {
        // Refresh the collections list display if we're on the collections page
        const collectionsGrid = document.getElementById('collections-grid');
        if (collectionsGrid && !collectionsGrid.classList.contains('hidden')) {
            // We're on the collections page, refresh the display
            this.renderCollections();
        }
        
        // Also refresh modal dropdown to ensure new collection appears
        setTimeout(() => {
            this.populateCollectionSelect();
        }, 150);
        
        // Log the event for debugging
        console.log('Collection created:', data.collection);
    }

    // Utility methods for accessing collections data
    getCollections() {
        return this.collections;
    }

    getCurrentCollection() {
        return this.currentCollection;
    }

    getCurrentCollectionPhotos() {
        return this.currentCollectionPhotos;
    }
}

// Create and export singleton instance
const collectionsManager = new CollectionsManager();
export default collectionsManager;