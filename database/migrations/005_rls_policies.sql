-- Enable Row Level Security for all tables
BEGIN;

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Projects table policies
CREATE POLICY "Users can view assigned projects"
    ON projects FOR SELECT
    USING (auth.uid() = created_by OR 
           auth.uid() = ANY(assigned_to) OR
           EXISTS (
               SELECT 1 FROM user_profiles
               WHERE user_id = auth.uid() 
               AND role = 'admin'
           ));

CREATE POLICY "Users can create projects"
    ON projects FOR INSERT
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Project owners and admins can update"
    ON projects FOR UPDATE
    USING (auth.uid() = created_by OR
           EXISTS (
               SELECT 1 FROM user_profiles
               WHERE user_id = auth.uid() 
               AND role = 'admin'
           ));

-- Documents table policies
CREATE POLICY "Users can view project documents"
    ON documents FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = documents.project_id
        AND (projects.created_by = auth.uid() OR
             auth.uid() = ANY(projects.assigned_to))
    ));

CREATE POLICY "Users can upload to assigned projects"
    ON documents FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = project_id
        AND (projects.created_by = auth.uid() OR
             auth.uid() = ANY(projects.assigned_to))
    ));

-- Analysis results policies
CREATE POLICY "Users can view analysis results"
    ON analysis_results FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM documents
        JOIN projects ON documents.project_id = projects.id
        WHERE documents.id = analysis_results.document_id
        AND (projects.created_by = auth.uid() OR
             auth.uid() = ANY(projects.assigned_to))
    ));

-- User profiles policies
CREATE POLICY "Users can view profiles"
    ON user_profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can update own profile"
    ON user_profiles FOR UPDATE
    USING (auth.uid() = user_id);

-- Enable real-time subscriptions for specific tables
ALTER PUBLICATION supabase_realtime ADD TABLE projects;
ALTER PUBLICATION supabase_realtime ADD TABLE documents;
ALTER PUBLICATION supabase_realtime ADD TABLE analysis_results;

-- Add real-time security
ALTER TABLE projects REPLICA IDENTITY FULL;
ALTER TABLE documents REPLICA IDENTITY FULL;
ALTER TABLE analysis_results REPLICA IDENTITY FULL;

COMMIT;