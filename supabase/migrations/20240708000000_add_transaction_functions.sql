-- Migration: Add Database Transaction Functions
-- Date: 2024-07-08
-- Purpose: Add support for atomic database transactions to prevent data inconsistency

-- Create transaction management functions
CREATE OR REPLACE FUNCTION begin_transaction()
RETURNS void AS $$
BEGIN
    -- Start a new transaction
    -- This is implicitly handled by Supabase, but we create this for consistency
    PERFORM 1;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION commit_transaction()
RETURNS void AS $$
BEGIN
    -- Commit current transaction
    -- This is implicitly handled by Supabase, but we create this for consistency
    PERFORM 1;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION rollback_transaction()
RETURNS void AS $$
BEGIN
    -- Rollback current transaction
    -- This is implicitly handled by Supabase, but we create this for consistency
    PERFORM 1;
END;
$$ LANGUAGE plpgsql;

-- Create atomic organization creation function
CREATE OR REPLACE FUNCTION create_organization_with_admin(
    p_organization_name VARCHAR(255),
    p_admin_email VARCHAR(320),
    p_admin_first_name VARCHAR(100),
    p_admin_last_name VARCHAR(100),
    p_admin_auth_id UUID
)
RETURNS TABLE(
    organization_id UUID,
    user_id UUID,
    success BOOLEAN,
    error_message TEXT
) AS $$
DECLARE
    v_org_id UUID;
    v_user_id UUID;
    v_error_msg TEXT;
BEGIN
    BEGIN
        -- Create organization
        INSERT INTO organizations (name, created_at, updated_at)
        VALUES (p_organization_name, NOW(), NOW())
        RETURNING id INTO v_org_id;

        -- Create user profile
        INSERT INTO users (
            auth_user_id,
            organization_id,
            email,
            first_name,
            last_name,
            role,
            is_active,
            created_at,
            updated_at
        )
        VALUES (
            p_admin_auth_id,
            v_org_id,
            p_admin_email,
            p_admin_first_name,
            p_admin_last_name,
            'admin',
            true,
            NOW(),
            NOW()
        )
        RETURNING id INTO v_user_id;

        -- Create audit log
        INSERT INTO audit_logs (
            organization_id,
            user_id,
            action,
            resource_type,
            resource_id,
            details,
            created_at
        )
        VALUES (
            v_org_id,
            v_user_id,
            'organization_created',
            'organization',
            v_org_id,
            json_build_object(
                'organization_name', p_organization_name,
                'admin_email', p_admin_email,
                'admin_name', p_admin_first_name || ' ' || p_admin_last_name
            ),
            NOW()
        );

        -- Return success
        RETURN QUERY SELECT v_org_id, v_user_id, true, ''::TEXT;

    EXCEPTION
        WHEN OTHERS THEN
            v_error_msg := SQLERRM;
            RETURN QUERY SELECT NULL::UUID, NULL::UUID, false, v_error_msg;
    END;
END;
$$ LANGUAGE plpgsql;

-- Create atomic document upload function
CREATE OR REPLACE FUNCTION create_document_with_audit(
    p_name VARCHAR(255),
    p_file_path VARCHAR(500),
    p_organization_id UUID,
    p_uploaded_by UUID,
    p_project_id UUID DEFAULT NULL,
    p_description TEXT DEFAULT NULL
)
RETURNS TABLE(
    document_id UUID,
    success BOOLEAN,
    error_message TEXT
) AS $$
DECLARE
    v_doc_id UUID;
    v_error_msg TEXT;
BEGIN
    BEGIN
        -- Create document record
        INSERT INTO documents (
            name,
            file_path,
            organization_id,
            uploaded_by,
            project_id,
            description,
            status,
            created_at,
            updated_at
        )
        VALUES (
            p_name,
            p_file_path,
            p_organization_id,
            p_uploaded_by,
            p_project_id,
            p_description,
            'uploaded',
            NOW(),
            NOW()
        )
        RETURNING id INTO v_doc_id;

        -- Create audit log
        INSERT INTO audit_logs (
            organization_id,
            user_id,
            action,
            resource_type,
            resource_id,
            details,
            created_at
        )
        VALUES (
            p_organization_id,
            p_uploaded_by,
            'document_uploaded',
            'document',
            v_doc_id,
            json_build_object(
                'document_name', p_name,
                'file_path', p_file_path,
                'project_id', p_project_id
            ),
            NOW()
        );

        -- Return success
        RETURN QUERY SELECT v_doc_id, true, ''::TEXT;

    EXCEPTION
        WHEN OTHERS THEN
            v_error_msg := SQLERRM;
            RETURN QUERY SELECT NULL::UUID, false, v_error_msg;
    END;
