# Specification for Security Verification, Implementation, and Audit

> **Do NOT add, remove, or alter tasks except by explicit instruction.**  
> Only execute or verify the items listed. Do not assume any additional security tasks.  
> If any task is believed already implemented, verify correctness against the criteria; do not introduce new features without consulting the owner.

---

## Purpose

Provide an exact, unambiguous set of instructions for:
1. Verifying presence and correctness of certain security-related implementations.
2. Implementing any missing or incorrect ones strictly as described.
3. Generating database files according to the given schema requirements.
4. Enforcing infrastructure, monitoring, integration, and post-completion audit steps.

> The system must not deviate outside these instructions or add features not explicitly listed.

---

## Sections

### 1. LOW-PRIORITY VERIFICATION (Non-Urgent)

**Description:**  
Verify that each of the following has been implemented correctly. Do not add functionality; only confirm and correct if found improperly done. If already correct, record verification; if incorrect or missing, implement exactly as described.

**Tasks:**
- **LP01: Rate Limiting on Authentication Endpoints**  
  - *Requirement:* Ensure rate limiting is implemented on all authentication endpoints. Verify configuration values, thresholds, and behavior under limit-exceeded conditions.
- **LP02: Environment Validation**  
  - *Requirement:* Ensure service key validation is mandatory. Verify that any environment-specific keys or secrets are validated before allowing operations; confirm no bypasses exist.
- **LP03: Error Handling**  
  - *Requirement:* Confirm that error responses do not expose sensitive information (stack traces, secrets, internal details). Verify that logs capture sufficient context without leaking secrets to end users.
- **LP04: Automated Security Scanning**  
  - *Requirement:* Verify that automated security scanning (e.g., static analysis, dependency checks, vulnerability scanners) is integrated and running regularly. Confirm scan results are reviewed and high-severity findings are addressed promptly.

**Notes:**
- The above items are believed already implemented; verify correctness. If an item is missing or improperly configured, implement exactly as stated, no additional enhancements beyond verifying/fixing.

---

### 2. HIGH-PRIORITY VERIFICATION (Urgent)

**Description:**  
Immediately verify that each high-priority item is implemented correctly. If found missing or incorrect, implement strictly according to these descriptions. Do not introduce unrelated features.

**Tasks:**
- **HP01: Secure Profile Creation**  
  - *Requirement:* Validate metadata before auto-creating profiles. Confirm that any incoming metadata for profile creation is validated against schema/rules; reject or sanitize invalid fields. Ensure no unauthorized profile creation occurs without valid checks.
- **HP02: Protect Invitation Tokens**  
  - *Requirement:* Ensure invitation tokens are never returned in API responses. Verify that tokens are only included in secure delivery channels and never leaked via endpoints or logs accessible by unauthorized parties.
- **HP03: Transaction Handling**  
  - *Requirement:* Implement proper database transactions for all multi-step operations. Verify atomicity: ensure either all steps commit or all roll back on error. Confirm no partial commits occur in failure scenarios.
- **HP04: Organization Access Validation**  
  - *Requirement:* Ensure proper multi-tenant isolation. Verify that every data access or operation enforces the organization context; no cross-tenant data leakage or operations permitted.
- 

# DONE#####--- Verified and Corrected Items**

 # == BEGIN HERE =====

- **HP05: Secure File Uploads**  
  - *Requirement:*  
    - Validate file type and size strictly according to allowed types.  
    - Enforce content inspection (e.g., MIME type checks).  
    - Verify storage permissions and access controls.  

**Notes:**
- These high-priority items are believed already implemented; perform verification and correct any issues exactly as described, without adding unrelated functionality.

---

### 3. POSITIVE SECURITY IMPLEMENTATIONS (Existing Features to Verify)

**Description:**  
Confirm that these features exist and operate correctly. They are stated as already implemented. Only verify and fix if misconfigured; do not extend or alter design without consultation.

**Features to Verify:**
- Multi-tenant organization isolation (when working correctly)
- Role-based access control with Admin / Auditor / Reviewer roles
- Comprehensive audit logging for sensitive operations
- Input validation and sanitization in most endpoints
- Soft delete implementation to prevent data loss

**Requirement for Each Feature:**
1. Verify presence.
2. Confirm correctness against expected behavior.
3. If misconfigured, adjust to match original design as described in later sections.

> Do not introduce additional roles, logging beyond scope, or alter the soft-delete design unless explicitly instructed.

---

### 4. SECURITY RECOMMENDATIONS (Auth & RBAC)

**Description:**  
These are recommendations already provided. If not implemented, implement exactly as stated. Do not expand or reinterpret recommendations.

#### 4.1 Authentication & Authorization
- Implement proper JWT token validation: verify signature, expiration, issuer, audience exactly as configured by application requirements.
- Use secure session management with proper expiration: if sessions are used, ensure secure cookies or tokens expire appropriately and are invalidated on logout.

