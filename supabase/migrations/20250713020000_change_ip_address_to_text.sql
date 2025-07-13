ALTER TABLE users ALTER COLUMN ip_address TYPE TEXT;
ALTER TABLE user_sessions ALTER COLUMN ip_address TYPE TEXT;
ALTER TABLE audit_logs ALTER COLUMN ip_address TYPE TEXT;
ALTER TABLE security_events ALTER COLUMN ip_address TYPE TEXT;
ALTER TABLE login_attempts ALTER COLUMN ip_address TYPE TEXT;

-- Add a check constraint to ensure the text is a valid IP address (optional but recommended)
CREATE OR REPLACE FUNCTION is_valid_ip(ip_text TEXT) RETURNS BOOLEAN AS $$
BEGIN
  IF ip_text IS NULL THEN
    RETURN TRUE; -- Allow null values
  END IF;
  PERFORM ip_text::inet;
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

ALTER TABLE users ADD CONSTRAINT check_ip_address CHECK (is_valid_ip(ip_address));
ALTER TABLE user_sessions ADD CONSTRAINT check_ip_address CHECK (is_valid_ip(ip_address));
ALTER TABLE audit_logs ADD CONSTRAINT check_ip_address CHECK (is_valid_ip(ip_address));
ALTER TABLE security_events ADD CONSTRAINT check_ip_address CHECK (is_valid_ip(ip_address));
ALTER TABLE login_attempts ADD CONSTRAINT check_ip_address CHECK (is_valid_ip(ip_address));
