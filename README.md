# Esus Audit AI

AI-powered audit automation platform for finance and audit firms.

## Migration Notice

This project has been migrated from Azure Functions to Express.js and from Azure Blob Storage to Supabase. The following Azure services are still in use:

- Azure Document Intelligence (formerly Form Recognizer)
- Azure Cognitive Search
- Azure OpenAI Services
- Azure Application Insights

## Tech Stack

- **Frontend**: React, Tailwind CSS, Vite
- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL via Supabase
- **Storage**: Supabase Storage
- **Authentication**: Supabase Auth
- **AI Services**: Azure OpenAI, Azure Document Intelligence
- **Search**: Azure Cognitive Search
- **Monitoring**: Azure Application Insights

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Supabase account
- Azure account (for retained services)

## Environment Setup

1. Copy the example environment files:
   ```bash
   # For the root directory
   cp .env.example .env
   
   # For the server directory
   cp server/.env.example server/.env
   ```

2. Fill in the required environment variables in both .env files:
   - Supabase URL and API keys
   - Azure service endpoints and keys
   - JWT secret for token signing
   
   Note: The environment variables in both files should be identical to ensure consistent behavior.

## Installation

1. Install dependencies:
   ```
   npm install
   cd client && npm install
   cd server && npm install
   ```

2. Set up the database:
   ```
   npm run db:setup
   ```

3. Set up Supabase resources:
   ```
   npm run supabase:setup
   ```

## Development

Start the development server:
```
npm run dev
```

This will start both the client (Vite) and server (Express) in development mode with hot reloading.

### Project Structure Notes

- The main server entry point is `/server/server.js`
- The Express application is defined in `/server/app.js`
- API routes are defined in `/server/routes`
- Database operations are handled through Supabase

## Production Build

Build the client for production:
```
npm run build
```

Start the production server:
```
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login
- `GET /api/auth/verify` - Verify token
- `PUT /api/auth/profile` - Update user profile
- `PUT /api/auth/password` - Change password
- `POST /api/auth/logout` - Logout

### Projects
- `GET /api/projects` - Get all projects for user
- `POST /api/projects` - Create a new project
- `GET /api/projects/:projectId` - Get project details
- `PUT /api/projects/:projectId` - Update project

### Documents
- `POST /api/documents/:projectId` - Upload document
- `GET /api/documents/detail/:documentId` - Get document details
- `GET /api/documents/:documentId/download` - Download document
- `DELETE /api/documents/:documentId` - Delete document

### Analysis
- `POST /api/analysis/:documentId` - Analyze document
- `GET /api/analysis/:documentId` - Get analysis results
- `POST /api/analysis/search` - Search documents

### Chat (Ask Esus)
- `POST /api/chat/ask` - Ask a question
- `GET /api/chat/history/:projectId` - Get chat history
- `GET /api/chat/suggested-questions/:projectId` - Get suggested questions

### Reports
- `POST /api/reports/generate` - Generate report
- `GET /api/reports/:projectId` - Get all reports for a project
- `GET /api/reports/detail/:reportId` - Get report details

## Database Schema

The database schema is defined in `database/schema.sql`. It includes tables for:

- Users
- Projects
- Documents
- Analysis Results
- Chat History
- Audit Reports
- Audit Logs
- Application Settings

## Storage Buckets

Supabase Storage is used for file storage with two buckets:

- `documents` - For storing uploaded documents
- `reports` - For storing generated PDF reports

## Azure Services Integration

### Document Intelligence (Form Recognizer)
Used for extracting data from documents. The service analyzes PDFs, invoices, receipts, and other document types.

### Cognitive Search
Used for full-text search across documents and analysis results.

### OpenAI
Used for generating summaries, answering questions, and providing insights based on document content.

### Application Insights
Used for monitoring and logging application performance and errors.

## Contributing

1. Create a feature branch
2. Make your changes
3. Submit a pull request

## License

MIT
