const express = require('express');
const cors = require('cors');
const { AzureKeyCredential } = require('@azure/core-auth');
const dotenv = require('dotenv');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { applicationInsights } = require('./shared/logging');
const { validateEnvOrExit } = require('./utils/envValidator');
const { errorMiddleware } = require('./utils/errorHandler');
const SecurityService = require('./shared/security');
const { DocumentAnalysisClient } = require('@azure/ai-form-recognizer');
const { SearchClient, SearchKeyCredential } = require('@azure/search-documents');
const { OpenAIClient } = require('@azure/openai');

// Import routes
const projectsRouter = require('./routes/projects');
const documentsRouter = require('./routes/documents');
const authRouter = require('./routes/auth');
const analysisRouter = require('./routes/analysis');
const chatRouter = require('./routes/chat');
const reportsRouter = require('./routes/reports');


// Load environment variables
dotenv.config({ path: './.env' });
dotenv.config({ path: '../.env' }); // Try root .env
dotenv.config({ path: '../config/dev.env' }); // Try config/dev.env
dotenv.config({ path: '../config/prod.env' }); // Try config/prod.env

// Validate environment variables
validateEnvOrExit();

// Initialize Express app
const app = express();

// Trust proxy - required for rate limiting behind Render's proxy
app.set('trust proxy', 1);

// Initialize security service
const security = new SecurityService();

// Initialize Supabase client
const { supabase } = require('./shared/supabaseClient');


// Production security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            connectSrc: [
                "'self'",
                process.env.SUPABASE_URL,
                "https://*.azure.com",
                "https://*.applicationinsights.azure.com"
            ],
            imgSrc: ["'self'", "data:", "https:"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            upgradeInsecureRequests: []
        }
    },
    crossOriginEmbedderPolicy: { policy: "credentialless" }
}));

// Compression
app.use(compression());

// CORS configuration
app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? process.env.ALLOWED_ORIGINS?.split(',')
        : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id']
}));

// Request parsing middleware with limits
app.use(express.json({
    limit: process.env.MAX_FILE_SIZE || '50mb',
    verify: (req, res, buf) => {
        req.rawBody = buf.toString();
    }
}));
app.use(express.urlencoded({
    extended: true,
    limit: process.env.MAX_FILE_SIZE || '50mb'
}));

// Application Insights request tracking
app.use(applicationInsights.trackRequest());

// Global rate limiting
const globalRateLimit = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Use X-Forwarded-For if present (from Render's proxy)
        return req.headers['x-forwarded-for'] || req.ip;
    }
});

// Apply rate limiting to all routes
app.use(globalRateLimit);

// Health check rate limit
const healthCheckRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 requests per minute
    message: { error: 'Too many health check requests' }
});

// Health check endpoint with rate limiting
app.get('/health', healthCheckRateLimit, async (req, res) => {
  const healthCheck = {
    uptime: process.uptime(),
    timestamp: Date.now(),
    status: 'healthy',
    services: {}
  };

  try {
    // Check Supabase connection
    const { data: healthData, error: healthError } = await supabase
      .rpc('ping_health_check');
    
    healthCheck.services.database = {
      status: healthError ? 'unhealthy' : 'healthy',
      message: healthError ? healthError.message : 'Connected'
    };

    // Check Azure Document Intelligence
    try {
      if (!process.env.AZURE_FORM_RECOGNIZER_KEY || !process.env.AZURE_FORM_RECOGNIZER_ENDPOINT) {
        healthCheck.services.documentIntelligence = {
          status: 'unavailable',
          message: 'Not configured'
        };
      } else {
        const documentIntelligence = new DocumentAnalysisClient(
          process.env.AZURE_FORM_RECOGNIZER_ENDPOINT,
          new AzureKeyCredential(process.env.AZURE_FORM_RECOGNIZER_KEY)
        );
        await documentIntelligence.getOperationSummary();
        healthCheck.services.documentIntelligence = {
          status: 'healthy',
          message: 'Connected'
        };
      }
    } catch (error) {
      healthCheck.services.documentIntelligence = {
        status: 'unhealthy',
        message: error.message
      };
    }

    // Check Azure Cognitive Search
    try {
      if (!process.env.AZURE_SEARCH_API_KEY || !process.env.AZURE_SEARCH_ENDPOINT || !process.env.AZURE_SEARCH_INDEX_NAME) {
        healthCheck.services.search = {
          status: 'unavailable',
          message: 'Not configured'
        };
      } else {
        const searchClient = new SearchClient(
          process.env.AZURE_SEARCH_ENDPOINT,
          process.env.AZURE_SEARCH_INDEX_NAME,
          new SearchKeyCredential(process.env.AZURE_SEARCH_API_KEY)
        );
        await searchClient.getDocumentCount();
        healthCheck.services.search = {
          status: 'healthy',
          message: 'Connected'
        };
      }
    } catch (error) {
      healthCheck.services.search = {
        status: 'unhealthy',
        message: error.message
      };
    }

    // Check Azure OpenAI
    try {
      const openai = new OpenAIClient(
        process.env.AZURE_OPENAI_ENDPOINT,
        new AzureKeyCredential(process.env.AZURE_OPENAI_API_KEY)
      );
      await openai.getDeployments();
      healthCheck.services.openai = {
        status: 'healthy',
        message: 'Connected'
      };
    } catch (error) {
      healthCheck.services.openai = {
        status: 'unhealthy',
        message: error.message
      };
    }

    // Check Supabase Storage
    try {
      const { data: buckets, error: storageError } = await supabase.storage.listBuckets();
      healthCheck.services.storage = {
        status: storageError ? 'unhealthy' : 'healthy',
        message: storageError ? storageError.message : 'Connected'
      };
    } catch (error) {
      healthCheck.services.storage = {
        status: 'unhealthy',
        message: error.message
      };
    }

    // Overall health status
    const allHealthy = Object.values(healthCheck.services)
      .every(service => service.status === 'healthy');
    
    healthCheck.status = allHealthy ? 'healthy' : 'unhealthy';
    
    // Track health check in Application Insights
    applicationInsights.trackEvent({
      name: 'HealthCheck',
      properties: {
        status: healthCheck.status,
        services: healthCheck.services
      }
    });

    const statusCode = allHealthy ? 200 : 503;
    res.status(statusCode).json(healthCheck);
  } catch (error) {
    healthCheck.status = 'unhealthy';
    healthCheck.error = error.message;
    
    applicationInsights.trackException({
      exception: error,
      properties: {
        component: 'HealthCheck'
      }
    });
    
    res.status(503).json(healthCheck);
  }
});

// API Routes with specific rate limits
app.use('/api/auth', security.createRateLimit(15 * 60 * 1000, 5), authRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/analysis', analysisRouter);
app.use('/api/chat', chatRouter);
app.use('/api/reports', reportsRouter);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
});

// Error handler
app.use(errorMiddleware);

module.exports = { app};