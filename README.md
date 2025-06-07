# Esus Audit AI

AI-powered audit automation platform for finance and audit firms. This comprehensive solution leverages artificial intelligence to streamline the audit process, extract insights from financial documents, and provide intelligent analysis for auditors and financial professionals.

## Key Features

### Document Management
- **Document Upload & Storage**: Securely upload and store financial documents in Supabase Storage
- **Document Organization**: Organize documents by projects and clients
- **Document Preview**: View documents directly in the application
- **Document Download**: Download original documents when needed
- **File Type Support**: Support for PDF, Word, Excel, and CSV files

### AI-Powered Analysis
- **Automated Data Extraction**: Extract key financial data from documents using Azure Document Intelligence
- **Financial Statement Analysis**: Analyze balance sheets, income statements, and cash flow statements
- **Anomaly Detection**: Identify unusual patterns or discrepancies in financial data
- **Risk Assessment**: Evaluate financial risk factors and highlight areas of concern
- **Confidence Scoring**: Provide confidence levels for extracted data and analysis results

### Interactive Chat Assistant
- **Context-Aware Queries**: Ask questions about specific documents or projects
- **Financial Insights**: Get AI-generated insights about financial data
- **Audit Guidance**: Receive suggestions for audit procedures based on document content
- **Chat History**: Maintain a record of all questions and answers for reference
- **Suggested Questions**: Get AI-generated question suggestions based on document content

### Report Generation
- **Automated Reporting**: Generate comprehensive audit reports with a single click
- **Customizable Templates**: Choose from different report templates based on audit type
- **Executive Summaries**: Create concise summaries of audit findings
- **PDF Export**: Export reports in PDF format for sharing and archiving
- **Audit Trail**: Maintain a complete record of report generation and modifications

### Project Management
- **Client Management**: Organize work by client and project
- **Team Collaboration**: Assign team members to projects with role-based access
- **Status Tracking**: Monitor project progress from active to completed
- **Timeline Management**: Set and track project start and end dates
- **Activity Logging**: Comprehensive audit trail of all user actions

### Security & Compliance
- **Role-Based Access Control**: Granular permissions based on user roles (admin, auditor, reviewer)
- **Secure Authentication**: Robust authentication via Supabase Auth
- **Data Encryption**: End-to-end encryption for sensitive financial data
- **Audit Logging**: Detailed logs of all system activities for compliance
- **Rate Limiting**: Protection against brute force and DoS attacks
- **Session Management**: Secure session handling with automatic timeouts

## Tech Stack

- **Frontend**: React 18, Tailwind CSS, Vite, React Query, React Router
- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL via Supabase
- **Storage**: Supabase Storage
- **Authentication**: Supabase Auth
- **AI Services**: 
  - Azure OpenAI (GPT-4 Turbo) for intelligent analysis and chat
  - Azure Document Intelligence for document parsing
  - Azure Cognitive Search for full-text search capabilities
- **Monitoring**: Azure Application Insights
- **Security**: Helmet.js, Express Rate Limit, CORS protection

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Supabase account
- Azure account (for AI services)

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

### Project Structure

#### Server Structure
- `/server/server.js` - Main entry point
- `/server/app.js` - Express application configuration
- `/server/routes/` - API route definitions
- `/server/middleware/` - Express middleware
- `/server/shared/` - Shared services (auth, database, AI clients)
- `/server/utils/` - Utility functions and helpers

#### Client Structure
- `/client/src/App.jsx` - Main React component
- `/client/src/components/` - Reusable UI components
- `/client/src/pages/` - Page components
- `/client/src/services/` - API service clients
- `/client/src/contexts/` - React context providers
- `/client/src/utils/` - Utility functions

#### Database Structure
- `/database/schema.sql` - Database schema definition
- `/database/seed.sql` - Initial seed data
- `/database/migrations/` - Database migration scripts

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
- `POST /api/auth/login` - Login with email and password
- `GET /api/auth/verify` - Verify authentication token
- `PUT /api/auth/profile` - Update user profile information
- `PUT /api/auth/password` - Change user password
- `POST /api/auth/logout` - Logout and invalidate session

### Projects
- `GET /api/projects` - Get all projects for authenticated user
- `POST /api/projects` - Create a new project
- `GET /api/projects/:projectId` - Get detailed project information
- `PUT /api/projects/:projectId` - Update project details
- `DELETE /api/projects/:projectId` - Archive or delete a project

### Documents
- `POST /api/documents/:projectId` - Upload document to a project
- `GET /api/documents/project/:projectId` - Get all documents for a project
- `GET /api/documents/detail/:documentId` - Get document details
- `GET /api/documents/:documentId/download` - Download original document
- `DELETE /api/documents/:documentId` - Delete document

### Analysis
- `POST /api/analysis/document/:documentId` - Analyze document with AI
- `GET /api/analysis/:documentId` - Get analysis results for a document
- `POST /api/analysis/search` - Search across document content and analysis
- `GET /api/analysis/summary/:projectId` - Get project-level analysis summary

### Chat (Ask Esus)
- `POST /api/chat/:projectId` - Send a message to the AI assistant
- `GET /api/chat/history/:projectId` - Get chat history for a project
- `GET /api/chat/suggested-questions/:projectId` - Get AI-suggested questions
- `DELETE /api/chat/:messageId` - Delete a chat message

