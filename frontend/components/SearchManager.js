/**
 * SearchManager Component
 * 
 * Handles all search functionality across the application including main search,
 * filtering, natural language chat-based search, and search result display.
 * 
 * Key Responsibilities:
 * - Main search execution and display
 * - Search filter management (album, status, date filters)
 * - Natural language search processing for chat interface
 * - Search result rendering and interaction
 * - Search state management and UI updates
 */

import { eventBus } from '../services/EventBus.js';

class SearchManager {
    constructor() {
        this.apiBase = 'http://localhost:8000';
        this.searchResults = [];
        this.searchFilters = {
            album: '',
            status: '',
            dateFrom: '',
            dateTo: ''
        };
        this.smugmugAlbums = []; // Will be populated from app state
        
        this.setupEventListeners();
        console.log('SearchManager initialized');
    }

    setupEventListeners() {
        // Main search events
        eventBus.on('search:perform', () => this.performMainSearch());
        eventBus.on('search:clear', () => this.clearMainSearch());
        
        // Filter events
        eventBus.on('search:filters:toggle', () => this.toggleFilters());
        eventBus.on('search:filters:apply', () => this.applyFilters());
        eventBus.on('search:filters:clear', () => this.clearFilters());
        eventBus.on('search:filters:populate-albums', () => this.populateAlbumFilter());
        
        // Chat-based search events
        eventBus.on('search:chat:handle', (data) => this.handlePhotoSearchChat(data.message));
        
        // Album data updates
        eventBus.on('albums:loaded', (data) => {
            this.smugmugAlbums = data.albums || [];
            this.populateAlbumFilter();
        });
        
        // Page initialization
        eventBus.on('search:initialize-page', () => this.initializeSearchPage());

        // DOM event listeners for search functionality (moved from app.js)
        this.bindDOMEventListeners();
    }

