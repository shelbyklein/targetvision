/**
 * SearchManager Component
 * 
 * Handles all search functionality across the application including main search,
 * natural language chat-based search, and search result display.
 * 
 * Key Responsibilities:
 * - Main search execution and display
 * - Natural language search processing for chat interface
 * - Search result rendering and interaction
 * - Search state management and UI updates
 */

import eventBus from '../services/EventBus.js';

class SearchManager {
    constructor() {
        this.apiBase = 'http://localhost:8000';
        this.searchResults = [];
        
        this.setupEventListeners();
        // Component initialized
    }

    setupEventListeners() {
        // Main search events
        eventBus.on('search:perform', () => this.performMainSearch());
        eventBus.on('search:clear', () => this.clearMainSearch());
        
        
        // Chat-based search events
        eventBus.on('search:chat:handle', (data) => this.handlePhotoSearchChat(data.message));
        
        
        // Page initialization
        eventBus.on('search:initialize-page', () => this.initializeSearchPage());
    }

    bindDOMEventListeners() {
        // Main search functionality DOM events
        const searchMainButton = document.getElementById('search-main-button');
        const searchMainInput = document.getElementById('search-main-input');
        const clearMainSearch = document.getElementById('clear-main-search');

        console.log('SearchManager bindDOMEventListeners:', {
            searchMainButton: !!searchMainButton,
            searchMainInput: !!searchMainInput,
            clearMainSearch: !!clearMainSearch
        });

        if (searchMainButton) {
            // Remove existing listeners first
            searchMainButton.replaceWith(searchMainButton.cloneNode(true));
            const newButton = document.getElementById('search-main-button');
            
            newButton.addEventListener('click', () => {
                console.log('Search button clicked');
                this.performMainSearch();
            });
        } else {
            console.warn('Search button not found');
        }

        if (searchMainInput) {
            // Remove existing listeners first
            searchMainInput.replaceWith(searchMainInput.cloneNode(true));
            const newInput = document.getElementById('search-main-input');
            
            newInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    console.log('Search input Enter pressed');
                    this.performMainSearch();
                }
            });
        } else {
            console.warn('Search input not found');
        }

        if (clearMainSearch) {
            clearMainSearch.addEventListener('click', () => this.clearMainSearch());
        }

    }

    // Search Page Initialization
    initializeSearchPage() {
        // Component initialized
        
        // Bind DOM event listeners now that the page is loaded
        this.bindDOMEventListeners();
    }

    // Chat-Based Natural Language Search
    async handlePhotoSearchChat(message) {
        // Extract search terms from natural language
        const searchQuery = this.extractSearchTerms(message);
        
        if (!searchQuery) {
            eventBus.emit('chat:add-message', {
                type: 'system', 
                message: "I understand you're looking for photos, but I'm not sure what to search for. Try asking something like 'Find photos with medals' or 'Show me archery images'."
            });
            return;
        }
        
        // Show "thinking" message
        eventBus.emit('chat:add-message', {
            type: 'system',
            message: `🔍 Searching your photos for "${searchQuery}"...`
        });
        
        try {
            // Perform actual photo search
            const response = await fetch(`${this.apiBase}/search?q=${encodeURIComponent(searchQuery)}&search_type=hybrid&limit=10`);
            
            if (!response.ok) throw new Error(`Search failed: ${response.status}`);
            
            const results = await response.json();
            this.handleSearchResults(searchQuery, results);
            
        } catch (error) {
            console.error('Photo search error:', error);
            eventBus.emit('chat:add-message', {
                type: 'system',
                message: "Sorry, I encountered an error while searching. Please make sure your photos are synced and try again."
            });
        }
    }
    
    extractSearchTerms(message) {
        // Remove common chat words and extract the important terms
        const stopWords = ['find', 'show', 'search', 'look', 'for', 'photos', 'images', 'pictures', 'me', 'with', 'containing', 'have', 'any', 'all', 'the', 'some'];
        
        // Simple extraction - remove stop words and get meaningful terms
        let terms = message.toLowerCase()
            .replace(/[^\w\s]/g, ' ') // Remove punctuation
            .split(/\s+/)
            .filter(word => word.length > 2 && !stopWords.includes(word));
            
        return terms.join(' ').trim();
    }
    
    handleSearchResults(searchQuery, results) {
        const photos = results.photos || [];
        
        if (photos.length === 0) {
            eventBus.emit('chat:add-message', {
                type: 'system',
                message: `I didn't find any photos matching "${searchQuery}". Try different terms or make sure your photos are synced and processed with AI first.`
            });
            return;
        }
        
        // Add success message
        let responseMessage = `Found ${photos.length} photos matching "${searchQuery}"`;
        if (photos.length > 6) {
            responseMessage += ` (showing first 6)`;
        }
        
        eventBus.emit('chat:add-message', {
            type: 'system',
            message: responseMessage
        });
        
        // Use ChatManager's addPhotoResults method for proper photo display
        const photosToShow = photos.slice(0, 6).map(photo => ({
            photo: photo.photo, // Extract the nested photo object from search results
            score: photo.search_score || 0
        }));
        
        eventBus.emit('chat:add-photo-results', { photos: photosToShow });
        
        // Add "view all results" link if there are more photos
        if (photos.length > 6) {
            eventBus.emit('chat:add-message', {
                type: 'system',
                message: `<div class="text-center mt-2"><button onclick="eventBus.emit('page:switch', {page: 'search'}); document.getElementById('search-main-input').value = '${searchQuery}'; eventBus.emit('search:perform');" class="text-blue-600 hover:text-blue-800 underline">View all ${photos.length} results in Search page</button></div>`
            });
        }
    }

    // Main Search Functionality  
    async performMainSearch() {
        console.log('performMainSearch called');
        
        const input = document.getElementById('search-main-input');
        const query = input.value.trim();
        const searchType = document.getElementById('search-main-type').value;
        
        console.log('Search query:', query, 'type:', searchType);
        
        if (!query) {
            console.log('No query provided, returning');
            return;
        }
        
        eventBus.emit('search:loading:show');
        
        try {
            // Build search URL
            const params = new URLSearchParams({
                q: query,
                search_type: searchType,
                limit: '50'
            });
            
            const searchUrl = `${this.apiBase}/search?${params}`;
            console.log('Search URL:', searchUrl);
            
            const response = await fetch(searchUrl);
            console.log('Search response status:', response.status);
            
            if (!response.ok) throw new Error(`Search failed: ${response.status}`);
            
            const results = await response.json();
            console.log('Search results:', results);
            
            this.searchResults = results.photos || [];
            console.log('Processed search results count:', this.searchResults.length);
            
            this.displaySearchResults(query, results);
            eventBus.emit('search:loading:hide');
            
        } catch (error) {
            console.error('Search error:', error);
            eventBus.emit('search:loading:hide');
            this.showSearchError('Search failed. Please try again.');
        }
    }
    
    displaySearchResults(query, results) {
        const welcomeState = document.getElementById('search-welcome');
        const loadingState = document.getElementById('search-loading');
        const resultsGrid = document.getElementById('search-results-grid');
        const noResults = document.getElementById('search-no-results');
        const infoSection = document.getElementById('search-main-info');
        const resultsText = document.getElementById('search-main-results-text');
        
        // Hide states
        welcomeState.classList.add('hidden');
        loadingState.classList.add('hidden');
        noResults.classList.add('hidden');
        
        // Show results info
        infoSection.classList.remove('hidden');
        resultsText.textContent = `Found ${results.results} results for "${query}"`;
        
        if (this.searchResults.length === 0) {
            noResults.classList.remove('hidden');
            resultsGrid.classList.add('hidden');
            return;
        }
        
        // Display results
        resultsGrid.classList.remove('hidden');
        const gridContainer = resultsGrid.querySelector('.grid');
        gridContainer.innerHTML = '';
        
        this.searchResults.forEach(result => {
            const photoCard = this.createSearchResultCard(result);
            gridContainer.appendChild(photoCard);
        });
    }
    
    createSearchResultCard(result) {
        const div = document.createElement('div');
        div.className = 'search-result-card relative group cursor-pointer';
        
        const photo = result.photo || result;
        const searchScore = result.search_score || 0;
        
        // Generate original image URL for download
        const originalUrl = this.getOriginalImageUrl(photo);
        
        
        div.innerHTML = `
            <div class="aspect-square bg-gray-100 rounded-lg overflow-hidden relative">
                <img 
                    src="${photo.thumbnail_url || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y0ZjRmNCIvPjx0ZXh0IHg9IjEwMCIgeT0iMTAwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM2NjYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuNGVtIj5JbWFnZSBOb3QgRm91bmQ8L3RleHQ+PC9zdmc+'}" 
                    alt="${photo.title || 'Search result'}"
                    class="w-full h-full object-cover"
                    loading="lazy"
                    onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y0ZjRmNCIvPjx0ZXh0IHg9IjEwMCIgeT0iMTAwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM2NjYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuNGVtIj5JbWFnZSBOb3QgRm91bmQ8L3RleHQ+PC9zdmc+'"
                />
                
                
                <!-- Action buttons -->
                <div class="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity z-20 flex gap-1">
                    <!-- Collection button -->
                    <button class="collection-btn w-8 h-8 bg-blue-600 bg-opacity-80 hover:bg-opacity-100 rounded-full flex items-center justify-center text-white transition-all" 
                            title="Add to Collection">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                        </svg>
                    </button>
                    
                    <!-- Download button -->
                    <button class="download-btn w-8 h-8 bg-green-600 bg-opacity-80 hover:bg-opacity-100 rounded-full flex items-center justify-center text-white transition-all" 
                            onclick="event.stopPropagation()"
                            title="Download Original">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                    </button>
                </div>
                
                <!-- Hover overlay for visual feedback -->
                <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all z-10">
                </div>
            </div>
            
            <!-- Photo info -->
            <div class="mt-2">
                <p class="text-xs text-gray-600 truncate">${photo.title || 'Untitled'}</p>
                <p class="text-xs text-gray-400">${photo.album_name || ''}</p>
            </div>
        `;
        
        // Add collection button click handler
        const collectionBtn = div.querySelector('.collection-btn');
        collectionBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            eventBus.emit('photo:show-modal', { photo: photo });
        });
        
        // Add download button click handler
        const downloadBtn = div.querySelector('.download-btn');
        downloadBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.downloadImage(originalUrl, photo.title || 'photo');
        });
        
        // Make entire card clickable to open lightbox
        div.addEventListener('click', () => {
            eventBus.emit('photo:show-modal', { photo: photo });
        });
        
        return div;
    }
    
    showSearchError(message) {
        console.error('Search error:', message);
        eventBus.emit('toast:error', { title: 'Search Error', message: message });
    }
    
    clearMainSearch() {
        document.getElementById('search-main-input').value = '';
        document.getElementById('search-main-info').classList.add('hidden');
        document.getElementById('search-results-grid').classList.add('hidden');
        document.getElementById('search-no-results').classList.add('hidden');
        document.getElementById('search-welcome').classList.remove('hidden');
        this.searchResults = [];
    }

    // Helper method to generate original image URL from SmugMug photo data
    getOriginalImageUrl(photo) {
        // If we have an image_url, try to convert it to original size
        if (photo.image_url) {
            // SmugMug URL pattern: https://photos.smugmug.com/photos/i-{id}/0/{size}/i-{id}-{size}.jpg
            // Extract the smugmug ID from the URL
            const match = photo.image_url.match(/i-([a-zA-Z0-9]+)/);
            if (match && match[1]) {
                const smugmugId = match[1];
                // Return the original size URL (size code "O")
                return `https://photos.smugmug.com/photos/i-${smugmugId}/0/O/i-${smugmugId}-O.jpg`;
            }
        }
        
        // Fallback to the image_url if we can't construct the original URL
        return photo.image_url || photo.thumbnail_url || '';
    }
    
    // Helper method to download image to user's computer
    async downloadImage(imageUrl, filename) {
        try {
            // Use backend proxy to avoid CORS issues
            const proxyUrl = `${this.apiBase}/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
            
            // Fetch the image through our proxy
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error(`Download failed: ${response.status}`);
            
            // Get the image as a blob
            const blob = await response.blob();
            
            // Create a temporary URL for the blob
            const blobUrl = URL.createObjectURL(blob);
            
            // Create a temporary anchor element and trigger download
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            
            // Clean up
            document.body.removeChild(link);
            URL.revokeObjectURL(blobUrl);
            
            // Show success message
            eventBus.emit('toast:success', { 
                title: 'Download Started', 
                message: `${filename} is being downloaded` 
            });
            
        } catch (error) {
            console.error('Download failed:', error);
            eventBus.emit('toast:error', { 
                title: 'Download Failed', 
                message: 'Could not download the image. Please try again.' 
            });
        }
    }
    
    // Utility methods for accessing search data
    getSearchResults() {
        return this.searchResults;
    }
}

// Create and export singleton instance
const searchManager = new SearchManager();
export default searchManager;