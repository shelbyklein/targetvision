import eventBus from '../services/EventBus.js';
import apiService from '../services/APIService.js';
import { EVENTS, PHOTO_STATUS, PROCESSING_STATUS, SUCCESS_MESSAGES, ERROR_MESSAGES } from '../utils/Constants.js';
import UIUtils from '../utils/UIUtils.js';

class PhotoProcessor {
    constructor() {
        this.processingPhotos = new Set();
        this.batchProcessingStatus = {
            isActive: false,
            processed: 0,
            total: 0,
            success: 0,
            failed: 0
        };
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        eventBus.on('photos:process-selected', (data) => {
            this.processSelectedPhotos(data.selectedPhotos, data.currentPhotos);
        });

        eventBus.on('photos:process-single', (data) => {
            this.processSinglePhoto(data.photo);
        });

        eventBus.on('photos:generate-embeddings', (data) => {
            this.generateMissingEmbeddings(data.album);
        });
    }

    async processSelectedPhotos(selectedPhotos, currentPhotos) {
        if (selectedPhotos.size === 0) {
            eventBus.emit('ui:show-error', {
                title: 'No Photos Selected',
                message: 'Please select photos to process.'
            });
            return;
        }
        
        const photoIds = Array.from(selectedPhotos);
        
        // Find local photo IDs for selected SmugMug IDs
        const localPhotoIds = [];
        for (const smugmugId of photoIds) {
            const photo = currentPhotos.find(p => p.smugmug_id === smugmugId);
            if (photo && photo.local_photo_id) {
                localPhotoIds.push(photo.local_photo_id);
            }
        }
        
        if (localPhotoIds.length === 0) {
            eventBus.emit('ui:show-error', {
                title: 'Processing Error',
                message: ERROR_MESSAGES.PROCESSING_FAILED
            });
            return;
        }
        
        // Add photos to UI processing state
        photoIds.forEach(photoId => {
            this.processingPhotos.add(photoId);
        });
        
        // Update batch processing status
        this.batchProcessingStatus = {
            isActive: true,
            processed: 0,
            total: localPhotoIds.length,
            success: 0,
            failed: 0
        };
        
        // Emit processing events
        eventBus.emit('photos:processing-start', {
            photoIds,
            localPhotoIds,
            total: localPhotoIds.length
        });

        this.showBatchProgress(0, localPhotoIds.length, 0);
        this.showGlobalProgress(0, localPhotoIds.length, 'Starting AI analysis of selected photos...', true);
        
        try {
            // Get user's API settings
            const apiSettings = await this.getApiSettings();
            
            // Prepare headers with API keys
            const headers = {
                'Content-Type': 'application/json'
            };
            
            if (apiSettings.anthropic_key) {
                headers['X-Anthropic-Key'] = apiSettings.anthropic_key;
            }
            if (apiSettings.openai_key) {
                headers['X-OpenAI-Key'] = apiSettings.openai_key;
            }
            
            // Start batch processing
            const provider = apiSettings.active_provider || 'anthropic';
            const result = await apiService.post(`/photos/process/batch?provider=${provider}`, localPhotoIds, { headers });
            
            console.log(`Batch processing started: ${result.message}`);
            
            // Update UI to show processing status
            localPhotoIds.forEach(photoId => {
                const currentPhoto = currentPhotos.find(p => p.local_photo_id === photoId);
                const displayId = currentPhoto ? 
                    (currentPhoto.smugmug_id || currentPhoto.image_key || currentPhoto.local_photo_id) : photoId;
                this.updatePhotoThumbnailStatus(displayId, PHOTO_STATUS.PROCESSING);
            });
            
            eventBus.emit('photos:batch-processing-started', {
                result,
                localPhotoIds,
                message: `Processing ${localPhotoIds.length} photos in background. Results will appear when you refresh or navigate back to this album.`
            });
            
            // Optional: Add delayed status check after 1 minute
            setTimeout(() => {
                eventBus.emit('photos:refresh-status');
            }, 60000);
            
        } catch (error) {
            console.error('Batch processing failed:', error);
            this.handleProcessingError(error, photoIds);
        }
    }

