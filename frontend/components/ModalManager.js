/**
 * ModalManager Component
 * 
 * Handles all modal functionality across the application including photo modals,
 * collection modals, full-screen lightbox, and metadata editing.
 * 
 * Key Responsibilities:
 * - Photo modal display and management
 * - Full-screen lightbox functionality
 * - Collection creation/edit modals
 * - Metadata editing and AI processing
 * - Modal animations and keyboard handling
 */

import eventBus from '../services/EventBus.js';
import apiService from '../services/APIService.js';

class ModalManager {
    constructor() {
        this.currentPhoto = null;
        this.setupEventListeners();
        this.setupModalEventHandlers();
        // Component initialized
    }

    setupEventListeners() {
        // Photo modal events
        eventBus.on('photo:show-modal', (data) => this.showPhotoModal(data.photo, data.showCollections));
        eventBus.on('modal:close', () => this.closeModal());
        eventBus.on('lightbox:open', (data) => this.openFullScreenLightbox(data.photo));
        eventBus.on('lightbox:close', () => this.closeFullScreenLightbox());
        
        // Collection modal events
        eventBus.on('collection:create-modal:show', () => this.showCreateCollectionModal());
        eventBus.on('collection:create-modal:hide', () => this.hideCreateCollectionModal());
        eventBus.on('collection:edit-modal:show', () => this.showEditCollectionModal());
        eventBus.on('collection:edit-modal:hide', () => this.hideEditCollectionModal());
        
        // Metadata editing events
        eventBus.on('metadata:edit:toggle', () => this.toggleMetadataEdit());
        eventBus.on('metadata:edit:save', () => this.saveMetadataChanges());
        eventBus.on('metadata:edit:cancel', () => this.cancelMetadataEdit());
        eventBus.on('metadata:ai:regenerate', () => this.regenerateAIMetadata());
        eventBus.on('metadata:ai:delete', () => this.deleteAIMetadata());
        
        // Additional modal events
        eventBus.on('modal:process-photo', () => this.processPhotoWithAI());
        
        // Collection update events
        eventBus.on('collections:created', () => this.refreshCollectionDropdown());
        eventBus.on('collections:updated', () => this.refreshCollectionDropdown());
        eventBus.on('collections:deleted', () => this.refreshCollectionDropdown());
    }

    setupModalEventHandlers() {
        // Photo modal handlers
        document.getElementById('modal-close').addEventListener('click', () => this.closeModal());
        document.getElementById('photo-modal').addEventListener('click', (e) => {
            if (e.target.id === 'photo-modal') this.closeModal();
        });
        document.getElementById('modal-process-button').addEventListener('click', () => this.processPhotoWithAI());
        
        // Metadata editing handlers
        document.getElementById('modal-edit-toggle').addEventListener('click', () => this.toggleMetadataEdit());
        document.getElementById('modal-save-metadata').addEventListener('click', () => this.saveMetadataChanges());
        document.getElementById('modal-cancel-edit').addEventListener('click', () => this.cancelMetadataEdit());
        document.getElementById('modal-regenerate-ai').addEventListener('click', () => this.regenerateAIMetadata());
        document.getElementById('modal-delete-ai').addEventListener('click', () => this.deleteAIMetadata());
        
        
        // Collection handlers
        document.getElementById('modal-add-to-collection').addEventListener('click', () => this.showCollectionInterface());
        document.getElementById('modal-add-collection-confirm').addEventListener('click', () => this.addPhotoToCollection());
        document.getElementById('modal-add-collection-cancel').addEventListener('click', () => this.hideCollectionInterface());
        document.getElementById('modal-create-collection').addEventListener('click', () => this.createCollectionFromModal());
    }

    // Photo Modal Management
    async showPhotoModal(photo, showCollections = false) {
        console.log('Show modal for photo:', photo, 'showCollections:', showCollections);
        
        // Fetch complete photo data including embeddings from API
        let completePhoto = photo;
        if (photo.id || photo.local_photo_id) {
            try {
                const photoId = photo.id || photo.local_photo_id;
                completePhoto = await apiService.get(`/photos/${photoId}?include_embedding=true`);
                console.log('Fetched complete photo data with embeddings:', completePhoto);
            } catch (error) {
                console.warn('Error fetching complete photo data:', error);
                // Use provided photo data as fallback
            }
        }
        
        // Store current photo for editing functions
        this.currentPhoto = completePhoto;
        
        // Populate modal with photo data
        this.populateModalData(completePhoto, photo);
        
        // Load collections for this photo
        await this.loadPhotoCollections(completePhoto);
        
        // Show modal with animation
        this.showModalWithAnimation();
        
        // Auto-show collections interface if requested
        if (showCollections) {
            setTimeout(() => this.showCollectionInterface(), 100);
        }
    }

