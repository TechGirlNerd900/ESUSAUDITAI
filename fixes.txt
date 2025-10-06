# Esus Audit AI - Production Readiness Implementation Plan

## Executive Summary

This comprehensive plan outlines the step-by-step implementation required to transform the Esus Audit AI application from its current state to a production-ready enterprise audit platform. The plan addresses critical gaps in API endpoints, frontend functionality, database completeness, security hardening, and deployment optimization.

## Current State Analysis

### ✅ Implemented Features
- Multi-tenant authentication with RBAC (Admin/Auditor/Reviewer)
- Basic project management structure
- Document upload infrastructure
- AI integration framework (Gemini services)
- Database schema foundation
- Security middleware and headers
- Admin panel structure

### ❌ Critical Issues Identified
- Missing API endpoints causing 404/401 errors
- Incomplete frontend pages (Documents, Reports)
- Dashboard failing due to missing data handling
- Authentication middleware not properly securing API routes
- Missing error boundaries and proper error handling
- Incomplete user workflow implementations

## Phase 1: Critical Infrastructure Fixes (Week 1-2)

### 1.1 Fix Authentication & API Security

**Priority: CRITICAL**

#### Backend Changes:
```typescript
// Fix API authentication middleware
// File: nextjs/lib/auth/apiAuth.ts
export async function authenticateApiRequest(request: NextRequest): Promise<AuthResult> {
  try {
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      return { authenticated: false, error: 'Authentication required' }
    }
    
    // Fetch user profile with organization
    const { data: profile } = await supabase
      .from('users')
      .select('*, organization:organizations(*)')
      .eq('id', user.id)
      .single()
    
    return { 
      authenticated: true, 
      user, 
      profile,
      organizationId: profile?.organization_id 
    }
  } catch (error) {
    return { authenticated: false, error: 'Authentication failed' }
  }
}
```

#### Implementation Steps:
1. **Update middleware.ts** - Fix auth check and rate limiting
2. **Implement withAuth HOC** - Wrap all API routes with proper authentication
3. **Fix API route handlers** - Ensure all routes use consistent auth pattern
4. **Add request validation** - Implement Zod schemas for all API inputs

### 1.2 Complete Missing API Endpoints

#### Documents API Implementation:
```typescript
// File: nextjs/app/api/documents/route.ts
export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request)
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '10')
  const projectId = searchParams.get('projectId')
  
  const supabase = createClient()
  let query = supabase
    .from('documents')
    .select('*, project:projects(name), uploaded_by:users(first_name, last_name)')
    .eq('organization_id', auth.organizationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  
  if (projectId) {
    query = query.eq('project_id', projectId)
  }
  
  const { data, error, count } = await query
    .range((page - 1) * limit, page * limit - 1)
  
  if (error) {
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
  }
  
  return NextResponse.json({
    documents: data || [],
    pagination: {
      page,
      limit,
      total: count || 0,
      pages: Math.ceil((count || 0) / limit)
    }
  })
}
```

#### Required API Endpoints to Implement:
1. **GET /api/documents** - List documents with pagination
2. **GET /api/documents/[id]** - Get document details
3. **PUT /api/documents/[id]** - Update document metadata
4. **DELETE /api/documents/[id]** - Soft delete document
5. **GET /api/reports** - List audit reports
6. **POST /api/reports/generate** - Generate new report
7. **GET /api/dashboard/stats** - Dashboard statistics
8. **GET /api/chat/general** - General AI chat endpoint
9. **GET /api/compliance/status** - Compliance status endpoint

### 1.3 Fix Frontend Error Handling

