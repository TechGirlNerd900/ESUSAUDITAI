
-- Drop existing RLS policies on the users table to avoid conflicts
DROP POLICY IF EXISTS "Users: Can view own user info" ON public.users;
DROP POLICY IF EXISTS "Users: Can view other users in the same organization" ON public.users;
DROP POLICY IF EXISTS "Users: Users can view users in their organization" ON public.users;

-- Create a new, non-recursive RLS policy for selecting from the users table
CREATE POLICY "Users: Can view own info or users in same organization"
ON public.users
FOR SELECT
TO authenticated
USING (
  -- The user's ID must match the authenticated user's ID
  id = auth.uid() OR
  -- The user's organization ID must match the organization ID of the authenticated user
  (
    organization_id = (
      SELECT u.organization_id
      FROM users u
      WHERE u.id = auth.uid()
    )
  )
);
