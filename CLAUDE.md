# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Primary Development
```bash
# Start full development environment (client + server)
npm run dev

# Start individual components  
npm run dev:client    # Vite dev server on port 5173
npm run dev:server    # Express server on port 3001
```

### Database Operations
```bash
# Setup database schema and seed data
npm run db:setup

# Run database migrations
npm run db:migrate

# Setup Supabase resources
npm run supabase:setup
```

### Testing and Validation
```bash
# Run tests across client and server
npm test

# Server linting and validation
cd server && npm run lint
cd server && npm run validate-env
cd server && npm run health
```

### Build Commands
```bash
# Build for production
npm run build

# Production deployment
npm run deploy
```

## Architecture Overview

### Dual Authentication Strategy
The application implements two authentication patterns in `server/middleware/auth.js`:

- **`protectRoute` middleware** - Modern HTTP-only cookie authentication with Supabase session management
- **`authMiddleware` middleware** - Legacy Bearer token authentication for backward compatibility

Both use manual session management with `supabase.auth.setSession()` and `persistSession: false`.

### Hybrid API Architecture
Frontend (`client/src/services/api.js`) uses dual approach:

- **Express Backend APIs** - Complex operations (auth, document analysis, AI chat) via axios with retry logic
- **Direct Supabase Calls** - Simple CRUD operations with real-time subscriptions

### Security Middleware Stack
```
helmet() → cors() → rate limiting → performance monitoring → 
authentication → input sanitization → route handlers → error monitoring
```

### File Processing Pipeline
```
Upload → Multer → Supabase Storage → Azure Document Intelligence → 
OpenAI Analysis → Database Storage → Real-time Notifications
```

## Key Implementation Patterns

### Authentication Flow
```
User Login → Backend API → HTTP-only Cookies → Supabase Client Sync → Frontend State
```

Client-side authentication in `AuthContext.jsx` coordinates between backend API and Supabase client for session synchronization.

### Error Handling Strategy
- **API Layer**: Exponential backoff retry for 5xx/408/429 errors
- **Validation Layer**: Express-validator with structured error responses
- **Monitoring**: Azure Application Insights for all errors and performance metrics

### Database Access Patterns
- **Server**: Service role for administrative operations
- **Client**: RLS-enforced direct calls for user operations  
- **Real-time**: Supabase subscriptions for live analysis updates

### Input Validation Architecture
Comprehensive validation in `server/middleware/validation.js`:
- Email normalization and format validation
- Password complexity requirements (8+ chars, mixed case, numbers, special chars)
- File upload validation (MIME types, size limits, filename sanitization)
- Recursive input sanitization removing control characters and script tags

### Monitoring and Health Checks
Health endpoints for container orchestration:
- `/health` - Comprehensive system health
- `/health/ready` - Database connectivity validation
- `/health/live` - Basic process health
- `/metrics` - System resource metrics

### Azure AI Services Integration
- **Document Intelligence**: OCR and structure extraction
- **OpenAI**: Text generation and analysis with confidence scoring
- **Cognitive Search**: Full-text search across documents
- **Application Insights**: Comprehensive telemetry and monitoring

## Critical Security Features

### Rate Limiting Configuration
- Authentication endpoints: 5 requests per 15 minutes
- General API endpoints: 100 requests per 15 minutes
- Configurable via environment variables

### Role-Based Access Control
Three-tier system (admin/auditor/reviewer) with:
- `requireRole()` middleware for endpoint authorization
- `requireProjectAccess()` middleware for project-specific permissions
- Account status validation (active/inactive)

### File Security
- Configurable allowed MIME types via `ALLOWED_FILE_TYPES` env var
- File size limits with `MAX_FILE_SIZE` configuration
- Filename sanitization preventing path traversal attacks

### Audit Logging
Complete activity trail in `audit_logs` table tracking:
- User actions with IP addresses and user agents
- Security events and unauthorized access attempts
- Business operations for compliance requirements