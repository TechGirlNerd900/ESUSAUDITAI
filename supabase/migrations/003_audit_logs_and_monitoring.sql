-- Audit Logs and Security Monitoring Schema

-- Audit logs table - captures all sensitive operations for security monitoring
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- NULL for system actions
    session_id UUID REFERENCES user_sessions(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL, -- Action performed (login, create_user, delete_document, etc.)
    resource_type VARCHAR(50) NOT NULL, -- Type of resource affected (user, document, project, etc.)
    resource_id UUID, -- ID of affected resource
    old_values JSONB, -- Previous values (for updates/deletes)
    new_values JSONB, -- New values (for creates/updates)
    details JSONB DEFAULT '{}', -- Additional contextual information
    ip_address INET, -- IP address of the user
    user_agent TEXT, -- User agent string
    referer TEXT, -- HTTP referer
    request_id VARCHAR(255), -- Request ID for correlation
    severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical')),
    status VARCHAR(20) DEFAULT 'success' CHECK (status IN ('success', 'failure', 'pending')),
    error_message TEXT, -- Error details for failed operations
    duration_ms INTEGER, -- Operation duration in milliseconds
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    partition_date DATE -- Regular column, will be set by trigger
);

-- Data access logs table - track access to sensitive data
CREATE TABLE data_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resource_type VARCHAR(50) NOT NULL, -- document, project, user_profile, etc.
    resource_id UUID NOT NULL,
    access_type VARCHAR(20) NOT NULL CHECK (access_type IN ('read', 'write', 'delete', 'download', 'export')),
    data_classification VARCHAR(20) DEFAULT 'internal' CHECK (data_classification IN ('public', 'internal', 'confidential', 'restricted')),
    ip_address INET,
    user_agent TEXT,
    request_path TEXT,
    query_parameters JSONB,
    response_status INTEGER,
    bytes_transferred BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    partition_date DATE -- Regular column, will be set by trigger
);

-- Security events table - specific table for security-related events
CREATE TABLE security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL, -- login_attempt, failed_login, suspicious_activity, etc.
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    location JSONB, -- Geographic location if available
    threat_indicators JSONB DEFAULT '{}', -- Threat intelligence indicators
    mitigated BOOLEAN DEFAULT FALSE,
    mitigation_details TEXT,
    mitigated_by UUID REFERENCES users(id),
    mitigated_at TIMESTAMP WITH TIME ZONE,
    alert_sent BOOLEAN DEFAULT FALSE,
    alert_sent_at TIMESTAMP WITH TIME ZONE,
    false_positive BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Login attempts table - detailed tracking of authentication attempts
CREATE TABLE login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    email VARCHAR(320) NOT NULL,
    ip_address INET NOT NULL,
    user_agent TEXT,
    success BOOLEAN NOT NULL,
    failure_reason VARCHAR(100), -- invalid_password, account_locked, etc.
    session_id UUID REFERENCES user_sessions(id) ON DELETE SET NULL,
    mfa_used BOOLEAN DEFAULT FALSE,
    mfa_method VARCHAR(20), -- totp, sms, email, etc.
    country_code CHAR(2), -- ISO country code
    city VARCHAR(100),
    device_fingerprint VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System health logs table - monitor system performance and errors
CREATE TABLE system_health_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name VARCHAR(50) NOT NULL, -- api, database, storage, etc.
    metric_name VARCHAR(100) NOT NULL, -- response_time, error_rate, cpu_usage, etc.
    metric_value NUMERIC,
    metric_unit VARCHAR(20), -- ms, percent, count, etc.
    labels JSONB DEFAULT '{}', -- Additional labels for metrics
    severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical')),
    message TEXT,
    stack_trace TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create trigger functions for partition_date
CREATE OR REPLACE FUNCTION set_audit_logs_partition_date()
RETURNS TRIGGER AS $$
BEGIN
    NEW.partition_date := DATE(NEW.created_at);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_data_access_logs_partition_date()
RETURNS TRIGGER AS $$
BEGIN
    NEW.partition_date := DATE(NEW.created_at);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers (now that tables exist)
