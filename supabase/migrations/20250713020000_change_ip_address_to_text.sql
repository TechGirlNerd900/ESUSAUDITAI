CREATE OR REPLACE FUNCTION public.safe_cast_to_inet(p_ip_text TEXT)
RETURNS INET AS $$
BEGIN
    -- Attempt to cast the text to an inet address.
    RETURN p_ip_text::inet;
EXCEPTION
    -- If any error occurs (e.g., invalid format), catch it and return NULL.
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;