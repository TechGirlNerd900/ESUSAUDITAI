-- Create function to get public tables
CREATE OR REPLACE FUNCTION get_public_tables()
RETURNS text[] 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN ARRAY(
        SELECT table_name::text
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
    );
END;
$$;

-- Create function to check uuid-ossp extension
CREATE OR REPLACE FUNCTION check_uuid_extension()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM pg_extension
        WHERE extname = 'uuid-ossp'
    );
END;
$$;