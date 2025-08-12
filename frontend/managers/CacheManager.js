import eventBus from '../services/EventBus.js';
import { CACHE_KEYS, CACHE_EXPIRY, EVENTS } from '../utils/Constants.js';

class CacheManager {
    constructor() {
        this.cache = {
            albums: new Map(),
            folders: new Map(),
            expiry: {
                photos: CACHE_EXPIRY.ALBUM_PHOTOS,
                folders: CACHE_EXPIRY.FOLDER_CONTENTS,
                metadata: CACHE_EXPIRY.DEFAULT
            }
        };
        
        this.loadCache();
        this.setupEventListeners();
    }

    setupEventListeners() {
        eventBus.on('app:shutdown', () => {
            this.saveCache();
        });
    }

    loadCache() {
        try {
            const albumsCache = localStorage.getItem(CACHE_KEYS.ALBUM_PHOTOS);
            const foldersCache = localStorage.getItem(CACHE_KEYS.FOLDER_CONTENTS);
            
            if (albumsCache) {
                const parsed = JSON.parse(albumsCache);
                this.cache.albums = new Map(Object.entries(parsed));
            }
            
            if (foldersCache) {
                const parsed = JSON.parse(foldersCache);
                this.cache.folders = new Map(Object.entries(parsed));
            }
            
            console.log('Cache loaded:', {
                albums: this.cache.albums.size,
                folders: this.cache.folders.size
            });

            eventBus.emit(EVENTS.CACHE_UPDATED, {
                type: 'loaded',
                albums: this.cache.albums.size,
                folders: this.cache.folders.size
            });

        } catch (error) {
            console.error('Error loading cache:', error);
            this.cache.albums = new Map();
            this.cache.folders = new Map();
        }
    }
    
    saveCache() {
        try {
            const albumsObj = Object.fromEntries(this.cache.albums.entries());
            const foldersObj = Object.fromEntries(this.cache.folders.entries());
            
            localStorage.setItem(CACHE_KEYS.ALBUM_PHOTOS, JSON.stringify(albumsObj));
            localStorage.setItem(CACHE_KEYS.FOLDER_CONTENTS, JSON.stringify(foldersObj));

            eventBus.emit(EVENTS.CACHE_UPDATED, {
                type: 'saved',
                albums: this.cache.albums.size,
                folders: this.cache.folders.size
            });

        } catch (error) {
            console.error('Error saving cache:', error);
        }
    }
    
    isCacheValid(timestamp, type = 'photos') {
        const now = Date.now();
        const expiry = this.cache.expiry[type] || this.cache.expiry.photos;
        return (now - timestamp) < expiry;
    }
    
    getCachedAlbumPhotos(albumId) {
        const cached = this.cache.albums.get(albumId);
        if (cached && this.isCacheValid(cached.timestamp, 'photos')) {
            console.log('Using cached photos for album:', albumId);
            return cached.photos;
        }
        return null;
    }
    
    setCachedAlbumPhotos(albumId, photos, metadata = {}) {
        this.cache.albums.set(albumId, {
            photos: photos,
            metadata: metadata,
            timestamp: Date.now()
        });
        this.saveCache();
        console.log('Cached photos for album:', albumId, `(${photos.length} photos)`);

        eventBus.emit(EVENTS.CACHE_UPDATED, {
            type: 'album_photos_set',
            albumId,
            photoCount: photos.length
        });
    }
    
    getCachedFolderContents(nodeUri) {
        const key = nodeUri || 'root';
        const cached = this.cache.folders.get(key);
        if (cached && this.isCacheValid(cached.timestamp, 'folders')) {
            console.log('Using cached folder contents for:', key);
            return cached.contents;
        }
        return null;
    }
    
    setCachedFolderContents(nodeUri, contents) {
        const key = nodeUri || 'root';
        this.cache.folders.set(key, {
            contents: contents,
            timestamp: Date.now()
        });
        this.saveCache();
        console.log('Cached folder contents for:', key);

        eventBus.emit(EVENTS.CACHE_UPDATED, {
            type: 'folder_contents_set',
            nodeUri: key,
            contentCount: contents ? contents.length : 0
        });
    }
    
    clearCache() {
        this.cache.albums.clear();
        this.cache.folders.clear();
        localStorage.removeItem(CACHE_KEYS.ALBUM_PHOTOS);
        localStorage.removeItem(CACHE_KEYS.FOLDER_CONTENTS);
        console.log('🔍 DEBUG: Cache cleared');

        eventBus.emit(EVENTS.CACHE_UPDATED, {
            type: 'cleared',
            albums: 0,
            folders: 0
        });
    }

    getCacheStats() {
        return {
            albums: {
                count: this.cache.albums.size,
                entries: Array.from(this.cache.albums.keys())
            },
            folders: {
                count: this.cache.folders.size,
                entries: Array.from(this.cache.folders.keys())
            }
        };
    }

    updateCacheStatus() {
        const stats = this.getCacheStats();
        
        const albumsCountElement = document.getElementById('cache-albums-count');
        const foldersCountElement = document.getElementById('cache-folders-count');
        
        if (albumsCountElement) {
            albumsCountElement.textContent = stats.albums.count;
        }
        if (foldersCountElement) {
            foldersCountElement.textContent = stats.folders.count;
        }

        eventBus.emit(EVENTS.CACHE_UPDATED, {
            type: 'status_updated',
            stats
        });
    }

    removeExpiredEntries() {
        const now = Date.now();
        let removedAlbums = 0;
        let removedFolders = 0;

        for (const [key, value] of this.cache.albums.entries()) {
            if (!this.isCacheValid(value.timestamp, 'photos')) {
                this.cache.albums.delete(key);
                removedAlbums++;
            }
        }

        for (const [key, value] of this.cache.folders.entries()) {
            if (!this.isCacheValid(value.timestamp, 'folders')) {
                this.cache.folders.delete(key);
                removedFolders++;
            }
        }

        if (removedAlbums > 0 || removedFolders > 0) {
            this.saveCache();
            console.log('Removed expired cache entries:', {
                albums: removedAlbums,
                folders: removedFolders
            });

            eventBus.emit(EVENTS.CACHE_UPDATED, {
                type: 'cleanup',
                removedAlbums,
                removedFolders
            });
        }
    }

    setExpiryTime(type, milliseconds) {
        if (this.cache.expiry.hasOwnProperty(type)) {
            this.cache.expiry[type] = milliseconds;
            console.log(`Cache expiry for ${type} set to ${milliseconds}ms`);
        }
    }
}

const cacheManager = new CacheManager();
export default cacheManager;