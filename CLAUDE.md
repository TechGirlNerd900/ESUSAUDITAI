# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚨 PRIORITY ACTIONS - DO THESE FIRST

### Context7 Integration Rules
- When using Context7, keep output range between 2k-4k tokens based on optimal context
- Maintain `library.md` file to store Library IDs - check this file before searching for new library IDs
- Use existing library IDs when available

### Zero Hallucination Policy
- **NO GUESSING**: Use high reasoning skills
- If uncertainty arises, first consult MCP Context7 for up-to-date documentation, schemas, rules, and specifications
- Only escalate to user if Context7 cannot resolve ambiguity and proceeding would risk code safety or system stability
- **ZERO HALLUCINATION**: Do not invent functionality, fields, parameters, APIs, or behaviors
- For AI-generated logic (RAG, report generation, summarization), implement strict guardrail prompts
- When context is insufficient, AI logic must return: "I cannot answer this question based on the provided documents"

### 🔧 Critical Issues to Debug/Fix (Priority Order)

#### 🚨 CRITICAL (Must Fix First)
1. **Database Schema Conflicts**
   - Multiple schema files conflict with each other
   - **CRITICAL**: `app_settings` table definition conflicts between `schema.sql` (no organization_id) and `001_init.sql` (with organization_id)
   - `database/schema.sql` and `database/seed.sql` are outdated and inconsistent with migration series
   - Need to consolidate into single source of truth (`001_init.sql`)
   - Run proper migration to fix conflicting table structures

2. **Documents Upload Missing Organization ID**
   - **CRITICAL**: `documents.organization_id` not being set on upload in `/api/documents/upload/route.ts`
   - Document records missing organization isolation
   - Breaks multi-tenant data separation

3. **User Profile Creation Logic**
   - Trigger still assigns to "Default Organization" instead of proper org creation/invitation flow
   - May cause authentication failures

4. **RLS Policy Dependencies**
   - `get_current_organization_id()` function needs testing and error handling
   - Could break if user profile doesn't exist
   - Need fallback handling

5. **Outdated Database Helper Class**
   - `/nextjs/lib/database.js` contains outdated/unused database helper class
   - Missing organization_id handling in user creation methods
   - Should be removed or updated to match current patterns

#### 🟡 HIGH PRIORITY
6. **Missing Organization Creation on First Signup**
   - New users need guidance to create/join organization
   - Dashboard may crash without organization context

7. **API Endpoint Inconsistencies**
   - Some endpoints may not properly filter by organization
   - Need systematic review of all data access
   - Generally good handling of `organization_id` in key API routes but critical omissions exist

8. **Invitation Token Cleanup**
   - Used tokens aren't being cleaned up
   - Could cause security/storage issues

9. **Environment Configuration Inconsistencies**
   - Check consistency between `.env.example`, `config/dev.env`, and `nextjs/lib/env.ts`
   - Ensure proper usage of database and application settings
   - Some duplicate/conflicting environment variable definitions

#### 🟢 MEDIUM PRIORITY
10. **Route Consistency**
    - Login in `(auth)` folder, signup in root may cause navigation confusion

11. **Error Handling**
    - Need proper error boundaries for org-related failures
    - User feedback for multi-tenancy issues

12. **Schema Check Script Dependencies**
    - `database-schema-check.js` has dependencies and expected configuration
    - May need updates to work with current database structure
    - Should be tested and validated for production use

## Project Overview

EsusAuditAI is a production-grade SaaS multi-tenant audit automation platform built with Next.js 15, Supabase, and Azure AI services. The application enables audit firms to automate document analysis, risk assessment, and report generation using AI-powered workflows.

### Tech Stack
- **Frontend**: Next.js 15 with React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes with Supabase integration
- **Database**: PostgreSQL via Supabase with Row Level Security (RLS)
- **Authentication**: Supabase Auth with multi-tenant support
- **AI Services**: Azure OpenAI, Azure Document Intelligence, Azure Cognitive Search
- **Deployment**: Vercel

## Architecture


### Multi-Tenant SaaS Structure
The application implements organization-based multi-tenancy where:
- Each organization has isolated data via `organization_id` foreign keys
- RLS policies enforce data isolation at the database level
- Users belong to one organization and can only access their org's data
- Admin users can manage their organization and invite team members

### Authentication Flow
1. **Organization Creation**: First user creates organization and becomes admin
2. **Team Invitations**: Admins invite users via secure token-based system
3. **Role-Based Access**: Three roles (admin, auditor, reviewer) with different permissions
4. **Profile Creation**: Automatic user profile creation via database triggers

