'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '../components/ui/badge'
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch'
import { Skeleton } from '../components/ui/skeleton'
import { Alert, AlertDescription } from '../components/ui/alert'
import { 
  Users, 
  FileText, 
  FolderOpen, 
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Plus
} from 'lucide-react'
import CreateProjectModal from '../components/CreateProjectModal'

interface DashboardStats {
  totalProjects: number
  activeProjects: number
  totalDocuments: number
  processingDocuments: number
  completedAnalyses: number
  pendingReviews: number
}

interface Project {
  id: string
  name: string
  client_name: string
  status: string
  created_at: string
}

interface Document {
  id: string
  name: string
  processing_status: string
  uploaded_at: string
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentProjects, setRecentProjects] = useState<Project[]>([])
  const [recentDocuments, setRecentDocuments] = useState<Document[]>([])
  const [userProfile, setUserProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateProject, setShowCreateProject] = useState(false)
  
  const authenticatedFetch = useAuthenticatedFetch()

  const fetchDashboardData = async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch user profile
      const profileResponse = await authenticatedFetch('/api/auth/profile')
      if (profileResponse.ok) {
        const profileData = await profileResponse.json()
        setUserProfile(profileData.user)
      }

      // Fetch projects with graceful handling
      const projectsResponse = await authenticatedFetch('/api/projects?limit=5')
      if (projectsResponse.ok) {
        const projectsData = await projectsResponse.json()
        setRecentProjects(projectsData.projects || [])
      }

      // Fetch documents with graceful handling
      const documentsResponse = await authenticatedFetch('/api/documents?limit=5')
      if (documentsResponse.ok) {
        const documentsData = await documentsResponse.json()
        setRecentDocuments(documentsData.documents || [])
      }

      // Calculate stats from fetched data
      const calculatedStats: DashboardStats = {
        totalProjects: recentProjects.length,
        activeProjects: recentProjects.filter(p => p.status === 'active').length,
        totalDocuments: recentDocuments.length,
        processingDocuments: recentDocuments.filter(d => d.processing_status === 'processing').length,
        completedAnalyses: recentDocuments.filter(d => d.processing_status === 'completed').length,
        pendingReviews: 0 // This would come from a reports endpoint
      }
      setStats(calculatedStats)

    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      setError('Failed to load dashboard data. Please try refreshing the page.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const handleProjectCreated = () => {
    setShowCreateProject(false)
    fetchDashboardData() // Refresh data
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="space-y-0 pb-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-16" />
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back{userProfile ? `, ${userProfile.firstName}` : ''}!
          </h1>
          <p className="text-muted-foreground">
            Here's what's happening with your audit projects today.
          </p>
        </div>
        <Button onClick={() => setShowCreateProject(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Project
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalProjects || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.activeProjects || 0} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalDocuments || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.processingDocuments || 0} processing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Analysis</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.completedAnalyses || 0}</div>
            <p className="text-xs text-muted-foreground">
              Ready for review
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pendingReviews || 0}</div>
            <p className="text-xs text-muted-foreground">
              Require attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent Projects */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Projects</CardTitle>
          </CardHeader>
          <CardContent>
            {recentProjects.length === 0 ? (
              <div className="text-center py-6">
                <FolderOpen className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-sm font-medium text-gray-900 mb-2">
                  No projects yet
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  Get started by creating your first audit project
                </p>
                <Button onClick={() => setShowCreateProject(true)} size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Project
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentProjects.slice(0, 5).map((project) => (
                  <div key={project.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{project.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {project.client_name}
                      </p>
                    </div>
                    <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                      {project.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Documents */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Documents</CardTitle>
          </CardHeader>
          <CardContent>
            {recentDocuments.length === 0 ? (
              <div className="text-center py-6">
                <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-sm font-medium text-gray-900 mb-2">
                  No documents uploaded
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  Start by uploading documents to analyze
                </p>
                <Button size="sm" variant="outline">
                  <FileText className="mr-2 h-4 w-4" />
                  Upload Document
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentDocuments.slice(0, 5).map((document) => (
                  <div key={document.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{document.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(document.uploaded_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge 
                      variant={
                        document.processing_status === 'completed' ? 'default' :
                        document.processing_status === 'processing' ? 'secondary' :
                        'outline'
                      }
                    >
                      {document.processing_status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={showCreateProject}
        onClose={() => setShowCreateProject(false)}
        onProjectCreated={handleProjectCreated}
      />
    </div>
  )
}
