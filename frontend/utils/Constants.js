export const API_ENDPOINTS = {
    AUTH: {
        SMUGMUG_REQUEST: '/auth/smugmug/request',
        SMUGMUG_CALLBACK: '/auth/smugmug/callback',
        STATUS: '/auth/status'
    },
    PHOTOS: {
        SYNC: '/photos/sync',
        LIST: '/photos',
        SINGLE: '/photos/{id}',
        DELETE: '/photos/{id}',
        PROCESS: '/photos/{id}/process',
        BATCH_PROCESS: '/photos/process/batch',
        QUEUE: '/photos/process/queue',
        SIMILAR: '/photos/{id}/similar'
    },
    METADATA: {
        GET: '/metadata/{id}',
        UPDATE: '/metadata/{id}'
    },
    SEARCH: '/search',
    COLLECTIONS: {
        LIST: '/collections',
        CREATE: '/collections',
        GET: '/collections/{id}',
        UPDATE: '/collections/{id}',
        DELETE: '/collections/{id}',
        PHOTOS: '/collections/{id}/photos'
    },
    STATUS: '/status',
    HEALTH: '/health'
};

export const PHOTO_STATUS = {
    UNPROCESSED: 'unprocessed',
    PROCESSING: 'processing',
    PROCESSED: 'processed',
    FAILED: 'failed'
};

export const PROCESSING_STATUS = {
    IDLE: 'idle',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed'
};

export const CACHE_KEYS = {
    APP_STATE: 'targetvision_app_state',
    ALBUM_PHOTOS: 'targetvision_album_photos',
    FOLDER_CONTENTS: 'targetvision_folder_contents',
    USER_SETTINGS: 'targetvision_user_settings',
    SEARCH_HISTORY: 'targetvision_search_history',
    COLLECTIONS: 'targetvision_collections'
};

export const CACHE_EXPIRY = {
    DEFAULT: 30 * 60 * 1000, // 30 minutes
    ALBUM_PHOTOS: 15 * 60 * 1000, // 15 minutes
    FOLDER_CONTENTS: 10 * 60 * 1000, // 10 minutes
    USER_SETTINGS: 24 * 60 * 60 * 1000, // 24 hours
    SEARCH_HISTORY: 7 * 24 * 60 * 60 * 1000 // 7 days
};

export const UI_CONSTANTS = {
    PHOTO_GRID_SIZES: {
        SMALL: 150,
        MEDIUM: 200,
        LARGE: 250
    },
    PAGINATION: {
        DEFAULT_LIMIT: 50,
        MAX_LIMIT: 200
    },
    TOAST_DURATION: {
        SUCCESS: 3000,
        ERROR: 5000,
        WARNING: 4000,
        INFO: 3000
    },
    MODAL_SIZES: {
        SMALL: 'max-w-md',
        MEDIUM: 'max-w-lg',
        LARGE: 'max-w-4xl',
        FULL: 'max-w-full'
    },
    PROGRESS_UPDATE_INTERVAL: 500,
    BATCH_PROCESS_CHUNK_SIZE: 10
};

export const ERROR_MESSAGES = {
    NETWORK_ERROR: 'Network connection error. Please check your internet connection.',
    AUTH_REQUIRED: 'Please authenticate with SmugMug to continue.',
    INVALID_RESPONSE: 'Received invalid response from server.',
    TIMEOUT_ERROR: 'Request timed out. Please try again.',
    PERMISSION_DENIED: 'Permission denied. Please check your authentication.',
    PHOTO_NOT_FOUND: 'Photo not found.',
    PROCESSING_FAILED: 'Photo processing failed. Please try again.',
    CACHE_ERROR: 'Cache operation failed.',
    UNKNOWN_ERROR: 'An unexpected error occurred.'
};

export const SUCCESS_MESSAGES = {
    PHOTO_PROCESSED: 'Photo processed successfully!',
    PHOTOS_SYNCED: 'Photos synced successfully!',
    COLLECTION_CREATED: 'Collection created successfully!',
    COLLECTION_UPDATED: 'Collection updated successfully!',
    METADATA_SAVED: 'Metadata saved successfully!',
    SETTINGS_SAVED: 'Settings saved successfully!'
};

export const EVENTS = {
    ALBUM_SELECTED: 'album:selected',
    PHOTOS_LOADED: 'photos:loaded',
    PHOTO_PROCESSED: 'photo:processed',
    BATCH_PROGRESS: 'batch:progress',
    CACHE_UPDATED: 'cache:updated',
    STATE_CHANGED: 'state:changed',
    SEARCH_PERFORMED: 'search:performed',
    COLLECTION_CHANGED: 'collection:changed',
    UI_TOAST_SHOW: 'ui:toast:show',
    UI_MODAL_OPEN: 'ui:modal:open',
    UI_MODAL_CLOSE: 'ui:modal:close',
    UI_LOADING_START: 'ui:loading:start',
    UI_LOADING_END: 'ui:loading:end'
};

export const CSS_CLASSES = {
    LOADING: 'opacity-50 pointer-events-none',
    SELECTED: 'ring-2 ring-blue-500 bg-blue-50',
    ERROR: 'border-red-500 text-red-500',
    SUCCESS: 'border-green-500 text-green-500',
    WARNING: 'border-yellow-500 text-yellow-500',
    HIDDEN: 'hidden',
    VISIBLE: 'block'
};

export const STATUS_ICONS = {
    [PHOTO_STATUS.UNPROCESSED]: '○',
    [PHOTO_STATUS.PROCESSING]: '⏳',
    [PHOTO_STATUS.PROCESSED]: '✓',
    [PHOTO_STATUS.FAILED]: '✗'
};

export const STATUS_COLORS = {
    [PHOTO_STATUS.UNPROCESSED]: 'text-gray-400',
    [PHOTO_STATUS.PROCESSING]: 'text-yellow-500',
    [PHOTO_STATUS.PROCESSED]: 'text-green-500',
    [PHOTO_STATUS.FAILED]: 'text-red-500'
};

export const MIME_TYPES = {
    JPEG: 'image/jpeg',
    PNG: 'image/png',
    WEBP: 'image/webp',
    GIF: 'image/gif'
};

export const FILE_EXTENSIONS = {
    JPEG: ['.jpg', '.jpeg'],
    PNG: ['.png'],
    WEBP: ['.webp'],
    GIF: ['.gif']
};