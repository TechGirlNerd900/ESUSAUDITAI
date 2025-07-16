'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion'; //  }, [supabase.auth, router]);
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

import ErrorBoundary from '../components/ErrorBoundary';
import CreateProjectModal from '../components/CreateProjectModal';
import WelcomeModal from '../components/WelcomeModal';
import ChatWidget from '../components/ChatWidget';
import SkeletonLoader from '../components/SkeletonLoader';

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

const Tooltip = ({ text, children }: { text: string; children: React.ReactNode }) => (
  <div className="relative group">
    {children}
    <div className="absolute bottom-full mb-2 w-max bg-gray-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
      {text}
    </div>
  </div>
);

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
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center p-8 bg-white rounded-lg shadow-md">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h3 className="text-lg font-medium text-red-900 mb-2">Unable to Load Dashboard</h3>
          <p className="text-sm text-red-700 mb-4">{error.message}</p>
          <button onClick={() => window.location.reload()} className="btn-primary">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-gray-50 font-sans">
        {/* Sidebar */}
        <aside className="w-64 bg-white shadow-md flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-800">Esus Audit AI</h1>
          </div>
          <nav className="flex-grow p-4 space-y-2">
            <Tooltip text="Dashboard Overview">
              <Link
                href="/dashboard"
                className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg"
              >
                <LayoutDashboard className="mr-3 h-5 w-5" />
                Dashboard
              </Link>
            </Tooltip>
            <Tooltip text="Manage Projects">
              <Link
                href="/projects"
                className="flex items-center px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <Briefcase className="mr-3 h-5 w-5" />
                Projects
              </Link>
            </Tooltip>
            {userProfile?.role === 'admin' && (
              <Tooltip text="User Management">
                <Link
                  href="/admin"
                  className="flex items-center px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  <Users className="mr-3 h-5 w-5" />
                  Admin
                </Link>
              </Tooltip>
            )}
            <Tooltip text="Application Settings">
              <Link
                href="/settings"
                className="flex items-center px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <Settings className="mr-3 h-5 w-5" />
                Settings
              </Link>
            </Tooltip>
          </nav>
          <div className="p-4 border-t border-gray-200">
            <button className="w-full btn-secondary text-sm">Help & Support</button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          {/* Header */}
          <header className="bg-white shadow-sm sticky top-0 z-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                <div className="flex items-center">
                  <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
                </div>
                <div className="flex items-center space-x-4">
                  <Tooltip text="Create New Project">
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="btn-primary flex items-center"
                    >
                      <PlusCircle className="h-5 w-5 mr-2" />
                      New Project
                    </button>
                  </Tooltip>
                  <Tooltip text="Notifications">
                    <button className="p-2 rounded-full hover:bg-gray-100">
                      <Bell className="h-6 w-6 text-gray-600" />
                    </button>
                  </Tooltip>
                  <div className="relative">
                    <button className="flex items-center space-x-2">
                      <Image
                        className="h-8 w-8 rounded-full"
                        // Use a local placeholder if userProfile is not loaded yet
                        src={
                          userProfile?.email
                            ? `https://i.pravatar.cc/150?u=${userProfile.email}`
                            : '/avatar-placeholder.svg'
                        }
                        alt="User avatar"
                        width={32}
                        height={32}
                        // Optionally, add unoptimized if you want to bypass next/image optimization for remote images
                        unoptimized={!!userProfile?.email}
                      />
                      <span className="text-sm font-medium text-gray-700 hidden md:block">
                        {userProfile?.first_name} {userProfile?.last_name}
                      </span>
                      <ChevronDown className="h-4 w-4 text-gray-500" />
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
                        <SkeletonLoader key={i} className="h-24" />
                      ))}
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-2">
                        <SkeletonLoader className="h-80" />
                      </div>
                      <div>
                        <SkeletonLoader className="h-80" />
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
                          <div className="bg-white p-5 rounded-lg shadow hover:shadow-lg transition-shadow duration-300">
                            <div className="flex items-center">
                              <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                                <stat.icon className="h-6 w-6" />
                              </div>
                              <div className="ml-4">
                                <p className="text-sm font-medium text-gray-500 truncate">
                                  {stat.name}
                                </p>
                                <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
                              </div>
                            </div>
                            <p
                              className={clsx(
                                'text-xs mt-2 flex items-center',
                                stat.trend.startsWith('+') ? 'text-green-600' : 'text-red-600'
                              )}
                            >
                              <TrendingUp
                                className={clsx(
                                  'h-4 w-4 mr-1',
                                  !stat.trend.startsWith('+') && 'transform rotate-180'
                                )}
                              />
                              {stat.trend} vs last month
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    {/* Main Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Recent Projects */}
                      <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow">
                        <h3 className="font-semibold text-lg mb-4 flex items-center">
                          <Briefcase className="mr-2 h-5 w-5" />
                          Recent Projects
                        </h3>
                        <div className="space-y-4">
                          {projects.slice(0, 5).map((p) => (
                            <Link key={p.id} href={`/projects/${p.id}`}>
                              <motion.div
                                whileHover={{ scale: 1.02 }}
                                className="p-4 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center justify-between"
                              >
                                <div>
                                  <p className="font-semibold text-gray-800">{p.name}</p>
                                  <p className="text-sm text-gray-500">{p.client_name}</p>
                                </div>
                                <div className="flex items-center space-x-4">
                                  <span
                                    className={clsx('px-2 py-1 text-xs font-medium rounded-full', {
                                      'bg-green-100 text-green-800': p.status === 'active',
                                      'bg-blue-100 text-blue-800': p.status === 'completed',
                                      'bg-gray-100 text-gray-800':
                                        p.status === 'on_hold' || p.status === 'cancelled',
                                    })}
                                  >
                                    {p.status}
                                  </span>
                                  <p className="text-sm text-gray-400">
                                    {new Date(p.created_at).toLocaleDateString()}
                                  </p>
                                </div>
                              </motion.div>
                            </Link>
                          ))}
                        </div>
                      </div>

                      {/* News & Activity */}
                      <div className="space-y-6">
                        <div className="bg-white p-6 rounded-lg shadow">
                          <h3 className="font-semibold text-lg mb-4 flex items-center">
                            <FileText className="mr-2 h-5 w-5" />
                            Financial News
                          </h3>
                          {newsLoading ? (
                            <div className="space-y-3">
                              {Array.from({ length: 3 }).map((_, i) => (
                                <SkeletonLoader key={i} className="h-16" />
                              ))}
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {news.slice(0, 3).map((article, index) => (
                                <div
                                  key={index}
                                  className="border-b border-gray-200 pb-3 last:border-b-0"
                                >
                                  <h4 className="font-medium text-sm text-gray-800 mb-1">
                                    {article.title}
                                  </h4>
                                  <p className="text-xs text-gray-600 mb-2">
                                    {article.description}
                                  </p>
                                  <p className="text-xs text-gray-400">
                                    {new Date(article.published_at).toLocaleDateString()}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="bg-white p-6 rounded-lg shadow">
                          <h3 className="font-semibold text-lg mb-4 flex items-center">
                            <Activity className="mr-2 h-5 w-5" />
                            Recent Activity
                          </h3>
                          <div className="space-y-3">
                            <div className="flex items-center text-sm">
                              <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                              <span className="text-gray-600">
                                Project &quot;Q3 Financial Review&quot; was created
                              </span>
                            </div>
                            <div className="flex items-center text-sm">
                              <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                              <span className="text-gray-600">
                                Audit findings uploaded for &quot;ABC Corp Review&quot;
                              </span>
                            </div>
                            <div className="flex items-center text-sm">
                              <div className="w-2 h-2 bg-yellow-500 rounded-full mr-3"></div>
                              <span className="text-gray-600">
                                Review deadline approaching for &quot;XYZ Analysis&quot;
                              </span>
                            </div>
                          </div>
                        </div>
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
