import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Photo APIs
export const photoAPI = {
  upload: async (file: File, album?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (album) formData.append('album', album);
    
    return api.post('/api/photos/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  uploadBatch: async (files: File[], album?: string) => {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    if (album) formData.append('album', album);
    
    return api.post('/api/photos/upload-batch', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  search: async (query: string, limit = 20, offset = 0) => {
    return api.get('/api/photos/search', {
      params: { query, limit, offset },
    });
  },
  
  getPhoto: async (photoId: string) => {
    return api.get(`/api/photos/${photoId}`);
  },
};

// Chat APIs
export const chatAPI = {
  sendMessage: async (message: string, sessionId?: string) => {
    return api.post('/api/chat/message', {
      message,
      session_id: sessionId,
    });
  },
  
  getHistory: async (sessionId: string, limit = 50, offset = 0) => {
    return api.get(`/api/chat/history/${sessionId}`, {
      params: { limit, offset },
    });
  },
};

// Health check
export const healthAPI = {
  check: async () => {
    return api.get('/api/health');
  },
};