#### Dashboard Component Fix:
```typescript
// File: nextjs/app/dashboard/page.tsx
const Dashboard: React.FC = () => {
  // ... existing state ...
  
  const fetchWithErrorHandling = async (url: string, errorMessage: string) => {
    try {
      const response = await authenticatedFetch(url)
      if (!response.ok) {
        if (response.status === 404) {
          // Return empty data for 404s instead of throwing
          return { data: [], empty: true }
        }
        throw new Error(`${errorMessage}: ${response.statusText}`)
      }
      return await response.json()
    } catch (error) {
      console.error(errorMessage, error)
      return { data: [], error: error.message }
    }
  }
  
  const fetchDashboardData = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const [userResult, projectsResult, documentsResult, complianceResult] = await Promise.all([
        fetchWithErrorHandling('/api/auth/profile', 'Failed to load user profile'),
        fetchWithErrorHandling('/api/projects', 'Failed to load projects'),
        fetchWithErrorHandling('/api/documents', 'Failed to load documents'),
        fetchWithErrorHandling('/api/compliance/status', 'Failed to load compliance status')
      ])
      
      // Handle each result gracefully
      if (userResult && !userResult.error) {
        setUserProfile(userResult.user || userResult.profile)
      }
      
      if (projectsResult && !projectsResult.error) {
        setProjects(projectsResult.projects || projectsResult.data || [])
      }
      
      if (documentsResult && !documentsResult.error) {
        setDocuments(documentsResult.documents || documentsResult.data || [])
      }
      
      if (complianceResult && !complianceResult.error) {
        setComplianceStatus(complianceResult.compliance || complianceResult.data)
      }
    } catch (error) {
      console.error('Dashboard data fetch failed:', error)
      setError('Failed to load dashboard data. Please refresh the page.')
    } finally {
      setIsLoading(false)
    }
  }
  
  // ... rest of component with proper error states ...
}
```

## Phase 2: Complete Core Features (Week 3-4)

### 2.1 Implement Missing Frontend Pages

#### Documents Page Implementation:
```typescript
// File: nextjs/app/documents/page.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, FileText, Download, Trash2, Eye } from 'lucide-react'
import UploadDocumentModal from '../components/UploadDocumentModal'
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch'

interface Document {
  id: string
  name: string
  file_type: string
  file_size: number
  project: { name: string }
  uploaded_by: { first_name: string, last_name: string }
  uploaded_at: string
  processing_status: 'pending' | 'processing' | 'completed' | 'failed'
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const authenticatedFetch = useAuthenticatedFetch()
  
  const fetchDocuments = async () => {
    try {
      const response = await authenticatedFetch('/api/documents')
      if (response.ok) {
        const data = await response.json()
        setDocuments(data.documents || [])
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error)
    } finally {
      setLoading(false)
    }
  }
  
  useEffect(() => {
    fetchDocuments()
  }, [])
  
  const handleDocumentUploaded = () => {
    fetchDocuments() // Refresh the list
    setShowUploadModal(false)
  }
  
  if (loading) {
    return <div className="p-6">Loading documents...</div>
  }
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Documents</h1>
        <Button onClick={() => setShowUploadModal(true)}>
          <Upload className="mr-2 h-4 w-4" />
          Upload Document
        </Button>
      </div>
      
      {documents.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium mb-2">No documents uploaded</h3>
            <p className="text-gray-500 mb-4">
              Upload your first document to get started with AI-powered analysis
            </p>
            <Button onClick={() => setShowUploadModal(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Upload Document
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {documents.map((doc) => (
            <Card key={doc.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <FileText className="h-8 w-8 text-blue-500" />
                    <div>
                      <h3 className="font-medium">{doc.name}</h3>
                      <p className="text-sm text-gray-500">
                        {doc.project?.name} • Uploaded by {doc.uploaded_by?.first_name} {doc.uploaded_by?.last_name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(doc.uploaded_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      doc.processing_status === 'completed' ? 'bg-green-100 text-green-800' :
                      doc.processing_status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                      doc.processing_status === 'failed' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {doc.processing_status}
                    </span>
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      <UploadDocumentModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploadComplete={handleDocumentUploaded}
      />
    </div>
  )
}
```