### Reports
- `POST /api/reports/generate/:projectId` - Generate a new report
- `GET /api/reports/project/:projectId` - Get all reports for a project
- `GET /api/reports/detail/:reportId` - Get detailed report information
- `GET /api/reports/:reportId/download` - Download report as PDF
- `DELETE /api/reports/:reportId` - Delete a report

### Health Check
- `GET /health` - System health check endpoint for monitoring

## Database Schema

The database schema is defined in `database/schema.sql` and includes the following tables:

### Users
Stores user account information with role-based access control.
- `id` - UUID primary key
- `email` - Unique email address
- `password_hash` - Securely hashed password
- `first_name`, `last_name` - User's name
- `role` - User role (admin, auditor, reviewer)
- `company` - User's company or organization
- Security fields: `is_active`, `last_login_at`, `password_changed_at`, `failed_login_attempts`, `locked_until`

### Projects
Organizes work by client and project.
- `id` - UUID primary key
- `name` - Project name
- `description` - Project description
- `client_name` - Client company name
- `client_email` - Client contact email
- `status` - Project status (active, completed, archived)
- `created_by` - User who created the project
- `assigned_to` - Array of user IDs assigned to the project
- `start_date`, `end_date` - Project timeline

### Documents
Tracks uploaded documents and their processing status.
- `id` - UUID primary key
- `project_id` - Associated project
- `uploaded_by` - User who uploaded the document
- `original_name` - Original filename
- `file_path` - Storage path
- `file_size` - Document size in bytes
- `file_type` - MIME type
- `blob_url` - URL for document access
- `status` - Processing status (uploaded, processing, analyzed, error)

### Analysis Results
Stores AI-generated analysis of documents.
- `id` - UUID primary key
- `document_id` - Associated document
- `extracted_data` - Structured data extracted from document (JSONB)
- `ai_summary` - AI-generated summary
- `red_flags` - Array of potential issues identified
- `highlights` - Array of important points
- `confidence_score` - AI confidence in analysis
- `processing_time_ms` - Processing duration

### Chat History
Records interactions with the AI assistant.
- `id` - UUID primary key
- `project_id` - Associated project
- `user_id` - User who asked the question
- `question` - User's question
- `answer` - AI's response
- `context_documents` - Array of document IDs used for context

### Audit Reports
Tracks generated audit reports.
- `id` - UUID primary key
- `project_id` - Associated project
- `generated_by` - User who generated the report
- `report_name` - Report name
- `report_data` - Report content (JSONB)
- `pdf_url` - URL to PDF version
- `status` - Report status (draft, final, archived)

### Audit Logs
Comprehensive activity tracking for security and compliance.
- `id` - UUID primary key
- `user_id` - User who performed the action
- `action` - Action performed
- `resource_type` - Type of resource affected
- `resource_id` - ID of affected resource
- `details` - Additional details (JSONB)
- `ip_address` - User's IP address
- `user_agent` - User's browser/client
- `success` - Whether action succeeded
- `error_message` - Error details if failed

### Application Settings
System-wide configuration settings.
- `key` - Setting name (primary key)
- `value` - Setting value
- `description` - Setting description
- `category` - Setting category
- `is_sensitive` - Whether setting contains sensitive data

## Storage Buckets

Supabase Storage is used for file storage with two buckets:

- `documents` - For storing uploaded documents (PDFs, Excel files, Word documents)
- `reports` - For storing generated PDF reports

## Azure Services Integration

### Document Intelligence (Form Recognizer)
- **Document Parsing**: Extract structured data from unstructured documents
- **Layout Analysis**: Understand document structure and organization
- **Table Extraction**: Extract tabular data from financial statements
- **Form Recognition**: Process standard financial forms and templates
- **Custom Models**: Support for custom-trained models for specific document types

### Cognitive Search
- **Full-Text Search**: Search across all document content
- **Semantic Search**: Understand the meaning behind search queries
- **Faceted Search**: Filter search results by metadata
- **Relevance Ranking**: Sort results by relevance to query
- **Search Suggestions**: Provide query suggestions based on partial input

### OpenAI
- **Text Generation**: Generate natural language summaries and reports
- **Question Answering**: Answer specific questions about document content
- **Anomaly Detection**: Identify unusual patterns in financial data
- **Risk Assessment**: Evaluate potential risk factors in financial documents
- **Insight Generation**: Provide actionable insights based on document analysis

### Application Insights
- **Performance Monitoring**: Track application performance metrics
- **Error Tracking**: Capture and analyze application errors
- **Usage Analytics**: Understand user behavior and feature usage
- **Availability Monitoring**: Monitor system uptime and responsiveness
- **Custom Event Tracking**: Track business-specific events and metrics

## Security Features

- **HTTPS Enforcement**: All communications are encrypted via HTTPS
- **Content Security Policy**: Strict CSP to prevent XSS attacks
- **Rate Limiting**: Protection against brute force and DoS attacks
- **Input Validation**: Comprehensive validation of all user inputs
- **Password Security**: Strong password requirements and secure storage
- **Account Lockout**: Temporary lockout after multiple failed login attempts
- **Session Management**: Secure session handling with automatic timeouts
- **Audit Logging**: Detailed logs of all security-relevant events
- **CORS Protection**: Strict cross-origin resource sharing policies
- **Helmet Security**: HTTP header security with Helmet.js

## Contributing

1. Create a feature branch
2. Make your changes
3. Submit a pull request

## License

MIT