    async processSinglePhoto(photo) {
        // Check if photo is synced and has required data
        if (!photo.is_synced || !photo.local_photo_id) {
            eventBus.emit('ui:show-error', {
                title: 'Processing Error',
                message: 'This photo must be synced to the database before it can be processed with AI.'
            });
            return;
        }
        
        // Check if already processing
        if (this.processingPhotos.has(photo.local_photo_id)) {
            eventBus.emit('ui:show-error', {
                title: 'Processing in Progress',
                message: 'This photo is already being processed.'
            });
            return;
        }
        
        // Immediately show processing status in UI
        const displayId = photo.smugmug_id || photo.image_key || photo.local_photo_id;
        this.updatePhotoThumbnailStatus(displayId, PHOTO_STATUS.PROCESSING);
        
        // Add to UI processing state
        this.processingPhotos.add(photo.local_photo_id);
        
        // Show global progress for single photo
        this.showGlobalProgress(0, 1, 'Analyzing photo with AI...');
        
        try {
            // Get user's API settings
            const apiSettings = await this.getApiSettings();
            
            // Prepare headers with API keys
            const headers = {};
            if (apiSettings.anthropic_key) {
                headers['X-Anthropic-Key'] = apiSettings.anthropic_key;
            }
            if (apiSettings.openai_key) {
                headers['X-OpenAI-Key'] = apiSettings.openai_key;
            }
            
            const provider = apiSettings.active_provider || 'anthropic';
            const result = await apiService.post(
                `/photos/${photo.local_photo_id}/process?provider=${provider}`,
                null,
                { headers }
            );
            
            // Remove from processing state
            this.processingPhotos.delete(photo.local_photo_id);
            
            // Update UI status based on result
            if (result.success) {
                this.updatePhotoThumbnailStatus(displayId, PHOTO_STATUS.PROCESSED);
                
                eventBus.emit('photos:single-processing-success', {
                    photo,
                    result,
                    message: SUCCESS_MESSAGES.PHOTO_PROCESSED
                });
            } else {
                this.updatePhotoThumbnailStatus(displayId, PHOTO_STATUS.FAILED);
                
                eventBus.emit('photos:single-processing-failed', {
                    photo,
                    error: result.error || 'Processing failed'
                });
            }
            
            this.hideGlobalProgress();
            
        } catch (error) {
            console.error('Single photo processing failed:', error);
            this.processingPhotos.delete(photo.local_photo_id);
            this.updatePhotoThumbnailStatus(displayId, PHOTO_STATUS.FAILED);
            this.hideGlobalProgress();
            
            eventBus.emit('photos:single-processing-error', {
                photo,
                error
            });
        }
    }

    async generateMissingEmbeddings(album) {
        if (!album || !album.local_album_id) {
            eventBus.emit('ui:show-error', {
                title: 'No Album Selected',
                message: 'Please select an album to generate embeddings for.'
            });
            return;
        }

        try {
            this.showGlobalProgress(0, 1, 'Finding photos that need embeddings...');

            const result = await apiService.post(`/photos/batch/generate-embeddings?album_id=${album.local_album_id}`);
            
            if (result.photos_to_process === 0) {
                this.hideGlobalProgress();
                eventBus.emit('ui:show-success', {
                    title: 'Up to Date',
                    message: 'All photos in this album already have embeddings.'
                });
                return;
            }

            // Show success message and progress
            this.showGlobalProgress(0, result.photos_to_process, `Generating embeddings for ${result.photos_to_process} photos...`);
            console.log(`Started embedding generation for ${result.photos_to_process} photos`);

            eventBus.emit('photos:embeddings-generation-started', {
                result,
                message: `Generating embeddings for ${result.photos_to_process} photos in background. Results will appear when you refresh or navigate back to this album.`
            });

        } catch (error) {
            console.error('Failed to generate embeddings:', error);
            this.hideGlobalProgress();
            
            eventBus.emit('ui:show-error', {
                title: 'Embedding Generation Failed',
                message: `Failed to start embedding generation: ${error.message}`
            });
        }
    }

    // Progress bar management
    showBatchProgress(processed, total, success) {
        const progressContainer = document.getElementById('batch-progress');
        const progressText = document.getElementById('batch-progress-text');
        const progressBar = document.getElementById('batch-progress-bar');
        
        if (!progressContainer || !progressText || !progressBar) {
            return;
        }
        
        const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;
        
        progressText.textContent = `${processed}/${total}`;
        progressBar.style.width = `${percentage}%`;
        UIUtils.show(progressContainer);
        
        // Update internal status
        this.batchProcessingStatus.processed = processed;
        this.batchProcessingStatus.success = success;
        
        eventBus.emit('photos:batch-progress-updated', {
            processed,
            total,
            success,
            percentage
        });
        
        if (processed >= total) {
            this.batchProcessingStatus.isActive = false;
            setTimeout(() => {
                this.hideBatchProgress();
            }, 3000);
        }
    }

    hideBatchProgress() {
        const progressContainer = document.getElementById('batch-progress');
        if (progressContainer) {
            UIUtils.hide(progressContainer);
        }
    }
    
    showGlobalProgress(processed, total, details = 'Analyzing images and generating metadata...') {
        const progressContainer = document.getElementById('global-progress-bar');
        const progressText = document.getElementById('global-progress-text');
        const progressFill = document.getElementById('global-progress-fill');
        const progressDetails = document.getElementById('global-progress-details');
        
        if (!progressContainer) return;
        
        const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;
        
        if (progressText) progressText.textContent = `${processed}/${total}`;
        if (progressFill) progressFill.style.width = `${percentage}%`;
        if (progressDetails) progressDetails.textContent = details;
        
        UIUtils.show(progressContainer);
        
        eventBus.emit('photos:global-progress-updated', {
            processed,
            total,
            percentage,
            details
        });
        
        // Auto-hide after completion
        if (processed >= total) {
            setTimeout(() => {
                this.hideGlobalProgress();
            }, 4000);
        }
    }
    
