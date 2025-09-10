// Frontend Configuration
// Dynamically determines API URL based on environment

const getApiUrl = () => {
    // Check if we're in production (not localhost)
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    const port = window.location.port;
    
    // Production domains
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
        // In production, use relative URLs (same origin)
        // or use the backend subdomain if configured
        if (hostname.includes('railway.app')) {
            // Railway deployment - backend is on same domain or separate service
            // Check if we have a backend subdomain
            const backendDomain = hostname.replace('-frontend', '');
            return `${protocol}//${backendDomain}`;
        }
        // For other production deployments
        return ''; // Use relative URLs
    }
    
    // Local development
    if (port === '3001') {
        // Docker environment
        return 'http://localhost:8001';
    }
    
    // Default local development
    return 'http://localhost:8000';
};

const getWebSocketUrl = () => {
    const apiUrl = getApiUrl();
    if (!apiUrl) return '/ws'; // Relative WebSocket URL
    
    // Convert http(s) to ws(s)
    return apiUrl.replace(/^http/, 'ws') + '/ws';
};

// Export configuration
const config = {
    API_URL: getApiUrl(),
    WS_URL: getWebSocketUrl(),
    ENVIRONMENT: window.location.hostname === 'localhost' ? 'development' : 'production',
    
    // Feature flags
    ENABLE_DEBUG: window.location.hostname === 'localhost',
    ENABLE_ANALYTICS: window.location.hostname !== 'localhost',
    
    // OAuth callback URL (needs to be absolute)
    OAUTH_CALLBACK_URL: `${window.location.protocol}//${window.location.host}/callback`
};

// Make config globally available
window.APP_CONFIG = config;

export default config;