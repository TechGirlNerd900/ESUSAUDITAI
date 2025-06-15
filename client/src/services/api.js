import axios from 'axios';
import supabase from './supabaseClient';

// Create axios instance for Express backend
const api = axios.create({
    // Use Vite proxy in development, otherwise use VITE_API_URL
    baseURL: import.meta.env.DEV ? '/api' : (import.meta.env.VITE_API_URL || '/api'),
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// Helper function for exponential backoff
const getRetryDelay = (retryCount) => {
    return RETRY_DELAY * Math.pow(2, retryCount);
};

const isRetryableError = (error) => {
    if (!error.response) return true;
    const status = error.response.status;
    return status >= 500 || status === 408 || status === 429;
};

// Add request interceptor for auth token
api.interceptors.request.use(async (config) => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
            config.headers.Authorization = `Bearer ${session.access_token}`;
        }
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
        if (import.meta.env.DEV) {
            console.log(`✅ ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);
        }
        return response.data;
    },
    async (error) => {
        const config = error.config;

        if (import.meta.env.DEV) {
            console.error(`❌ ${config?.method?.toUpperCase()} ${config?.url} - ${error.response?.status || 'Network Error'}`, error);
        }

        if (error.response?.status === 401) {
            await supabase.auth.signOut();
            window.location.href = '/login';
            return Promise.reject(error);
        }

        if (config && isRetryableError(error) && config.metadata.retryCount < MAX_RETRIES) {
            config.metadata.retryCount += 1;
            const delay = getRetryDelay(config.metadata.retryCount - 1);
            console.log(`🔄 Retrying request (${config.metadata.retryCount}/${MAX_RETRIES}) after ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return api(config);
        }

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

export const apiService = {
    // Express Backend API Calls
    // Authentication
    async login(credentials) {
        const response = await api.post('/auth/login', credentials);
        return response;
    },

    async register(userData) {
        const response = await api.post('/auth/register', userData);
        return response;
    },

    async logout() {
        const { data } = await api.post('/auth/logout');
        return data;
    },

    // Projects
    async getProjectById(id) {
        const { data } = await api.get(`/projects/${id}`);
        return data;
    },

    // Documents
    async uploadDocument(projectId, file, onProgress) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('projectId', projectId);

        const { data } = await api.post('/documents/upload', formData, {
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

    async analyzeDocument(documentId) {
        const { data } = await api.post(`/analysis/document/${documentId}`);
        return data;
    },

    // Chat with AI
    async sendChatMessage(projectId, message) {
        const { data } = await api.post(`/chat/${projectId}`, { message });
        return data;
    },

    // Supabase Database Operations
    async getProjects() {
        const { data, error } = await supabase
            .from('projects')
            .select(`
                *,
                documents (
                    id,
                    name,
                    status,
                    created_at
                )
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    async createProject(projectData) {
        const { data, error } = await supabase
            .from('projects')
            .insert([projectData])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async getDocuments(projectId) {
        const { data, error } = await supabase
            .from('documents')
            .select(`
                *,
                analysis_results (*)
            `)
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    async getAnalysisResults(documentId) {
        const { data, error } = await supabase
            .from('analysis_results')
            .select('*')
            .eq('document_id', documentId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    // Reports
    async getReports(projectId) {
        const { data, error } = await supabase
            .from('audit_reports')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return { reports: data };
    },

    async generateReport(projectId, reportName, includeCharts) {
        const { data, error } = await api.post(`/reports/generate`, {
            projectId,
            reportName,
            includeCharts
        });
        
        if (error) throw error;
        return data;
    },

    // Real-time subscriptions
    subscribeToAnalysisResults(documentId, callback) {
        return supabase
            .channel(`analysis_results_${documentId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'analysis_results',
                filter: `document_id=eq.${documentId}`
            }, callback)
            .subscribe();
    },

    // Error Handling
    handleError(error, operation) {
        console.error(`API Error in ${operation}:`, error);
        const errorMap = {
            'PGRST301': 'Database error occurred',
            'PGRST302': 'Invalid input data',
            'PGRST204': 'No data found',
            'UNAUTHORIZED': 'Authentication required',
            'FORBIDDEN': 'Access denied',
            'default': 'An unexpected error occurred'
        };

        const message = errorMap[error?.code] || errorMap.default;
        throw new Error(`${message} (${operation})`);
    }
};

// Named exports for different service areas
export const authService = {
    login: apiService.login,
    register: apiService.register,
    logout: apiService.logout,
    verify: async () => {
        const response = await api.get('/auth/verify');
        return response;
    },
    requestPasswordReset: async (data) => {
        const response = await api.post('/auth/reset-password', data);
        return response;
    },
    changePassword: async (data) => {
        const response = await api.post('/auth/change-password', data);
        return response;
    },
    updateProfile: async (data) => {
        const response = await api.put('/auth/profile', data);
        return response;
    }
};

export const projectsService = {
    getProjects: apiService.getProjects,
    getProjectById: apiService.getProjectById,
    createProject: apiService.createProject
};

export const documentsService = {
    uploadDocument: apiService.uploadDocument,
    getDocuments: apiService.getDocuments,
    analyzeDocument: apiService.analyzeDocument
};

export const chatService = {
    sendChatMessage: apiService.sendChatMessage
};
// Export the reports service
export const reportsService = {
    getReports: apiService.getReports,
    generateReport: apiService.generateReport
};
  

export default apiService;