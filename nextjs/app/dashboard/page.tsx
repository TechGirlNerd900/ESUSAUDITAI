'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Settings,
  Bell,
  PlusCircle,
  ChevronDown,
  FileText,
  Activity,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';

import ErrorBoundary from '../components/ErrorBoundary';
import CreateProjectModal from '../components/CreateProjectModal';
import WelcomeModal from '../components/WelcomeModal';
import ChatWidget from '../components/ChatWidget';

interface Project {
  id: string;
  name: string;
  description?: string;
  client_name: string;
  status: 'active' | 'completed' | 'on_hold' | 'cancelled';
  created_by: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
  tags?: string[];
  custom_fields?: Record<string, any>;
}

interface UserProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'auditor' | 'reviewer';
  organization_id: string;
}

interface NewsArticle {
  title: string;
  description: string;
  published_at: string;
  url: string;
}

const Dashboard: React.FC = () => {
  const router = useRouter();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [userRes, projectsRes] = await Promise.all([
          fetch('/api/auth/profile'),
          fetch('/api/projects'),
        ]);

        if (userRes.ok) {
          const userData = await userRes.json();
          setUserProfile(userData.profile);
          const hasSeenWelcome = localStorage.getItem(`welcome_seen_${userData.profile.id}`);
          if (!hasSeenWelcome) {
            setShowWelcomeModal(true);
          }
        }

        if (projectsRes.ok) {
          const projectsData = await projectsRes.json();
          setProjects(projectsData.projects || []);
        } else {
          const errorData = await projectsRes.json();
          throw new Error(errorData.error || 'Failed to load projects');
        }

        loadNews();
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const loadNews = async () => {
    setNewsLoading(true);
    try {
      const response = await fetch('/api/news');
      if (response.ok) {
        const data = await response.json();
        setNews(data.articles || []);
      }
    } catch (err) {
      console.error('Failed to load news:', err);
    } finally {
      setNewsLoading(false);
    }
  };

  const handleProjectCreated = (newProject: Project) => {
    setProjects((prev) => [newProject, ...prev]);
  };

  const handleWelcomeTaskSelect = (taskId: string) => {
    if (userProfile) {
      localStorage.setItem(`welcome_seen_${userProfile.id}`, 'true');
    }
    setShowWelcomeModal(false);
    // Navigation logic based on taskId
    switch (taskId) {
      case 'create_project':
        setShowCreateModal(true);
        break;
      case 'view_projects':
        router.push('/projects');
        break;
      case 'settings':
        router.push('/settings');
        break;
      default:
        break;
    }
  };

  const stats = [
    { name: 'Total Projects', value: projects.length, icon: Briefcase, trend: '+12%' },
    {
      name: 'Active Projects',
      value: projects.filter((p) => p.status === 'active').length,
      icon: Activity,
      trend: '+8%',
    },
    {
      name: 'Completed',
      value: projects.filter((p) => p.status === 'completed').length,
      icon: CheckCircle2,
      trend: '+25%',
    },
    { name: 'Issues Found', value: 12, icon: AlertTriangle, trend: '-15%' },
  ];

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Card className="w-full max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="text-destructive">Unable to Load Dashboard</CardTitle>
            <CardDescription>{error.message}</CardDescription>
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

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-background font-sans">
        {/* Sidebar */}
        <aside className="w-64 bg-card shadow-md flex flex-col">
          <div className="p-4 border-b">
            <h1 className="text-2xl font-bold text-foreground">Esus Audit AI</h1>
          </div>
          <nav className="flex-grow p-4 space-y-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/dashboard"
                    className="flex items-center px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg"
                  >
                    <LayoutDashboard className="mr-3 h-5 w-5" />
                    Dashboard
                  </Link>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Dashboard Overview</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/projects"
                    className="flex items-center px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent rounded-lg"
                  >
                    <Briefcase className="mr-3 h-5 w-5" />
                    Projects
                  </Link>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Manage Projects</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {userProfile?.role === 'admin' && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href="/admin"
                      className="flex items-center px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent rounded-lg"
                    >
                      <Users className="mr-3 h-5 w-5" />
                      Admin
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>User Management</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/settings"
                    className="flex items-center px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent rounded-lg"
                  >
                    <Settings className="mr-3 h-5 w-5" />
                    Settings
                  </Link>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Application Settings</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </nav>
          <div className="p-4 border-t">
            <Button variant="secondary" className="w-full">
              Help & Support
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          {/* Header */}
          <header className="bg-card shadow-sm sticky top-0 z-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                <div className="flex items-center">
                  <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
                </div>
                <div className="flex items-center space-x-4">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button onClick={() => setShowCreateModal(true)}>
                          <PlusCircle className="h-5 w-5 mr-2" />
                          New Project
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Create New Project</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Bell className="h-6 w-6" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Notifications</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <div className="relative">
                    <button className="flex items-center space-x-2">
                      <Avatar>
                        <AvatarImage
                          src={
                            userProfile?.email
                              ? `https://i.pravatar.cc/150?u=${userProfile.email}`
                              : '/avatar-placeholder.svg'
                          }
                        />
                        <AvatarFallback>
                          {userProfile?.first_name?.[0]}
                          {userProfile?.last_name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium text-foreground hidden md:block">
                        {userProfile?.first_name} {userProfile?.last_name}
                      </span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <AnimatePresence>
                {isLoading ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-24" />
                      ))}
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-2">
                        <Skeleton className="h-80" />
                      </div>
                      <div>
                        <Skeleton className="h-80" />
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                  >
                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                      {stats.map((stat, i) => (
                        <motion.div
                          key={stat.name}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.1 }}
                        >
                          <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                              <CardTitle className="text-sm font-medium">{stat.name}</CardTitle>
                              <stat.icon className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                              <div className="text-2xl font-bold">{stat.value}</div>
                              <p className="text-xs text-muted-foreground">
                                {stat.trend} vs last month
                              </p>
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                    </div>

                    {/* Main Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Recent Projects */}
                      <Card className="lg:col-span-2">
                        <CardHeader>
                          <CardTitle className="flex items-center">
                            <Briefcase className="mr-2 h-5 w-5" />
                            Recent Projects
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {projects.slice(0, 5).map((p) => (
                              <Link key={p.id} href={`/projects/${p.id}`}>
                                <motion.div
                                  whileHover={{ scale: 1.02 }}
                                  className="p-4 rounded-lg border hover:bg-accent flex items-center justify-between"
                                >
                                  <div>
                                    <p className="font-semibold text-foreground">{p.name}</p>
                                    <p className="text-sm text-muted-foreground">{p.client_name}</p>
                                  </div>
                                  <div className="flex items-center space-x-4">
                                    <span
                                      className={`px-2 py-1 text-xs font-medium rounded-full bg-secondary text-secondary-foreground`}
                                    >
                                      {p.status}
                                    </span>
                                    <p className="text-sm text-muted-foreground">
                                      {new Date(p.created_at).toLocaleDateString()}
                                    </p>
                                  </div>
                                </motion.div>
                              </Link>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      {/* News & Activity */}
                      <div className="space-y-6">
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center">
                              <FileText className="mr-2 h-5 w-5" />
                              Financial News
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            {newsLoading ? (
                              <div className="space-y-3">
                                {Array.from({ length: 3 }).map((_, i) => (
                                  <Skeleton key={i} className="h-16" />
                                ))}
                              </div>
                            ) : (
                              <div className="space-y-4">
                                {news.slice(0, 3).map((article, index) => (
                                  <div key={index} className="border-b pb-3 last:border-b-0">
                                    <h4 className="font-medium text-sm text-foreground mb-1">
                                      {article.title}
                                    </h4>
                                    <p className="text-xs text-muted-foreground mb-2">
                                      {article.description}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {new Date(article.published_at).toLocaleDateString()}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center">
                              <Activity className="mr-2 h-5 w-5" />
                              Recent Activity
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              <div className="flex items-center text-sm">
                                <div className="w-2 h-2 bg-primary rounded-full mr-3"></div>
                                <span className="text-muted-foreground">
                                  Project &quot;Q3 Financial Review&quot; was created
                                </span>
                              </div>
                              <div className="flex items-center text-sm">
                                <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                                <span className="text-muted-foreground">
                                  Audit findings uploaded for &quot;ABC Corp Review&quot;
                                </span>
                              </div>
                              <div className="flex items-center text-sm">
                                <div className="w-2 h-2 bg-yellow-500 rounded-full mr-3"></div>
                                <span className="text-muted-foreground">
                                  Review deadline approaching for &quot;XYZ Analysis&quot;
                                </span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </main>

        {/* Modals & Widgets */}
        <AnimatePresence>
          {showCreateModal && (
            <CreateProjectModal
              isOpen={showCreateModal}
              onClose={() => setShowCreateModal(false)}
              onSuccess={handleProjectCreated}
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
      </div>
    </ErrorBoundary>
  );
};

export default Dashboard;