    populateModalData(completePhoto, photo) {
        const modal = document.getElementById('photo-modal');
        const modalImage = document.getElementById('modal-image');
        const modalDownload = document.getElementById('modal-download');
        const modalDimensions = document.getElementById('modal-dimensions');
        const modalAlbum = document.getElementById('modal-album');
        const modalAiSection = document.getElementById('modal-ai-section');
        const modalNoAi = document.getElementById('modal-no-ai');
        const modalAiDescription = document.getElementById('modal-ai-description');
        const modalAiKeywords = document.getElementById('modal-ai-keywords');
        const modalAiTimestamp = document.getElementById('modal-ai-timestamp');
        
        // Set initial image - use image_url if available, otherwise thumbnail_url
        const initialImageUrl = photo.image_url || photo.thumbnail_url;
        modalImage.src = initialImageUrl;
        modalImage.alt = photo.title || 'Photo';
        
        // Set initial download link
        modalDownload.href = initialImageUrl;
        modalDownload.download = photo.title || 'photo';
        
        // Add click handler to ensure download dialog opens
        modalDownload.addEventListener('click', (e) => {
            e.preventDefault();
            this.downloadImage(modalDownload.href, modalDownload.download);
        });
        
        // Add click handler to modal image to open full-screen lightbox
        modalImage.style.cursor = 'pointer';
        modalImage.title = 'Click to view full-screen';
        
        // Add click handler to open full-screen lightbox
        modalImage.addEventListener('click', () => {
            this.openFullScreenLightbox(photo);
        });
        
        // Load largest image for download
        this.loadLargestImageForDownload(photo, modalDownload);
        
        // Populate basic photo information
        modalDimensions.textContent = `${completePhoto.width || 0} × ${completePhoto.height || 0} pixels`;
        modalAlbum.textContent = `Album: ${completePhoto.album_name || 'Unknown Album'}`;
        
        // Populate AI metadata section
        this.populateAIMetadata(completePhoto);
        
        // Populate embedding information
        this.populateEmbeddingInfo(completePhoto);
    }