    hideGlobalProgress() {
        const progressContainer = document.getElementById('global-progress-bar');
        if (progressContainer) {
            UIUtils.hide(progressContainer);
        }
    }
    
    updateGlobalProgress(processed, total, details = null) {
        const progressContainer = document.getElementById('global-progress-bar');
        if (!progressContainer || UIUtils.hasClass(progressContainer, 'hidden')) return;
        
        const progressText = document.getElementById('global-progress-text');
        const progressFill = document.getElementById('global-progress-fill');
        const progressDetails = document.getElementById('global-progress-details');
        
        const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;
        
        if (progressText) progressText.textContent = `${processed}/${total}`;
        if (progressFill) progressFill.style.width = `${percentage}%`;
        if (details && progressDetails) progressDetails.textContent = details;
        
        eventBus.emit('photos:global-progress-updated', {
            processed,
            total,
            percentage,
            details
        });
        
        // Auto-hide after completion
        if (processed >= total) {
            setTimeout(() => {
                this.hideGlobalProgress();
            }, 4000);
        }
    }

    // Update individual photo thumbnail status indicator
    updatePhotoThumbnailStatus(photoId, newStatus) {
        try {
            const targetCard = document.querySelector(`[data-photo-id="${photoId}"]`);
            if (!targetCard) return;
            
            const statusConfig = {
                [PHOTO_STATUS.PROCESSED]: { color: 'bg-green-500', icon: '✓', text: 'Processed' },
                [PHOTO_STATUS.PROCESSING]: { color: 'bg-yellow-500', icon: '⏳', text: 'Processing' },
                [PHOTO_STATUS.FAILED]: { color: 'bg-red-500', icon: '✗', text: 'Failed' },
                [PHOTO_STATUS.UNPROCESSED]: { color: 'bg-orange-500', icon: '○', text: 'Not Processed' }
            };
            
            const statusInfo = statusConfig[newStatus] || statusConfig[PHOTO_STATUS.UNPROCESSED];
            const statusIndicator = targetCard.querySelector('div[class*="absolute top-2 right-2"]');
            
            if (statusIndicator) {
                // Update classes and content
                statusIndicator.className = `absolute top-2 right-2 ${statusInfo.color} text-white text-xs px-2 py-1 rounded-full flex items-center z-20`;
                const iconSpan = statusIndicator.querySelector('span');
                if (iconSpan) {
                    iconSpan.textContent = statusInfo.icon;
                }
                
                // Update hover state and tooltip based on new status
                statusIndicator.classList.remove('hover:scale-110', 'hover:brightness-110', 'transition-all', 'duration-200');
                statusIndicator.style.cursor = 'pointer';
                
                if (newStatus === PHOTO_STATUS.UNPROCESSED) {
                    UIUtils.addClass(statusIndicator, 'hover:scale-110 hover:brightness-110 transition-all duration-200');
                    statusIndicator.title = 'Click to process with AI';
                } else if (newStatus === PHOTO_STATUS.PROCESSED) {
                    statusIndicator.title = 'Processed - click to reprocess';
                } else if (newStatus === PHOTO_STATUS.FAILED) {
                    statusIndicator.title = 'Processing failed - click to retry';
                } else if (newStatus === PHOTO_STATUS.PROCESSING) {
                    statusIndicator.title = 'Processing in progress...';
                    statusIndicator.style.cursor = 'default';
                }
                
                // Add a subtle animation to show the change
                statusIndicator.style.transform = 'scale(1.2)';
                setTimeout(() => {
                    statusIndicator.style.transform = 'scale(1)';
                }, 300);
            }
            
            eventBus.emit('photos:status-updated', {
                photoId,
                newStatus,
                statusInfo
            });
            
        } catch (error) {
            console.error('Error updating photo thumbnail status:', error);
        }
    }

    // Helper methods
    async getApiSettings() {
        // This would typically come from a settings manager
        // For now, emit event to get settings
        return new Promise((resolve) => {
            eventBus.emit('settings:get-api-settings', { callback: resolve });
        });
    }

    handleProcessingError(error, photoIds) {
        // Clear processing state on error
        photoIds.forEach(photoId => {
            this.processingPhotos.delete(photoId);
        });
        
        this.batchProcessingStatus.isActive = false;
        
        this.hideBatchProgress();
        this.hideGlobalProgress();
        
        eventBus.emit('photos:batch-processing-error', {
            error,
            photoIds
        });
    }

    // Public API methods
    isPhotoProcessing(photoId) {
        return this.processingPhotos.has(photoId);
    }

    getBatchProcessingStatus() {
        return { ...this.batchProcessingStatus };
    }

    clearProcessingState() {
        this.processingPhotos.clear();
        this.batchProcessingStatus = {
            isActive: false,
            processed: 0,
            total: 0,
            success: 0,
            failed: 0
        };
        this.hideBatchProgress();
        this.hideGlobalProgress();
    }

    getProcessingStats() {
        return {
            activeCount: this.processingPhotos.size,
            batchActive: this.batchProcessingStatus.isActive,
            batchProgress: this.batchProcessingStatus
        };
    }
}

const photoProcessor = new PhotoProcessor();
export default photoProcessor;