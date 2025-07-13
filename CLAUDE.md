# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ESUS Audit AI is a comprehensive AI-powered audit automation platform for finance and audit firms. It's built with Next.js 15, Supabase, and enterprise-grade security features for multi-tenant SaaS environments.

## Development Commands

### Primary Development Workflow
```bash
# Start development server (from project root)
cd nextjs && npm run dev

# Alternative using test script
./scripts/test-frontend.sh  # Interactive frontend testing menu

# Install dependencies
npm install  # Root dependencies  
cd nextjs && npm install  # Next.js dependencies
```

### Code Quality
```bash
# From nextjs/ directory:
npm run lint              # ESLint checking
npm run lint:fix          # Auto-fix ESLint issues  
npm run format            # Format with Prettier
npm run build             # Production build
npm run test              # Run Jest tests
npm run test:watch        # Run tests in watch mode
```

### Database Operations
```bash
# From supabase/ directory:
supabase db reset         # Reset local database
supabase db push          # Apply migrations to database
```

### Environment Validation
```bash
npm run validate-env      # Validate environment variables (placeholder)
```

## Architecture Overview

### Multi-Tenant Security Architecture
The application implements a sophisticated multi-tenant system where each organization has complete data isolation through Row Level Security (RLS) policies and organization_id foreign keys on all tenant-specific tables.

### Key Architectural Components

**Frontend Structure (Next.js 15 App Router):**
- `/app/` - App Router pages and layouts  
- `/app/api/` - API route handlers with comprehensive security
- `/components/` - Reusable React components
- `/lib/` - Core business logic and utilities
- `/middleware.ts` - Request middleware with security, auth, and rate limiting

**Database Structure (PostgreSQL/Supabase):**
- `supabase/migrations/` - Sequential database migrations (000-006 + timestamped)
- Core entities: organizations, users, projects, documents, audit_logs
- Security: invitations, api_tokens, security_events, deleted_entities
- RBAC: Three-tier role system (Admin/Auditor/Reviewer)

**Security Layers:**
- Middleware-based authentication, rate limiting, and security headers
- Row Level Security (RLS) for multi-tenant data isolation  
- Comprehensive audit logging for compliance
- Soft delete patterns with approval workflows
- Input validation using Zod schemas

### Core Services Integration

**Azure AI Services:**
- Azure Form Recognizer for document processing (`lib/azureServices.ts`)
- Azure OpenAI for AI-powered analysis (`lib/openaiClient.ts`)
- Document processing pipeline in `lib/documentProcessor.ts`

**Supabase Integration:**
- Authentication and session management
- Real-time subscriptions for collaborative features
- File storage with security policies
- Database client in `lib/database.ts`

## Key Code Patterns

### API Route Structure
All API routes follow a consistent pattern:
```typescript
// Example: app/api/projects/route.ts
export async function GET(request: NextRequest) {
  return withErrorHandling(async () => {
    // 1. Authentication check
    // 2. Input validation  
    // 3. Database operations with RLS
    // 4. Response formatting
  })(request);
}
```

### Database Operations
Use the Database class for type-safe operations:
```typescript
const db = new Database(cookies());
const projects = await db.getProjects(userId, organizationId);
```

### Error Handling
Centralized error handling with custom error types:
```typescript
import { withErrorHandling, ValidationError } from '@/lib/errorHandler';
// Use custom errors: ApiError, NotFoundError, AuthorizationError, etc.
```

### Multi-Tenant Isolation
Every database query must include organization context:
```typescript
// Always filter by organization_id for tenant isolation
.eq('organization_id', userOrganizationId)
```

## Security Requirements

### Required Environment Variables
```bash
# Core Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY  
SUPABASE_SERVICE_ROLE_KEY

# Security
JWT_SECRET
CSRF_SECRET
ENCRYPTION_KEY

# Azure AI (for full functionality)
AZURE_OPENAI_API_KEY
AZURE_OPENAI_ENDPOINT
AZURE_FORM_RECOGNIZER_ENDPOINT
AZURE_FORM_RECOGNIZER_KEY
```