### Database Schema
- **Core Tables**: `organizations`, `users`, `projects`, `documents`, `analysis_results`
- **Multi-tenancy**: All data tables include `organization_id` for isolation
- **Audit Trail**: Comprehensive `audit_logs` table for all user actions
- **RLS Policies**: Enforce organization-level data access control

## Development Commands

### Primary Workflows
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Run linting
npm run lint

# Database setup (local)
npm run db:setup

# Supabase setup
npm run supabase:setup
```

### From Root Directory
```bash
# Start Next.js development
cd nextjs && npm run dev

# Build Next.js application
cd nextjs && npm run build

# Run production tests
node test-production.js
```

### Database Migrations
```bash
# Apply all migrations
npm run db:migrate

# Setup Supabase for development
npm run supabase:setup

# Setup Supabase for production
npm run supabase:setup:prod
```

## Key Implementation Patterns

### API Authentication
All API routes use centralized authentication via `/lib/apiAuth.ts`:
```typescript
const auth = await authenticateApiRequest(request, { requireRole: 'admin' })
if (!auth.success) return auth.response
```

### Organization-Based Data Access
API endpoints filter data by organization:
```typescript
.eq('organization_id', auth.profile.organization_id)
```

### Multi-Tenant Database Queries
RLS policies automatically filter queries, but explicit organization filtering is used in API routes for clarity and security.

### File Upload Security
Document uploads include:
- MIME type validation (PDF, DOC, XLS, CSV only)
- File size limits (50MB max)
- Filename sanitization
- Organization-scoped project validation

## Critical Components

### `/lib/apiAuth.ts`
Centralized authentication middleware eliminating duplicate auth code across 15+ API routes. Handles user validation, role checking, and organization verification.

### `/app/api/organizations/`
Organization management endpoints for:
- Creating new organizations
- Managing organization settings
- Inviting team members
- Handling invitation tokens

### `/app/components/WelcomeModal.tsx`
Role-based onboarding modal that presents different task options based on user role (admin/auditor/reviewer).

### `/database/migrations/`
Database schema evolution with particular attention to:
- `001_init.sql`: Core multi-tenant schema
- `015_fix_rls_policies.sql`: Updated RLS policies for Supabase integration
- `014_create_user_profile_trigger.sql`: Automatic profile creation

## Security Considerations

### Environment Variables
Required variables in `.env.local`:
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`
- Azure AI: `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_FORM_RECOGNIZER_*`
- Security: `JWT_SECRET`, rate limiting configs

### Data Isolation
- RLS policies on all tables
- Organization ID validation in API routes
- Cross-organization access prevention
- Audit logging for all data access

### File Security
- Strict MIME type validation
- Path traversal prevention
- File size limits
- Organization-scoped storage

## Known Issues & Debugging

### Critical Issues to Monitor
1. **Database Schema Conflicts**: Multiple migration files may conflict - use `001_init.sql` as source of truth
2. **User Profile Creation**: Trigger may assign users to "Default Organization" instead of proper org
3. **RLS Function Dependencies**: `get_current_organization_id()` needs proper error handling
4. **Route Inconsistencies**: Login in `(auth)` directory, signup in root may cause navigation issues

### Debugging Steps
1. Check database schema consistency between migration files
2. Verify RLS policies are correctly applied
3. Test organization isolation between different tenant data
4. Validate user profile creation trigger integration
5. Monitor API endpoints for proper organization filtering

## Project Rules

### Context7 Integration
- Keep Context7 output range between 2k-4k tokens
- Maintain `library.md` file for Context7 Library IDs
- Check existing library IDs before searching for new ones

### Anti-Hallucination Policy
- No invented functionality, fields, parameters, or APIs
- AI-generated logic must include strict guardrails
- Return "I cannot answer this question based on the provided documents" when context is insufficient

### Code Quality
- Use existing patterns and conventions
- Follow multi-tenant architecture consistently
- Implement proper error handling and logging
- Maintain organization-based data isolation
- Use centralized authentication middleware

### Production Readiness
The application includes production optimizations:
- Health check endpoints (`/health`, `/metrics`)
- Application Insights integration
- Comprehensive error handling
- Security headers and CORS protection
- Rate limiting with Redis (Upstash)
- Vercel-optimized serverless deployment

### Testing Approach
- Manual testing of multi-tenant isolation
- API endpoint validation for organization filtering
- Authentication flow testing (creation, invitation, login)
- File upload security validation
- Database migration compatibility testing

## 🏗️ Production-Grade Refactoring & Optimization Plan