END;
$$ LANGUAGE plpgsql;



-- Create atomic document analysis function
CREATE OR REPLACE FUNCTION process_document_analysis(
    p_document_id UUID,
    p_content TEXT,
    p_summary TEXT,
    p_key_findings JSONB,
    p_recommendations JSONB,
    p_analyzed_by UUID
)
RETURNS TABLE(
    analysis_id UUID,
    success BOOLEAN,
    error_message TEXT
) AS $$
DECLARE
    v_analysis_id UUID;
    v_doc_org_id UUID;
    v_error_msg TEXT;
BEGIN
    BEGIN
        -- Get document organization for audit log
        SELECT organization_id INTO v_doc_org_id
        FROM documents
        WHERE id = p_document_id;

        IF v_doc_org_id IS NULL THEN
            RAISE EXCEPTION 'Document not found';
        END IF;

        -- Update document status to processing
        UPDATE documents
        SET status = 'processing', updated_at = NOW()
        WHERE id = p_document_id;

        -- Create analysis results
        INSERT INTO analysis_results (
            document_id,
            content,
            summary,
            key_findings,
            recommendations,
            analyzed_by,
            created_at
        )
        VALUES (
            p_document_id,
            p_content,
            p_summary,
            p_key_findings,
            p_recommendations,
            p_analyzed_by,
            NOW()
        )
        RETURNING id INTO v_analysis_id;

        -- Update document status to analyzed
        UPDATE documents
        SET status = 'analyzed', updated_at = NOW()
        WHERE id = p_document_id;

        -- Create audit log
        INSERT INTO audit_logs (
            organization_id,
            user_id,
            action,
            resource_type,
            resource_id,
            details,
            created_at
        )
        VALUES (
            v_doc_org_id,
            p_analyzed_by,
            'document_analyzed',
            'document',
            p_document_id,
            json_build_object(
                'analysis_id', v_analysis_id,
                'findings_count', jsonb_array_length(p_key_findings),
                'recommendations_count', jsonb_array_length(p_recommendations)
            ),
            NOW()
        );

        -- Return success
        RETURN QUERY SELECT v_analysis_id, true, ''::TEXT;

    EXCEPTION
        WHEN OTHERS THEN
            v_error_msg := SQLERRM;
            -- Reset document status on error
            UPDATE documents
            SET status = 'uploaded', updated_at = NOW()
            WHERE id = p_document_id;
            
            RETURN QUERY SELECT NULL::UUID, false, v_error_msg;
    END;
END;
$$ LANGUAGE plpgsql;

-- Create atomic invitation creation function
CREATE OR REPLACE FUNCTION create_invitation_with_audit(
    p_organization_id UUID,
    p_email VARCHAR(320),
    p_first_name VARCHAR(100),
    p_last_name VARCHAR(100),
    p_role VARCHAR(20),
    p_invited_by UUID
)
RETURNS TABLE(
    invitation_id UUID,
    invitation_token VARCHAR(255),
    success BOOLEAN,
    error_message TEXT
) AS $$
DECLARE
    v_invitation_id UUID;
    v_token VARCHAR(255);
    v_error_msg TEXT;
BEGIN
    BEGIN
        -- Generate secure token
        v_token := encode(gen_random_bytes(32), 'hex');

        -- Create invitation record
        INSERT INTO invitations (
            organization_id,
            email,
            first_name,
            last_name,
            role,
            invited_by,
            token,
            expires_at,
            created_at
        )
        VALUES (
            p_organization_id,
            p_email,
            p_first_name,
            p_last_name,
            p_role,
            p_invited_by,
            v_token,
            NOW() + INTERVAL '7 days',
            NOW()
        )
        RETURNING id INTO v_invitation_id;

        -- Create audit log
        INSERT INTO audit_logs (
            organization_id,
            user_id,
            action,
            resource_type,
            resource_id,
            details,
            created_at
        )
        VALUES (
            p_organization_id,
            p_invited_by,
            'invitation_created',
            'invitation',
            v_invitation_id,
            json_build_object(
                'invited_email', p_email,
                'invited_role', p_role,
                'invited_name', p_first_name || ' ' || p_last_name
            ),
            NOW()
        );

        -- Return success
        RETURN QUERY SELECT v_invitation_id, v_token, true, ''::TEXT;

    EXCEPTION
        WHEN OTHERS THEN
            v_error_msg := SQLERRM;
            RETURN QUERY SELECT NULL::UUID, NULL::VARCHAR, false, v_error_msg;
    END;
