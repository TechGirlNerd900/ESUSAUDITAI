
-- Migration to update the RLS policy for the projects table

-- First, drop the existing policy
DROP POLICY projects_isolation_policy ON projects;

-- Then, create the new policy using the user_can_access_project function
CREATE POLICY projects_isolation_policy ON projects
    FOR ALL USING (
        user_can_access_project(auth.uid(), id)
    );
