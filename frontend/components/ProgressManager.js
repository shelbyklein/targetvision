/**
 * ProgressManager Component
 * 
 * Handles all loading states and progress indicators across the application.
 * Manages loading spinners, state transitions, and visual feedback for various operations.
 * 
 * Key Responsibilities:
 * - Album loading states
 * - Photo grid loading states  
 * - Search loading states
 * - Image fallback loading for lightbox
 * - UI state management during async operations
 */

import eventBus from '../services/EventBus.js';

class ProgressManager {
    constructor() {
        this.setupEventListeners();
        console.log('ProgressManager initialized');
    }

    setupEventListeners() {
        // Loading state events
        eventBus.on('albums:loading:show', () => this.showAlbumsLoading());
        eventBus.on('albums:loading:hide', () => this.hideAlbumsLoading());
        eventBus.on('photos:loading:show', () => this.showPhotosLoading());
        eventBus.on('photos:loading:hide', () => this.hidePhotosLoading());
        eventBus.on('search:loading:show', () => this.showSearchLoading());
        eventBus.on('search:loading:hide', () => this.hideSearchLoading());
        eventBus.on('folders:loading:show', () => this.showFoldersLoading());
        eventBus.on('folders:loading:hide', () => this.hideFoldersLoading());
        
        // Item loading events
        eventBus.on('progress:show-item-loading', (data) => this.showItemLoading(data.itemId, data.itemType));
        eventBus.on('progress:hide-item-loading', (data) => this.hideItemLoading(data.itemId));
        
        // Image loading events
        eventBus.on('image:fallback:load', (data) => this.loadFallbackImage(data.photo, data.fullscreenImage, data.loadingDiv));
        
        // Note: Batch loading events moved to PhotoGrid component for better separation of concerns
    }

    // Albums Loading States
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

    // Photos Loading States
    showPhotosLoading() {
        document.getElementById('loading-photos').classList.remove('hidden');
        
        // Clear existing photos immediately to avoid showing old photos during loading
        const photoGrid = document.getElementById('photo-grid');
        photoGrid.innerHTML = '';
        photoGrid.classList.add('hidden');
        
        document.getElementById('empty-photos').classList.add('hidden');
        document.getElementById('welcome-state').classList.add('hidden');
    }

    hidePhotosLoading() {
        document.getElementById('loading-photos').classList.add('hidden');
    }

    // Search Loading States
    showSearchLoading() {
        document.getElementById('search-welcome').classList.add('hidden');
        document.getElementById('search-results-grid').classList.add('hidden');
        document.getElementById('search-no-results').classList.add('hidden');
        document.getElementById('search-loading').classList.remove('hidden');
    }
    
    hideSearchLoading() {
        document.getElementById('search-loading').classList.add('hidden');
    }

    // Image Loading and Fallback
    loadFallbackImage(photo, fullscreenImage, loadingDiv) {
        const fallbackUrl = photo.image_url || photo.thumbnail_url;
        if (fallbackUrl) {
            fullscreenImage.src = fallbackUrl;
            
            // Animate fallback image in
            loadingDiv.style.opacity = '0';
            setTimeout(() => {
                fullscreenImage.style.opacity = '1';
                fullscreenImage.style.transform = 'scale(1)';
            }, 150);
        } else {
            loadingDiv.innerHTML = '<div class="text-center text-red-500 transform transition-all duration-300 ease-out">No image available</div>';
        }
    }

    // Folders Loading States
    showFoldersLoading() {
        const folderGrid = document.getElementById('folder-grid');
        if (folderGrid) {
            // Create overlay for folder grid
            const loadingOverlay = document.createElement('div');
            loadingOverlay.id = 'folder-grid-loading';
            loadingOverlay.className = 'absolute inset-0 bg-white bg-opacity-90 flex flex-col items-center justify-center z-10';
            loadingOverlay.innerHTML = `
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                <p class="text-gray-600 text-sm">Loading folders...</p>
            `;
            
            // Make sure parent has relative positioning
            if (folderGrid.style.position !== 'relative') {
                folderGrid.style.position = 'relative';
            }
            
            // Remove existing loading overlay if any
            const existingOverlay = document.getElementById('folder-grid-loading');
            if (existingOverlay) {
                existingOverlay.remove();
            }
            
            folderGrid.appendChild(loadingOverlay);
        }
    }

    hideFoldersLoading() {
        const loadingOverlay = document.getElementById('folder-grid-loading');
        if (loadingOverlay) {
            loadingOverlay.remove();
        }
    }

    // Item-specific loading states for navigation feedback
    showItemLoading(itemId, itemType = 'folder') {
        let selector;
        
        // Handle different item types
        if (itemType === 'folder-tree') {
            selector = `[data-folder-id="${itemId}"] .folder-item`;
        } else if (itemType === 'album-tree') {
            selector = `[data-album-id="${itemId}"] .album-item`;
        } else if (itemType === 'folder') {
            selector = `[data-folder-id="${itemId}"]`;
        } else if (itemType === 'album') {
            selector = `[data-album-id="${itemId}"]`;
        } else {
            selector = `[data-folder-id="${itemId}"], [data-album-id="${itemId}"]`;
        }
        
        const item = document.querySelector(selector);
        
        if (item) {
            // Remove any existing spinner for this item
            this.hideItemLoading(itemId);
            
            // Add loading spinner to the item
            const spinner = document.createElement('div');
            spinner.className = 'absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center z-10';
            spinner.innerHTML = '<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>';
            spinner.setAttribute('data-loading-spinner', itemId);
            
            // Make sure item has relative positioning
            if (getComputedStyle(item).position === 'static') {
                item.style.position = 'relative';
            }
            
            item.appendChild(spinner);
        }
    }

    hideItemLoading(itemId) {
        const spinner = document.querySelector(`[data-loading-spinner="${itemId}"]`);
        if (spinner) {
            spinner.remove();
        }
    }

    // Utility methods for common loading patterns
    showLoadingSpinner(containerId, message = 'Loading...') {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center p-8 text-gray-500">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                    <p>${message}</p>
                </div>
            `;
        }
    }

    hideLoadingSpinner(containerId) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = '';
        }
    }

    // Generic loading state management
    setLoadingState(elementId, isLoading, loadingContent = null) {
        const element = document.getElementById(elementId);
        if (!element) return;

        if (isLoading) {
            element.classList.remove('hidden');
            if (loadingContent) {
                element.innerHTML = loadingContent;
            }
        } else {
            element.classList.add('hidden');
        }
    }

    // Visual feedback for async operations
    showOperationFeedback(message, type = 'info', duration = 3000) {
        // This could integrate with ToastManager when it's extracted
        console.log(`[${type.toUpperCase()}] ${message}`);
        
        // For now, emit event that could be picked up by ToastManager
        eventBus.emit('feedback:show', {
            message,
            type,
            duration
        });
    }

    // Note: Batch loading methods moved to PhotoGrid component for better separation of concerns
    // ProgressManager now focuses only on AI processing progress, sync operations, and general app loading states
}

// Create and export singleton instance
const progressManager = new ProgressManager();
export default progressManager;