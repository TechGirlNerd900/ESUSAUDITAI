# ESUS Audit AI

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15.3.3-black)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)](https://supabase.com/)

A comprehensive AI-powered audit automation platform designed for finance and audit firms. Built with Next.js 15, Supabase, and enterprise-grade security features for multi-tenant SaaS environments.

## 🚀 Features

### Core Functionality
- **AI-Powered Document Processing** - Automated analysis using Azure Form Recognizer and OpenAI
- **Multi-Tenant Architecture** - Secure organization-based isolation with Row Level Security (RLS)
- **Role-Based Access Control** - Three-tier system (Admin/Auditor/Reviewer) with hierarchical permissions
- **Real-Time Collaboration** - Live updates using Supabase Realtime
- **Comprehensive Audit Trails** - Complete activity logging and security monitoring
- **Document Management** - Secure upload, processing, and storage with virus scanning
- **Interactive Chat Interface** - AI-powered assistance for audit queries and analysis

### Security Features
- **Enterprise-Grade Security** - CSP headers, HSTS, X-Frame-Options protection
- **Rate Limiting** - Redis-based protection against abuse
- **Input Validation** - Comprehensive sanitization using Zod schemas
- **Secure File Handling** - Type validation, size limits, and malware scanning
- **Session Management** - JWT-based authentication with automatic expiration
- **Soft Delete Patterns** - Data retention with recovery capabilities

### Technical Highlights
- **Modern Stack** - Next.js 15 with App Router, TypeScript, and Tailwind CSS
- **Database** - PostgreSQL with Supabase for real-time capabilities
- **AI Integration** - Azure OpenAI and Form Recognizer services
- **Cloud Storage** - Supabase Storage with security policies
- **Monitoring** - Application Insights integration for production monitoring

## 📋 Prerequisites

- **Node.js** >= 18.0.0
- **npm** or **yarn**
- **Supabase Account** (for database and authentication)
- **Azure Account** (for AI services - optional)
- **Redis Instance** (for rate limiting - optional)

## 🛠️ Installation

### 1. Clone the Repository
```bash
git clone https://github.com/your-org/esus-audit-ai.git
cd esus-audit-ai
```

### 2. Install Dependencies
```bash
# Install root dependencies
npm install

# Install Next.js dependencies
cd nextjs && npm install
```

### 3. Environment Configuration
```bash
# Copy environment template
cp .env.example .env.local
cp nextjs/.env.local.example nextjs/.env.local
```

### 4. Configure Environment Variables
Edit `.env.local` and `nextjs/.env.local` with your actual values:

#### Required Variables
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Database
DATABASE_URL=postgresql://username:password@your-host:5432/your-database

# Authentication
JWT_SECRET=your-jwt-secret-key
```

#### Optional Variables (for full functionality)
```env
# Azure AI Services
AZURE_OPENAI_ENDPOINT=https://your-openai-service.openai.azure.com/
AZURE_OPENAI_API_KEY=your-azure-openai-key
AZURE_FORM_RECOGNIZER_ENDPOINT=https://your-service.cognitiveservices.azure.com/
AZURE_FORM_RECOGNIZER_KEY=your-azure-form-recognizer-key

# Rate Limiting (Production)
UPSTASH_REDIS_REST_URL=your-redis-url
UPSTASH_REDIS_REST_TOKEN=your-redis-token
```

### 5. Database Setup
```bash
# Run Supabase migrations
cd supabase
supabase db reset
supabase db push
```

## 🚀 Development

### Start Development Server
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### Available Scripts
```bash
# Development
npm run dev                    # Start development server
npm run build                  # Production build
npm run start                  # Start production server
npm run lint                   # Lint code
npm run lint:fix              # Fix linting issues
npm run format                 # Format code with Prettier

# Testing
npm run test                   # Run Jest tests
npm run test:watch             # Run tests in watch mode

# Database
npm run db:setup              # Setup local database
npm run supabase:setup        # Configure Supabase
```

## 🏗️ Architecture

### Multi-Tenant Security Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Organization  │    │   Organization  │    │   Organization  │
│        A        │    │        B        │    │        C        │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ Users           │    │ Users           │    │ Users           │
│ Projects        │    │ Projects        │    │ Projects        │
│ Documents       │    │ Documents       │    │ Documents       │
│ Audit Logs      │    │ Audit Logs      │    │ Audit Logs      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │  Shared Services │
                    │                 │
                    │ • Authentication│
                    │ • Rate Limiting │
                    │ • Audit Logging │
                    │ • File Storage  │
                    └─────────────────┘
```

### Database Schema Overview
- **Core Tables**: `organizations`, `users`, `projects`, `documents`, `audit_logs`
- **Security**: `invitations`, `api_tokens`, `security_events`, `login_attempts`
- **Workflow**: `deleted_entities`, `pending_deletion_requests`, `workflow_approvals`

### API Structure
```
/api/
├── auth/                 # Authentication endpoints
├── admin/               # Administrative functions
├── projects/            # Project management
├── documents/           # Document processing
├── chat/               # AI chat interface
├── reports/            # Report generation
└── health/             # System health checks
```

## 🔐 Security Features

### Authentication & Authorization
- **JWT-based Authentication** with automatic token refresh
- **Role-Based Access Control** (RBAC) with three permission levels
- **Multi-Factor Authentication** support (configurable)
- **Session Management** with automatic timeout

### Data Protection
- **Row Level Security (RLS)** for tenant isolation
- **Input Validation** using Zod schemas
- **SQL Injection Protection** via parameterized queries
- **XSS Prevention** through content sanitization

### Infrastructure Security
- **Rate Limiting** on all API endpoints
- **CORS Configuration** for cross-origin protection
- **Security Headers** (CSP, HSTS, X-Frame-Options)
- **File Upload Security** with type and size validation

## 🤖 AI Integration

### Document Processing
- **Azure Form Recognizer** for intelligent document analysis
- **OpenAI GPT-4** for content understanding and insights
- **Automated Data Extraction** from financial documents
- **Custom Model Training** for audit-specific use cases

### Chat Interface
- **Contextual AI Assistance** for audit queries
- **Document-Based Q&A** using RAG (Retrieval Augmented Generation)
- **Conversation History** with persistent storage
- **Multi-Language Support** for international audits

## 📊 Monitoring & Analytics

### Application Monitoring
- **Azure Application Insights** integration
- **Real-time Performance Metrics** and alerts
- **Error Tracking** with detailed stack traces
- **User Activity Analytics** for usage insights

### Audit & Compliance
- **Comprehensive Audit Logs** for all user actions
- **Security Event Monitoring** with automated alerts
- **Data Retention Policies** for compliance requirements
- **Export Capabilities** for regulatory reporting

## 🚀 Deployment

### Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to Vercel
vercel --prod
```

### Docker Deployment
```bash
# Build Docker image
docker build -t esus-audit-ai .

# Run container
docker run -p 3000:3000 esus-audit-ai
```

### Environment-Specific Configuration
- **Development**: Local Supabase with development keys
- **Staging**: Staging Supabase instance with limited data
- **Production**: Production Supabase with full security enabled

## 🧪 Testing

### Unit Tests
```bash
npm run test
```

### Integration Tests
```bash
npm run test:integration
```

### End-to-End Tests
```bash
npm run test:e2e
```

### Test Coverage
- **Authentication Flows** - Login, signup, password reset
- **API Endpoints** - All routes with various scenarios
- **Database Operations** - CRUD operations with RLS
- **Security Features** - Rate limiting, input validation

## 📚 API Documentation

### Authentication
```typescript
POST /api/auth/login
POST /api/auth/signup
POST /api/auth/logout
POST /api/auth/reset-password
```

### Projects
```typescript
GET    /api/projects              # List user's projects
POST   /api/projects              # Create new project
GET    /api/projects/[id]         # Get project details
PUT    /api/projects/[id]         # Update project
DELETE /api/projects/[id]         # Delete project
```

### Documents
```typescript
POST   /api/documents/upload      # Upload document
GET    /api/documents/[id]        # Get document
POST   /api/documents/process     # Process with AI
DELETE /api/documents/[id]        # Delete document
```

### Admin
```typescript
GET    /api/admin/users           # List all users
POST   /api/admin/users/invite    # Invite new user
GET    /api/admin/metrics         # System metrics
GET    /api/admin/audit-logs      # Audit trail
```

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Standards
- **TypeScript** for type safety
- **ESLint** for code quality
- **Prettier** for code formatting
- **Jest** for testing
- **Conventional Commits** for commit messages

### Pull Request Guidelines
- Include tests for new features
- Update documentation as needed
- Ensure all CI checks pass
- Request review from maintainers

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Documentation
- [API Documentation](docs/api.md)
- [Deployment Guide](docs/deployment.md)
- [Security Guide](docs/security.md)
- [Troubleshooting](docs/troubleshooting.md)

### Community
- [GitHub Issues](https://github.com/your-org/esus-audit-ai/issues)
- [Discussions](https://github.com/your-org/esus-audit-ai/discussions)
- [Discord Community](https://discord.gg/your-invite)

### Commercial Support
For enterprise support, custom development, or consulting services, contact us at support@esusaudit.ai

## 🗺️ Roadmap

### Q1 2024
- [ ] Advanced AI model training
- [ ] Mobile application development
- [ ] Enhanced reporting capabilities
- [ ] Third-party integrations (QuickBooks, Xero)

### Q2 2024
- [ ] Blockchain audit capabilities
- [ ] Advanced analytics dashboard
- [ ] Multi-language support
- [ ] API rate limiting improvements

### Q3 2024
- [ ] Machine learning insights
- [ ] Automated compliance checking
- [ ] Advanced workflow automation
- [ ] Performance optimizations

---

**Built with ❤️ by the ESUS Audit AI Team**

For more information, visit our [website](https://esusaudit.ai) or contact us at [hello@esusaudit.ai](mailto:hello@esusaudit.ai)