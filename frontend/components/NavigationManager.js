/**
 * NavigationManager Component
 * 
 * Handles page navigation, route management, and navigation-related event listeners.
 * 
 * Key Responsibilities:
 * - Page switching and routing
 * - Navigation event listeners
 * - Page state management
 * - URL state synchronization
 */

import eventBus from '../services/EventBus.js';
import stateManager from '../managers/StateManager.js';
import cacheManager from '../managers/CacheManager.js';

class NavigationManager {
    constructor() {
        this.currentPage = 'albums';
        this.domReady = false;
        
        this.setupEventListeners();
        
        // Defer DOM event listener setup until DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializeDOMListeners());
        } else {
            // DOM is already ready
            this.initializeDOMListeners();
        }
        
        console.log('NavigationManager initialized');
    }

    setupEventListeners() {
        // Navigation events from other components
        eventBus.on('navigation:show-page', (data) => this.showPage(data.pageName));
    }

    initializeDOMListeners() {
        if (this.domReady) return; // Prevent double initialization
        
        try {
            // Navigation tab listeners
            const navAlbums = document.getElementById('nav-albums');
            const navCollections = document.getElementById('nav-collections');
            const navChat = document.getElementById('nav-chat');
            const navSearch = document.getElementById('nav-search');
            const navSettings = document.getElementById('nav-settings');
            
            if (navAlbums) {
                navAlbums.addEventListener('click', () => this.showPage('albums'));
                console.log('Albums navigation bound');
            }
            
            if (navCollections) {
                navCollections.addEventListener('click', () => {
                    console.log('Collections button clicked!');
                    this.showPage('collections');
                });
                console.log('Collections navigation bound');
            }
            
            if (navChat) {
                navChat.addEventListener('click', () => this.showPage('chat'));
                console.log('Chat navigation bound');
            }
            
            if (navSearch) {
                navSearch.addEventListener('click', () => this.showPage('search'));
                console.log('Search navigation bound');
            }
            
            if (navSettings) {
                navSettings.addEventListener('click', () => {
                    console.log('Settings button clicked!');
                    this.showPage('settings');
                });
                console.log('Settings navigation bound');
            }
            
            console.log('Navigation event listeners bound successfully');
            this.domReady = true;
        } catch (error) {
            console.error('Error binding navigation event listeners:', error);
            // Retry after a short delay if DOM elements weren't found
            setTimeout(() => this.initializeDOMListeners(), 100);
        }
    }

    showPage(pageName) {
        try {
            console.log(`Switching to page: ${pageName}`);
            
            // Hide all pages
            document.getElementById('page-albums').classList.add('hidden');
            document.getElementById('page-collections').classList.add('hidden');
            document.getElementById('page-chat').classList.add('hidden');
            document.getElementById('page-search').classList.add('hidden');
            document.getElementById('page-settings').classList.add('hidden');
            
            // Remove active state from all nav tabs
            document.querySelectorAll('.nav-tab').forEach(tab => {
                tab.classList.remove('nav-tab-active');
            });
            
            // Show selected page and activate tab
            const pageElement = document.getElementById(`page-${pageName}`);
            const navElement = document.getElementById(`nav-${pageName}`);
            
            if (pageElement) {
                pageElement.classList.remove('hidden');
                console.log(`Page ${pageName} shown successfully`);
            } else {
                console.error(`Page element not found: page-${pageName}`);
            }
            
            if (navElement) {
                navElement.classList.add('nav-tab-active');
            } else {
                console.error(`Nav element not found: nav-${pageName}`);
            }
            
            this.currentPage = pageName;
            
            // Update StateManager with current page and save state
            eventBus.emit('state:page-changed', { currentPage: pageName });
            
            // Initialize page if needed
            if (pageName === 'albums') {
                // Signal to app to load albums view
                eventBus.emit('app:show-albums-view');
            } else if (pageName === 'collections') {
                eventBus.emit('collections:initialize-page');
            } else if (pageName === 'chat') {
                eventBus.emit('chat:initialize-page');
            } else if (pageName === 'search') {
                eventBus.emit('search:initialize-page');
            } else if (pageName === 'settings') {
                eventBus.emit('settings:initialize-page');
            }
        } catch (error) {
            console.error('Error in showPage:', error);
        }
    }

    getCurrentPage() {
        return this.currentPage;
    }
}

// Create and export singleton instance
const navigationManager = new NavigationManager();
export default navigationManager;