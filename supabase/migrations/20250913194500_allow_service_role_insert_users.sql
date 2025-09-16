-- Migration: add broad insert policy for service role on public.users
BEGIN;

-- Ensure RLS is enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Broad INSERT policy allowing JWTs with role='service_role' to insert
CREATE POLICY "Service role insert on users"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

COMMIT;