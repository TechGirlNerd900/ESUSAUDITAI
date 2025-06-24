# Database Schema Documentation

This directory contains the complete database schema for the audit management system, implementing secure multi-tenant architecture with role-based access control (RBAC).

## Schema Overview

The database schema is designed with the following security principles:
- **Multi-tenant isolation** using organization_id foreign keys
- **Role-based access control** with Admin/Auditor/Reviewer roles
- **Comprehensive audit logging** for all sensitive operations
- **Soft delete functionality** with approval workflows
- **Row Level Security (RLS)** policies for data isolation

## File Structure

### 000_init_database.sql
- Database initialization and configuration
- Extensions, types, and utility functions
- Application settings and system configuration
- Health check and maintenance functions

### 001_organizations_and_users.sql
- Organizations table (root of multi-tenant structure)
- Users table with RBAC implementation
- User roles and session management
- Row Level Security policies

### 002_invitations_and_tokens.sql
- Secure invitation system
- API token management
- Password reset and email verification tokens
- Token cleanup and security functions

### 003_audit_logs_and_monitoring.sql
- Comprehensive audit logging
- Security event tracking
- Login attempt monitoring
- Data access logs and system health monitoring

### 004_soft_delete_and_workflows.sql
- Soft delete tracking system
- Pending deletion approval workflow
- Data retention policies
- Workflow approval system

### 005_projects_and_documents.sql
- Project management tables
- Document storage with security classifications
- Document comments and collaboration
- Project milestones and analysis results

### 006_reports_and_analytics.sql
- Audit report generation and management
- Report templates and distribution
- Analytics dashboards and KPIs
- Report distribution tracking

## Deployment Instructions

1. **Initialize Database**:
   ```sql
   \i 000_init_database.sql
   ```

2. **Create Core Tables** (run in order):
   ```sql
   \i 001_organizations_and_users.sql
   \i 002_invitations_and_tokens.sql
   \i 003_audit_logs_and_monitoring.sql
   \i 004_soft_delete_and_workflows.sql
   \i 005_projects_and_documents.sql
   \i 006_reports_and_analytics.sql
   ```

3. **Verify Installation**:
   ```sql
   SELECT system_health_check();
   ```

## Security Features

### Multi-Tenant Isolation
- Every tenant-specific table includes `organization_id`
- Row Level Security (RLS) policies enforce data isolation
- Cross-tenant data access is prevented at the database level

### Role-Based Access Control (RBAC)
- **Admin**: Full access to organization data, user management, deletion approval
- **Auditor**: Broad data access, can initiate deletions (requires admin approval)
- **Reviewer**: Limited access focused on review tasks

### Audit Logging
- All sensitive operations are logged in `audit_logs` table
- Security events tracked in `security_events` table
- Login attempts monitored for anomaly detection
- Data access logging for compliance

### Soft Delete System
- Entities are soft-deleted with `deleted_at` timestamp
- Full entity data preserved in `deleted_entities` table
- Pending deletion requests require admin approval
- Configurable retention policies

### Token Security
- Invitation tokens are securely generated and hashed
- Tokens never returned in API responses (as per security requirements)
- Automatic token expiration and cleanup
- Rate limiting support for API tokens

## Maintenance

### Scheduled Tasks
Run the maintenance function regularly:
```sql
SELECT run_maintenance_tasks();
```

This performs:
- Expired invitation cleanup
- Token cleanup
- Deletion request cleanup
- Anomaly detection
- Statistics refresh

### Health Monitoring
```sql
SELECT system_health_check();
SELECT verify_data_integrity();
```

### Statistics Refresh
```sql
SELECT refresh_organization_stats();
```

## Configuration

Application settings are stored in the `app_settings` table:
- Organization-specific and global settings
- Encrypted sensitive configuration
- Runtime configuration management

## Compliance Features

- **Data Retention**: Configurable retention policies per entity type
- **Audit Trail**: Complete audit trail for regulatory compliance
- **Access Controls**: Granular access controls with logging
- **Data Classification**: Document classification levels (public, internal, confidential, restricted)
- **Secure Deletion**: Proper data disposal with approval workflows

## Performance Considerations

- Comprehensive indexing strategy for multi-tenant queries
- Materialized views for organization statistics
- Partitioning support for large audit log tables
- Optimized RLS policies to minimize performance impact

## Backup and Recovery

- All critical data includes created_at/updated_at timestamps
- Soft delete system provides recovery capabilities
- Schema versioning for migration tracking
- Data integrity verification functions

## Development Notes

- All tables include organization_id for multi-tenant isolation
- UUID primary keys for security and distributed systems
- JSONB fields for flexible metadata storage
- Comprehensive foreign key constraints
- Trigger-based timestamp management

For additional information, see the inline documentation within each SQL file.