#### 4.2 RBAC (Role-Based Access Control) and Permission Levels
- **Preamble:** Define clear role hierarchies and assign permissions strictly as described below. Do not add or remove roles or permissions beyond Admin, Auditor, Reviewer.
- Define clear role hierarchies: Admin > Auditor > Reviewer. Do not introduce other roles.
- Assign permissions exactly per role definitions given in the “RBAC Role Definitions” section.

#### 4.3 RBAC Role Definitions

##### Administrator (Admin)
- **Permissions:**
  - Onboarding: Admin can sign up independently, then create a new organization profile in the application.
  - User Management: Admin can invite, manage, and remove users (Auditors and Reviewers) in their organization.
  - Invitation System: Admin has dashboard to send invitation links for new team members.
  - Organizational Oversight: Admin has full access to all their organization’s data and settings.
  - Deletion Approval: Admin reviews and approves or rejects deletion requests submitted by Auditors. Deletions execute only upon Admin approval.
- **Notes:**
  - Do not add extra Admin capabilities beyond above. Any change requires explicit consultation.

##### Auditor
- **Permissions:**
  - Access Level: Broad access to view and interact with data in assigned organization.
  - Editing Permissions: Can edit data directly; edits do not require approval.
  - Deletion Initiation: Can initiate deletion of a piece of data/file. For project-level deletion, flag item as pending deletion and send request to Admin; do not execute deletion until Admin approves.
- **Restrictions:**
  - Cannot manage users, change high-level settings, or generate invitation links.
  - Primary function: access application features for data management within scope above.
- **Notes:**
  - Implement database flags (e.g., `is_pending_deletion`), notifications, and interface for Admin approval workflow as described. Do not add further workflows beyond deletion approval.

##### Reviewer
- **Permissions:**
  - Task-Specific Permissions: Limited access focused on review tasks (e.g., view submitted reports or requests; approve or reject them).
  - Limited Scope: Only interact with data relevant to review tasks; cannot access high-level settings or user management.
  - Access Granted: Only via invitation from Admin.
- **Notes:**
  - Do not expand Reviewer’s scope. Follow exactly as described.

**Notes for This Section:**
- The system must support roles and the deletion-approval workflow exactly as described.
- If any part of these recommendations is missing, implement exactly; if already present, verify correctness.

---

### 5. DATABASE FILE GENERATION

**Description:**  
Generate database schema files from scratch, ignoring any existing data structure guides except what is provided here. Place generated files in the project’s database directory. Include all necessary fields and relationships aligned with the project requirements as implied by above RBAC and multi-tenant design.

**Requirements:**
- Use exactly the entities and relationships implied by:  
  Organizations, Users, Roles (Admin, Auditor, Reviewer), InvitationTokens, Profiles, AuditLogs, SoftDeletes, PendingDeletionRequests, etc.
- Do not introduce additional entities not implied by the instructions.
- Ensure database schema supports:  
  - Multi-tenant isolation (e.g., `organization_id` foreign keys on all tenant-specific tables).  
  - RBAC tables or fields linking users to roles within an organization.  
  - Invitation tokens stored securely (but not returned in API responses).  
  - Audit logging table(s) capturing sensitive operations.  
  - Soft delete flags/columns on entities.  
  - Pending-deletion workflow: a table or flag for deletion requests, linking Auditor-initiated request to Admin approval.
- Schema files should be placed in the designated database directory. Use naming conventions consistent with the project. Ensure easy-to-understand and maintainable definitions.
- Document foreign keys, indexes, constraints, and any necessary validations at the database level to enforce data integrity (e.g., uniqueness constraints as needed).

**Notes:**
- Before generating, confirm project directory structure for database directory; place files accordingly.
- If existing files conflict, handle according to project policy (consult owner) rather than overwriting blindly.

---

### 6. INFRASTRUCTURE SECURITY

**Description:**  
Implement or verify the following in all environments. If missing or misconfigured, configure exactly as stated; do not add extra infrastructure features beyond these.

**Tasks:**
- Enforce HTTPS in all environments: ensure TLS certificates are valid; no HTTP endpoints allowed in production or staging.
- Implement proper CORS policies: restrict allowed origins as per application requirements; do not allow overly permissive settings.
- Add security headers:  
  - Content-Security-Policy (CSP) appropriate to application resources.  
  - HTTP Strict Transport Security (HSTS) with suitable max-age.  
  - X-Frame-Options to prevent clickjacking.  
  - Other headers as required (e.g., X-Content-Type-Options: nosniff).
- Use environment-specific configurations: secrets, keys, endpoints must be loaded per environment; verify no hard-coded secrets.

**Notes:**
- Verify existing infra; if absent or misconfigured, implement only these items as described.

---

### 7. MONITORING & LOGGING

**Description:**  
Verify or implement the following security monitoring capabilities. Do not add beyond these.

**Tasks:**
- Implement security event monitoring: collect events relevant to authentication, authorization failures, critical operations.
- Add anomaly detection for unusual access patterns: set up basic thresholds or integrate with existing monitoring tools; detect e.g., unusual login volumes or cross-tenant access attempts.
- Regular security log reviews: define schedule and responsibilities for reviewing logs; ensure alerts for high-severity events.
- Automated vulnerability scanning: ensure scheduled scans of infrastructure and code dependencies; review and remediate findings.