#### Reports Page Implementation:
```typescript
// File: nextjs/app/reports/page.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileBarChart, Plus, Download, Eye } from 'lucide-react'
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch'

interface Report {
  id: string
  title: string
  project_name: string
  generated_by: string
  generated_at: string
  status: 'draft' | 'reviewed' | 'final'
  report_type: 'audit' | 'management_letter' | 'compliance'
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const authenticatedFetch = useAuthenticatedFetch()
  
  const fetchReports = async () => {
    try {
      const response = await authenticatedFetch('/api/reports')
      if (response.ok) {
        const data = await response.json()
        setReports(data.reports || [])
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error)
    } finally {
      setLoading(false)
    }
  }
  
  useEffect(() => {
    fetchReports()
  }, [])
  
  if (loading) {
    return <div className="p-6">Loading reports...</div>
  }
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Reports</h1>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Generate Report
        </Button>
      </div>
      
      {reports.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileBarChart className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium mb-2">No reports generated</h3>
            <p className="text-gray-500 mb-4">
              Generate your first audit report from your analyzed documents
            </p>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Generate Report
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {reports.map((report) => (
            <Card key={report.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{report.title}</h3>
                    <p className="text-sm text-gray-500">
                      {report.project_name} • Generated by {report.generated_by}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(report.generated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      report.status === 'final' ? 'bg-green-100 text-green-800' :
                      report.status === 'reviewed' ? 'bg-blue-100 text-blue-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {report.status}
                    </span>
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
```

### 2.2 Complete Database Schema

#### Missing Tables Implementation:
```sql
-- File: supabase/migrations/20250115000000_complete_missing_tables.sql

-- Create documents table if not exists
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    file_path TEXT NOT NULL,
    upload_metadata JSONB DEFAULT '{}',
    processing_status VARCHAR(50) DEFAULT 'pending',
    analysis_results JSONB,
    uploaded_by UUID NOT NULL REFERENCES users(id),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT documents_status_check CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed'))
);

-- Create audit_reports table if not exists
CREATE TABLE IF NOT EXISTS audit_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    report_type VARCHAR(50) DEFAULT 'audit',
    template_id UUID,
    content JSONB NOT NULL DEFAULT '{}',
    findings JSONB DEFAULT '[]',
    recommendations JSONB DEFAULT '[]',
    status VARCHAR(50) DEFAULT 'draft',
    generated_by UUID NOT NULL REFERENCES users(id),
    reviewed_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT audit_reports_type_check CHECK (report_type IN ('audit', 'management_letter', 'compliance')),
    CONSTRAINT audit_reports_status_check CHECK (status IN ('draft', 'reviewed', 'final', 'archived'))
);

-- Create compliance_assessments table
CREATE TABLE IF NOT EXISTS compliance_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    assessment_type VARCHAR(100) NOT NULL,
    framework VARCHAR(100) NOT NULL, -- 'nigerian_frs', 'ifrs', 'gaap', etc.
    assessment_data JSONB NOT NULL DEFAULT '{}',
    results JSONB DEFAULT '{}',
    overall_score DECIMAL(5,2),
    passed_checks INTEGER DEFAULT 0,
    total_checks INTEGER DEFAULT 0,
    recommendations JSONB DEFAULT '[]',
    assessed_by UUID NOT NULL REFERENCES users(id),
    assessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create chat_sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_type VARCHAR(50) DEFAULT 'general', -- 'general', 'project', 'document'
    context_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    sender_type VARCHAR(20) NOT NULL, -- 'user', 'assistant'
    message_content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_documents_organization_id ON documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_processing_status ON documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_audit_reports_organization_id ON audit_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_reports_project_id ON audit_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_compliance_assessments_organization_id ON compliance_assessments(organization_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);

-- RLS Policies
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Documents RLS
CREATE POLICY "Users can view documents in their organization" ON documents
FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
));

CREATE POLICY "Users can insert documents in their organization" ON documents
FOR INSERT WITH CHECK (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
));

CREATE POLICY "Users can update documents in their organization" ON documents
FOR UPDATE USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
));

-- Similar policies for other tables...
```

## Phase 3: Enhanced Features & User Experience (Week 5-6)

### 3.1 Implement Complete User Workflows

