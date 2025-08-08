// TargetVision Frontend Application
class TargetVisionApp {
    constructor() {
        this.apiBase = 'http://localhost:8000';
        this.photos = [];
        this.currentSearch = null;
        this.currentPage = 0;
        this.photosPerPage = 20;
        
        this.initializeApp();
    }

    async initializeApp() {
        this.bindEventListeners();
        await this.checkAuthentication();
        await this.loadPhotos();
    }

    bindEventListeners() {
        // Search functionality
        document.getElementById('search-button').addEventListener('click', () => this.performSearch());
        document.getElementById('search-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.performSearch();
        });
        document.getElementById('clear-search').addEventListener('click', () => this.clearSearch());
        
        // Modal functionality
        document.getElementById('modal-close').addEventListener('click', () => this.closeModal());
        document.getElementById('photo-modal').addEventListener('click', (e) => {
            if (e.target.id === 'photo-modal') this.closeModal();
        });
        
        // Process AI button
        document.getElementById('modal-process-button').addEventListener('click', () => this.processPhotoWithAI());
        
        // Retry button
        document.getElementById('retry-button').addEventListener('click', () => this.loadPhotos());
        
        // Load more
        document.getElementById('load-more-button').addEventListener('click', () => this.loadMorePhotos());
    }

    async checkAuthentication() {
        try {
            const response = await fetch(`${this.apiBase}/auth/status`);
            const authStatus = await response.json();
            
            const loading = document.getElementById('auth-loading');
            const success = document.getElementById('auth-success');
            const error = document.getElementById('auth-error');
            const username = document.getElementById('auth-username');
            
            loading.classList.add('hidden');
            
            if (authStatus.authenticated) {
                success.classList.remove('hidden');
                username.textContent = `(@${authStatus.username})`;
            } else {
                error.classList.remove('hidden');
            }
        } catch (err) {
            console.error('Authentication check failed:', err);
            document.getElementById('auth-loading').classList.add('hidden');
            document.getElementById('auth-error').classList.remove('hidden');
        }
    }

    async loadPhotos() {
        this.showLoading();
        
        try {
            const response = await fetch(`${this.apiBase}/photos?skip=0&limit=${this.photosPerPage}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            this.photos = await response.json();
            this.displayPhotos(this.photos);
            this.hideLoading();
            
        } catch (error) {
            console.error('Failed to load photos:', error);
            this.showError('Failed to load photos. Please try again.', error.message);
        }
    }

    async loadMorePhotos() {
        const skip = this.photos.length;
        
        try {
            const response = await fetch(`${this.apiBase}/photos?skip=${skip}&limit=${this.photosPerPage}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const newPhotos = await response.json();
            if (newPhotos.length > 0) {
                this.photos = [...this.photos, ...newPhotos];
                this.displayPhotos(this.photos);
            } else {
                document.getElementById('load-more-container').classList.add('hidden');
            }
        } catch (error) {
            console.error('Failed to load more photos:', error);
        }
    }

    async performSearch() {
        const query = document.getElementById('search-input').value.trim();
        const searchType = document.getElementById('search-type').value;
        
        if (!query) return;
        
        this.showLoading();
        
        try {
            const response = await fetch(`${this.apiBase}/search?q=${encodeURIComponent(query)}&search_type=${searchType}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const searchResults = await response.json();
            this.currentSearch = searchResults;
            
            // Convert search results to photo format
            const searchPhotos = searchResults.photos.map(result => ({
                ...result.photo,
                searchScore: result.score,
                aiDescription: result.description,
                aiKeywords: result.ai_keywords
            }));
            
            this.displayPhotos(searchPhotos, true);
            this.showSearchInfo(searchResults);
            this.hideLoading();
            
        } catch (error) {
            console.error('Search failed:', error);
            this.showError('Search failed. Please try again.', error.message);
        }
    }

    clearSearch() {
        this.currentSearch = null;
        document.getElementById('search-input').value = '';
        document.getElementById('search-info').classList.add('hidden');
        this.displayPhotos(this.photos);
    }

    displayPhotos(photos, isSearchResult = false) {
        const gallery = document.getElementById('photo-gallery');
        const grid = document.getElementById('photo-grid');
        const emptyState = document.getElementById('empty-state');
        const galleryCount = document.getElementById('gallery-count');
        const loadMoreContainer = document.getElementById('load-more-container');
        
        if (photos.length === 0) {
            gallery.classList.add('hidden');
            emptyState.classList.remove('hidden');
            return;
        }
        
        emptyState.classList.add('hidden');
        gallery.classList.remove('hidden');
        
        // Update count
        if (isSearchResult) {
            galleryCount.textContent = `Found ${photos.length} matching photos`;
        } else {
            galleryCount.textContent = `${photos.length} photos synced from SmugMug`;
        }
        
        // Clear and populate grid
        grid.innerHTML = '';
        photos.forEach(photo => {
            const photoCard = this.createPhotoCard(photo, isSearchResult);
            grid.appendChild(photoCard);
        });
        
        // Show/hide load more button
        if (isSearchResult || photos.length < this.photosPerPage) {
            loadMoreContainer.classList.add('hidden');
        } else {
            loadMoreContainer.classList.remove('hidden');
        }
    }

    createPhotoCard(photo, isSearchResult = false) {
        const card = document.createElement('div');
        card.className = 'bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden';
        
        // Search score badge
        const scoreBadge = isSearchResult && photo.searchScore ? 
            `<div class="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                ${(photo.searchScore * 100).toFixed(0)}%
            </div>` : '';
        
        // AI indicator
        const aiIndicator = photo.ai_metadata || photo.aiDescription ? 
            `<div class="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                🤖 AI
            </div>` : '';
        
        card.innerHTML = `
            <div class="relative aspect-square">
                <img 
                    src="${photo.thumbnail_url || photo.image_url}" 
                    alt="${photo.title || 'Photo'}"
                    class="w-full h-full object-cover"
                    loading="lazy"
                >
                ${scoreBadge}
                ${aiIndicator}
            </div>
            <div class="p-3">
                <div class="text-sm text-gray-900 font-medium truncate">
                    ${photo.title || 'Untitled'}
                </div>
                <div class="text-xs text-gray-500 mt-1">
                    ${photo.album_name || 'No album'}
                </div>
                ${isSearchResult && photo.aiDescription ? 
                    `<div class="text-xs text-blue-600 mt-2 line-clamp-2">
                        ${photo.aiDescription.substring(0, 100)}...
                    </div>` : ''}
            </div>
        `;
        
        card.addEventListener('click', () => this.showPhotoModal(photo));
        
        return card;
    }

    async showPhotoModal(photo) {
        const modal = document.getElementById('photo-modal');
        
        // Set basic photo info
        document.getElementById('modal-image').src = photo.image_url;
        document.getElementById('modal-image').alt = photo.title || 'Photo';
        document.getElementById('modal-dimensions').textContent = 
            photo.width && photo.height ? `${photo.width} × ${photo.height}` : 'Unknown dimensions';
        document.getElementById('modal-album').textContent = `Album: ${photo.album_name || 'None'}`;
        
        // Set original metadata
        document.getElementById('modal-original-title').innerHTML = 
            photo.title ? `<strong>Title:</strong> ${photo.title}` : '<em>No title</em>';
        document.getElementById('modal-original-caption').innerHTML = 
            photo.caption ? `<strong>Caption:</strong> ${photo.caption}` : '<em>No caption</em>';
        
        const originalKeywords = document.getElementById('modal-original-keywords');
        if (photo.keywords && photo.keywords.length > 0) {
            originalKeywords.innerHTML = '<strong>Keywords:</strong> ' + 
                photo.keywords.map(k => `<span class="bg-gray-200 px-2 py-1 rounded text-xs">${k}</span>`).join(' ');
        } else {
            originalKeywords.innerHTML = '<em>No keywords</em>';
        }
        
        // Try to get AI metadata if not already present
        let aiMetadata = photo.ai_metadata || (photo.aiDescription ? {
            description: photo.aiDescription,
            ai_keywords: photo.aiKeywords || []
        } : null);
        
        if (!aiMetadata && photo.id) {
            try {
                const response = await fetch(`${this.apiBase}/photos/${photo.id}`);
                if (response.ok) {
                    const fullPhoto = await response.json();
                    aiMetadata = fullPhoto.ai_metadata;
                }
            } catch (error) {
                console.error('Failed to fetch AI metadata:', error);
            }
        }
        
        // Display AI metadata or processing option
        const aiSection = document.getElementById('modal-ai-section');
        const noAiSection = document.getElementById('modal-no-ai');
        
        if (aiMetadata) {
            aiSection.classList.remove('hidden');
            noAiSection.classList.add('hidden');
            
            document.getElementById('modal-ai-description').textContent = aiMetadata.description;
            document.getElementById('modal-ai-confidence').textContent = 
                aiMetadata.confidence_score ? `${(aiMetadata.confidence_score * 100).toFixed(0)}% confidence` : '';
            
            const aiKeywords = document.getElementById('modal-ai-keywords');
            if (aiMetadata.ai_keywords && aiMetadata.ai_keywords.length > 0) {
                aiKeywords.innerHTML = aiMetadata.ai_keywords
                    .map(k => `<span class="bg-blue-200 text-blue-800 px-2 py-1 rounded text-xs">${k}</span>`)
                    .join(' ');
            } else {
                aiKeywords.innerHTML = '<em>No AI keywords generated</em>';
            }
            
            document.getElementById('modal-ai-timestamp').textContent = 
                aiMetadata.processed_at ? `Processed: ${new Date(aiMetadata.processed_at).toLocaleDateString()}` : '';
        } else {
            aiSection.classList.add('hidden');
            noAiSection.classList.remove('hidden');
            
            // Store photo ID for AI processing
            document.getElementById('modal-process-button').dataset.photoId = photo.id;
        }
        
        modal.classList.remove('hidden');
    }

    async processPhotoWithAI() {
        const button = document.getElementById('modal-process-button');
        const photoId = button.dataset.photoId;
        
        if (!photoId) return;
        
        const originalText = button.textContent;
        button.textContent = 'Processing...';
        button.disabled = true;
        
        try {
            const response = await fetch(`${this.apiBase}/photos/${photoId}/process`, {
                method: 'POST'
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const result = await response.json();
            
            // Refresh the modal with new AI metadata
            const photoResponse = await fetch(`${this.apiBase}/photos/${photoId}`);
            if (photoResponse.ok) {
                const updatedPhoto = await photoResponse.json();
                this.showPhotoModal(updatedPhoto);
            }
            
        } catch (error) {
            console.error('AI processing failed:', error);
            alert('AI processing failed. Please try again.');
        } finally {
            button.textContent = originalText;
            button.disabled = false;
        }
    }

    closeModal() {
        document.getElementById('photo-modal').classList.add('hidden');
    }

    showSearchInfo(searchResults) {
        const searchInfo = document.getElementById('search-info');
        const searchText = document.getElementById('search-results-text');
        
        searchText.textContent = `Found ${searchResults.results} photos matching "${searchResults.query}" using ${searchResults.search_type} search`;
        searchInfo.classList.remove('hidden');
    }

    showLoading() {
        document.getElementById('loading').classList.remove('hidden');
        document.getElementById('photo-gallery').classList.add('hidden');
        document.getElementById('empty-state').classList.add('hidden');
        document.getElementById('error').classList.add('hidden');
    }

    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
    }

    showError(message, details = '') {
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('photo-gallery').classList.add('hidden');
        document.getElementById('empty-state').classList.add('hidden');
        
        const errorDiv = document.getElementById('error');
        const errorMessage = document.getElementById('error-message');
        
        errorMessage.textContent = details ? `${message} (${details})` : message;
        errorDiv.classList.remove('hidden');
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TargetVisionApp();
});

// Add utility CSS classes for line clamping
const style = document.createElement('style');
style.textContent = `
    .line-clamp-2 {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
`;
document.head.appendChild(style);