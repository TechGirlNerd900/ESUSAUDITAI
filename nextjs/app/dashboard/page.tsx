'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlusCircle,
  Upload,
  ShieldCheck,
  FileBarChart,
  Calendar,
  FileText,
  AlertTriangle,
  CheckCircle,
  Brain,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import ErrorBoundary from '../components/ErrorBoundary';
import CreateProjectModal from '../components/CreateProjectModal';
import WelcomeModal from '../components/WelcomeModal';
import ChatWidget from '../components/ChatWidget';
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch';
import UploadDocumentModal from '../components/UploadDocumentModal';

// --- Interfaces ---
interface Project {
  id: string;
  name: string;
  client_name: string;
  status: 'active' | 'completed' | 'on_hold' | 'cancelled';
  created_at: string;
  due_date?: string;
}

interface Document {
  id: string;
  name: string;
  uploaded_at: string;
}

interface ComplianceStatus {
  overall_score: number;
  passed_checks: number;
  total_checks: number;
}

interface AIInsight {
  id: string;
  message: string;
}

// --- Dashboard Component ---
const Dashboard: React.FC = () => {
  const authenticatedFetch = useAuthenticatedFetch();
  
  // --- Modal States ---
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // --- Data States ---
  const [userProfile, setUserProfile] = useState<any>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [complianceStatus, setComplianceStatus] = useState<ComplianceStatus | null>(null);
  const [aiInsight, setAiInsight] = useState<AIInsight | null>(null);

  // --- Loading States ---
  const [isLoading, setIsLoading] = useState(true);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [complianceLoading, setComplianceLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(true);

  // --- Error States ---
  const [error, setError] = useState<string | null>(null);

  // --- Data Fetching Functions ---
  const fetchUserProfile = useCallback(async () => {
    try {
      const response = await authenticatedFetch('/api/auth/profile');
      if (!response.ok) throw new Error('Failed to fetch profile');
      const data = await response.json();
      setUserProfile(data.user);
    } catch (err) {
      setError('Failed to load user profile');
      console.error(err);
    }
  }, [authenticatedFetch]);

  const fetchProjects = useCallback(async () => {
    setProjectsLoading(true);
    try {
      const response = await authenticatedFetch('/api/projects');
      if (!response.ok) throw new Error('Failed to fetch projects');
      const data = await response.json();
      setProjects(data);
    } catch (err) {
      setError('Failed to load projects');
      console.error(err);
    } finally {
      setProjectsLoading(false);
    }
  }, [authenticatedFetch]);

  const fetchDocuments = useCallback(async () => {
    setDocumentsLoading(true);
    try {
      const response = await authenticatedFetch('/api/documents');
      if (!response.ok) throw new Error('Failed to fetch documents');
      const data = await response.json();
      setDocuments(data);
    } catch (err) {
      setError('Failed to load documents');
      console.error(err);
    } finally {
      setDocumentsLoading(false);
    }
  }, [authenticatedFetch]);

  const fetchComplianceStatus = useCallback(async () => {
    setComplianceLoading(true);
    try {
      const response = await authenticatedFetch('/api/compliance/status');
      if (!response.ok) throw new Error('Failed to fetch compliance status');
      const data = await response.json();
      setComplianceStatus(data);
    } catch (err) {
      setError('Failed to load compliance status');
      console.error(err);
    } finally {
      setComplianceLoading(false);
    }
  }, [authenticatedFetch]);

  const fetchAIInsight = useCallback(async () => {
    setAiLoading(true);
    try {
      const response = await authenticatedFetch('/api/ai/insights');
      if (!response.ok) throw new Error('Failed to fetch AI insights');
      const data = await response.json();
      setAiInsight(data);
    } catch (err) {
      // Don't show error for AI insights as it's non-critical
      console.error('Failed to load AI insights:', err);
    } finally {
      setAiLoading(false);
    }
  }, [authenticatedFetch]);

  // --- Effect Hooks ---
  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        await Promise.all([
          fetchUserProfile(),
          fetchProjects(),
          fetchDocuments(),
          fetchComplianceStatus(),
          fetchAIInsight(),
        ]);
      } catch (err) {
        setError('Failed to load dashboard data.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [
    fetchUserProfile,
    fetchProjects,
    fetchDocuments,
    fetchComplianceStatus,
    fetchAIInsight
  ]);

  // --- Event Handlers ---
  const handleProjectCreated = useCallback((newProject: Project) => {
    setProjects(prev => [newProject, ...prev]);
  }, []);

  const handleWelcomeTaskSelect = useCallback((taskId: string) => {
    if (userProfile) {
      localStorage.setItem(`welcome_seen_${userProfile.id}`, 'true');
    }
    setShowWelcomeModal(false);
    if (taskId === 'create_project') {
      setShowCreateModal(true);
    }
  }, [userProfile]);

  // --- Render Logic ---
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Dashboard Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
          </CardContent>
          <CardFooter>
            <Button onClick={() => window.location.reload()} className="w-full">
              Try Again
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Quick Actions Bar Skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
        {/* Cards Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {[...Array(2)].map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-lg" />
            ))}
          </div>
          <div className="space-y-6">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="flex flex-col space-y-6">
        {/* --- Quick Actions Bar --- */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-card rounded-lg shadow-sm"
        >
          <Button size="lg" className="flex-col items-start space-y-2 py-6" onClick={() => setShowCreateModal(true)}>
            <PlusCircle className="h-5 w-5" />
            <span>New Project</span>
          </Button>
          <Button variant="secondary" size="lg" className="flex-col items-start space-y-2 py-6" onClick={() => setShowUploadModal(true)}>
            <Upload className="h-5 w-5" />
            <span>Upload Document</span>
          </Button>
          <Button variant="secondary" size="lg" className="flex-col items-start space-y-2 py-6">
            <ShieldCheck className="h-5 w-5" />
            <span>Run Compliance</span>
          </Button>
          <Button variant="secondary" size="lg" className="flex-col items-start space-y-2 py-6">
            <FileBarChart className="h-5 w-5" />
            <span>Generate Report</span>
          </Button>
        </motion.div>

        {/* --- Main Content Grid --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* --- Column 1: Work Overview --- */}
          <div className="lg:col-span-2 space-y-6">
            {/* Current Projects Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CheckCircle className="mr-2 h-5 w-5 text-green-600" />
                  Current Projects
                  <span className="ml-auto text-sm font-normal text-muted-foreground">
                    {projects.filter(p => p.status === 'active').length} active
                  </span>
                </CardTitle>
                <CardDescription>
                  Your most recent and active audit projects.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {projectsLoading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-16" />
                    ))}
                  </div>
                ) : projects && projects.length > 0 ? (
                  <div className="space-y-4">
                    {projects.slice(0, 3).map((project) => (
                      <div
                        key={project.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div>
                          <p className="font-medium">{project.name}</p>
                          <p className="text-sm text-muted-foreground">{project.client_name}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                              project.status === 'active'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {project.status}
                          </span>
                          <Button size="sm" variant="ghost">
                            Open
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <CheckCircle className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">No active projects. Create one to get started.</p>
                    <Button className="mt-4" onClick={() => setShowCreateModal(true)}>
                      Create Project
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Upcoming Deadlines Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calendar className="mr-2 h-5 w-5 text-blue-600" />
                  Upcoming Deadlines
                </CardTitle>
                <CardDescription>
                  Stay on top of your upcoming tasks and milestones.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {projectsLoading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-12" />
                    ))}
                  </div>
                ) : projects.filter(p => p.due_date).length > 0 ? (
                  <div className="space-y-4">
                    {projects
                      .filter(p => p.due_date)
                      .slice(0, 3)
                      .map((project) => (
                        <div key={project.id} className="flex items-center justify-between">
                          <span className="font-medium">{project.name}</span>
                          <span className="text-sm text-muted-foreground">
                            {project.due_date ? new Date(project.due_date).toLocaleDateString() : 'No date'}
                          </span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">No upcoming deadlines.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* --- Column 2: Activity & Insights --- */}
          <div className="space-y-6">
            {/* Recent Documents Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="mr-2 h-5 w-5 text-purple-600" />
                  Recent Documents
                </CardTitle>
                <CardDescription>
                  Your latest uploaded files for review.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {documentsLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-12" />
                    ))}
                  </div>
                ) : documents && documents.length > 0 ? (
                  <div className="space-y-3">
                    {documents.slice(0, 3).map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-2 hover:bg-accent/50 rounded transition-colors">
                        <span className="text-sm truncate">{doc.name}</span>
                        <Button size="sm" variant="ghost">
                          View
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">No documents uploaded yet.</p>
                )}
              </CardContent>
            </Card>

            {/* Compliance Status Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <ShieldCheck className="mr-2 h-5 w-5 text-green-600" />
                  Compliance Status
                </CardTitle>
                <CardDescription>
                  Overview of your audit compliance.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {complianceLoading ? (
                  <div className="flex justify-center items-center h-24">
                    <Skeleton className="h-12 w-12 rounded-full" />
                  </div>
                ) : complianceStatus ? (
                  <div className="text-center">
                    <div className="text-4xl font-bold text-primary">{complianceStatus.overall_score}%</div>
                    <p className="text-sm text-muted-foreground mt-2">
                      {complianceStatus.passed_checks} of {complianceStatus.total_checks} checks passed
                    </p>
                    <Button variant="outline" className="mt-4 w-full">
                      View Details
                    </Button>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">No compliance data available.</p>
                )}
              </CardContent>
            </Card>

            {/* AI Assistant Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Brain className="mr-2 h-5 w-5 text-indigo-600" />
                  AI Assistant Insights
                </CardTitle>
                <CardDescription>
                  Recommendations from your AI assistant.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {aiLoading ? (
                  <Skeleton className="h-20" />
                ) : aiInsight ? (
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm">{aiInsight.message}</p>
                    <Button variant="link" className="p-0 h-auto mt-3">
                      Chat with AI
                    </Button>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">No new insights from AI.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* --- Modals & Widgets --- */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateProjectModal
            isOpen={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            onSuccess={handleProjectCreated}
          />
        )}
        {showUploadModal && (
          <UploadDocumentModal
            isOpen={showUploadModal}
            onClose={() => setShowUploadModal(false)}
            onSuccess={() => fetchDocuments()} // Refresh documents after upload
          />
        )}
        {showWelcomeModal && userProfile && (
          <WelcomeModal
            isOpen={showWelcomeModal}
            onClose={() => setShowWelcomeModal(false)}
            user={userProfile}
            onTaskSelect={handleWelcomeTaskSelect}
          />
        )}
      </AnimatePresence>
      <ChatWidget />
    </ErrorBoundary>
  );
};

export default Dashboard;