    bindDOMEventListeners() {
        // Main search functionality DOM events
        const searchMainButton = document.getElementById('search-main-button');
        const searchMainInput = document.getElementById('search-main-input');
        const clearMainSearch = document.getElementById('clear-main-search');

        if (searchMainButton) {
            searchMainButton.addEventListener('click', () => eventBus.emit('search:perform'));
        }

        if (searchMainInput) {
            searchMainInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') eventBus.emit('search:perform');
            });
        }

        if (clearMainSearch) {
            clearMainSearch.addEventListener('click', () => eventBus.emit('search:clear'));
        }

        // Filter functionality DOM events  
        const toggleFilters = document.getElementById('toggle-filters');
        const applyFilters = document.getElementById('apply-filters');
        const clearFilters = document.getElementById('clear-filters');

        if (toggleFilters) {
            toggleFilters.addEventListener('click', () => eventBus.emit('search:filters:toggle'));
        }

        if (applyFilters) {
            applyFilters.addEventListener('click', () => eventBus.emit('search:filters:apply'));
        }

        if (clearFilters) {
            clearFilters.addEventListener('click', () => eventBus.emit('search:filters:clear'));
        }
    }

    // Search Page Initialization
    initializeSearchPage() {
        console.log('Search page initialized');
        this.populateAlbumFilter();
    }
    
    // Filter Management
    async populateAlbumFilter() {
        try {
            // Get albums for filter dropdown
            const albumSelect = document.getElementById('search-filter-album');
            if (!albumSelect) return;
            
            // Clear existing options except "All Albums"
            while (albumSelect.children.length > 1) {
                albumSelect.removeChild(albumSelect.lastChild);
            }
            
            // Add albums from current data
            if (this.smugmugAlbums && this.smugmugAlbums.length > 0) {
                this.smugmugAlbums.forEach(album => {
                    const option = document.createElement('option');
                    option.value = album.smugmug_id || album.album_key;
                    option.textContent = album.title || album.name;
                    albumSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error populating album filter:', error);
        }
    }
    
    toggleFilters() {
        const filtersDiv = document.getElementById('search-filters');
        const toggleText = document.getElementById('filter-toggle-text');
        const toggleIcon = document.getElementById('filter-toggle-icon');
        
        if (filtersDiv.classList.contains('hidden')) {
            filtersDiv.classList.remove('hidden');
            toggleText.textContent = 'Hide Filters';
            toggleIcon.style.transform = 'rotate(180deg)';
        } else {
            filtersDiv.classList.add('hidden');
            toggleText.textContent = 'Show Filters';
            toggleIcon.style.transform = 'rotate(0deg)';
        }
    }
    
    applyFilters() {
        // Get filter values
        this.searchFilters.album = document.getElementById('search-filter-album').value;
        this.searchFilters.status = document.getElementById('search-filter-status').value;
        this.searchFilters.dateFrom = document.getElementById('search-filter-date-from').value;
        this.searchFilters.dateTo = document.getElementById('search-filter-date-to').value;
        
        // Update active filters display
        this.updateActiveFiltersDisplay();
        
        // Re-run search with filters if there's a current query
        const searchInput = document.getElementById('search-main-input');
        if (searchInput.value.trim()) {
            this.performMainSearch();
        }
    }
    
    clearFilters() {
        // Clear filter values
        document.getElementById('search-filter-album').value = '';
        document.getElementById('search-filter-status').value = '';
        document.getElementById('search-filter-date-from').value = '';
        document.getElementById('search-filter-date-to').value = '';
        
        // Reset internal filter state
        this.searchFilters = {
            album: '',
            status: '',
            dateFrom: '',
            dateTo: ''
        };
        
        // Clear active filters display
        this.updateActiveFiltersDisplay();
        
        // Re-run search if there's a current query
        const searchInput = document.getElementById('search-main-input');
        if (searchInput.value.trim()) {
            this.performMainSearch();
        }
    }
    
    updateActiveFiltersDisplay() {
        const activeFiltersDiv = document.getElementById('active-filters');
        const activeFilters = [];
        
        if (this.searchFilters.album) {
            const albumSelect = document.getElementById('search-filter-album');
            const selectedAlbum = albumSelect.options[albumSelect.selectedIndex].text;
            activeFilters.push(`Album: ${selectedAlbum}`);
        }
        
        if (this.searchFilters.status) {
            const statusSelect = document.getElementById('search-filter-status');
            const selectedStatus = statusSelect.options[statusSelect.selectedIndex].text;
            activeFilters.push(`Status: ${selectedStatus}`);
        }
        
        if (this.searchFilters.dateFrom) {
            activeFilters.push(`From: ${this.searchFilters.dateFrom}`);
        }
        
        if (this.searchFilters.dateTo) {
            activeFilters.push(`To: ${this.searchFilters.dateTo}`);
        }
        
        if (activeFilters.length > 0) {
            activeFiltersDiv.innerHTML = `
                <div class="text-sm text-gray-600 mb-2">Active filters:</div>
                <div class="flex flex-wrap gap-2">
                    ${activeFilters.map(filter => 
                        `<span class="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">${filter}</span>`
                    ).join('')}
                </div>
            `;
            activeFiltersDiv.classList.remove('hidden');
        } else {
            activeFiltersDiv.classList.add('hidden');
        }
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
        
        // Build photo gallery for chat
        const photosHtml = photos.slice(0, 6).map(photo => {
            const confidence = photo.ai_metadata?.confidence_score || photo.confidence_score || 0;
            return `
                <div class="inline-block w-20 h-20 mr-2 mb-2 relative cursor-pointer hover:scale-105 transition-transform" 
                     onclick="eventBus.emit('photo:show-modal', {photo: ${JSON.stringify(photo).replace(/"/g, '&quot;')}})">
                    <img src="${photo.thumbnail_url}" alt="${photo.title || 'Photo'}" 
                         class="w-full h-full object-cover rounded-lg border-2 border-transparent hover:border-blue-400" />
                    <div class="absolute top-0 right-0 bg-blue-600 text-white text-xs px-1 rounded-bl-lg">
                        ${Math.round(confidence * 100)}%
                    </div>
                </div>
            `;
        }).join('');
        
        let responseMessage = `Found ${photos.length} photos matching "${searchQuery}":`;
        
        if (photos.length > 6) {
            responseMessage += ` (showing first 6)`;
        }
        
        eventBus.emit('chat:add-message', {
            type: 'system',
            message: responseMessage + '<div class="mt-2">' + photosHtml + '</div>'
        });
        
        if (photos.length > 6) {
            eventBus.emit('chat:add-message', {
                type: 'system',
                message: `<div class="text-center mt-2"><button onclick="eventBus.emit('page:switch', {page: 'search'}); document.getElementById('search-main-input').value = '${searchQuery}'; eventBus.emit('search:perform');" class="text-blue-600 hover:text-blue-800 underline">View all ${photos.length} results in Search page</button></div>`
            });
        }
    }

    // Main Search Functionality  
    async performMainSearch() {
        const input = document.getElementById('search-main-input');
        const query = input.value.trim();
        const searchType = document.getElementById('search-main-type').value;
        
        if (!query) return;
        
        eventBus.emit('search:loading:show');
        
        try {
            // Build search URL with filters
            const params = new URLSearchParams({
                q: query,
                search_type: searchType,
                limit: '50'
            });
            
            // Add filter parameters if they exist
            if (this.searchFilters.album) {
                params.append('album', this.searchFilters.album);
            }
            if (this.searchFilters.status) {
                params.append('status', this.searchFilters.status);
            }
            if (this.searchFilters.dateFrom) {
                params.append('date_from', this.searchFilters.dateFrom);
            }
            if (this.searchFilters.dateTo) {
                params.append('date_to', this.searchFilters.dateTo);
            }
            
            const response = await fetch(`${this.apiBase}/search?${params}`);
            if (!response.ok) throw new Error(`Search failed: ${response.status}`);
            
            const results = await response.json();
            this.searchResults = results.photos || [];
            
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
        
        // Get AI confidence score from AI metadata
        const aiConfidence = photo.ai_metadata?.confidence_score || 
                           (photo.confidence_score ? photo.confidence_score : 0);
        
        div.innerHTML = `
            <div class="aspect-square bg-gray-100 rounded-lg overflow-hidden relative">
                <img 
                    src="${photo.thumbnail_url}" 
                    alt="${photo.title || 'Search result'}"
                    class="w-full h-full object-cover"
                    loading="lazy"
                />
                
                <!-- AI Confidence score -->
                <div class="absolute top-2 right-2 bg-blue-600 text-white text-xs px-2 py-1 rounded-full z-20">
                    ${Math.round(aiConfidence * 100)}%
                </div>
                
                <!-- Download button -->
                <div class="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                    <a href="${photo.image_url || photo.thumbnail_url}" 
                       download="${photo.title || 'photo'}"
                       class="download-btn inline-block w-8 h-8 bg-green-600 bg-opacity-80 hover:bg-opacity-100 rounded-full flex items-center justify-center text-white transition-all mr-1" 
                       onclick="event.stopPropagation()"
                       title="Download">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                    </a>
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

    // Utility methods for accessing search data
    getSearchResults() {
        return this.searchResults;
    }

    getSearchFilters() {
        return this.searchFilters;
    }

    setAlbums(albums) {
        this.smugmugAlbums = albums;
        this.populateAlbumFilter();
    }
}

// Create and export singleton instance
const searchManager = new SearchManager();
export default searchManager;