import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from './middleware/auth.js';
import { supabase } from './shared/supabaseClient.js';
import { applicationInsights } from './shared/logging.js';

// Import routes
import authRoutes from './routes/auth.js';
import projectsRoutes from './routes/projects.js';
import documentsRoutes from './routes/documents.js';
import analysisRoutes from './routes/analysis.js';
import chatRoutes from './routes/chat.js';
import reportsRoutes from './routes/reports.js';

const app = express();

// Basic security middleware
app.use(helmet());
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
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

// Logging
if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
}

// Request parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        // Check Supabase connection
        const { data, error } = await supabase
            .from('app_settings')
            .select('key')
            .limit(1);

        if (error) {
            applicationInsights.trackEvent({
                name: 'HealthCheckFailed',
                properties: {
                    error: error.message,
                    component: 'Supabase'
                }
            });
            return res.status(500).json({
                status: 'error',
                message: 'Database connection failed',
                error: error.message
            });
        }

        applicationInsights.trackEvent({
            name: 'HealthCheckPassed',
            properties: {
                timestamp: new Date().toISOString()
            }
        });

        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: process.env.npm_package_version
        });
    } catch (error) {
        applicationInsights.trackException({ exception: error });
        res.status(500).json({
            status: 'error',
            message: 'Health check failed',
            error: error.message
        });
    }
});

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

// Error handling
app.use((err, req, res, next) => {
    applicationInsights.trackException({ exception: err });

    console.error(err.stack);

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
