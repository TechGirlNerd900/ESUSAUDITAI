# Esus Audit AI - Next.js Application

This is the migrated Next.js version of the Esus Audit AI platform, providing AI-powered audit automation for finance and audit firms.

## 🚀 Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your actual values
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🏗️ Architecture

This Next.js application follows the App Router pattern with server-side rendering and uses:

- **Framework**: Next.js 15 with App Router
- **Authentication**: Supabase Auth with SSR
- **Database**: PostgreSQL via Supabase
- **Storage**: Supabase Storage
- **AI Services**: Azure OpenAI, Document Intelligence, Cognitive Search
- **Styling**: Tailwind CSS
- **Language**: TypeScript

## 📁 Project Structure

```
nextjs/
├── app/                    # App Router pages and layouts
│   ├── api/               # API routes
│   │   ├── auth/         # Authentication endpoints
│   │   ├── projects/     # Project management
│   │   ├── documents/    # Document upload/management
│   │   ├── analysis/     # AI document analysis
│   │   ├── chat/         # AI chat assistant
│   │   └── reports/      # Report generation
│   ├── login/            # Login page
│   ├── layout.js         # Root layout
│   ├── page.tsx          # Dashboard homepage
│   └── globals.css       # Global styles
├── lib/                  # Utility libraries
│   ├── azureServices.js  # Azure AI service clients
│   ├── openaiClient.ts   # OpenAI configuration
│   ├── env.ts           # Environment validation
│   └── utils.ts         # Utility functions
├── utils/               # Supabase utilities
│   └── supabase/
│       ├── client.ts    # Browser client
│       └── server.ts    # Server client
├── types/
│   └── supabase.ts      # Database type definitions
├── middleware.ts        # Session management
└── next.config.mjs     # Next.js configuration
```

## 🔐 Authentication

The application uses Supabase Auth with proper SSR implementation:

- **Browser Client**: `utils/supabase/client.ts` for client-side operations
- **Server Client**: `utils/supabase/server.ts` for server-side operations  
- **Middleware**: Automatic session refresh and route protection
- **Patterns**: Follows `@supabase/ssr` guidelines with `getAll()`/`setAll()` cookie handling

## 🛠️ API Routes

### Authentication
- `POST /api/auth/logout` - Sign out user
- `GET /api/auth/callback` - OAuth callback handler

### Projects
- `GET /api/projects` - List user's projects
- `POST /api/projects` - Create new project
- `GET /api/projects/[id]` - Get project details
- `PUT /api/projects/[id]` - Update project
- `DELETE /api/projects/[id]` - Archive project

### Documents
- `POST /api/documents/upload` - Upload document to project

### Analysis
- `POST /api/analysis/document/[id]` - Analyze document with AI

### Chat
- `POST /api/chat/[projectId]` - Send message to AI assistant
- `GET /api/chat/[projectId]` - Get chat history

### Reports
- `POST /api/reports/generate` - Generate audit report

## 🔧 Environment Variables

Required variables (see `.env.local.example`):

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=

# Azure AI Services
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_DEPLOYMENT_NAME=
AZURE_FORM_RECOGNIZER_ENDPOINT=
AZURE_FORM_RECOGNIZER_KEY=
AZURE_SEARCH_ENDPOINT=
AZURE_SEARCH_API_KEY=
AZURE_SEARCH_INDEX_NAME=
```

## 🚀 Deployment

1. **Build the application:**
   ```bash
   npm run build
   ```

2. **Start production server:**
   ```bash
   npm start
   ```

## 🔄 Migration from Express.js

This application was migrated from an Express.js backend to Next.js App Router. Key changes:

1. **API Routes**: Express routes → Next.js API routes
2. **Authentication**: Express middleware → Supabase SSR middleware
3. **File Uploads**: Multer → Next.js FormData handling
4. **Session Management**: Express cookies → Supabase SSR cookies
5. **Database**: Express + Supabase → Direct Supabase with RLS

## 🧪 Development Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run validate-env # Validate environment variables
```

## 🔒 Security Features

- Server-side session validation
- HTTP-only cookie management
- File upload validation and sanitization
- Database Row Level Security (RLS)
- Input validation and sanitization
- Secure Azure AI service integration

## 📊 AI Features

- **Document Analysis**: Azure Document Intelligence for OCR and data extraction
- **AI Chat**: Context-aware chat assistant using project and document data
- **Report Generation**: AI-powered audit report creation with PDF export
- **Confidence Scoring**: ML confidence metrics for analysis results

## 🛠️ Tech Stack

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first styling
- **Supabase** - Database, auth, and storage
- **Azure AI Services** - Document Intelligence, OpenAI, Cognitive Search
- **jsPDF** - PDF generation

## 📝 Development Notes

- Follow Supabase SSR patterns strictly (no `get`/`set`/`remove` cookie methods)
- Use TypeScript for all new code
- Implement proper error handling with user-friendly messages
- Follow the established API response format
- Maintain audit logging for compliance requirements
