-- Add password_hash column to the users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text;

-- Add auth_user_id column to link to Supabase auth.users
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Make auth_user_id unique since each auth user should have one profile
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id);

-- Add is_active column that might be referenced elsewhere
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Make password_hash nullable since we're using Supabase auth
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Update the existing check constraint for email to be case-insensitive
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_check;
ALTER TABLE users ADD CONSTRAINT users_email_check 
    CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Create index for is_active if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);