
##
- When using Context, make sure that you keep the range of output in the range 2k to 4k based on what you think is the best.
- Maintain a file named library.md to stpre the Library IDs that you search for and before searching make sure that you check the file and use the library
ID already available. Otherwise, search for it.

## recommended fixes

Production-Grade Refactoring & Optimization Plan for EsusAuditAI

Objective: Your task is to perform a comprehensive analysis and refactoring of the EsusAuditAI application. The goal is to elevate it to a production-grade standard by resolving all identified security vulnerabilities, architectural flaws, and performance bottlenecks. The final application will be deployed on Vercel, using Supabase as its database and backend service layer, and Azure/GCP for AI services.

Guiding Principle: Leave no stone unturned. Every aspect of the application, from frontend code to database schema and deployment pipelines, must be scrutinized and optimized for security, scalability, and maintainability.

Phase 1: Critical Security & Stability Remediation (Immediate Priority)
This phase addresses all HIGH severity issues that make the application unsafe for production use.

Authentication & Authorization
[ ] Standardize Supabase Auth Client:

Action: Remove the deprecated @supabase/auth-helpers-nextjs package.

Action: Refactor all authentication logic (client-side, server-side, and middleware) to exclusively use the modern @supabase/ssr package. This ensures consistent and secure cookie/session handling.

Files to check: package.json, middleware.ts, utils/supabase/server.ts, all API routes.

[ ] Implement Strict API Authorization Middleware:

Action: Create a reusable middleware function that enforces Role-Based Access Control (RBAC) for all sensitive API endpoints.

Logic: The middleware must decode the user's JWT, verify their role (Admin, Auditor, Reviewer), and check for project ownership or assignment before allowing the request to proceed.

Target APIs: api/projects/[id], api/documents/*, api/chat/*, api/reports/*, api/admin/*.

[ ] Fix Hardcoded Credentials:

Action: Remove the hardcoded default admin user from database/seed.sql. Seeding should be handled via secure, environment-specific scripts.

Input & Data Validation
[ ] Implement Secure File Upload Validation:

Action: In the api/documents/upload/route.ts endpoint, implement strict server-side validation for file types (MIME types) and file size. Only allow specified types (e.g., application/pdf, application/vnd.ms-excel).

Action: Sanitize all filenames to prevent path traversal attacks.

[ ] Prevent Information Disclosure:

Action: Refactor all API error handling. Never expose raw database errors or stack traces to the client. Implement a generic error response structure that logs detailed errors on the server but shows a user-friendly message.

Action: Specifically remove any potential API key leakage in error responses (e.g., api/chat/[projectId]/route.ts).

Phase 2: Architectural Refactoring & Performance Optimization
This phase focuses on improving code quality, performance, and the overall architecture for scalability.

Code & Dependency Consistency
[ ] Unify API Response Formats:

Action: Define and implement a consistent JSON structure for all API success and error responses across the application.

[ ] Resolve Database Schema Discrepancies:

Action: Correct the code to use the correct table names as defined in the schema (e.g., use users instead of the non-existent profiles).

Action: Run the provided schema_adaptation_recommendations.sql script (after careful review) to align the database with application needs.

Action: Add any missing foreign key constraints or indexes identified in the audit.

Performance & Scalability
[ ] Implement Resilient AI Processing Queue:

Action: Introduce a message queue system to handle long-running AI tasks asynchronously (document processing, report generation).

Recommendation: Use Supabase Edge Functions triggered by database webhooks for a lightweight solution. This decouples the API response from the completion of the AI task.

Action: Implement retry/backoff logic for failed AI API calls (e.g., to Azure Document Intelligence).

[ ] Optimize Large File Uploads:

Action: Refactor the file upload mechanism to support chunked uploads and checksum verification. This improves reliability for large files over unstable connections.

[ ] Implement Scalable Rate Limiting:

Action: Replace the in-memory rate limiter with a Redis-based solution (e.g., using Upstash, which has a free tier and integrates well with Vercel). This ensures rate limits are consistent across all serverless function instances.

[ ] Add Pagination:

Action: Implement pagination for all endpoints that return lists of data, especially the chat history (GET /api/chat/history/:projectId).

Phase 3: Enterprise Hardening & Feature Enhancement
This phase adds features required for enterprise clients and prepares the app for long-term growth.

[ ] Implement Multi-Factor Authentication (MFA):

Action: Enable and configure MFA support within Supabase Auth. Integrate the MFA enrollment and verification flows into the user profile and login pages.

[ ] Build the Ask Esus RAG Pipeline:

Action: Implement a proper Retrieval-Augmented Generation (RAG) pipeline for the "Ask Esus" assistant to eliminate hallucinations.

Flow:

When a user asks a question, use Azure Cognitive Search to find the most relevant document chunks (vector search).

Pass these chunks as context along with the user's question to the GPT model.

Crucially: Force the model to generate answers based only on the provided context and to include citations pointing back to the source documents.

[ ] Develop an Admin Alerting System:

Action: Create a mechanism (e.g., using Supabase Functions or a Vercel Cron Job) to monitor for and alert admins about suspicious activity (high error rates, unusual user activity, AI service quotas nearing limits).

[ ] Establish Immutable Audit Logs:

Action: Ensure the audit_logs table is designed to be append-only. Use PostgreSQL table permissions or triggers to prevent any updates or deletions to log entries.

Infrastructure & Deployment (Vercel)
[ ] Configure CI/CD Pipeline:

Action: Set up a GitHub Action that triggers Vercel deployments.

Branches: main branch deploys to production, while pull requests generate preview deployments.

Gates: Implement required status checks (e.g., tests passing) before allowing a PR to be merged into main.

[ ] Secure Environment Variable Management:

Action: Use Vercel's Environment Variables settings for all secrets (Supabase URL/keys, Azure AI keys, etc.). Ensure different variables for Preview, Development, and Production environments.

[ ] Enable Vercel Edge Firewall:

Action: Configure Vercel's firewall to add a layer of protection against common web attacks (DDoS, SQLi, XSS) at the network edge.

Final Deliverables
A Pull Request on GitHub containing all the required code changes, clearly organized into commits that correspond to the tasks in this plan.

An updated README-PRODUCTION.md file detailing how to set up, deploy, and manage the production-grade application on Vercel and Supabase.

All necessary database migration scripts to transition from the current schema to the new, optimized schema.

generate a totally new db to fit the apps purpose.


Here are the suggested final additions:

Immutable Audit Logs: While implied by the schema work, we should add an explicit task in Phase 3: "Ensure the audit_logs table is append-only by using PostgreSQL table permissions or triggers to prevent any updates or deletions."
Admin Alerting System: Add a task in Phase 3: "Develop an admin alerting system (using Vercel Cron Jobs or Supabase Functions) to send notifications for unusual user activity, high error rates, or AI service quotas nearing their limits."
Multi-Factor Authentication (MFA): Add a task in Phase 3: "Enable and configure MFA support within Supabase Auth and integrate the necessary enrollment and verification flows into the frontend."

AI Output Explainability: In addition to RAG, add a task in Phase 3: "Build an 'explainability UI' that shows which specific snippets or data points in a source document triggered an AI-generated red flag or summary point."
Formalized Testing Plan: The current "Required Testing Scope" is good. We can formalize it by making it a required section in the final Pull Request description, where the developer must check off each test case they performed manually or via automation.