#### Project Creation with Team Assignment:
```typescript
// File: nextjs/app/components/CreateProjectModal.tsx (Enhanced)
const CreateProjectModal: React.FC<Props> = ({ isOpen, onClose, onProjectCreated }) => {
  const [formData, setFormData] = useState({
    name: '',
    client_name: '',
    client_email: '',
    description: '',
    start_date: '',
    end_date: '',
    tags: [],
    team_members: [], // Add team assignment
    custom_fields: {}
  })
  
  const [teamMembers, setTeamMembers] = useState([])
  const [loading, setLoading] = useState(false)
  
  // Fetch available team members
  useEffect(() => {
    const fetchTeamMembers = async () => {
      try {
        const response = await authenticatedFetch('/api/users')
        if (response.ok) {
          const data = await response.json()
          setTeamMembers(data.users || [])
        }
      } catch (error) {
        console.error('Failed to fetch team members:', error)
      }
    }
    
    if (isOpen) {
      fetchTeamMembers()
    }
  }, [isOpen])
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const response = await authenticatedFetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          team_assignments: formData.team_members.map(memberId => ({
            user_id: memberId,
            role: 'auditor', // Default role, can be customized
            assigned_at: new Date().toISOString()
          }))
        })
      })
      
      if (response.ok) {
        const newProject = await response.json()
        onProjectCreated(newProject)
        onClose()
        setFormData({ /* reset form */ })
      } else {
        const error = await response.json()
        setError(error.message || 'Failed to create project')
      }
    } catch (error) {
      setError('Network error occurred')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic project fields */}
          {/* ... existing fields ... */}
          
          {/* Team Assignment Section */}
          <div className="space-y-2">
            <Label>Assign Team Members</Label>
            <div className="space-y-2">
              {teamMembers.map((member) => (
                <div key={member.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`member-${member.id}`}
                    checked={formData.team_members.includes(member.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setFormData(prev => ({
                          ...prev,
                          team_members: [...prev.team_members, member.id]
                        }))
                      } else {
                        setFormData(prev => ({
                          ...prev,
                          team_members: prev.team_members.filter(id => id !== member.id)
                        }))
                      }
                    }}
                  />
                  <Label htmlFor={`member-${member.id}`} className="flex-1">
                    {member.first_name} {member.last_name} ({member.role})
                  </Label>
                </div>
              ))}
            </div>
          </div>
          
          {/* Form actions */}
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Project'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

### 3.2 Implement Document Processing Workflow

#### Enhanced Document Processing:
```typescript
// File: nextjs/app/api/documents/process/route.ts
export async function POST(request: NextRequest) {
  const auth = await authenticateApiRequest(request)
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const { documentId, processingType = 'full' } = await request.json()
  
  const supabase = createClient()
  
  // Get document details
  const { data: document, error: docError } = await supabase
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .eq('organization_id', auth.organizationId)
    .single()
  
  if (docError || !document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }
  
  try {
    // Update status to processing
    await supabase
      .from('documents')
      .update({ 
        processing_status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId)
    
    // Queue for background processing
    const processingJob = {
      id: crypto.randomUUID(),
      type: 'document_analysis',
      data: {
        documentId,
        processingType,
        organizationId: auth.organizationId,
        userId: auth.user.id
      },
      createdAt: new Date().toISOString()
    }
    
    // Add to job queue (implement with your preferred queue system)
    await queueJob(processingJob)
    
    // Start processing pipeline
    await processDocumentPipeline(documentId, processingType)
    
    return NextResponse.json({
      message: 'Document processing started',
      jobId: processingJob.id,
      status: 'processing'
    })
  } catch (error) {
    // Update status to failed
    await supabase
      .from('documents')
      .update({ 
        processing_status: 'failed',
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId)
    
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}

async function processDocumentPipeline(documentId: string, processingType: string) {
  try {
    // 1. Extract text and metadata using Google Document AI
    const extractionResults = await extractDocumentContent(documentId)
    
    // 2. Analyze content using Gemini
    const analysisResults = await analyzeDocumentContent(extractionResults)
    
    // 3. Generate insights and recommendations
    const insights = await generateDocumentInsights(analysisResults)
    
    // 4. Save results to database
    await saveProcessingResults(documentId, {
      extraction: extractionResults,
      analysis: analysisResults,
      insights: insights,
      processedAt: new Date().toISOString()
    })
    
    // 5. Update status to completed
    const supabase = createClient()
    await supabase
      .from('documents')
      .update({ 
        processing_status: 'completed',
        processed_at: new Date().toISOString(),
        analysis_results: {
          extraction: extractionResults,
          analysis: analysisResults,
          insights: insights
        }
      })
      .eq('id', documentId)
    
  } catch (error) {
    console.error('Document processing pipeline failed:', error)
    throw error
  }
}
```

## Phase 4: Security Hardening & Performance (Week 7-8)

### 4.1 Implement Comprehensive Security

#### Enhanced Security Headers:
```typescript
// File: nextjs/lib/core/securityHeaders.ts (Enhanced)
export const securityHeaders = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.google.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://*.supabase.co https://api.openai.com https://generativelanguage.googleapis.com",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ].join('; '),
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Permissions-Policy': [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'payment=()',
    'usb=()'
  ].join(', ')
}
```

#### Input Validation Schemas:
```typescript
// File: nextjs/lib/validation/schemas.ts
import { z } from 'zod'

export const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  client_name: z.string().min(1).max(255),
  client_email: z.string().email().optional(),
  description: z.string().max(2000).optional(),
  start_date: z.string().datetime(),
  end_date: z.string().datetime(),
  tags: z.array(z.string()).max(10),
  team_assignments: z.array(z.object({
    user_id: z.string().uuid(),
    role: z.enum(['auditor', 'reviewer']),
    assigned_at: z.string().datetime()
  })).optional(),
  custom_fields: z.record(z.any()).optional()
})

