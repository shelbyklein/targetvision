/**
 * InteractiveSelection Component
 * 
 * Provides an interactive slideshow mode for photo selection, similar to Tinder-style swiping
 * but with keyboard and button controls. Users can quickly approve or skip photos in a
 * full-screen interface with progress tracking and keyboard shortcuts.
 * 
 * Key Features:
 * - Full-screen slideshow interface
 * - Approve/skip photo selection
 * - Keyboard shortcuts (spacebar = approve, X = skip, arrows = navigate)
 * - Progress tracking and selection count
 * - Integration with existing PhotoGrid selection system
 * - Process selected photos directly from modal
 */

import eventBus from '../services/EventBus.js';

class InteractiveSelection {
    constructor() {
        this.currentPhotos = [];
        this.currentIndex = 0;
        this.selectedPhotos = new Set();
        this.isActive = false;
        this.keyboardHandler = null;
        
        this.setupEventListeners();
        console.log('InteractiveSelection initialized');
    }

    setupEventListeners() {
        // Listen for interactive selection mode requests
        eventBus.on('interactive:start', (data) => {
            this.startInteractiveMode(data.photos);
        });
        
        eventBus.on('interactive:stop', () => {
            this.stopInteractiveMode();
        });
        
        // Setup DOM event listeners
        this.setupDOMEventListeners();
    }

    setupDOMEventListeners() {
        // Modal controls
        document.getElementById('interactive-close').addEventListener('click', () => {
            this.stopInteractiveMode();
        });
        
        document.getElementById('interactive-exit').addEventListener('click', () => {
            this.stopInteractiveMode();
        });
        
        // Navigation controls
        document.getElementById('interactive-prev').addEventListener('click', () => {
            this.previousPhoto();
        });
        
        document.getElementById('interactive-next').addEventListener('click', () => {
            this.nextPhoto();
        });
        
        // Selection controls
        document.getElementById('interactive-approve').addEventListener('click', () => {
            this.approveCurrentPhoto();
        });
        
        document.getElementById('interactive-reject').addEventListener('click', () => {
            this.skipCurrentPhoto();
        });
        
        // Modal click-outside to close
        document.getElementById('interactive-selection-modal').addEventListener('click', (e) => {
            if (e.target.id === 'interactive-selection-modal') {
                this.stopInteractiveMode();
            }
        });
    }

    startInteractiveMode(photos) {
        // Accept all synced photos for selection (processing status is irrelevant)
        this.currentPhotos = photos.filter(photo => photo.is_synced);
        
        if (this.currentPhotos.length === 0) {
            eventBus.emit('toast:warning', {
                title: 'No Photos Available',
                message: 'No synced photos available for selection. Please sync the album first.'
            });
            return;
        }
        
        this.currentIndex = 0;
        this.selectedPhotos.clear();
        this.isActive = true;
        
        // Show modal
        const modal = document.getElementById('interactive-selection-modal');
        modal.classList.remove('hidden');
        
        // Setup keyboard handlers
        this.setupKeyboardHandlers();
        
        // Display first photo
        this.displayCurrentPhoto();
        
        // Update UI
        this.updateProgressDisplay();
        this.updateSelectionCount();
        this.updateNavigationButtons();
        this.updateSelectionIndicator();
        
        console.log(`🎯 Interactive selection started with ${this.currentPhotos.length} photos`);
    }

    stopInteractiveMode() {
        if (!this.isActive) return;
        
        this.isActive = false;
        
        // Hide modal
        const modal = document.getElementById('interactive-selection-modal');
        modal.classList.add('hidden');
        
        // Remove keyboard handlers
        if (this.keyboardHandler) {
            document.removeEventListener('keydown', this.keyboardHandler);
            this.keyboardHandler = null;
        }
        
        // Update PhotoGrid with selections
        this.syncSelectionsWithPhotoGrid();
        
        console.log(`🎯 Interactive selection stopped. Selected ${this.selectedPhotos.size} photos`);
        
        // Clear references
        this.currentPhotos = [];
        this.selectedPhotos.clear();
    }

    setupKeyboardHandlers() {
        this.keyboardHandler = (e) => {
            if (!this.isActive) return;
            
            switch (e.key) {
                case 'Escape':
                    this.stopInteractiveMode();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    this.previousPhoto();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.nextPhoto();
                    break;
                case ' ': // Spacebar
                    e.preventDefault();
                    this.approveCurrentPhoto();
                    break;
                case 'x':
                case 'X':
                    e.preventDefault();
                    this.skipCurrentPhoto();
                    break;
            }
        };
        
        document.addEventListener('keydown', this.keyboardHandler);
    }

    displayCurrentPhoto() {
        if (this.currentIndex >= this.currentPhotos.length) return;
        
        const photo = this.currentPhotos[this.currentIndex];
        const imageElement = document.getElementById('interactive-image');
        const loadingElement = document.getElementById('interactive-loading');
        
        // Show loading state
        loadingElement.classList.remove('hidden');
        imageElement.style.opacity = '0';
        
        // Use image_url if available, otherwise thumbnail_url
        const imageUrl = photo.image_url || photo.thumbnail_url;
        
        // Create new image to test loading
        const img = new Image();
        img.onload = () => {
            imageElement.src = imageUrl;
            imageElement.alt = photo.title || 'Photo';
            
            // Animate image in
            setTimeout(() => {
                loadingElement.classList.add('hidden');
                imageElement.style.opacity = '1';
            }, 100);
        };
        
        img.onerror = () => {
            // Fallback handling
            loadingElement.classList.add('hidden');
            imageElement.style.opacity = '1';
            console.warn('Failed to load image:', imageUrl);
        };
        
        img.src = imageUrl;
    }

