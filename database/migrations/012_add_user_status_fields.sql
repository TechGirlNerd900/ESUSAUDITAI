-- Add missing status and activity fields to users table

-- Add status column
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' 
    CHECK (status IN ('active', 'inactive', 'suspended', 'pending'));

-- Add is_active column
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Add last_activity_at column  
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_last_activity ON users(last_activity_at);

-- Update existing users to have active status
UPDATE users SET 
    status = 'active',
    is_active = true,
    last_activity_at = CURRENT_TIMESTAMP
WHERE status IS NULL OR is_active IS NULL;