export const uploadDocumentSchema = z.object({
  project_id: z.string().uuid(),
  document_type: z.string().max(100),
  metadata: z.record(z.any()).optional()
})

export const chatMessageSchema = z.object({
  session_id: z.string().uuid().optional(),
  message: z.string().min(1).max(4000),
  context: z.object({
    project_id: z.string().uuid().optional(),
    document_ids: z.array(z.string().uuid()).optional()
  }).optional()
})
```

### 4.2 Performance Optimization

#### Database Query Optimization:
```sql
-- File: supabase/migrations/20250116000000_performance_optimization.sql

-- Add composite indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_org_project_status 
ON documents(organization_id, project_id, processing_status) 
WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_org_status_created 
ON projects(organization_id, status, created_at DESC) 
WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_reports_org_project_status 
ON audit_reports(organization_id, project_id, status) 
WHERE deleted_at IS NULL;

-- Create partial indexes for active records
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_active_organization 
ON users(organization_id, role) 
WHERE deleted_at IS NULL AND status = 'active';

-- Optimize frequently used views
CREATE OR REPLACE VIEW project_summary AS
SELECT 
    p.id,
    p.name,
    p.client_name,
    p.status,
    p.organization_id,
    COUNT(DISTINCT d.id) FILTER (WHERE d.deleted_at IS NULL) as document_count,
    COUNT(DISTINCT ar.id) as report_count,
    COUNT(DISTINCT pa.user_id) as team_member_count,
    p.created_at,
    p.updated_at
