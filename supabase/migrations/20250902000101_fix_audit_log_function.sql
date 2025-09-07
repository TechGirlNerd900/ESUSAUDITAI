-- Fix the log_action function to properly handle ip_address data type conversion
-- and organization_id lookup issues during user creation
CREATE OR REPLACE FUNCTION public.log_action(
    p_user_id UUID,
    p_action TEXT,
    p_resource_type TEXT,
    p_resource_id TEXT,
    p_details JSONB DEFAULT '{}'::jsonb,
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_organization_id UUID;
    v_log_id UUID;
    v_ip_address INET;
BEGIN
    -- Get user's organization ID with fallback logic
    SELECT organization_id INTO v_organization_id
    FROM public.users
    WHERE id = p_user_id;
    
    -- If organization_id is null (user doesn't exist yet), try to extract from details
    IF v_organization_id IS NULL AND p_details ? 'new' THEN
        v_organization_id := (p_details->'new'->>'organization_id')::UUID;
    END IF;
    
    -- Handle IP address conversion from TEXT to INET
    BEGIN
        IF p_ip_address IS NULL OR p_ip_address = '' OR p_ip_address = 'unknown' THEN
            v_ip_address := NULL;
        ELSE
            v_ip_address := p_ip_address::inet;
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            v_ip_address := NULL; -- If conversion fails, set to NULL
    END;
    
    -- Skip audit log if we still can't determine organization_id
    IF v_organization_id IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Insert audit log with proper type conversion
    INSERT INTO public.audit_logs (
        user_id,
        action,
        resource_type,
        resource_id,
        details,
        ip_address,
        user_agent,
        organization_id
    ) VALUES (
        p_user_id,
        p_action,
        p_resource_type,
        p_resource_id,
        p_details,
        v_ip_address,
        p_user_agent,
        v_organization_id
    ) RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;