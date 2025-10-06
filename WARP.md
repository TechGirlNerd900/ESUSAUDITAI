# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

ESUSAUDITAI is an AI-powered audit automation platform built with Next.js 15, React 19, TypeScript, Supabase, and Google Cloud AI services. It's designed for finance and audit firms to streamline document analysis, AI-assisted auditing, and report generation.

## Development Commands

### Main Application (Next.js)
```bash
# Navigate to Next.js directory
cd nextjs

# Development
npm run dev                 # Start development server (localhost:3000)
npm run build              # Build for production
npm start                  # Start production build
npm run lint               # Run ESLint
npm run lint:fix           # Fix ESLint issues automatically
npm run format             # Format code with Prettier
npm run clean              # Clean build artifacts
npm test                   # Run Jest tests
npm run test:watch         # Run tests in watch mode

# Environment validation
npm run validate-env       # Validate environment variables
```

### Root Project Scripts
```bash
# From project root (/Users/techgirlnerd/Desktop/ESUSAUDITAI)
npm run dev                # Start Next.js dev server
npm run build              # Build Next.js app
npm start                  # Start Next.js production
npm run lint               # Lint Next.js app
npm test                   # Run Next.js tests

# Database operations
npm run db:setup           # Set up PostgreSQL database
npm run db:migrate         # Run database migrations
npm run db:fix-auth        # Fix authentication issues

# Supabase operations
npm run supabase:setup     # Setup Supabase for development
npm run supabase:setup:prod # Setup Supabase for production

# Deployment and utilities
npm run deploy             # Deploy application
npm run init               # Initialize local environment
npm run fix:admin-access   # Fix admin access issues
npm run fix:admin-user     # Fix admin user issues
```

### Supabase CLI Commands
```bash
# Database management
supabase db push           # Push local schema to remote
supabase db pull           # Pull remote schema to local
supabase db reset          # Reset local database
supabase migration new [name] # Create new migration

# Development
supabase start             # Start local Supabase
supabase stop              # Stop local Supabase
supabase status            # Check services status

# Specific to this project
npx supabase link --project-ref vczmjgajmdlniqohdesv
npx supabase db push --db-url "postgresql://postgres.vczmjgajmdlniqohdesv:OdrPnkt5b6V2wymM@aws-0-us-east-2.pooler.supabase.com:6543/postgres"
```

## Architecture Overview

### Application Structure
The project follows a monorepo structure with the main Next.js application in the `nextjs/` directory:

```
ESUSAUDITAI/
├── nextjs/                 # Main Next.js 15 application (App Router)
│   ├── app/               # Next.js App Router pages
│   │   ├── api/           # API routes (REST endpoints)
│   │   ├── admin/         # Admin dashboard pages
│   │   ├── projects/      # Project management pages
│   │   ├── documents/     # Document management pages
│   │   └── components/    # React components
│   ├── lib/               # Core business logic and utilities
│   │   ├── core/          # Core services (serviceContainer, errorHandler)
│   │   └── types/         # TypeScript type definitions
│   ├── hooks/             # React custom hooks
│   └── middleware.ts      # Next.js middleware (auth & security)
├── supabase/              # Supabase configuration and migrations
│   └── migrations/        # Database migration files
└── scripts/               # Utility and deployment scripts
```

### Key Architectural Patterns

**Service Container Pattern**: The application uses dependency injection via `lib/core/serviceContainer.ts` to manage services like DatabaseService, DocumentService, ChatService, UserService, and AuditService. This promotes testability and modularity.

**Authentication Flow**: Built on Supabase Auth with custom middleware in `middleware.ts` that handles:
- Rate limiting (100 requests/minute standard, 10/minute for auth)
- Security headers injection
- Session management via `@supabase/ssr`
- Role-based access control (Admin, Auditor, Reviewer)

**API Architecture**: RESTful API routes in `app/api/` using Next.js 15 App Router with:
- Authentication wrapper functions (`withAuth`)
- Consistent error handling
- Rate limiting per endpoint type
- Structured response formats

**Database Layer**: PostgreSQL via Supabase with:
- Row Level Security (RLS) policies
- UUID-based primary keys
- Comprehensive migration system
- Real-time subscriptions support

### Core Technology Stack
- **Frontend**: React 19, Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Backend**: Next.js API routes, Supabase (PostgreSQL)
- **AI Services**: Google Cloud (Document AI, Vertex AI), Google Generative AI
- **Authentication**: Supabase Auth with custom middleware
- **Storage**: Supabase Storage for document management
- **Styling**: Tailwind CSS, Radix UI, Lucide React icons
- **Testing**: Jest, React Testing Library

### Environment Setup
The application requires multiple environment files:
- Root `.env` - Main environment variables
- `nextjs/.env.local` - Next.js specific variables
- Contains Google Cloud, Supabase, and other API credentials

### Known Issues & Current State
Based on the PRODUCTION_IMPLEMENTATION_PLAN.md, the application has some critical issues:
- API authentication middleware needs fixing (401 errors)
- Dashboard empty state handling needs improvement  
- Missing pages return 404 errors
- Navigation and settings functionality incomplete

### Development Workflow
1. Start with `cd nextjs && npm run dev` for development
2. Use Supabase local development: `supabase start`
3. Run tests with `npm test` in nextjs directory
4. Database changes require migrations in `supabase/migrations/`
5. Environment validation with `npm run validate-env`

### Code Standards
- Use 4 spaces for indentation
- Double quotes for strings
- camelCase for variables
- async/await for promises
- Comprehensive error handling with try/catch
- Type annotations for function parameters and returns
- ES modules with import statements

### Important Files to Know
- `nextjs/middleware.ts` - Core authentication and security middleware
- `nextjs/lib/core/serviceContainer.ts` - Main dependency injection container
- `nextjs/app/layout.tsx` - Root application layout
- `supabase/migrations/` - Database schema evolution
- `package.json` files at root and nextjs/ level - Different script contexts