# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ESUS Audit AI is a multi-tenant SaaS platform for audit management with AI-powered document processing. Built with Next.js 15, Supabase, and comprehensive security features.

## Development Commands

```bash
# Development
npm run dev                    # Start development server
npm run build                  # Production build
npm run start                  # Start production server
npm run lint                   # Lint code
npm run lint:fix              # Fix linting issues
npm run format                 # Format code with Prettier
npm run test                   # Run Jest tests
npm run test:watch             # Run tests in watch mode

# Database
cd supabase && supabase db reset    # Reset local database
cd supabase && supabase db push     # Push migrations
```

## Architecture Overview

### Multi-Tenant Security Architecture
- **Row Level Security (RLS)**: Database-level tenant isolation using `organization_id`
- **RBAC System**: Three roles (Admin/Auditor/Reviewer) with hierarchical permissions
- **Middleware Security**: Rate limiting, audit logging, and auth enforcement in `middleware.ts`
- **API Authentication**: Centralized in `lib/apiAuth.ts` with Redis-based rate limiting

### Database Schema (Supabase/PostgreSQL)
- **Core Tables**: organizations, users, projects, documents, audit_logs
- **Security Tables**: invitations, api_tokens, security_events, login_attempts
- **Workflow Tables**: deleted_entities, pending_deletion_requests, workflow_approvals
- **16 Migration Files**: Comprehensive schema with RBAC, soft deletes, and audit trails

### API Architecture
- **Authentication Routes**: `/api/auth/*` - Login, signup, password reset
- **Admin Routes**: `/api/admin/*` - User management, system metrics, integrations
- **Business Logic**: `/api/projects/*`, `/api/documents/*` - Core functionality
- **AI Features**: `/api/chat/*`, `/api/analysis/*` - OpenAI integration
- **Rate Limiting**: Different limits per endpoint type (auth: 10/min, sensitive: 20/min, standard: 100/min)

### Frontend Structure
- **App Router**: Next.js 15 with TypeScript and Tailwind CSS
- **Authentication**: Server-side auth with Supabase SSR
- **Admin Panel**: Role-based access with comprehensive dashboards
- **Real-time Updates**: Supabase Realtime for audit logs (replaced WebSocket)
- **File Uploads**: Secure with validation, virus scanning, and storage policies

## Key Implementation Patterns

### Error Handling
```typescript
// Standardized error responses in lib/apiResponse.ts
import { errorResponse, successResponse } from '@/lib/apiResponse';

// Database operations with retry logic in lib/database.ts
await withRetry(async () => { /* operation */ }, { maxRetries: 3 });
```

### Authentication Flow
```typescript
// All API routes use lib/apiAuth.ts
const auth = await authenticateApiRequest(request, { 
  rateLimit: 100, 
  requireRole: 'auditor' 
});
```

### Multi-Tenant Data Access
```typescript
// All queries automatically scope to user's organization
const { data } = await supabase
  .from('projects')
  .select('*')
  .eq('organization_id', userProfile.organization_id);
```

### Transaction Management
```typescript
// Atomic operations using lib/transactionHandler.ts
await executeTransaction(async (client) => {
  // Multiple operations that must succeed together
});
```

## Security Implementation Status

### ✅ Implemented Security Features
- Multi-tenant isolation with RLS
- Comprehensive audit logging
- Rate limiting on sensitive endpoints
- Secure file uploads with validation
- RBAC with three-tier role system
- Security headers (CSP, HSTS, X-Frame-Options)
- Input validation and sanitization
- Soft delete patterns

### ⚠️ Known Security Gaps
- Missing rate limiting on some admin endpoints
- Invitation tokens may be exposed in API responses
- Cross-tenant access validation needs verification
- Session management doesn't properly clear on logout

## Environment Configuration

Required environment variables are validated in `lib/env.ts`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `UPSTASH_REDIS_REST_URL` (optional, for rate limiting)
- `OPENAI_API_KEY` (for AI features)
- `AZURE_*` variables (for document processing)

## Database Integration

### Supabase Configuration
- Client setup in `utils/supabase/`
- Database operations in `lib/database.ts`
- Query optimization and caching in `lib/queryOptimizer.ts`
- Migration files in `supabase/migrations/`

### Key Database Functions
```sql
-- Core transaction functions (20240708000000_add_transaction_functions.sql)
create_organization_with_admin()
upload_document_with_record()
process_document_analysis()
create_invitation_with_audit()
```

## Testing

- Jest configuration for unit tests
- Test files in `__tests__/` directories
- Key test areas: auth flows, error handling, database operations

## Production Deployment

- Vercel deployment with `vercel.json` configuration
- Supabase for database and authentication
- Redis (Upstash) for rate limiting in production
- Environment-specific configurations
- Security scanning with Trivy in GitHub Actions

## Code Quality

- ESLint configuration with TypeScript rules
- Prettier for code formatting
- Comprehensive TypeScript types in `types/` and `lib/types/`
- Error boundaries for graceful failure handling

## Notable Implementation Details

- **Removed WebSocket**: Replaced with Supabase Realtime for better serverless compatibility
- **Job Queue**: In-memory implementation in `lib/jobQueue.ts`
- **Document Processing**: Azure Form Recognizer integration for AI analysis
- **Chat Features**: OpenAI integration with conversation history
- **File Storage**: Supabase Storage with security policies