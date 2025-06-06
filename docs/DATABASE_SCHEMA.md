# Esus Audit AI - Database Schema Documentation

## 🗄️ Database Overview

The Esus Audit AI application uses **PostgreSQL** as its primary database with a comprehensive schema designed for enterprise audit management, document processing, and AI-powered analysis.

## 📊 Schema Summary

| Table | Purpose | Key Features |
|-------|---------|--------------|
| `users` | User management | Role-based access, security tracking |
| `projects` | Audit projects | Client management, team assignment |
| `documents` | File storage metadata | Blob storage integration |
| `analysis_results` | AI analysis data | Form Recognizer + OpenAI results |
| `chat_history` | Ask Esus conversations | AI chat with context |
| `audit_reports` | Generated reports | PDF reports with data |
| `audit_logs` | Activity tracking | Comprehensive audit trail |
| `app_settings` | Configuration | Dynamic application settings |

## 🔐 Security Features

### Email Validation
```sql
CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
```

### Account Security
- **Failed Login Tracking**: `failed_login_attempts` counter
- **Account Lockout**: `locked_until` timestamp
- **Password Change Tracking**: `password_changed_at` timestamp
- **Last Login Tracking**: `last_login_at` timestamp

### Data Validation
- **Name Validation**: `CHECK (LENGTH(TRIM(first_name)) > 0)`
- **Role Constraints**: `CHECK (role IN ('admin', 'auditor', 'reviewer'))`
- **Status Constraints**: Enum-like constraints for all status fields

## 📈 Performance Optimizations

### Comprehensive Indexing Strategy

#### User Indexes
```sql
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_company ON users(company);
CREATE INDEX idx_users_last_login ON users(last_login_at);
```

#### Project Indexes
```sql
CREATE INDEX idx_projects_client ON projects(client_name);
CREATE INDEX idx_projects_dates ON projects(start_date, end_date);
CREATE INDEX idx_projects_assigned_to ON projects USING GIN(assigned_to);
```

#### Document Indexes
```sql
CREATE INDEX idx_documents_project_status ON documents(project_id, status);
CREATE INDEX idx_documents_file_type ON documents(file_type);
CREATE INDEX idx_documents_created_at ON documents(created_at);
```

#### Analysis Indexes
```sql
CREATE INDEX idx_analysis_confidence ON analysis_results(confidence_score);
CREATE INDEX idx_analysis_processing_time ON analysis_results(processing_time_ms);
```

### Query Optimization Features
- **Composite Indexes**: Multi-column indexes for common query patterns
- **GIN Indexes**: For array fields like `assigned_to`
- **Partial Indexes**: For frequently filtered data
- **JSONB Indexes**: For efficient JSON queries

## 🔄 Automated Features

### Timestamp Management
```sql
-- Automatic updated_at tracking
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Password Security
```sql
-- Automatic password change tracking
CREATE TRIGGER track_user_password_change 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION track_password_change();
```

## 📋 Table Details

### Users Table
**Purpose**: User management with role-based access control

**Key Fields**:
- `email`: Unique, validated email address
- `role`: admin, auditor, reviewer
- `failed_login_attempts`: Security tracking
- `locked_until`: Account lockout management
- `last_login_at`: Activity tracking

### Projects Table
**Purpose**: Audit project management

**Key Fields**:
- `assigned_to`: UUID array for team assignment
- `client_name`: Indexed for fast client searches
- `status`: active, completed, archived
- `start_date`, `end_date`: Project timeline

### Documents Table
**Purpose**: File metadata and Azure Blob Storage integration

**Key Fields**:
- `blob_url`: Azure Blob Storage URL
- `file_size`: Size in bytes
- `file_type`: MIME type
- `status`: uploaded, processing, analyzed, error

### Analysis Results Table
**Purpose**: AI analysis results from Form Recognizer and OpenAI

**Key Fields**:
- `extracted_data`: JSONB with Form Recognizer results
- `ai_summary`: OpenAI-generated summary
- `red_flags`: Array of identified issues
- `highlights`: Array of positive findings
- `confidence_score`: Analysis confidence (0-1)

### Chat History Table
**Purpose**: Ask Esus AI chat conversations

**Key Fields**:
- `question`: User question
- `answer`: AI response
- `context_documents`: UUID array of relevant documents

### Audit Reports Table
**Purpose**: Generated PDF reports

**Key Fields**:
- `report_data`: JSONB with report content
- `pdf_url`: Generated PDF location
- `status`: draft, final, archived

### Audit Logs Table
**Purpose**: Comprehensive activity tracking

**Key Fields**:
- `action`: Action performed
- `resource_type`: Type of resource affected
- `details`: JSONB with action details
- `ip_address`: User IP address
- `user_agent`: Browser information

### App Settings Table
**Purpose**: Dynamic application configuration

**Key Fields**:
- `category`: Setting category (security, ai, upload, etc.)
- `is_sensitive`: Flag for sensitive settings
- `last_updated_by`: Change tracking

## 🛡️ Data Integrity

### Foreign Key Constraints
- All relationships properly constrained
- Cascade deletes where appropriate
- SET NULL for audit trail preservation

### Check Constraints
- Email format validation
- Enum-like status constraints
- Data length validations
- Business rule enforcement

### Unique Constraints
- Email uniqueness
- Composite uniqueness where needed

## 🔧 Configuration Settings

### Security Settings
- `max_login_attempts`: 5
- `account_lockout_duration_minutes`: 30
- `password_min_length`: 8
- `require_password_complexity`: true
- `jwt_expiry_hours`: 24

### Upload Settings
- `max_file_size_mb`: 50
- `supported_file_types`: pdf,xlsx,xls,docx,doc,csv

### AI Settings
- `ai_confidence_threshold`: 0.7
- `default_analysis_timeout_seconds`: 300

### System Settings
- `app_version`: 1.0.0
- `maintenance_mode`: false
- `enable_demo_mode`: false
- `enable_audit_logging`: true

## 📊 Performance Monitoring

### Query Performance
- Comprehensive indexing strategy
- Optimized for common access patterns
- JSONB indexes for flexible queries

### Storage Optimization
- Efficient data types
- Proper normalization
- JSONB for flexible schema

### Scalability Features
- UUID primary keys for distributed systems
- Partitioning-ready design
- Efficient indexing strategy

## 🚀 Migration Strategy

### Version Control
- Schema versioning with timestamps
- Incremental migration scripts
- Rollback procedures

### Data Migration
- Safe migration procedures
- Data validation scripts
- Backup and restore procedures

---

**Note**: This schema is designed for production use with enterprise-grade security, performance, and scalability features.
