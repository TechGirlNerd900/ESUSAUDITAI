-- Function to get all RLS policies
BEGIN;

CREATE OR REPLACE FUNCTION get_policies()
RETURNS TABLE (
    schemaname text,
    tablename text,
    policyname text,
    roles name[],
    cmd text,
    qual text,
    with_check text
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.schemaname::text,
        p.tablename::text,
        p.policyname::text,
        p.roles,
        p.cmd::text,
        p.qual::text,
        p.with_check::text
    FROM pg_policies p
    WHERE p.schemaname = 'public';
END;
$$;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION get_policies() TO service_role;

COMMIT;