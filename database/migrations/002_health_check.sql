-- Create health check table for monitoring
CREATE TABLE IF NOT EXISTS health_check (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    count INTEGER NOT NULL DEFAULT 1
);

-- Insert initial record
INSERT INTO health_check (count) VALUES (1)
ON CONFLICT DO NOTHING;

-- Create function to update health check timestamp
CREATE OR REPLACE FUNCTION update_health_check_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.created_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to update timestamp on health check updates
DROP TRIGGER IF EXISTS update_health_check_timestamp ON health_check;
CREATE TRIGGER update_health_check_timestamp
    BEFORE UPDATE ON health_check
    FOR EACH ROW EXECUTE FUNCTION update_health_check_timestamp();

-- Create RLS policy for health check table
ALTER TABLE health_check ENABLE ROW LEVEL SECURITY;

CREATE POLICY health_check_read_policy ON health_check
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Create function to update health check
CREATE OR REPLACE FUNCTION ping_health_check()
RETURNS void AS $$
BEGIN
    UPDATE health_check
    SET count = count + 1
    WHERE id = (SELECT id FROM health_check LIMIT 1);
END;
$$ language 'plpgsql';