**Objective**: Elevate EsusAuditAI to production-grade standard by resolving security vulnerabilities, architectural flaws, and performance bottlenecks. Deploy on Vercel with Supabase database and Azure AI services.

### Phase 1: Security Hardening

#### Authentication & Authorization
**Files to check**: package.json, middleware.ts, utils/supabase/server.ts, all API routes

- [ ] **Implement Strict API Authorization Middleware**
  - Create reusable middleware enforcing Role-Based Access Control (RBAC)
  - Decode JWT, verify role (Admin, Auditor, Reviewer), check project ownership/assignment
  - Target APIs: api/projects/[id], api/documents/*, api/chat/*, api/reports/*, api/admin/*

- [ ] **Fix Hardcoded Credentials**
  - Remove hardcoded default admin user from database/seed.sql
  - Handle seeding via secure, environment-specific scripts

#### Input & Data Validation
- [ ] **Implement Secure File Upload Validation**
  - In api/documents/upload/route.ts: strict server-side validation for file types (MIME) and size
  - Only allow: application/pdf, application/vnd.ms-excel, etc.
  - Sanitize filenames to prevent path traversal attacks

- [ ] **Prevent Information Disclosure**
  - Refactor API error handling - never expose raw database errors or stack traces
  - Implement generic error response structure
  - Remove API key leakage in error responses (e.g., api/chat/[projectId]/route.ts)

### Phase 2: Architectural Refactoring & Performance

#### Code & Dependency Consistency
- [ ] **Unify API Response Formats**
  - Define and implement consistent JSON structure for all API success/error responses

- [ ] **Resolve Database Schema Discrepancies**
  - Use correct table names (users instead of non-existent profiles)
  - Run schema_adaptation_recommendations.sql after review
  - Add missing foreign key constraints and indexes

#### Performance & Scalability
- [ ] **Implement Resilient AI Processing Queue**
  - Message queue system for long-running AI tasks (document processing, report generation)
  - Use Supabase Edge Functions triggered by database webhooks
  - Implement retry/backoff logic for failed AI API calls

- [ ] **Optimize Large File Uploads**
  - Support chunked uploads and checksum verification
  - Improve reliability for large files over unstable connections

- [ ] **Implement Scalable Rate Limiting**
  - Replace in-memory rate limiter with Redis-based solution (Upstash)
  - Ensure consistent rate limits across serverless function instances

- [ ] **Add Pagination**
  - Implement for all endpoints returning lists
  - Especially chat history (GET /api/chat/history/:projectId)

### Phase 3: Enterprise Hardening & Features

- [ ] **Implement Multi-Factor Authentication (MFA)**
  - Enable/configure MFA support in Supabase Auth
  - Integrate MFA enrollment and verification flows

- [ ] **Build Ask Esus RAG Pipeline**
  - Implement proper Retrieval-Augmented Generation pipeline
  - Use Azure Cognitive Search for relevant document chunks (vector search)
  - Pass chunks as context to GPT model with citations
  - Force answers based only on provided context

- [ ] **Develop Admin Alerting System**
  - Monitor suspicious activity, high error rates, unusual user activity
  - AI service quotas nearing limits
  - Use Supabase Functions or Vercel Cron Jobs

- [ ] **Establish Immutable Audit Logs**
  - Ensure audit_logs table is append-only
  - Use PostgreSQL table permissions/triggers to prevent updates/deletions

- [ ] **AI Output Explainability**
  - Build explainability UI showing which document snippets triggered AI red flags
  - Include specific data points that generated summary points

### Infrastructure & Deployment (Vercel)

- [ ] **Configure CI/CD Pipeline**
  - GitHub Actions triggering Vercel deployments
  - main branch → production, PRs → preview deployments
  - Required status checks before PR merge

- [ ] **Secure Environment Variable Management**
  - Use Vercel Environment Variables for all secrets
  - Different variables for Preview, Development, Production

- [ ] **Enable Vercel Edge Firewall**
  - Configure firewall protection against DDoS, SQLi, XSS at network edge

### Final Deliverables
- Pull Request with all code changes organized by task
- Updated README-PRODUCTION.md for setup/deployment/management
- Database migration scripts for schema transition
- New database design optimized for the application purpose

### Testing Requirements
- [ ] Multi-tenant data isolation verification
- [ ] Cross-organization access prevention testing
- [ ] Authentication flow validation (org creation, invitations, login)
- [ ] File upload security validation
- [ ] API endpoint organization filtering verification
- [ ] Database migration compatibility testing
- [ ] Performance testing for AI processing pipeline
- [ ] Rate limiting effectiveness testing