    populateAIMetadata(completePhoto) {
        const modalAiSection = document.getElementById('modal-ai-section');
        const modalNoAi = document.getElementById('modal-no-ai');
        const modalAiDescription = document.getElementById('modal-ai-description');
        const modalAiKeywords = document.getElementById('modal-ai-keywords');
        const modalAiTimestamp = document.getElementById('modal-ai-timestamp');
        
        // Check if there's AI metadata (it's an object, not an array)
        if (completePhoto.ai_metadata && typeof completePhoto.ai_metadata === 'object') {
            const aiData = completePhoto.ai_metadata; // Use the AI metadata object directly
            
            modalAiSection.classList.remove('hidden');
            modalNoAi.classList.add('hidden');
            
            // Populate AI description
            if (aiData.description) {
                modalAiDescription.textContent = aiData.description;
            } else {
                modalAiDescription.textContent = 'No AI description available';
            }
            
            // Populate AI keywords
            if (aiData.ai_keywords && aiData.ai_keywords.length > 0) {
                const keywords = Array.isArray(aiData.ai_keywords) ? aiData.ai_keywords : aiData.ai_keywords.split(',').map(k => k.trim());
                const aiKeywordTags = keywords.map(keyword => 
                    `<span class="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full mr-1 mb-1">${keyword}</span>`
                ).join('');
                modalAiKeywords.innerHTML = aiKeywordTags;
            } else {
                modalAiKeywords.innerHTML = '<span class="text-blue-400">No AI keywords</span>';
            }
            
            
            // Populate timestamp
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
    }

    populateEmbeddingInfo(completePhoto) {
        const embeddingInfo = document.getElementById('modal-embedding-info');
        const embeddingStatus = document.getElementById('modal-embedding-status');
        const embeddingDimensions = document.getElementById('modal-embedding-dimensions');
        const embeddingModel = document.getElementById('modal-embedding-model');
        const embeddingDimCount = document.getElementById('modal-embedding-dim-count');
        const embeddingSample = document.getElementById('modal-embedding-sample');
        
        // Check if embedding data is available (it's nested in ai_metadata)
        const embedding = completePhoto.ai_metadata?.embedding;
        if (embedding && Array.isArray(embedding) && embedding.length > 0) {
            embeddingStatus.textContent = 'Available';
            embeddingStatus.className = 'text-green-600 font-medium';
            
            const dimensions = embedding.length;
            embeddingDimensions.textContent = `${dimensions}D vector`;
            embeddingModel.textContent = 'CLIP (OpenAI)';
            embeddingDimCount.textContent = `${dimensions} dimensions`;
            
            // Show first few embedding values as sample
            const sampleValues = embedding.slice(0, 5).map(val => val.toFixed(4)).join(', ');
            embeddingSample.textContent = `[${sampleValues}...]`;
            
            embeddingInfo.classList.remove('hidden');
        } else {
            embeddingStatus.textContent = 'Not Available';
            embeddingStatus.className = 'text-gray-400';
            embeddingInfo.classList.add('hidden');
        }
    }

    showModalWithAnimation() {
        const modal = document.getElementById('photo-modal');
        
        // Show modal with animation
        modal.classList.remove('hidden');
        
        // Get modal content elements for staggered animation
        const modalContent = modal.querySelector('.bg-white');
        const downloadButton = modal.querySelector('#modal-download');
        
        // Trigger animation after modal is visible
        requestAnimationFrame(() => {
            // Set initial animation state
            modal.style.opacity = '0';
            modalContent.style.transform = 'scale(0.9) translateY(20px)';
            modalContent.style.opacity = '0';
            
            // Force reflow
            modal.offsetHeight;
            
            // Apply transitions
            modal.style.transition = 'opacity 0.2s ease-out';
            modalContent.style.transition = 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
            
            // Animate to final state
            modal.style.opacity = '1';
            
            setTimeout(() => {
                modalContent.style.opacity = '1';
                modalContent.style.transform = 'scale(1) translateY(0)';
            }, 50);
        });
        
        // Focus management for accessibility
        setTimeout(() => {
            const modalImage = document.getElementById('modal-image');
            modalImage.focus();
        }, 300);
        
        // Add escape key handler
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    closeModal() {
        const modal = document.getElementById('photo-modal');
        const modalContent = modal.querySelector('.bg-white');
        const downloadButton = modal.querySelector('#modal-download');
        
        // Only animate if modal is visible
        if (!modal.classList.contains('hidden')) {
            // Animate out with smoother transition
            modalContent.style.transition = 'all 0.2s ease-in';
            modalContent.style.transform = 'scale(0.9) translateY(20px)';
            modalContent.style.opacity = '0';
            
            modal.style.transition = 'opacity 0.2s ease-in';
            modal.style.opacity = '0';
            
            setTimeout(() => {
                // Hide modal and reset styles
                modal.classList.add('hidden');
                
                // Reset all inline styles for next time
                modal.style.opacity = '';
                modal.style.transition = '';
                modalContent.style.transform = '';
                modalContent.style.opacity = '';
                modalContent.style.transition = '';
            }, 200);
        }
        
        // Clear current photo reference
        this.currentPhoto = null;
    }

    // Full-screen Lightbox
    async openFullScreenLightbox(photo) {
        try {
            // Create full-screen lightbox if it doesn't exist
            let lightbox = document.getElementById('fullscreen-lightbox');
            if (!lightbox) {
                lightbox = document.createElement('div');
                lightbox.id = 'fullscreen-lightbox';
                lightbox.className = 'fixed inset-0 bg-black flex items-center justify-center z-50 opacity-0 transition-all duration-300 ease-out pointer-events-none p-4 md:p-8';
                lightbox.innerHTML = `
                    <div id="fullscreen-container" class="relative max-w-full max-h-full">
                        <img id="fullscreen-image" class="max-w-full max-h-full object-contain opacity-0 transform scale-95 transition-all duration-300 ease-out" />
                        <div id="fullscreen-loading" class="absolute inset-0 flex items-center justify-center text-white text-lg opacity-0 transition-all duration-300 ease-out">
                            <div class="text-center transform transition-all duration-300 ease-out" style="transform: translateY(4px)">
                                <div class="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent mx-auto mb-2"></div>
                                Loading largest image...
                            </div>
                        </div>
                        <button id="fullscreen-close" class="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors z-10">
                            <svg class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                `;
                document.body.appendChild(lightbox);
                
                // Add close button handler
                document.getElementById('fullscreen-close').addEventListener('click', () => {
                    this.closeFullScreenLightbox();
                });
                
                // Add click-outside-to-close handler
                lightbox.addEventListener('click', (e) => {
                    if (e.target === lightbox) {
                        this.closeFullScreenLightbox();
                    }
                });
                
                // Add escape key handler
                document.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape' && !lightbox.classList.contains('hidden')) {
                        this.closeFullScreenLightbox();
                    }
                });
            }
            
            const fullscreenImage = document.getElementById('fullscreen-image');
            const loadingDiv = document.getElementById('fullscreen-loading');
            
            // Don't show lightbox until image is loaded - start with pointer events enabled but opacity 0
            lightbox.style.pointerEvents = 'auto';
            
            // Try to load the largest available image
            if (photo.id || photo.local_photo_id) {
                try {
                    const photoId = photo.id || photo.local_photo_id;
                    console.log('Fetching largest image for full-screen lightbox:', photoId);
                    const largestImageData = await apiService.get(`/photos/${photoId}/largest-image`);
                    
                    if (largestImageData && largestImageData.url) {
                        console.log('Largest image data:', largestImageData);
                        
                        // Show loading state first
                        loadingDiv.style.opacity = '1';
                        loadingDiv.querySelector('.text-center').style.transform = 'translateY(0)';
                        
                        // Show lightbox with loading state
                        setTimeout(() => {
                            lightbox.style.opacity = '1';
                        }, 10);
                        
                        // Create image to test loading
                        const img = new Image();
                        img.onload = () => {
                            // Image loaded successfully - now show it
                            fullscreenImage.src = largestImageData.url;
                            setTimeout(() => {
                                // Animate image in and loading out
                                loadingDiv.style.opacity = '0';
                                fullscreenImage.style.opacity = '1';
                                fullscreenImage.style.transform = 'scale(1)';
                            }, 150);
                        };
                        img.onerror = () => {
                            // Fallback to existing image
                            eventBus.emit('image:fallback:load', { photo, fullscreenImage, loadingDiv });
                        };
                        img.src = largestImageData.url;
                        return;
                    }
                } catch (error) {
                    console.error('Error fetching largest image:', error);
                }
            }
            
            // Fallback to existing image URL
            eventBus.emit('image:fallback:load', { photo, fullscreenImage, loadingDiv });
            
        } catch (error) {
            console.error('Error opening full-screen lightbox:', error);
        }
    }

    closeFullScreenLightbox() {
        const lightbox = document.getElementById('fullscreen-lightbox');
        if (lightbox) {
            const container = document.getElementById('fullscreen-container');
            const fullscreenImage = document.getElementById('fullscreen-image');
            
            // Animate out
            lightbox.style.opacity = '0';
            fullscreenImage.style.opacity = '0';
            fullscreenImage.style.transform = 'scale(0.95)';
            
            setTimeout(() => {
                lightbox.style.pointerEvents = 'none';
            }, 300);
            
            // Reset for next time
            setTimeout(() => {
                const loadingDiv = document.getElementById('fullscreen-loading');
                if (loadingDiv) {
                    loadingDiv.style.opacity = '0';
                    loadingDiv.querySelector('.text-center').style.transform = 'translateY(4px)';
                }
                fullscreenImage.style.transform = 'scale(0.95)';
            }, 300);
        }
    }

    // Collection Modal Management
    showCreateCollectionModal() {
        const modal = document.getElementById('create-collection-modal');
        // Clear form
        const nameInput = document.getElementById('create-collection-name');
        const descInput = document.getElementById('create-collection-description');
        if (nameInput) nameInput.value = '';
        if (descInput) descInput.value = '';
        
        if (modal) {
            modal.classList.remove('hidden');
            if (nameInput) nameInput.focus();
        }
    }

    hideCreateCollectionModal() {
        const modal = document.getElementById('create-collection-modal');
        if (modal) modal.classList.add('hidden');
    }

    showEditCollectionModal() {
        // This would be implemented with actual collection data
        const modal = document.getElementById('edit-collection-modal');
        
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    hideEditCollectionModal() {
        const modal = document.getElementById('edit-collection-modal');
        if (modal) modal.classList.add('hidden');
    }

    // Utility methods for other components to use
    downloadImage(imageUrl, filename) {
        console.log('Downloading image:', imageUrl);
        
        // Create a temporary link element to trigger download
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = filename || 'photo';
        link.target = '_blank'; // Open in new tab as fallback
        
        // Append to body, click, and remove
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    async loadLargestImageForDownload(photo, modalDownload) {
        // Implementation for loading largest image for download
        // This integrates with the SmugMug API to get the highest resolution image
        try {
            const originalContent = modalDownload.innerHTML;
            modalDownload.innerHTML = `
                <svg class="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="m12,2a10,10,0,1,0,10,10,1,1,0,0,0-2,0,8,8,0,1,1-8-8,1,1,0,0,0,0-2Z"></path>
                </svg>
                Loading...
            `;
            modalDownload.style.opacity = '0.7';
            modalDownload.style.pointerEvents = 'none';

            if (photo.id || photo.local_photo_id) {
                try {
                    const photoId = photo.id || photo.local_photo_id;
                    const largestImageData = await apiService.get(`/photos/${photoId}/largest-image`);
                    
                    if (largestImageData && largestImageData.url) {
                        modalDownload.href = largestImageData.url;
                        
                        // Update button with size info if available
                        const sizeText = largestImageData.width && largestImageData.height 
                            ? ` (${largestImageData.width}×${largestImageData.height})`
                            : '';
                        modalDownload.innerHTML = `
                            <svg class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Download Original${sizeText}
                        `;
                    } else {
                        modalDownload.innerHTML = originalContent;
                    }
                } catch (error) {
                    console.warn('Error loading largest image:', error);
                    modalDownload.innerHTML = originalContent;
                }
            }
            
            modalDownload.style.opacity = '1';
            modalDownload.style.pointerEvents = 'auto';
            
        } catch (error) {
            console.error('Error loading largest image for download:', error);
            modalDownload.innerHTML = originalContent || `
                <svg class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download
            `;
            modalDownload.style.opacity = '1';
            modalDownload.style.pointerEvents = 'auto';
        }
    }

    // Load photo collections - delegate to CollectionsManager
    async loadPhotoCollections(photo) {
        console.log('Loading collections for photo:', photo.id);
        eventBus.emit('collections:load-for-photo', { photo });
    }

    processPhotoWithAI() {
        // This will emit event to PhotoProcessor
        eventBus.emit('photos:process-single', { photo: this.currentPhoto });
    }

    toggleMetadataEdit() {
        // Metadata editing implementation
        console.log('Toggle metadata edit mode');
    }

    saveMetadataChanges() {
        // Save metadata changes implementation
        console.log('Save metadata changes');
    }

    cancelMetadataEdit() {
        // Cancel metadata edit implementation
        console.log('Cancel metadata edit');
    }

    regenerateAIMetadata() {
        // Regenerate AI metadata implementation
        console.log('Regenerate AI metadata');
    }

    deleteAIMetadata() {
        // Delete AI metadata implementation
        console.log('Delete AI metadata');
    }


    showCollectionInterface() {
        // Delegate to CollectionsManager
        eventBus.emit('collections:show-interface');
    }

    hideCollectionInterface() {
        // Delegate to CollectionsManager
        eventBus.emit('collections:hide-interface');
    }

    addPhotoToCollection() {
        // Delegate to CollectionsManager
        eventBus.emit('collections:add-photo');
    }

    createCollectionFromModal() {
        // Delegate to CollectionsManager
        eventBus.emit('collections:create-from-modal');
    }

    refreshCollectionDropdown() {
        // Request CollectionsManager to refresh the dropdown in the modal
        eventBus.emit('collections:refresh-modal-dropdown');
    }
}

// Create and export singleton instance
const modalManager = new ModalManager();
export default modalManager;