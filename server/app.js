import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from './middleware/auth.js';
import { supabase } from './shared/supabaseClient.js';
import { applicationInsights } from './shared/logging.js';
import logger from './shared/logger.js';
import { sanitizeInput } from './middleware/validation.js';
import { 
    healthCheckHandler, 
    readinessCheck, 
    livenessCheck, 
    getMetrics,
    performanceMonitor,
    errorRateMonitor 
} from './middleware/monitoring.js';

// Import routes
import authRoutes from './routes/auth.js';
import projectsRoutes from './routes/projects.js';
import documentsRoutes from './routes/documents.js';
import analysisRoutes from './routes/analysis.js';
import chatRoutes from './routes/chat.js';
import reportsRoutes from './routes/reports.js';
import adminRoutes from './routes/admin.js';
import storageRoutes from './routes/storage.js';

const app = express();

// Basic security middleware
const supabaseUrl = process.env.SUPABASE_URL || 'https://localhost';
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", supabaseUrl]
        }
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));

// Enhanced CORS configuration for production
const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',')
    : process.env.NODE_ENV === 'production' 
        ? [] // No wildcard in production
        : ['http://localhost:3000', 'http://127.0.0.1:3000'];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin && process.env.NODE_ENV !== 'production') {
            return callback(null, true);
        }
        
        if (allowedOrigins.includes(origin) || 
            (process.env.NODE_ENV !== 'production' && allowedOrigins.includes('*'))) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS policy'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    maxAge: 86400 // 24 hours
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
});

const authLimiter = rateLimit({
    windowMs: 900000, // 15 minutes
    max: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS) || 5,
    message: 'Too many authentication attempts, please try again later'
});

// Request logging
if (process.env.NODE_ENV !== 'test') {
    if (process.env.NODE_ENV === 'production') {
        app.use(logger.requestLogger.bind(logger));
    } else {
        app.use(morgan('dev'));
    }
}

// Performance monitoring
app.use(performanceMonitor);

// Request parsing with input sanitization
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser()); // Parse cookies from incoming requests
app.use(sanitizeInput);

// Health and monitoring endpoints
app.get('/health', healthCheckHandler);
app.get('/health/ready', readinessCheck);
app.get('/health/live', livenessCheck);
app.get('/metrics', getMetrics);

// Apply rate limiting to auth routes
app.use('/api/auth', authLimiter, authRoutes);

// Apply general rate limiting to other routes
app.use('/api', limiter);

// Protected routes
app.use('/api/projects', authMiddleware, projectsRoutes);
app.use('/api/documents', authMiddleware, documentsRoutes);
app.use('/api/analysis', authMiddleware, analysisRoutes);
app.use('/api/chat', authMiddleware, chatRoutes);
app.use('/api/reports', authMiddleware, reportsRoutes);
app.use('/api/storage', storageRoutes); // Storage routes have their own protectRoute middleware
app.use('/api/admin', adminRoutes); // Admin routes have their own auth middleware

// Error rate monitoring
app.use(errorRateMonitor);

// Error handling
app.use((err, req, res, next) => {
    logger.error('Unhandled application error', {
        error: err,
        stack: err.stack,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userId: req.user?.id,
        requestId: req.requestId
    });

    // Handle specific error types
    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({
            error: 'Invalid or expired token'
        });
    }

    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: err.message
        });
    }

    // Default error response
    res.status(500).json({
        error: process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : err.message
    });
});

// 404 handler
app.use((req, res) => {
    applicationInsights.trackEvent({
        name: 'NotFound',
        properties: {
            path: req.path,
            method: req.method
        }
    });

    res.status(404).json({
        error: 'Not found'
    });
});

export default app;