CREATE TRIGGER set_audit_logs_partition_date_trigger
BEFORE INSERT ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION set_audit_logs_partition_date();

CREATE TRIGGER set_data_access_logs_partition_date_trigger
BEFORE INSERT ON data_access_logs
FOR EACH ROW
EXECUTE FUNCTION set_data_access_logs_partition_date();

-- Create indexes for audit_logs (optimized for common queries)
CREATE INDEX idx_audit_logs_organization_id ON audit_logs(organization_id, created_at DESC);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action, organization_id, created_at DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id, organization_id);
CREATE INDEX idx_audit_logs_severity ON audit_logs(severity, organization_id, created_at DESC);
CREATE INDEX idx_audit_logs_ip_address ON audit_logs(ip_address, created_at DESC);
CREATE INDEX idx_audit_logs_partition_date ON audit_logs(partition_date);
CREATE INDEX idx_audit_logs_request_id ON audit_logs(request_id) WHERE request_id IS NOT NULL;

-- Create indexes for security_events
CREATE INDEX idx_security_events_organization_id ON security_events(organization_id, created_at DESC);
CREATE INDEX idx_security_events_user_id ON security_events(user_id, created_at DESC);
CREATE INDEX idx_security_events_type ON security_events(event_type, severity, created_at DESC);
CREATE INDEX idx_security_events_severity ON security_events(severity, created_at DESC);
CREATE INDEX idx_security_events_ip_address ON security_events(ip_address, created_at DESC);
CREATE INDEX idx_security_events_unmitigated ON security_events(mitigated, severity, created_at DESC) 
    WHERE mitigated = FALSE;

-- Create indexes for login_attempts
CREATE INDEX idx_login_attempts_organization_id ON login_attempts(organization_id, created_at DESC);
CREATE INDEX idx_login_attempts_user_id ON login_attempts(user_id, created_at DESC);
CREATE INDEX idx_login_attempts_email ON login_attempts(email, created_at DESC);
CREATE INDEX idx_login_attempts_ip_address ON login_attempts(ip_address, created_at DESC);
CREATE INDEX idx_login_attempts_success ON login_attempts(success, created_at DESC);
CREATE INDEX idx_login_attempts_failures ON login_attempts(success, email, ip_address, created_at DESC) 
    WHERE success = FALSE;

-- Create indexes for data_access_logs
CREATE INDEX idx_data_access_logs_organization_id ON data_access_logs(organization_id, created_at DESC);
CREATE INDEX idx_data_access_logs_user_id ON data_access_logs(user_id, created_at DESC);
CREATE INDEX idx_data_access_logs_resource ON data_access_logs(resource_type, resource_id, created_at DESC);
CREATE INDEX idx_data_access_logs_access_type ON data_access_logs(access_type, organization_id, created_at DESC);
CREATE INDEX idx_data_access_logs_classification ON data_access_logs(data_classification, created_at DESC);
CREATE INDEX idx_data_access_logs_partition_date ON data_access_logs(partition_date);

-- Create indexes for system_health_logs
CREATE INDEX idx_system_health_logs_service ON system_health_logs(service_name, metric_name, created_at DESC);
CREATE INDEX idx_system_health_logs_severity ON system_health_logs(severity, created_at DESC);
CREATE INDEX idx_system_health_logs_created_at ON system_health_logs(created_at DESC);

-- Add RLS policies for multi-tenant isolation
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_access_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for audit_logs (users can only see logs from their organization)
CREATE POLICY audit_logs_isolation_policy ON audit_logs
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE auth_user_id = auth.uid() 
            AND deleted_at IS NULL
        )
    );

-- RLS policies for security_events
CREATE POLICY security_events_isolation_policy ON security_events
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE auth_user_id = auth.uid() 
            AND deleted_at IS NULL
        ) OR organization_id IS NULL
    );

-- RLS policies for login_attempts
CREATE POLICY login_attempts_isolation_policy ON login_attempts
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE auth_user_id = auth.uid() 
            AND deleted_at IS NULL
        ) OR organization_id IS NULL
    );