FROM projects p
LEFT JOIN documents d ON p.id = d.project_id
LEFT JOIN audit_reports ar ON p.id = ar.project_id
LEFT JOIN project_assignments pa ON p.id = pa.project_id
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.name, p.client_name, p.status, p.organization_id, p.created_at, p.updated_at;
```

## Phase 5: AI Integration & Advanced Features (Week 9-10)

### 5.1 Enhanced AI Capabilities

#### Document Analysis Pipeline:
```typescript
// File: nextjs/lib/ai/documentAnalysis.ts
import { GoogleAIFileManager } from '@google/generative-ai/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export class DocumentAnalysisService {
  private fileManager: GoogleAIFileManager
  private genAI: GoogleGenerativeAI
  
  constructor() {
    this.fileManager = new GoogleAIFileManager(process.env.GOOGLE_AI_API_KEY!)
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)
  }
  
  async analyzeDocument(documentPath: string, documentType: string) {
    try {
      // 1. Upload file to Google AI
      const uploadResult = await this.fileManager.uploadFile(documentPath, {
        mimeType: this.getMimeType(documentPath),
        displayName: `Document Analysis - ${Date.now()}`
      })
      
      // 2. Wait for processing
      let file = await this.fileManager.getFile(uploadResult.file.name)
      while (file.state === 'PROCESSING') {
        await new Promise(resolve => setTimeout(resolve, 2000))
        file = await this.fileManager.getFile(uploadResult.file.name)
      }
      
      if (file.state === 'FAILED') {
        throw new Error('File processing failed')
      }
      
      // 3. Analyze with Gemini
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-pro' })
      
      const analysisPrompt = this.getAnalysisPrompt(documentType)
      
      const result = await model.generateContent([
        {
          fileData: {
            mimeType: file.mimeType,
            fileUri: file.uri
          }
        },
        { text: analysisPrompt }
      ])
      
      const analysis = JSON.parse(result.response.text())
      
      // 4. Clean up uploaded file
      await this.fileManager.deleteFile(uploadResult.file.name)
      
      return {
        success: true,
        analysis,
        confidence: this.calculateConfidenceScore(analysis),
        recommendations: this.generateRecommendations(analysis, documentType)
      }
    } catch (error) {
      console.error('Document analysis failed:', error)
      return {
        success: false,
        error: error.message,
        analysis: null
      }
    }
  }
  
  private getAnalysisPrompt(documentType: string): string {
    const basePrompt = `
      Analyze this ${documentType} document and extract the following information in JSON format:
      {
        "document_type": "${documentType}",
        "key_findings": [],
        "financial_data": {},
        "risk_indicators": [],
        "compliance_issues": [],
        "summary": "",
        "recommendations": []
      }
    `
    
    const typeSpecificPrompts = {
      'financial_statement': `
        Focus on:
        - Revenue recognition patterns
        - Asset valuation methods
        - Liability assessments
        - Cash flow analysis
        - Ratio calculations
        - Trend analysis
      `,
      'invoice': `
        Focus on:
        - Invoice validity
        - Pricing accuracy
        - Tax calculations
        - Payment terms
        - Vendor information
        - Approval evidence
      `,
      'bank_statement': `
        Focus on:
        - Transaction patterns
        - Unusual activities
        - Reconciliation items
        - Interest calculations
        - Fee assessments
        - Balance verification
      `
    }
    
    return basePrompt + (typeSpecificPrompts[documentType] || '')
  }
  
  private calculateConfidenceScore(analysis: any): number {
    // Implement confidence scoring based on data completeness and quality
    let score = 0.5 // Base score
    
    if (analysis.key_findings?.length > 0) score += 0.2
    if (analysis.financial_data && Object.keys(analysis.financial_data).length > 0) score += 0.2
    if (analysis.summary?.length > 50) score += 0.1
    
    return Math.min(score, 1.0)
  }
  
  private generateRecommendations(analysis: any, documentType: string): string[] {
    const recommendations = []
    
    if (analysis.risk_indicators?.length > 0) {
      recommendations.push('Review identified risk indicators with senior auditor')
    }
    
    if (analysis.compliance_issues?.length > 0) {
      recommendations.push('Address compliance issues before finalizing audit')
    }
    
    // Add type-specific recommendations
    if (documentType === 'financial_statement') {
      recommendations.push('Perform analytical procedures on key ratios')
      recommendations.push('Test significant accounting estimates')
    }
    
    return recommendations
  }
}
```

### 5.2 Advanced Chat Features

#### Context-Aware AI Assistant:
```typescript
// File: nextjs/lib/ai/chatService.ts
export class ChatService {
  private genAI: GoogleGenerativeAI
  
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)
  }
  
  async generateResponse(message: string, context: ChatContext) {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-pro' })
    
    const systemPrompt = this.buildSystemPrompt(context)
    const conversationHistory = await this.getConversationHistory(context.sessionId)
    
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: message }
    ]
    
    try {
      const result = await model.generateContent({
        contents: messages.map(msg => ({
          role: msg.role === 'system' ? 'user' : msg.role,
          parts: [{ text: msg.content }]
        }))
      })
      
      const response = result.response.text()
      
      // Save conversation
      await this.saveMessage(context.sessionId, 'user', message)
      await this.saveMessage(context.sessionId, 'assistant', response)
      
      return {
        response,
        suggestions: this.generateSuggestions(context),
        confidence: 0.8 // Implement confidence scoring
      }
    } catch (error) {
      console.error('Chat generation failed:', error)
      throw new Error('Failed to generate response')
    }
  }
  
  private buildSystemPrompt(context: ChatContext): string {
    let prompt = `
      You are Esus, an AI audit assistant specialized in financial auditing and compliance.
      You help auditors with document analysis, risk assessment, and audit procedures.
      
      Current context:
      - Organization: ${context.organizationName}
      - User Role: ${context.userRole}
    `
    
    if (context.projectId) {
      prompt += `
      - Current Project: ${context.projectName}
      - Project Type: ${context.projectType}
      - Project Status: ${context.projectStatus}
      `
    }
    
    if (context.documentContext?.length > 0) {
      prompt += `
      - Available Documents: ${context.documentContext.length}
      - Document Types: ${context.documentContext.map(d => d.type).join(', ')}
      `
    }
    
    prompt += `
    Provide helpful, accurate audit guidance while maintaining professional standards.
    Reference specific documents when relevant and suggest appropriate audit procedures.
    `
    
    return prompt
  }
  
  private generateSuggestions(context: ChatContext): string[] {
    const suggestions = [
      "What audit procedures should I perform?",
      "Help me identify risks in this project",
      "Generate a summary of findings"
    ]
    
    if (context.projectId) {
      suggestions.push("What's the status of document analysis?")
      suggestions.push("Are there any compliance issues?")
    }
    
    return suggestions
  }
}
```

## Phase 6: Testing & Quality Assurance (Week 11-12)

### 6.1 Comprehensive Testing Strategy

#### Unit Tests:
```typescript
// File: nextjs/__tests__/api/auth.test.ts
import { authenticateApiRequest } from '@/lib/auth/apiAuth'
import { createMockRequest } from '../utils/mockRequest'

