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

import { eventBus } from '../services/EventBus.js';

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
        
        // Image loading events
        eventBus.on('image:fallback:load', (data) => this.loadFallbackImage(data.photo, data.fullscreenImage, data.loadingDiv));
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
}

// Create and export singleton instance
const progressManager = new ProgressManager();
export default progressManager;