### Security Middleware Features
- Rate limiting (different limits for auth/standard/sensitive endpoints)
- CSRF protection
- Security headers (CSP, HSTS, X-Frame-Options, etc.)
- Admin-only route protection
- Request/response audit logging

## Testing Strategy

### Test Structure
- Unit tests in `__tests__/` directories alongside source files
- Jest configuration in package.json
- Test utilities for mocking Supabase and Azure services
- Example: `lib/__tests__/errorHandler.test.ts`

### Running Tests
```bash
npm run test              # Run all tests
npm run test:watch        # Watch mode for development
```

### Test Patterns
- Mock external services (Supabase, Azure)
- Test error handling scenarios extensively
- Validate multi-tenant isolation in database operations
- Test RBAC permission enforcement

## File Upload & Processing

### Document Processing Pipeline
1. Upload validation (type, size, security scanning)
2. Storage in Supabase Storage with security policies
3. Azure Form Recognizer processing
4. AI analysis with OpenAI
5. Results stored with audit trail

### Security Considerations
- File type validation beyond MIME type
- Virus scanning integration points
- Organization-scoped storage policies
- Audit logging for all file operations

## AI Integration Patterns

### Chat Interface
- RAG (Retrieval Augmented Generation) with document context
- Conversation history persistence
- Organization-scoped AI interactions
- Component: `ChatRAG.tsx`, `ChatWidget.tsx`

### Document Analysis
- Automated extraction from financial documents  
- Custom model training capabilities
- Results integration with audit workflows
- Processing service: `lib/documentProcessor.ts`

## Database Schema Guidelines

### Migration Strategy
- Sequential numbered migrations (000_init through 006_reports)
- Timestamped migrations for ongoing changes
- Always include rollback considerations
- Document schema changes in migration comments

### Key Tables
- `organizations` - Root of multi-tenant hierarchy
- `users` - RBAC with organization relationships  
- `projects` - Audit engagement containers
- `documents` - Processed files with metadata
- `audit_logs` - Comprehensive activity tracking
- `deleted_entities` - Soft delete with recovery

### RBAC Implementation
- **Admin**: Full organization access, user management, deletion approval
- **Auditor**: Broad data access, can initiate deletions (requires approval)
- **Reviewer**: Limited access for review tasks only

## Performance Considerations

### Database Optimization
- Comprehensive indexing for multi-tenant queries
- Materialized views for organization statistics  
- RLS policies optimized to minimize performance impact
- Query optimization in `lib/queryOptimizer.ts`

### Frontend Optimization  
- Next.js 15 App Router with optimized routing
- Component lazy loading for large forms
- Image optimization through Next.js
- Tailwind CSS for minimal bundle size

## Deployment & Infrastructure

### Vercel Deployment (Recommended)
- Configured in `vercel.json`
- Environment variables managed through Vercel dashboard
- Automatic HTTPS and CDN
- Security headers in `next.config.mjs`

### Security Infrastructure
- Rate limiting (Redis-based in production)
- Application Insights monitoring
- Comprehensive logging and alerting
- Backup and disaster recovery procedures

## Common Development Patterns

### Adding New API Endpoints
1. Create route handler in `app/api/`
2. Implement with `withErrorHandling` wrapper
3. Add input validation with Zod
4. Include organization-scoped database queries
5. Add comprehensive test coverage
6. Update API documentation

### Adding New Database Tables
1. Create migration in `supabase/migrations/`
2. Include organization_id for multi-tenant isolation
3. Add RLS policies for security
4. Update Database class with new methods
5. Add corresponding TypeScript types

### UI Component Development
1. Follow existing component patterns in `/components/`
2. Use Tailwind CSS for styling
3. Implement proper TypeScript interfaces
4. Include loading and error states
5. Ensure accessibility compliance

This codebase prioritizes security, maintainability, and scalability. Always consider multi-tenant isolation, comprehensive audit logging, and proper error handling in all changes.