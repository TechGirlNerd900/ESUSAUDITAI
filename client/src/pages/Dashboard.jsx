import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  FolderIcon,
  DocumentTextIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  SparklesIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { projectsService } from '../services/api';
import { isDemoMode, demoService, demoData } from '../services/demoData';
import LoadingSpinner from '../components/LoadingSpinner';
import CreateProjectModal from '../components/CreateProjectModal';
import ErrorBoundary from '../components/ErrorBoundary';

const Dashboard = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statsVisible, setStatsVisible] = useState(false);
  const [projectsVisible, setProjectsVisible] = useState(false);

  useEffect(() => {
    const timer1 = setTimeout(() => setStatsVisible(true), 300);
    const timer2 = setTimeout(() => setProjectsVisible(true), 600);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  // Use demo data if in demo mode, otherwise use real API
  const { data: projectsData, isLoading, error, refetch } = useQuery(
    'projects',
    isDemoMode()
      ? () => demoService.getDemoData('projects')
      : projectsService.getProjects,
    {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      onError: (error) => {
        console.error('Failed to load projects:', error);
        if (!isDemoMode()) {
          toast.error(error.error || 'Failed to load projects');
        }
      }
    }
  );

  const projects = isDemoMode() ? projectsData || [] : projectsData?.projects || [];

  const stats = [
    {
      name: 'Total Projects',
      value: projects.length,
      icon: FolderIcon,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-gradient-to-br from-blue-50 to-blue-100',
      change: '+12%',
      trend: 'up'
    },
    {
      name: 'Active Projects',
      value: projects.filter(p => p.status === 'active').length,
      icon: DocumentTextIcon,
      color: 'from-green-500 to-emerald-600',
      bgColor: 'bg-gradient-to-br from-green-50 to-emerald-100',
      change: '+8%',
      trend: 'up'
    },
    {
      name: 'Completed Projects',
      value: projects.filter(p => p.status === 'completed').length,
      icon: ChartBarIcon,
      color: 'from-purple-500 to-indigo-600',
      bgColor: 'bg-gradient-to-br from-purple-50 to-indigo-100',
      change: '+25%',
      trend: 'up'
    },
    {
      name: 'Issues Found',
      value: '12',
      icon: ExclamationTriangleIcon,
      color: 'from-red-500 to-red-600',
      bgColor: 'bg-gradient-to-br from-red-50 to-red-100',
      change: '-15%',
      trend: 'down'
    }
  ];

  // Error state
  if (error && !isDemoMode()) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-md mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <ExclamationCircleIcon className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-medium text-red-900 mb-2">
              Unable to Load Dashboard
            </h3>
            <p className="text-sm text-red-700 mb-4">
              {error.error || 'Failed to load projects. Please check your connection and try again.'}
            </p>
            <button
              onClick={() => refetch()}
              className="btn-primary"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
          <span className="ml-3 text-gray-600">
            {isDemoMode() ? 'Loading demo data...' : 'Loading projects...'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        {/* Demo Mode Banner */}
        {isDemoMode() && (
          <div className="mb-6 glass-card rounded-xl p-4 border border-blue-200/20 animate-fade-in-up">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
                  <SparklesIcon className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-semibold text-blue-900">Demo Mode Active</h4>
                <p className="text-sm text-blue-700">
                  You're viewing demo data. Configure Azure services to use real data.
                </p>
              </div>
            </div>
          </div>
        )}
      {/* Header */}
      <div className="sm:flex sm:items-center animate-fade-in-up">
        <div className="sm:flex-auto">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
            Dashboard
          </h1>
          <p className="mt-2 text-lg text-gray-600">
            Overview of your audit projects and recent activity
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="btn-primary group hover-lift"
          >
            <PlusIcon className="h-4 w-4 mr-2 group-hover:rotate-90 transition-transform duration-200" />
            New Project
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className={`mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 transition-all duration-700 ${statsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        {stats.map((stat, index) => (
          <div 
            key={stat.name} 
            className={`card-gradient hover-lift interactive-card stagger-item animate-fade-in-up`}
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color} shadow-soft`}>
                      <stat.icon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div className="ml-4">
                    <dt className="text-sm font-medium text-gray-600 truncate">
                      {stat.name}
                    </dt>
                    <dd className="text-2xl font-bold text-gray-900">
                      {stat.value}
                    </dd>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`flex items-center text-sm font-medium ${
                    stat.trend === 'up' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {stat.trend === 'up' ? (
                      <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-3 3" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4 mr-1 transform rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-3 3" />
                      </svg>
                    )}
                    {stat.change}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">vs last month</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Projects */}
      <div className={`mt-12 transition-all duration-700 ${projectsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <div className="sm:flex sm:items-center mb-6">
          <div className="sm:flex-auto">
            <h2 className="text-2xl font-semibold text-gray-900 flex items-center">
              <ClockIcon className="h-6 w-6 mr-2 text-gray-500" />
              Recent Projects
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Your latest audit projects and their current status
            </p>
          </div>
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
            <Link 
              to="/projects" 
              className="inline-flex items-center text-sm font-medium text-primary-600 hover:text-primary-500 transition-colors duration-200 group"
            >
              View all projects 
              <svg className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {projects.slice(0, 6).map((project, index) => (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className={`card-gradient hover-lift interactive-card group stagger-item animate-fade-in-up`}
              style={{ animationDelay: `${index * 0.1 + 0.3}s` }}
            >
              <div className="card-body">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center">
                    <div className={`status-dot mr-2 ${
                      project.status === 'active' ? 'status-dot-green' :
                      project.status === 'completed' ? 'bg-blue-400' :
                      'status-dot-gray'
                    }`}></div>
                    <h3 className="text-lg font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors duration-200">
                      {project.name}
                    </h3>
                  </div>
                  <span className={`badge ${
                    project.status === 'active' ? 'badge-success' :
                    project.status === 'completed' ? 'badge-primary' :
                    'badge-gray'
                  }`}>
                    {project.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-2">
                  Client: <span className="font-medium">{project.clientName}</span>
                </p>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Created {new Date(project.createdAt).toLocaleDateString()}</span>
                  <span className="inline-flex items-center text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    View details →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {projects.length === 0 && (
          <div className="text-center py-16 animate-fade-in-up">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full mb-6 animate-float">
              <FolderIcon className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No projects yet</h3>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              Get started by creating your first audit project. Our AI-powered analysis will help you identify compliance issues and generate detailed reports.
            </p>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="btn-primary group hover-lift"
            >
              <PlusIcon className="h-5 w-5 mr-2 group-hover:rotate-90 transition-transform duration-200" />
              Create Your First Project
            </button>
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      <CreateProjectModal
        open={showCreateModal}
        setOpen={setShowCreateModal}
        onSuccess={() => {
          refetch();
          setShowCreateModal(false);
        }}
      />
      </div>
    </ErrorBoundary>
  );
};

export default Dashboard;