describe('API Authentication', () => {
  test('should authenticate valid user', async () => {
    const request = createMockRequest('/api/projects', {
      headers: { 'Authorization': 'Bearer valid-token' }
    })
    
    const result = await authenticateApiRequest(request)
    
    expect(result.authenticated).toBe(true)
    expect(result.user).toBeDefined()
    expect(result.organizationId).toBeDefined()
  })
  
  test('should reject invalid token', async () => {
    const request = createMockRequest('/api/projects', {
      headers: { 'Authorization': 'Bearer invalid-token' }
    })
    
    const result = await authenticateApiRequest(request)
    
    expect(result.authenticated).toBe(false)
    expect(result.error).toBe('Authentication required')
  })
})
```

#### Integration Tests:
```typescript
// File: nextjs/__tests__/integration/projects.test.ts
describe('Projects API Integration', () => {
  test('should create project with team assignment', async () => {
    const projectData = {
      name: 'Test Project',
      client_name: 'Test Client',
      team_assignments: [{
        user_id: 'test-user-id',
        role: 'auditor'
      }]
    }
    
    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testToken}`
      },
      body: JSON.stringify(projectData)
    })
    
    expect(response.status).toBe(201)
    const project = await response.json()
    expect(project.id).toBeDefined()
    expect(project.team_assignments).toHaveLength(1)
  })
})
```

### 6.2 End-to-End Testing

#### E2E Test Suite:
```typescript
// File: nextjs/__tests__/e2e/audit-workflow.test.ts
import { test, expect } from '@playwright/test'

test.describe('Complete Audit Workflow', () => {
  test('should complete full audit workflow', async ({ page }) => {
    // 1. Login
    await page.goto('/login')
    await page.fill('[data-testid="email"]', 'auditor@test.com')
    await page.fill('[data-testid="password"]', 'password')
    await page.click('[data-testid="login-button"]')
    
    // 2. Create Project
    await page.click('[data-testid="create-project"]')
    await page.fill('[data-testid="project-name"]', 'E2E Test Project')
    await page.fill('[data-testid="client-name"]', 'Test Client')
    await page.click('[data-testid="submit-project"]')
    
    // 3. Upload Document
    await page.click('[data-testid="upload-document"]')
    await page.setInputFiles('[data-testid="file-input"]', 'test-document.pdf')
    await page.click('[data-testid="upload-button"]')
    
    // 4. Wait for processing
    await page.waitForSelector('[data-testid="processing-complete"]', { timeout: 30000 })
    
    // 5. Review Analysis
    await page.click('[data-testid="view-analysis"]')
    await expect(page.locator('[data-testid="analysis-results"]')).toBeVisible()
    
    // 6. Generate Report
    await page.click('[data-testid="generate-report"]')
    await page.waitForSelector('[data-testid="report-generated"]', { timeout: 30000 })
    
    // 7. Verify Report
    await expect(page.locator('[data-testid="report-title"]')).toContainText('E2E Test Project')
  })
})
```

## Phase 7: Production Deployment (Week 13-14)

### 7.1 Environment Configuration

#### Production Environment Setup:
```javascript
// File: nextjs/next.config.prod.js
module.exports = {
  experimental: {
    nodeMiddleware: true
  },
  env: {
    NODE_ENV: 'production'
  },
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'X-Frame-Options',
          value: 'DENY'
        },
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff'
        },
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=31536000; includeSubDomains; preload'
        }
      ]
    }
  ],
  images: {
    domains: ['your-domain.supabase.co']
  },
  compress: true,
  poweredByHeader: false,
  trailingSlash: false
}
```

#### Vercel Configuration:
```json
// File: vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm ci",
  "framework": "nextjs",
  "regions": ["iad1"],
  "env": {
    "NODE_ENV": "production"
  },
  "build": {
    "env": {
      "NODE_ENV": "production",
      "NEXT_PUBLIC_APP_ENV": "production"
    }
  },
  "functions": {
    "nextjs/app/api/**/*.ts": {
      "maxDuration": 30
    }
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/$1"
    }
  ]
}
```

### 7.2 Monitoring & Analytics

#### Application Monitoring:
```typescript
// File: nextjs/lib/monitoring/analytics.ts
export class ApplicationMonitoring {
  static trackUserAction(action: string, metadata?: Record<string, any>) {
    if (process.env.NODE_ENV === 'production') {
      // Send to analytics service
      console.log('User Action:', { action, metadata, timestamp: new Date() })
    }
  }
  
  static trackError(error: Error, context?: string) {
    console.error('Application Error:', {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date()
    })
    
    if (process.env.NODE_ENV === 'production') {
      // Send to error tracking service
    }
  }
  
  static trackPerformance(metric: string, value: number, unit: string) {
    if (process.env.NODE_ENV === 'production') {
      console.log('Performance Metric:', { metric, value, unit, timestamp: new Date() })
    }
  }
}
```

## Implementation Summary

### Critical Path Dependencies:
1. **Phase 1 (Infrastructure)** must be completed before any other phases
2. **Phase 2 (Core Features)** depends on Phase 1 completion
3. **Phase 3 (Enhanced UX)** can run parallel to Phase 4 (Security)
4. **Phase 5 (AI Features)** requires stable core from Phases 1-2
5. **Phase 6 (Testing)** should run throughout all phases
6. **Phase 7 (Deployment)** is the final integration phase

### Resource Requirements:
- **Development Team**: 3-4 developers (1 senior, 2-3 mid-level)
- **DevOps Engineer**: 0.5 FTE for deployment and monitoring
- **QA Engineer**: 1 FTE for testing strategy and execution
- **UI/UX Designer**: 0.5 FTE for interface improvements

### Success Metrics:
- **Performance**: Page load times < 2s, API response times < 500ms
- **Reliability**: 99.9% uptime, < 0.1% error rate
- **Security**: Zero critical vulnerabilities, SOC 2 compliance ready
- **User Experience**: Task completion rate > 95%, user satisfaction > 4.5/5

### Risk Mitigation:
- **API Integration Issues**: Implement comprehensive mocking and testing
- **Performance Bottlenecks**: Monitor and optimize database queries early
- **Security Vulnerabilities**: Regular security audits and penetration testing
- **User Adoption**: Conduct user testing throughout development

This plan transforms Esus Audit AI from its current state to a production-ready enterprise platform that delivers all features outlined in the features.md file while maintaining the highest standards of security, performance, and user experience.