-- Migration: Storage Security Policies
-- Date: 2024-07-08
-- Purpose: Implement comprehensive storage security policies for file uploads

-- Enable RLS on storage.objects table
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create policy for file uploads (authenticated users can upload to their organization path)
CREATE POLICY "Users can upload files to their organization folder"
ON storage.objects FOR INSERT
WITH CHECK (
  -- Check if user is authenticated
  auth.role() = 'authenticated' AND
  -- Check if the file path starts with user's organization ID
  CASE 
    WHEN bucket_id = 'documents' THEN
      -- Extract organization from path structure: userId/projectId/filename
      -- First get the user ID from path
      (SELECT 
        CASE 
          WHEN users.organization_id::text = split_part(name, '/', 1) 
          THEN true 
          ELSE false 
        END
      FROM users 
      WHERE users.auth_user_id = auth.uid()
      LIMIT 1)
    ELSE false
  END
);

-- Create policy for file downloads (authenticated users can download from their organization)
CREATE POLICY "Users can download files from their organization"
ON storage.objects FOR SELECT
USING (
  auth.role() = 'authenticated' AND
  CASE 
    WHEN bucket_id = 'documents' THEN
      -- Check if user has access to this document through their organization
      EXISTS (
        SELECT 1 FROM documents d
        JOIN users u ON u.auth_user_id = auth.uid()
        WHERE d.file_path = name 
        AND d.organization_id = u.organization_id
        AND d.deleted_at IS NULL
      )
    ELSE false
  END
);

-- Create policy for file updates (only document owner or admin can update)
CREATE POLICY "Users can update their own files"
ON storage.objects FOR UPDATE
USING (
  auth.role() = 'authenticated' AND
  CASE 
    WHEN bucket_id = 'documents' THEN
      EXISTS (
        SELECT 1 FROM documents d
        JOIN users u ON u.auth_user_id = auth.uid()
        WHERE d.file_path = name 
        AND (d.uploaded_by = auth.uid() OR u.role = 'admin')
        AND d.organization_id = u.organization_id
        AND d.deleted_at IS NULL
      )
    ELSE false
  END
);

-- Create policy for file deletion (only document owner or admin can delete)
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
USING (
  auth.role() = 'authenticated' AND
  CASE 
    WHEN bucket_id = 'documents' THEN
      EXISTS (
        SELECT 1 FROM documents d
        JOIN users u ON u.auth_user_id = auth.uid()
        WHERE d.file_path = name 
        AND (d.uploaded_by = auth.uid() OR u.role = 'admin')
        AND d.organization_id = u.organization_id
        AND d.deleted_at IS NULL
      )
    ELSE false
  END
);

-- Create data access logs table for compliance tracking
CREATE TABLE IF NOT EXISTS data_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,
  access_method VARCHAR(20) NOT NULL,
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT fk_data_access_user 
    FOREIGN KEY (user_id) REFERENCES users(id),
  
  CONSTRAINT data_access_action_check 
    CHECK (action IN ('view', 'download', 'upload', 'delete', 'modify')),
  
  CONSTRAINT data_access_method_check 
    CHECK (access_method IN ('api', 'web', 'mobile', 'cli'))
);

-- Enable RLS on data access logs
ALTER TABLE data_access_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for data access logs
CREATE POLICY "Users can view data access logs from their organization"
ON data_access_logs FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM users 
    WHERE auth_user_id = auth.uid() 
    AND deleted_at IS NULL
  )
);

-- Create RLS policy for inserting data access logs
CREATE POLICY "Authenticated users can insert data access logs"
ON data_access_logs FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated' AND
  organization_id IN (
    SELECT organization_id FROM users 
    WHERE auth_user_id = auth.uid() 
    AND deleted_at IS NULL
  )
);

-- Create security events table for monitoring
CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID REFERENCES users(id),
  event_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'medium',
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT security_event_severity_check 
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  
  CONSTRAINT security_event_type_check 
    CHECK (event_type IN (
      'unauthorized_access_attempt',
      'file_access_denied',
      'file_download_error',
      'cross_tenant_access_attempt',
      'suspicious_file_upload',
      'malicious_content_detected',
      'rate_limit_exceeded',
      'authentication_failure',
      'permission_escalation_attempt'
    ))
);

-- Enable RLS on security events
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for security events
CREATE POLICY "Users can view security events from their organization"
ON security_events FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM users 
    WHERE auth_user_id = auth.uid() 
    AND deleted_at IS NULL
  )
);