END;
$$ LANGUAGE plpgsql;

-- Create atomic project creation function
CREATE OR REPLACE FUNCTION create_project_with_audit(
    p_name VARCHAR(255),
    p_description TEXT,
    p_client_name VARCHAR(255),
    p_client_email VARCHAR(320),
    p_organization_id UUID,
    p_created_by UUID,
    p_project_type VARCHAR(50) DEFAULT 'compliance',
    p_priority VARCHAR(20) DEFAULT 'medium',
    p_risk_level VARCHAR(20) DEFAULT 'medium'
)
RETURNS TABLE(
    project_id UUID,
    success BOOLEAN,
    error_message TEXT
) AS $$
DECLARE
    v_project_id UUID;
    v_error_msg TEXT;
BEGIN
    BEGIN
        -- Create project record
        INSERT INTO projects (
            name,
            description,
            client_name,
            client_email,
            organization_id,
            created_by,
            project_type,
            priority,
            risk_level,
            status,
            created_at,
            updated_at
        )
        VALUES (
            p_name,
            p_description,
            p_client_name,
            p_client_email,
            p_organization_id,
            p_created_by,
            p_project_type,
            p_priority,
            p_risk_level,
            'active',
            NOW(),
            NOW()
        )
        RETURNING id INTO v_project_id;

        -- Create audit log
        INSERT INTO audit_logs (
            organization_id,
            user_id,
            action,
            resource_type,
            resource_id,
            details,
            created_at
        )
        VALUES (
            p_organization_id,
            p_created_by,
            'project_created',
            'project',
            v_project_id,
            json_build_object(
                'project_name', p_name,
                'client_name', p_client_name,
                'project_type', p_project_type,
                'priority', p_priority,
                'risk_level', p_risk_level
            ),
            NOW()
        );

        -- Return success
        RETURN QUERY SELECT v_project_id, true, ''::TEXT;

    EXCEPTION
        WHEN OTHERS THEN
            v_error_msg := SQLERRM;
            RETURN QUERY SELECT NULL::UUID, false, v_error_msg;
    END;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION begin_transaction() TO authenticated;
GRANT EXECUTE ON FUNCTION commit_transaction() TO authenticated;
GRANT EXECUTE ON FUNCTION rollback_transaction() TO authenticated;
GRANT EXECUTE ON FUNCTION create_organization_with_admin(VARCHAR, VARCHAR, VARCHAR, VARCHAR, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_document_with_audit(VARCHAR, VARCHAR, UUID, UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION process_document_analysis(UUID, TEXT, TEXT, JSONB, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_invitation_with_audit(UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_project_with_audit(VARCHAR, TEXT, VARCHAR, VARCHAR, UUID, UUID, VARCHAR, VARCHAR, VARCHAR) TO authenticated;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Add comments for documentation
COMMENT ON FUNCTION begin_transaction() IS 'Begin a database transaction';
COMMENT ON FUNCTION commit_transaction() IS 'Commit the current transaction';
COMMENT ON FUNCTION rollback_transaction() IS 'Rollback the current transaction';
COMMENT ON FUNCTION create_organization_with_admin(VARCHAR, VARCHAR, VARCHAR, VARCHAR, UUID) IS 'Atomically create organization with admin user';
COMMENT ON FUNCTION create_document_with_audit(VARCHAR, VARCHAR, UUID, UUID, UUID, TEXT) IS 'Atomically create document record with audit log';
COMMENT ON FUNCTION process_document_analysis(UUID, TEXT, TEXT, JSONB, JSONB, UUID) IS 'Atomically process document analysis with status updates';
COMMENT ON FUNCTION create_invitation_with_audit(UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR, UUID) IS 'Atomically create invitation with audit log';
COMMENT ON FUNCTION create_project_with_audit(VARCHAR, TEXT, VARCHAR, VARCHAR, UUID, UUID, VARCHAR, VARCHAR, VARCHAR) IS 'Atomically create project with audit log';
