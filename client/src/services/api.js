import axios from 'axios';
import supabase from './supabaseClient';

// Create axios instance with configuration
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
    timeout: 30000, // 30 second timeout
    headers: {
        'Content-Type': 'application/json'
    }
});

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// Helper function for exponential backoff
const getRetryDelay = (retryCount) => {
  return RETRY_DELAY * Math.pow(2, retryCount);
};

// Helper function to check if error is retryable
const isRetryableError = (error) => {
  if (!error.response) return true; // Network errors are retryable
  const status = error.response.status;
  return status >= 500 || status === 408 || status === 429; // Server errors, timeout, rate limit
};

// Add request interceptor for auth
api.interceptors.request.use(async (config) => {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (session?.access_token) {
            config.headers.Authorization = `Bearer ${session.access_token}`;
        }

        // Add retry metadata
        config.metadata = {
          retryCount: config.metadata?.retryCount || 0,
          startTime: config.metadata?.startTime || Date.now()
        };

        return config;
    } catch (error) {
        return Promise.reject(error);
    }
});

// Add response interceptor for error handling
api.interceptors.response.use(
    (response) => {
        // Log successful requests in development
        if (import.meta.env.DEV) {
          console.log(`✅ ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);
        }
        return response.data;
    },
    async (error) => {
        const config = error.config;

        // Log errors in development
        if (import.meta.env.DEV) {
          console.error(`❌ ${config?.method?.toUpperCase()} ${config?.url} - ${error.response?.status || 'Network Error'}`, error);
        }

        // Handle authentication errors
        if (error.response?.status === 401) {
          // Clear session and redirect to login
          await supabase.auth.signOut();
          window.location.href = '/login';
          return Promise.reject(error);
        }

        // Handle retry logic
        if (config && isRetryableError(error) && config.metadata.retryCount < MAX_RETRIES) {
          config.metadata.retryCount += 1;
          const delay = getRetryDelay(config.metadata.retryCount - 1);

          console.log(`🔄 Retrying request (${config.metadata.retryCount}/${MAX_RETRIES}) after ${delay}ms`);

          await new Promise(resolve => setTimeout(resolve, delay));
          return api(config);
        }

        // Format error response
        const errorResponse = {
          error: error.response?.data?.error || error.message || 'An unexpected error occurred',
          code: error.response?.data?.code || error.code || 'UNKNOWN_ERROR',
          status: error.response?.status || 0,
          retries: config?.metadata?.retryCount || 0,
          duration: config?.metadata ? Date.now() - config.metadata.startTime : 0
        };

        return Promise.reject(errorResponse);
    }
);

// API methods
export const apiService = {
    // Authentication
    async login(credentials) {
        const { data } = await api.post('/auth/login', credentials);
        return data;
    },

    async register(userData) {
        try {
            const { data } = await api.post('/auth/register', userData);
            return data;
        } catch (error) {
            console.error('API register error:', error);
            throw error; // Re-throw to be handled by the mutation's onError
        }
    },

    async logout() {
        const { data } = await api.post('/auth/logout');
        return data;
    },

    async verify() {
        const { data } = await api.get('/auth/verify');
        return data;
    },

    // Projects
    async getProjects() {
        const { data } = await api.get('/projects');
        return data;
    },

    async getProjectById(id) {
        const { data } = await api.get(`/projects/${id}`);
        return data;
    },

    async createProject(projectData) {
        const { data } = await api.post('/projects', projectData);
        return data;
    },

    // Documents
    async uploadDocument(projectId, file, onProgress) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('projectId', projectId);

        const { data } = await api.post(`/documents/upload`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            },
            onUploadProgress: (progressEvent) => {
                const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                onProgress?.(percentCompleted);
            }
        });
        return data;
    },

    async getProjectDocuments(projectId) {
        const { data } = await api.get(`/documents/project/${projectId}`);
        return data;
    },

    async analyzeDocument(documentId) {
        const { data } = await api.post(`/analysis/document/${documentId}`);
        return data;
    },

    // Reports
    async generateReport(projectId, options) {
        const { data } = await api.post(`/reports/generate/${projectId}`, options);
        return data;
    },

    async getProjectReports(projectId) {
        const { data } = await api.get(`/reports/project/${projectId}`);
        return data;
    },

    // Chat
    async sendChatMessage(projectId, message) {
        const { data } = await api.post(`/chat/${projectId}`, { message });
        return data;
    },

    async getChatHistory(projectId) {
        const { data } = await api.get(`/chat/history/${projectId}`);
        return data;
    },

    // Error handler wrapper
    async withErrorHandling(apiCall, customErrorHandler) {
        try {
            return await apiCall();
        } catch (error) {
            if (customErrorHandler) {
                customErrorHandler(error);
            }
            throw error;
        }
    }
};

// Named exports for compatibility with component imports
export const authService = {
  login: apiService.login,
  register: apiService.register,
  logout: apiService.logout,
  verify: apiService.verify,
  withErrorHandling: apiService.withErrorHandling
};

export const projectsService = {
  getProjects: apiService.getProjects,
  getProjectById: apiService.getProjectById,
  createProject: apiService.createProject
};

export const documentsService = {
  uploadDocument: apiService.uploadDocument,
  getProjectDocuments: apiService.getProjectDocuments,
  analyzeDocument: apiService.analyzeDocument
};

export const reportsService = {
  generateReport: apiService.generateReport,
  getProjectReports: apiService.getProjectReports
};

export const chatService = {
  sendChatMessage: apiService.sendChatMessage,
  getChatHistory: apiService.getChatHistory
};

export default apiService;
