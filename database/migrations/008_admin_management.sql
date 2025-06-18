-- Admin Management Tables for Environment Variables and API Integrations
-- This migration adds support for runtime configuration management

-- App Settings table for environment variables and configuration
CREATE TABLE IF NOT EXISTS app_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) NOT NULL,
    value TEXT,
    description TEXT,
    category VARCHAR(50) DEFAULT 'custom',
    type VARCHAR(50) DEFAULT 'environment', -- 'environment', 'config', 'feature_flag'
    sensitive BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    
    UNIQUE(key, type)
);

-- API Integrations table
CREATE TABLE IF NOT EXISTS api_integrations (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'azure_openai', 'azure_form_recognizer', 'azure_search', 'custom'
    endpoint TEXT NOT NULL,
    api_key TEXT NOT NULL,
    config JSONB DEFAULT '{}',
    enabled BOOLEAN DEFAULT true,
    last_test_at TIMESTAMP WITH TIME ZONE,
    last_test_result JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_app_settings_type_category ON app_settings(type, category);
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key);
CREATE INDEX IF NOT EXISTS idx_api_integrations_type ON api_integrations(type);
CREATE INDEX IF NOT EXISTS idx_api_integrations_enabled ON api_integrations(enabled);

-- Row Level Security policies for app_settings
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Admin users can manage all settings
CREATE POLICY "Admin users can manage app settings" ON app_settings
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_user_id = auth.uid() 
            AND users.role IN ('admin', 'super_admin')
        )
    );

-- Regular users can only read non-sensitive settings
CREATE POLICY "Users can read non-sensitive settings" ON app_settings
    FOR SELECT
    USING (
        NOT sensitive AND 
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_user_id = auth.uid()
        )
    );

-- Row Level Security policies for api_integrations
ALTER TABLE api_integrations ENABLE ROW LEVEL SECURITY;

-- Admin users can manage all integrations
CREATE POLICY "Admin users can manage API integrations" ON api_integrations
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_user_id = auth.uid() 
            AND users.role IN ('admin', 'super_admin')
        )
    );

-- Regular users can only read enabled integrations (without API keys)
CREATE POLICY "Users can read enabled integrations" ON api_integrations
    FOR SELECT
    USING (
        enabled AND 
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_user_id = auth.uid()
        )
    );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_app_settings_updated_at 
    BEFORE UPDATE ON app_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_integrations_updated_at 
    BEFORE UPDATE ON api_integrations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default environment variable categories
INSERT INTO app_settings (key, value, description, category, type, sensitive, created_by)
VALUES 
    ('NODE_ENV', 'production', 'Node.js environment mode', 'system', 'environment', false, 
     (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1)),
    ('LOG_LEVEL', 'info', 'Application log level', 'system', 'environment', false,
     (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1)),
    ('RATE_LIMIT_MAX_REQUESTS', '100', 'Maximum requests per window', 'security', 'environment', false,
     (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1)),
    ('AUTH_RATE_LIMIT_MAX_REQUESTS', '5', 'Maximum auth requests per window', 'security', 'environment', false,
     (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1))
ON CONFLICT (key, type) DO NOTHING;

-- Add admin role to first user if no admin exists
UPDATE users 
SET role = 'admin' 
WHERE id = (SELECT id FROM users ORDER BY created_at LIMIT 1)
AND NOT EXISTS (SELECT 1 FROM users WHERE role IN ('admin', 'super_admin'));

-- Create admin audit log table
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL, -- 'create', 'update', 'delete', 'test'
    resource_type VARCHAR(50) NOT NULL, -- 'environment_variable', 'api_integration'
    resource_id VARCHAR(100),
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for audit log
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_user_action ON admin_audit_log(user_id, action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_resource ON admin_audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log(created_at);

-- RLS for audit log
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit logs
CREATE POLICY "Admin users can read audit logs" ON admin_audit_log
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_user_id = auth.uid() 
            AND users.role IN ('admin', 'super_admin')
        )
    );

-- Function to log admin actions
CREATE OR REPLACE FUNCTION log_admin_action(
    p_user_id UUID,
    p_action VARCHAR(100),
    p_resource_type VARCHAR(50),
    p_resource_id VARCHAR(100),
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO admin_audit_log (
        user_id, action, resource_type, resource_id, 
        old_values, new_values, ip_address, user_agent
    ) VALUES (
        p_user_id, p_action, p_resource_type, p_resource_id,
        p_old_values, p_new_values, p_ip_address, p_user_agent
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON app_settings TO authenticated;
GRANT ALL ON api_integrations TO authenticated;
GRANT SELECT ON admin_audit_log TO authenticated;
GRANT EXECUTE ON FUNCTION log_admin_action TO authenticated;

COMMENT ON TABLE app_settings IS 'Runtime configuration and environment variables management';
COMMENT ON TABLE api_integrations IS 'External API integrations configuration';
COMMENT ON TABLE admin_audit_log IS 'Audit trail for administrative actions';
COMMENT ON FUNCTION log_admin_action IS 'Logs administrative actions for audit purposes';