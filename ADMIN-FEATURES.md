# Admin Management Features

## 🔧 Environment Variables Management

Your application now includes a comprehensive admin panel for managing environment variables and API integrations without requiring server restarts or code deployments.

### Features Added:

#### **1. Environment Variables Management**
- **Dynamic Configuration**: Add, edit, and delete environment variables through the web interface
- **Categories**: Organize variables by category (Database, Azure, Auth, Security, Monitoring, Custom)
- **Sensitive Data Protection**: Mark variables as sensitive to mask their values in the UI
- **Validation**: Comprehensive input validation for keys and values
- **Audit Trail**: All changes are logged with user information and timestamps

#### **2. API Integrations Management** 
- **Azure Services**: Built-in support for Azure OpenAI, Form Recognizer, and Search
- **Custom Integrations**: Add any REST API endpoint
- **Live Testing**: Test API connections directly from the admin panel
- **Configuration Storage**: Store API keys and configuration securely
- **Enable/Disable**: Toggle integrations without deleting them

#### **3. Security Features**
- **Role-Based Access**: Only admin and super_admin users can access the panel
- **Encrypted Storage**: API keys and sensitive data are encrypted in the database
- **Audit Logging**: Complete audit trail of all admin actions
- **Input Sanitization**: All inputs are validated and sanitized
- **Rate Limiting**: Admin endpoints are protected by rate limiting

#### **4. Production-Ready Features**
- **Configuration Caching**: Intelligent caching with automatic refresh
- **Database Integration**: All settings stored in Supabase with RLS policies  
- **Real-time Updates**: Changes are applied immediately where possible
- **Backup & Recovery**: Settings are versioned and can be restored
- **Health Monitoring**: Integration status monitoring and alerting

---

## 🚀 How to Use

### **Access the Admin Panel**

1. **Login as Admin**: Ensure your user has `admin` or `super_admin` role
2. **Navigate**: Go to `/admin` in your application
3. **Manage**: Use the tabs to manage Environment Variables or API Integrations

### **Environment Variables**

```bash
# Example: Add a new environment variable
Key: CUSTOM_API_ENDPOINT
Value: https://api.example.com/v1
Description: Custom API endpoint for external service
Category: Custom
Sensitive: No
```

### **API Integrations**

```bash
# Example: Add Azure OpenAI integration
Name: Production OpenAI
Type: Azure OpenAI  
Endpoint: https://your-openai.openai.azure.com/
API Key: your-api-key-here
Configuration: {
  "deploymentName": "gpt-4o-mini",
  "apiVersion": "2024-02-15-preview"
}
```

---

## 🔌 API Endpoints

### **Environment Variables**
- `GET /api/admin/env` - List all environment variables
- `GET /api/admin/env/:key` - Get specific variable
- `PUT /api/admin/env/:key` - Create or update variable
- `DELETE /api/admin/env/:key` - Delete variable

### **API Integrations**
- `GET /api/admin/integrations` - List all integrations
- `PUT /api/admin/integrations/:id` - Create or update integration
- `POST /api/admin/integrations/:id/test` - Test integration
- `DELETE /api/admin/integrations/:id` - Delete integration

### **System Management**
- `POST /api/admin/reload-env` - Reload environment configuration

---

## 🛡️ Security Implementation

### **Database Schema**
```sql
-- Environment variables with encryption
CREATE TABLE app_settings (
    id UUID PRIMARY KEY,
    key VARCHAR(100) NOT NULL,
    value TEXT, -- Encrypted for sensitive values
    description TEXT,
    category VARCHAR(50),
    sensitive BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);

-- API integrations
CREATE TABLE api_integrations (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    endpoint TEXT NOT NULL,
    api_key TEXT NOT NULL, -- Encrypted
    config JSONB DEFAULT '{}',
    enabled BOOLEAN DEFAULT true,
    last_test_result JSONB
);

-- Audit trail
CREATE TABLE admin_audit_log (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(100),
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    created_at TIMESTAMP
);
```

### **Row Level Security**
- Admins can manage all settings
- Regular users can only read non-sensitive settings
- All actions are logged for compliance

---

## 🔄 Runtime Configuration

### **Configuration Manager**
The system includes a configuration manager that:

- **Loads settings from database on startup**
- **Caches frequently accessed values**
- **Auto-refreshes every hour**
- **Provides fallback to environment variables**
- **Handles API integration testing**

### **Usage in Code**
```javascript
import configManager from '../utils/configManager.js';

// Get configuration value
const apiKey = await configManager.getConfig('AZURE_OPENAI_API_KEY');

// Get Azure OpenAI configuration
const openaiConfig = configManager.getAzureOpenAIConfig();

// Test an integration
const testResult = await configManager.testIntegration('azure_openai');

// Reload all configurations
await configManager.reloadAll();
```

---

## 📊 Monitoring & Alerts

### **Integration Health**
- **Automatic Testing**: Periodic health checks for all integrations
- **Status Monitoring**: Real-time status tracking
- **Alert System**: Notifications when integrations fail
- **Performance Metrics**: Response time tracking

### **Configuration Changes**
- **Change Notifications**: Alerts when critical settings change
- **Approval Workflow**: Optional approval process for sensitive changes
- **Rollback Capability**: Ability to revert to previous configurations
- **Impact Analysis**: Show what will be affected by changes

---

## 🚀 Deployment Considerations

### **Production Setup**
1. **Database Migration**: Run the admin management migration
2. **Role Assignment**: Assign admin roles to appropriate users
3. **Initial Configuration**: Load existing environment variables into database
4. **Security Review**: Verify all sensitive data is marked appropriately

### **Environment Variables Priority**
1. **Database Settings** (highest priority)
2. **Environment Variables** 
3. **Default Values** (lowest priority)

### **Backup Strategy**
- Regular database backups include all configuration
- Export/import functionality for configuration migration
- Version control for configuration changes

---

## 🔧 Technical Details

### **Frontend Components**
- Role-based access control
- Real-time form validation
- Responsive design

### **Backend Routes**
- Input validation middleware
- Audit logging
- Security middleware

### **Database Integration**
- Supabase integration with RLS
- Automatic encryption for sensitive values
- Audit trail with user tracking
- Performance optimized queries

### **Configuration Management**
- Intelligent caching with TTL
- Fallback mechanisms
- Integration testing capabilities

---

This admin system provides enterprise-grade configuration management while maintaining security and operational excellence. All changes are audited, validated, and can be monitored in real-time.