    approveCurrentPhoto() {
        if (this.currentIndex >= this.currentPhotos.length) return;
        
        const photo = this.currentPhotos[this.currentIndex];
        const photoId = photo.smugmug_id || photo.image_key || photo.local_photo_id;
        
        // Add to selected photos
        this.selectedPhotos.add(photoId);
        
        // Show approval feedback animation
        this.showApprovalFeedback(() => {
            // Move to next photo after animation
            this.nextPhoto();
        });
        
        // Update selection count
        this.updateSelectionCount();
        
        console.log(`✅ Approved photo ${photoId}. Total selected: ${this.selectedPhotos.size}`);
    }

    skipCurrentPhoto() {
        if (this.currentIndex >= this.currentPhotos.length) return;
        
        const photo = this.currentPhotos[this.currentIndex];
        const photoId = photo.smugmug_id || photo.image_key || photo.local_photo_id;
        
        // Remove from selected photos if it was selected
        this.selectedPhotos.delete(photoId);
        
        // Show skip feedback animation
        this.showSkipFeedback(() => {
            // Move to next photo after animation
            this.nextPhoto();
        });
        
        // Update selection count
        this.updateSelectionCount();
        
        console.log(`⏭️ Skipped photo ${photoId}. Total selected: ${this.selectedPhotos.size}`);
    }

    nextPhoto() {
        if (this.currentIndex < this.currentPhotos.length - 1) {
            this.currentIndex++;
            this.displayCurrentPhoto();
            this.updateProgressDisplay();
            this.updateNavigationButtons();
            this.updateSelectionIndicator();
        } else {
            // Reached end - show completion message
            this.showCompletionMessage();
        }
    }

    previousPhoto() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.displayCurrentPhoto();
            this.updateProgressDisplay();
            this.updateNavigationButtons();
            this.updateSelectionIndicator();
        }
    }

    updateProgressDisplay() {
        const progressElement = document.getElementById('interactive-progress');
        const current = this.currentIndex + 1;
        const total = this.currentPhotos.length;
        progressElement.textContent = `${current} of ${total}`;
    }

    updateSelectionCount() {
        const countElement = document.getElementById('interactive-selected-count');
        countElement.textContent = `${this.selectedPhotos.size} selected`;
    }

    updateNavigationButtons() {
        const prevBtn = document.getElementById('interactive-prev');
        const nextBtn = document.getElementById('interactive-next');
        
        prevBtn.disabled = this.currentIndex === 0;
        nextBtn.disabled = this.currentIndex >= this.currentPhotos.length - 1;
    }

    updateSelectionIndicator() {
        const indicator = document.getElementById('interactive-selection-indicator');
        
        if (this.currentIndex >= this.currentPhotos.length) {
            indicator.classList.add('hidden');
            return;
        }
        
        const photo = this.currentPhotos[this.currentIndex];
        const photoId = photo.smugmug_id || photo.image_key || photo.local_photo_id;
        const isSelected = this.selectedPhotos.has(photoId);
        
        if (isSelected) {
            indicator.classList.remove('hidden');
        } else {
            indicator.classList.add('hidden');
        }
    }


    showCompletionMessage() {
        if (this.selectedPhotos.size > 0) {
            eventBus.emit('toast:success', {
                title: 'Selection Complete',
                message: `You've selected ${this.selectedPhotos.size} photos. Exit to return to the photo grid and process them.`
            });
        } else {
            eventBus.emit('toast:info', {
                title: 'Selection Complete',
                message: 'No photos were selected.'
            });
        }
    }


    syncSelectionsWithPhotoGrid() {
        // Clear current PhotoGrid selections
        eventBus.emit('photos:clear-selection');
        
        // Add our selections to PhotoGrid
        this.selectedPhotos.forEach(photoId => {
            eventBus.emit('photos:toggle-selection', { 
                photoId, 
                isSelected: true 
            });
        });
        
        console.log(`🔄 Synced ${this.selectedPhotos.size} selections with PhotoGrid`);
    }

    // Visual Feedback Methods
    showApprovalFeedback(callback) {
        const feedbackElement = document.getElementById('interactive-approved-feedback');
        const iconElement = feedbackElement.querySelector('div');
        
        // Show the feedback overlay
        feedbackElement.classList.remove('hidden');
        
        // Trigger scale animation
        requestAnimationFrame(() => {
            iconElement.style.transform = 'scale(1)';
        });
        
        // Quick flash - hide after brief moment
        setTimeout(() => {
            iconElement.style.transform = 'scale(0)';
            feedbackElement.classList.add('hidden');
            if (callback) callback();
        }, 150); // Quick 150ms flash
    }

    showSkipFeedback(callback) {
        const feedbackElement = document.getElementById('interactive-skipped-feedback');
        const iconElement = feedbackElement.querySelector('div');
        
        // Show the feedback overlay
        feedbackElement.classList.remove('hidden');
        
        // Trigger scale animation
        requestAnimationFrame(() => {
            iconElement.style.transform = 'scale(1)';
        });
        
        // Quick flash - hide after brief moment
        setTimeout(() => {
            iconElement.style.transform = 'scale(0)';
            feedbackElement.classList.add('hidden');
            if (callback) callback();
        }, 150); // Quick 150ms flash
    }

    // Public API methods
    getCurrentPhotos() {
        return [...this.currentPhotos];
    }

    getSelectedPhotos() {
        return Array.from(this.selectedPhotos);
    }

    getSelectionCount() {
        return this.selectedPhotos.size;
    }

    isInteractiveModeActive() {
        return this.isActive;
    }
}

// Create and export singleton instance
const interactiveSelection = new InteractiveSelection();
export default interactiveSelection;