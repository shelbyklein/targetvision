import eventBus from './EventBus.js';

class APIService {
    constructor(baseURL = '', options = {}) {
        this.baseURL = baseURL;
        this.defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            timeout: options.timeout || 30000,
            ...options
        };
        this.interceptors = {
            request: [],
            response: []
        };
    }

    addRequestInterceptor(interceptor) {
        this.interceptors.request.push(interceptor);
    }

    addResponseInterceptor(interceptor) {
        this.interceptors.response.push(interceptor);
    }

    async request(endpoint, options = {}) {
        const url = this.baseURL + endpoint;
        const config = {
            ...this.defaultOptions,
            ...options,
            headers: {
                ...this.defaultOptions.headers,
                ...options.headers
            }
        };

        for (const interceptor of this.interceptors.request) {
            try {
                await interceptor(config);
            } catch (error) {
                console.warn('Request interceptor error:', error);
            }
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeout);

        try {
            const response = await fetch(url, {
                ...config,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            let result = { response, data: null, error: null };

            try {
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    result.data = await response.json();
                } else {
                    result.data = await response.text();
                }
            } catch (parseError) {
                console.warn('Failed to parse response:', parseError);
                result.data = null;
            }

            for (const interceptor of this.interceptors.response) {
                try {
                    await interceptor(result);
                } catch (error) {
                    console.warn('Response interceptor error:', error);
                }
            }

            if (!response.ok) {
                const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
                error.status = response.status;
                error.response = response;
                error.data = result.data;
                throw error;
            }

            return result.data;
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                const timeoutError = new Error(`Request timeout after ${config.timeout}ms`);
                timeoutError.name = 'TimeoutError';
                throw timeoutError;
            }

            eventBus.emit('api:error', {
                endpoint,
                error,
                config
            });

            throw error;
        }
    }

    async get(endpoint, params = {}, options = {}) {
        const searchParams = new URLSearchParams(params);
        const url = searchParams.toString() ? `${endpoint}?${searchParams}` : endpoint;
        return this.request(url, { ...options, method: 'GET' });
    }

    async post(endpoint, data = null, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'POST',
            body: data ? JSON.stringify(data) : null
        });
    }

    async put(endpoint, data = null, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'PUT',
            body: data ? JSON.stringify(data) : null
        });
    }

    async patch(endpoint, data = null, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'PATCH',
            body: data ? JSON.stringify(data) : null
        });
    }

    async delete(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'DELETE' });
    }

    async uploadFile(endpoint, file, fieldName = 'file', options = {}) {
        const formData = new FormData();
        formData.append(fieldName, file);

        const config = {
            ...options,
            method: 'POST',
            body: formData
        };

        delete config.headers['Content-Type'];

        return this.request(endpoint, config);
    }
}

const apiService = new APIService('/api');

apiService.addRequestInterceptor(async (config) => {
    eventBus.emit('api:request:start', config);
});

apiService.addResponseInterceptor(async (result) => {
    eventBus.emit('api:request:end', result);
});

export default apiService;