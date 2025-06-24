-- Projects and Documents Schema
-- Implements business logic tables with proper multi-tenant isolation and RBAC

-- Projects table - main business entities for organizing audit work
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    project_type VARCHAR(50) DEFAULT 'audit' CHECK (project_type IN ('audit', 'compliance', 'risk_assessment', 'review')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'on_hold', 'completed', 'cancelled')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    
    -- Ownership and assignment
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_to UUID[] DEFAULT '{}', -- Array of user IDs assigned to project
    project_manager UUID REFERENCES users(id), -- Lead for the project
    
    -- Timeline
    start_date DATE,
    expected_completion_date DATE,
    actual_completion_date DATE,
    
    -- Business fields
    client_name VARCHAR(255),
    client_contact_info JSONB DEFAULT '{}',
    budget DECIMAL(15,2),
    currency VARCHAR(3) DEFAULT 'USD',
    billing_rate DECIMAL(10,2),
    
    -- Project settings
    settings JSONB DEFAULT '{}',
    custom_fields JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    
    -- Compliance and risk
    compliance_framework VARCHAR(100), -- SOX, GDPR, HIPAA, etc.
    risk_level VARCHAR(20) DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    
    -- Soft delete and audit
    is_template BOOLEAN DEFAULT FALSE, -- Project templates
    archived_at TIMESTAMP WITH TIME ZONE,
    archived_by UUID REFERENCES users(id),
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for projects
CREATE INDEX idx_projects_organization_id ON projects(organization_id, deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_created_by ON projects(created_by, organization_id);
CREATE INDEX idx_projects_status ON projects(status, organization_id);
CREATE INDEX idx_projects_priority ON projects(priority, organization_id);
CREATE INDEX idx_projects_assigned_to ON projects USING GIN(assigned_to);
CREATE INDEX idx_projects_project_manager ON projects(project_manager, organization_id);
CREATE INDEX idx_projects_completion_date ON projects(expected_completion_date, organization_id);
CREATE INDEX idx_projects_tags ON projects USING GIN(tags);
CREATE INDEX idx_projects_compliance ON projects(compliance_framework, organization_id);
CREATE INDEX idx_projects_archived ON projects(archived_at, organization_id) WHERE archived_at IS NOT NULL;

-- Documents table - files uploaded for projects with enhanced security
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- File information
    original_name VARCHAR(500) NOT NULL,
    file_path VARCHAR(1000) NOT NULL, -- Path in storage system
    file_size BIGINT NOT NULL,
    file_type VARCHAR(100) NOT NULL, -- MIME type
    file_hash VARCHAR(128), -- SHA-256 hash for integrity verification
    
    -- Document metadata
    title VARCHAR(500),
    description TEXT,
    document_type VARCHAR(50) DEFAULT 'general' CHECK (document_type IN ('general', 'evidence', 'workpaper', 'report', 'correspondence')),
    version_number INTEGER DEFAULT 1,
    parent_document_id UUID REFERENCES documents(id), -- For document versioning
    
    -- Classification and security
    classification VARCHAR(20) DEFAULT 'internal' CHECK (classification IN ('public', 'internal', 'confidential', 'restricted')),
    sensitivity_level INTEGER DEFAULT 1 CHECK (sensitivity_level BETWEEN 1 AND 5), -- 1=low, 5=high
    requires_approval BOOLEAN DEFAULT FALSE,
    
    -- Access control
    uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reviewed_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    
    -- Processing and analysis
    status VARCHAR(20) DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'processed', 'analyzed', 'reviewed', 'approved', 'rejected')),
    processing_status VARCHAR(20) DEFAULT 'pending' CHECK (processing_status IN ('pending', 'in_progress', 'completed', 'failed')),
    analysis_results JSONB DEFAULT '{}', -- AI/ML analysis results
    
    -- URLs and access
    blob_url TEXT, -- URL for file access
    download_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    last_accessed_by UUID REFERENCES users(id),
    
    -- Custom fields and metadata
    custom_fields JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    keywords TEXT[] DEFAULT '{}', -- Extracted keywords for search
    
    -- Audit trail
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    approved_at TIMESTAMP WITH TIME ZONE,
    
    -- Soft delete
    archived_at TIMESTAMP WITH TIME ZONE,
    archived_by UUID REFERENCES users(id),
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for documents
CREATE INDEX idx_documents_organization_id ON documents(organization_id, deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_project_id ON documents(project_id, deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_uploaded_by ON documents(uploaded_by, organization_id);
CREATE INDEX idx_documents_status ON documents(status, organization_id);
CREATE INDEX idx_documents_processing_status ON documents(processing_status, organization_id);
CREATE INDEX idx_documents_classification ON documents(classification, organization_id);
CREATE INDEX idx_documents_document_type ON documents(document_type, project_id);
CREATE INDEX idx_documents_file_hash ON documents(file_hash) WHERE file_hash IS NOT NULL;
CREATE INDEX idx_documents_parent ON documents(parent_document_id) WHERE parent_document_id IS NOT NULL;
CREATE INDEX idx_documents_tags ON documents USING GIN(tags);
CREATE INDEX idx_documents_keywords ON documents USING GIN(keywords);
CREATE INDEX idx_documents_uploaded_at ON documents(uploaded_at, organization_id);
CREATE INDEX idx_documents_archived ON documents(archived_at, organization_id) WHERE archived_at IS NOT NULL;

-- Document comments table - for collaboration and review
CREATE TABLE document_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES document_comments(id), -- For threaded comments
    
    comment_text TEXT NOT NULL,
    comment_type VARCHAR(20) DEFAULT 'general' CHECK (comment_type IN ('general', 'question', 'issue', 'approval', 'rejection')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'hidden')),
    
    -- Position in document (for annotations)
    page_number INTEGER,
    position_data JSONB, -- For precise positioning annotations
    
    -- Metadata
    is_private BOOLEAN DEFAULT FALSE, -- Private to creator vs. team visible
    requires_response BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES users(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- Create indexes for document_comments
CREATE INDEX idx_document_comments_organization_id ON document_comments(organization_id);
CREATE INDEX idx_document_comments_document_id ON document_comments(document_id, deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_document_comments_user_id ON document_comments(user_id, organization_id);
CREATE INDEX idx_document_comments_parent ON document_comments(parent_comment_id) WHERE parent_comment_id IS NOT NULL;
CREATE INDEX idx_document_comments_status ON document_comments(status, document_id);
CREATE INDEX idx_document_comments_created_at ON document_comments(created_at, document_id);

-- Project milestones table - tracking project progress
CREATE TABLE project_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    milestone_type VARCHAR(50) DEFAULT 'deliverable' CHECK (milestone_type IN ('deliverable', 'checkpoint', 'review', 'approval')),
    
    -- Timeline
    target_date DATE NOT NULL,
    actual_completion_date DATE,
    
    -- Status and progress
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue', 'cancelled')),
    completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage BETWEEN 0 AND 100),
    
    -- Ownership
    assigned_to UUID REFERENCES users(id),
    completed_by UUID REFERENCES users(id),
    
    -- Dependencies
    dependencies UUID[] DEFAULT '{}', -- Array of milestone IDs this depends on
    blockers TEXT[] DEFAULT '{}', -- Array of blocking issues
    
    -- Deliverables
    deliverables JSONB DEFAULT '{}', -- Expected deliverables
    deliverable_documents UUID[] DEFAULT '{}', -- Documents that fulfill this milestone
    
    -- Metadata
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    custom_fields JSONB DEFAULT '{}',
    
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for project_milestones
CREATE INDEX idx_project_milestones_organization_id ON project_milestones(organization_id);
CREATE INDEX idx_project_milestones_project_id ON project_milestones(project_id);
CREATE INDEX idx_project_milestones_status ON project_milestones(status, project_id);
CREATE INDEX idx_project_milestones_target_date ON project_milestones(target_date, project_id);
CREATE INDEX idx_project_milestones_assigned_to ON project_milestones(assigned_to, organization_id);
CREATE INDEX idx_project_milestones_dependencies ON project_milestones USING GIN(dependencies);

-- Document analysis results table - for AI/ML processing results
CREATE TABLE document_analysis_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    
    analysis_type VARCHAR(50) NOT NULL, -- ocr, sentiment, classification, risk_detection, etc.
    analysis_version VARCHAR(20) DEFAULT '1.0', -- Version of analysis algorithm
    
    -- Results
    raw_results JSONB NOT NULL, -- Full analysis results
    summary_results JSONB DEFAULT '{}', -- Processed/summarized results
    confidence_score DECIMAL(5,4), -- 0.0000 to 1.0000
    processing_time_ms INTEGER,
    
    -- Status and metadata
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    error_message TEXT,
    
    -- Analysis metadata
    model_name VARCHAR(100),
    model_version VARCHAR(50),
    parameters JSONB DEFAULT '{}', -- Analysis parameters used
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for document_analysis_results
CREATE INDEX idx_document_analysis_results_organization_id ON document_analysis_results(organization_id);
CREATE INDEX idx_document_analysis_results_document_id ON document_analysis_results(document_id);
CREATE INDEX idx_document_analysis_results_type ON document_analysis_results(analysis_type, document_id);
CREATE INDEX idx_document_analysis_results_status ON document_analysis_results(status, organization_id);
CREATE INDEX idx_document_analysis_results_confidence ON document_analysis_results(confidence_score, analysis_type);

-- Add RLS policies for multi-tenant isolation
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_analysis_results ENABLE ROW LEVEL SECURITY;

-- RLS policies for projects
CREATE POLICY projects_isolation_policy ON projects
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE auth_user_id = auth.uid() 
            AND deleted_at IS NULL
        )
    );

