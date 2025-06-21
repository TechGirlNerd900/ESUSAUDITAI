# Fixing Admin Access Issues

This document provides instructions for fixing admin authentication issues in the application.

## Understanding the Problem

There are several potential issues that can prevent admin users from signing in:

1. **Schema Mismatch**: The application expects users to have records in both the `auth.users` table (Supabase authentication) and the `public.users` table (application profiles).

2. **Role Assignment**: Admin role may be set in auth metadata but not in the user profile, or vice versa.

3. **Missing Organization**: Admin users need to be associated with an organization.

4. **Account Status**: User accounts might be marked as inactive or deleted.

## Automated Fixes

We've provided several scripts to help diagnose and fix these issues:

### 1. Fix Database Schema

This script adds missing tables and columns needed for proper authentication:

```bash
npm run db:fix-auth
```

This will:
- Create the organizations table if missing
- Create the invitations table if missing
- Add auth_user_id column to users table
- Add organization_id to relevant tables
- Set up proper RLS policies
- Create a trigger to link auth users to profiles

### 2. Fix Admin Access

This script checks for and fixes issues with admin users:

```bash
npm run fix:admin-access
```

This will:
- Check for auth users without profiles and create them
- Ensure admin roles are consistent
- Create a default organization if needed
- Activate disabled admin accounts

### 3. Fix Admin User Tool

For more specific user issues, use the interactive admin user tool:

```bash
npm run fix:admin-user
```

This tool provides options to:
- Create a new admin user
- Fix permissions for an existing user
- Reset an admin's password

## Manual Diagnostics

### Check Authentication Status

Visit the authentication debug endpoint to see detailed diagnostic information:

```
/api/auth/debug
```

This will show:
- Authentication status
- Supabase auth user details
- User profile details
- Any mismatches between auth and profile

### Direct Database Checks

You can also query the database directly to check for issues:

1. Check auth users:
```sql
SELECT id, email, raw_user_meta_data->>'role' as role
FROM auth.users;
```

2. Check application users:
```sql
SELECT id, email, auth_user_id, role, is_active, status, deleted_at
FROM users;
```

3. Find auth users without profiles:
```sql
SELECT au.id, au.email 
FROM auth.users au
LEFT JOIN users u ON au.id = u.auth_user_id
WHERE u.id IS NULL;
```

4. Find profiles without auth users:
```sql
SELECT u.id, u.email 
FROM users u
LEFT JOIN auth.users au ON u.auth_user_id = au.id
WHERE au.id IS NULL;
```

## Common Solutions

### User Can Sign In But Has No Admin Access

```sql
-- Update user role in profile
UPDATE users
SET role = 'admin'
WHERE email = 'admin@example.com';

-- Update user role in auth metadata
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  raw_user_meta_data, 
  '{role}', 
  '"admin"'
)
WHERE email = 'admin@example.com';
```

### User Cannot Sign In At All

Check that the user exists in auth:

```sql
SELECT * FROM auth.users WHERE email = 'admin@example.com';
```

If not found, you'll need to create a new user. Use the admin user tool:

```bash
npm run fix:admin-user
```

### Missing Profile Record

If the user exists in auth but not in the profiles table:

```sql
INSERT INTO users (
  auth_user_id,
  email,
  first_name,
  last_name,
  role,
  organization_id,
  is_active,
  status
) VALUES (
  'auth-user-id-here',
  'admin@example.com',
  'Admin',
  'User',
  'admin',
  'organization-id-here',
  true,
  'active'
);
```

## Preventing Future Issues

To prevent these issues in the future:

1. **Use the API**: Always create users through the application API which handles both auth and profile creation

2. **Database Triggers**: The fix_auth_issues.sql script adds triggers to maintain consistency

3. **Regular Audits**: Periodically run the admin access fix script to check for and fix issues

4. **Monitoring**: Add monitoring for failed admin logins