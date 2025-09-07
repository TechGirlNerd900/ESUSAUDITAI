DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'ip_address') THEN
        ALTER TABLE users ADD COLUMN ip_address INET;
    END IF;
END
$$;