-- RLS policies for documents
CREATE POLICY documents_isolation_policy ON documents
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE auth_user_id = auth.uid() 
            AND deleted_at IS NULL
        )
    );

-- RLS policies for document_comments
CREATE POLICY document_comments_isolation_policy ON document_comments
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE auth_user_id = auth.uid() 
            AND deleted_at IS NULL
        )
    );

-- RLS policies for project_milestones
CREATE POLICY project_milestones_isolation_policy ON project_milestones
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE auth_user_id = auth.uid() 
            AND deleted_at IS NULL
        )
    );

-- RLS policies for document_analysis_results
CREATE POLICY document_analysis_results_isolation_policy ON document_analysis_results
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM users 
            WHERE auth_user_id = auth.uid() 
            AND deleted_at IS NULL
        )
    );

-- Function to check if user can access project
CREATE OR REPLACE FUNCTION user_can_access_project(
    p_user_id UUID,
    p_project_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    user_org_id UUID;
    project_record RECORD;
BEGIN
    -- Get user's organization
    SELECT organization_id INTO user_org_id
    FROM users
    WHERE auth_user_id = p_user_id
    AND deleted_at IS NULL;
    
    IF user_org_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Get project details
    SELECT organization_id, created_by, assigned_to, project_manager
    INTO project_record
    FROM projects
    WHERE id = p_project_id
    AND deleted_at IS NULL;
    
    IF NOT FOUND OR project_record.organization_id != user_org_id THEN
        RETURN FALSE;
    END IF;
    
    -- Check if user has access (creator, manager, or assigned)
    RETURN (
        project_record.created_by = p_user_id OR
        project_record.project_manager = p_user_id OR
        p_user_id = ANY(project_record.assigned_to)
    );
END;
$$ LANGUAGE plpgsql;

-- Function to calculate project completion percentage
CREATE OR REPLACE FUNCTION calculate_project_completion(p_project_id UUID)
RETURNS INTEGER AS $$
DECLARE
    total_milestones INTEGER;
    completed_milestones INTEGER;
    completion_percentage INTEGER;
BEGIN
    -- Count total and completed milestones
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'completed')
    INTO total_milestones, completed_milestones
    FROM project_milestones
    WHERE project_id = p_project_id;
    
    -- Calculate percentage
    IF total_milestones = 0 THEN
        RETURN 0;
    END IF;
    
    completion_percentage := (completed_milestones * 100) / total_milestones;
    
    -- Update project with calculated completion
    UPDATE projects
    SET custom_fields = jsonb_set(
        COALESCE(custom_fields, '{}'),
        '{completion_percentage}',
        to_jsonb(completion_percentage)
    ),
    updated_at = NOW()
    WHERE id = p_project_id;
    
    RETURN completion_percentage;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updating timestamps
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_document_comments_updated_at BEFORE UPDATE ON document_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_milestones_updated_at BEFORE UPDATE ON project_milestones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_document_analysis_results_updated_at BEFORE UPDATE ON document_analysis_results
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();