-- RLS policies for data_access_logs
CREATE POLICY data_access_logs_isolation_policy ON data_access_logs
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE auth_user_id = auth.uid() 
            AND deleted_at IS NULL
        )
    );

-- Function to create audit log entries
CREATE OR REPLACE FUNCTION create_audit_log(
    p_organization_id UUID,
    p_user_id UUID,
    p_action VARCHAR,
    p_resource_type VARCHAR,
    p_resource_id UUID,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL,
    p_details JSONB DEFAULT '{}',
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO audit_logs (
        organization_id, user_id, action, resource_type, resource_id,
        old_values, new_values, details, ip_address, user_agent
    ) VALUES (
        p_organization_id, p_user_id, p_action, p_resource_type, p_resource_id,
        p_old_values, p_new_values, p_details, p_ip_address, p_user_agent
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create security event entries
CREATE OR REPLACE FUNCTION create_security_event(
    p_organization_id UUID,
    p_user_id UUID,
    p_event_type VARCHAR,
    p_severity VARCHAR,
    p_description TEXT,
    p_ip_address INET DEFAULT NULL,
    p_threat_indicators JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    event_id UUID;
BEGIN
    INSERT INTO security_events (
        organization_id, user_id, event_type, severity, description,
        ip_address, threat_indicators
    ) VALUES (
        p_organization_id, p_user_id, p_event_type, p_severity, p_description,
        p_ip_address, p_threat_indicators
    ) RETURNING id INTO event_id;
    
    RETURN event_id;
END;
$$ LANGUAGE plpgsql;

-- Function to detect anomalous login patterns
CREATE OR REPLACE FUNCTION detect_anomalous_logins()
RETURNS void AS $$
DECLARE
    rec RECORD;
BEGIN
    -- Detect multiple failed logins from same IP
    FOR rec IN 
        SELECT ip_address, COUNT(*) as failure_count
        FROM login_attempts 
        WHERE success = FALSE 
        AND created_at > NOW() - INTERVAL '1 hour'
        GROUP BY ip_address
        HAVING COUNT(*) >= 5
    LOOP
        INSERT INTO security_events (
            event_type, severity, description, ip_address
        ) VALUES (
            'multiple_failed_logins',
            'high',
            format('Multiple failed login attempts from IP %s (%s attempts in last hour)', 
                   rec.ip_address, rec.failure_count),
            rec.ip_address
        );
    END LOOP;
    
    -- Detect logins from new locations
    FOR rec IN
        SELECT DISTINCT user_id, country_code, city, ip_address
        FROM login_attempts la1
        WHERE success = TRUE
        AND created_at > NOW() - INTERVAL '24 hours'
        AND NOT EXISTS (
            SELECT 1 FROM login_attempts la2
            WHERE la2.user_id = la1.user_id
            AND la2.country_code = la1.country_code
            AND la2.success = TRUE
            AND la2.created_at BETWEEN NOW() - INTERVAL '30 days' AND NOW() - INTERVAL '24 hours'
        )
    LOOP
        INSERT INTO security_events (
            user_id, event_type, severity, description, ip_address
        ) VALUES (
            rec.user_id,
            'login_from_new_location',
            'medium',
            format('Login from new location: %s, %s', rec.city, rec.country_code),
            rec.ip_address
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old logs (for compliance and storage management)
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS void AS $$
BEGIN
    -- Delete audit logs older than 7 years (adjust based on compliance requirements)
    DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '7 years';
    
    -- Delete security events older than 5 years
    DELETE FROM security_events WHERE created_at < NOW() - INTERVAL '5 years';
    
    -- Delete login attempts older than 2 years
    DELETE FROM login_attempts WHERE created_at < NOW() - INTERVAL '2 years';
    
    -- Delete data access logs older than 3 years
    DELETE FROM data_access_logs WHERE created_at < NOW() - INTERVAL '3 years';
    
    -- Delete system health logs older than 90 days
    DELETE FROM system_health_logs WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;