**Notes:**
- If part of monitoring already exists, verify configuration; if missing, integrate exactly these capabilities without additional monitoring features beyond scope.

---

### 8. CLIENT AND SERVER SIDE INTEGRATION

**Description:**  
Ensure that database schema and application code reflect client-server integration requirements exactly as stated. Changes on either end should synchronize with the database automatically.

**Requirements:**
- Design database schema and application endpoints so that when new features are added on frontend or backend, the database changes accordingly (e.g., migrations triggered by code changes).
- Do not assume or add extra integration patterns beyond ensuring synchronization between client, server, and database for allowed features. Any mechanism chosen (e.g., migrations, API-driven updates) should be documented and aligned with project practices.

**Notes:**
- Consult owner if integration approach conflicts with existing design. Do not alter original design without approval.

---

### 9. GROUND RULES

**Description:**  
Overarching constraints on all work.

**Rules:**
- Do not complicate issues or alter application features without consulting the owner first. No major alterations to the original application design unless explicitly approved.
- When drafting database schema, ensure alignment with application requirements and functionality; keep schemas easy to understand and maintain.
- All implementations or verifications must adhere to original design intent; if uncertain, raise for clarification rather than guessing.

**Notes:**  
Treat these as hard guardrails.

---

### 10. POST-COMPLETION VALIDATION

**Description:**  
After completing all the above verifications, fixes, and implementations, perform comprehensive audits as follows:

**Tasks:**
- Comprehensive codebase audit: Identify and rectify functional errors or security vulnerabilities overlooked during initial amendments. Do not introduce new features; only address defects or missing security controls from above scope.
- Thorough examination of codebase: Detect and address overlooked bugs, security flaws, performance issues possibly missed earlier.
- Validation of entire user sign-up and registration process: Examine stability and security of database connection to remote database; ensure secure handling of credentials, retries, error handling.
- Verify correct integration and secure handling of storage, database, and authentication processes managed by Supabase: Confirm environment configurations, secrets handling, access rules in Supabase exactly per application requirements.

**Notes:**  
For each subtask, document findings and fixes. Do not extend beyond verifying or correcting issues within the scope defined above.

---

## Instructions for Automated System Processing

1. **Parse the above specification.**  
   - Do not perform any task not explicitly listed.
2. **For each “Verify…” item:**  
   - Check existing implementation, compare against the requirement, log status.  
   - If non-compliant, implement the precise fix described; do not add extras.
3. **For tasks requiring generation** (e.g., database files):  
   - Generate files strictly according to the requirements; place them in the designated directory.
4. **For infrastructural changes:**  
   - Apply only the listed configurations.
5. **For RBAC workflows:**  
   - Implement or verify exactly as described in RBAC Role Definitions, including deletion-approval workflow.
6. **On ambiguous points** regarding “project directory” or “existing codebase structure”:  
   - Pause and request clarification rather than assume.
7. **After all steps:**  
   - Run the post-completion validation tasks in the order listed.
8. **Log all actions taken, changes made, and verification results.**  
   - Provide a report summarizing compliance and any fixes applied.

---

## Guardrails (Hard Constraints)

- **DO NOT** introduce functionality not explicitly described.
- **DO NOT** modify original design unless explicit approval is obtained.
- **DO NOT** assume any default values or thresholds beyond what is provided; if needed, request explicit values.
- All tasks are mandatory only as listed; no extra security enhancements outside these instructions.
- Any uncertainties must trigger a clarification request to the owner.

---

*End of specification.*

# Claude stooped here 

 HP05: Verify secure file uploads with validation and access controls
     ☐ HP03: Document upload lacks transaction handling - needs improvement
     ☐ Verify multi-tenant organization isolation implementation
     ☐ Verify RBAC with Admin/Auditor/Reviewer roles
     ☐ Verify comprehensive audit logging for sensitive operations
     ☐ Verify input validation and sanitization in endpoints
     ☐ Verify soft delete implementation
     ☐ Verify JWT token validation implementation
     ☐ Verify secure session management with proper expiration
     ☐ Comprehensive codebase audit for security vulnerabilities
     ☐ Validate user sign-up and registration process security
     ☐ Verify Supabase integration security and configuration
     ☐ LP01: Rate limiting exists but not applied to auth endpoints - needs implementation
     ☐ LP02: Verify environment validation for service keys
     ☐ LP03: Verify error handling doesn't expose sensitive information
     ☐ LP04: Verify automated security scanning integration
     ☐ Verify HTTPS enforcement in all environments
     ☐ Verify proper CORS policies
     ☐ Verify security headers (CSP, HSTS, X-Frame-Options, etc.)
     ☐ Verify environment-specific configurations without hard-coded secrets
     ☐ Verify security event monitoring implementation
     ☐ Verify anomaly detection for unusual access patterns
     ☐ Verify regular security log review processes
     ☐ Verify automated vulnerability scanning
     ☐ Verify client-server-database integration synchronization