-- Create RLS policy for inserting security events
CREATE POLICY "Authenticated users can insert security events"
ON security_events FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated' AND
  organization_id IN (
    SELECT organization_id FROM users 
    WHERE auth_user_id = auth.uid() 
    AND deleted_at IS NULL
  )
);

-- Create file quarantine table for suspicious files
CREATE TABLE IF NOT EXISTS file_quarantine (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  file_path VARCHAR(500) NOT NULL,
  quarantine_reason TEXT NOT NULL,
  threat_type VARCHAR(100),
  quarantined_by UUID NOT NULL REFERENCES users(id),
  quarantined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) NOT NULL DEFAULT 'quarantined',
  resolution_notes TEXT,
  
  CONSTRAINT quarantine_status_check 
    CHECK (status IN ('quarantined', 'safe', 'malicious', 'deleted'))
);

-- Enable RLS on file quarantine
ALTER TABLE file_quarantine ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for file quarantine
CREATE POLICY "Users can view quarantined files from their organization"
ON file_quarantine FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM users 
    WHERE auth_user_id = auth.uid() 
    AND deleted_at IS NULL
  )
);

-- Create RLS policy for inserting quarantine records
CREATE POLICY "Authenticated users can quarantine files"
ON file_quarantine FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated' AND
  organization_id IN (
    SELECT organization_id FROM users 
    WHERE auth_user_id = auth.uid() 
    AND deleted_at IS NULL
  )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_data_access_logs_user_id ON data_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_data_access_logs_organization_id ON data_access_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_data_access_logs_resource_type ON data_access_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_data_access_logs_timestamp ON data_access_logs(timestamp);

CREATE INDEX IF NOT EXISTS idx_security_events_organization_id ON security_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON security_events(timestamp);

CREATE INDEX IF NOT EXISTS idx_file_quarantine_organization_id ON file_quarantine(organization_id);
CREATE INDEX IF NOT EXISTS idx_file_quarantine_status ON file_quarantine(status);
CREATE INDEX IF NOT EXISTS idx_file_quarantine_quarantined_at ON file_quarantine(quarantined_at);

-- Create function to auto-quarantine suspicious files
CREATE OR REPLACE FUNCTION auto_quarantine_suspicious_file(
  p_document_id UUID,
  p_organization_id UUID,
  p_file_path VARCHAR(500),
  p_threat_type VARCHAR(100),
  p_reason TEXT,
  p_quarantined_by UUID
)
RETURNS UUID AS $$
DECLARE
  v_quarantine_id UUID;
BEGIN
  -- Insert quarantine record
  INSERT INTO file_quarantine (
    document_id,
    organization_id,
    file_path,
    quarantine_reason,
    threat_type,
    quarantined_by,
    status
  )
  VALUES (
    p_document_id,
    p_organization_id,
    p_file_path,
    p_reason,
    p_threat_type,
    p_quarantined_by,
    'quarantined'
  )
  RETURNING id INTO v_quarantine_id;

  -- Update document status
  UPDATE documents 
  SET 
    status = 'quarantined',
    processing_status = 'quarantined',
    updated_at = NOW()
  WHERE id = p_document_id;

  -- Log security event
  INSERT INTO security_events (
    organization_id,
    user_id,
    event_type,
    severity,
    details
  )
  VALUES (
    p_organization_id,
    p_quarantined_by,
    'malicious_content_detected',
    'high',
    json_build_object(
      'document_id', p_document_id,
      'file_path', p_file_path,
      'threat_type', p_threat_type,
      'quarantine_id', v_quarantine_id,
      'reason', p_reason
    )
  );

  RETURN v_quarantine_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT, INSERT ON data_access_logs TO authenticated;
GRANT SELECT, INSERT ON security_events TO authenticated;
GRANT SELECT, INSERT ON file_quarantine TO authenticated;
GRANT EXECUTE ON FUNCTION auto_quarantine_suspicious_file(UUID, UUID, VARCHAR, VARCHAR, TEXT, UUID) TO authenticated;

-- Add comments
COMMENT ON TABLE data_access_logs IS 'Tracks all data access events for compliance and security monitoring';
COMMENT ON TABLE security_events IS 'Logs security-related events and potential threats';
COMMENT ON TABLE file_quarantine IS 'Manages quarantined files that have been flagged as suspicious';
COMMENT ON FUNCTION auto_quarantine_suspicious_file(UUID, UUID, VARCHAR, VARCHAR, TEXT, UUID) IS 'Automatically quarantine files detected as suspicious';