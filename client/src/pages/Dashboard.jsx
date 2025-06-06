import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  FolderIcon,
  DocumentTextIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';
import { projectsService } from '../services/api';
import { isDemoMode, demoService, demoData } from '../services/demoData';
import LoadingSpinner from '../components/LoadingSpinner';
import CreateProjectModal from '../components/CreateProjectModal';
import ErrorBoundary from '../components/ErrorBoundary';

const Dashboard = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);

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
      color: 'bg-blue-500'
    },
    {
      name: 'Active Projects',
      value: projects.filter(p => p.status === 'active').length,
      icon: DocumentTextIcon,
      color: 'bg-green-500'
    },
    {
      name: 'Completed Projects',
      value: projects.filter(p => p.status === 'completed').length,
      icon: ChartBarIcon,
      color: 'bg-purple-500'
    },
    {
      name: 'Issues Found',
      value: '12', // This would come from analysis results
      icon: ExclamationTriangleIcon,
      color: 'bg-red-500'
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
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <ExclamationCircleIcon className="h-5 w-5 text-blue-500 mr-2" />
              <div>
                <h4 className="text-sm font-medium text-blue-900">Demo Mode</h4>
                <p className="text-sm text-blue-700">
                  You're viewing demo data. Configure Azure services to use real data.
                </p>
              </div>
            </div>
          </div>
        )}
      {/* Header */}
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-sm text-gray-700">
            Overview of your audit projects and recent activity
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            New Project
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.name} className="card">
            <div className="card-body">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className={`p-3 rounded-md ${stat.color}`}>
                    <stat.icon className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {stat.name}
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stat.value}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Projects */}
      <div className="mt-8">
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h2 className="text-lg font-medium text-gray-900">Recent Projects</h2>
          </div>
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
            <Link to="/projects" className="text-sm text-primary-600 hover:text-primary-500">
              View all projects →
            </Link>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.slice(0, 6).map((project) => (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className="card hover:shadow-md transition-shadow duration-200"
            >
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-900 truncate">
                    {project.name}
                  </h3>
                  <span className={`badge ${
                    project.status === 'active' ? 'badge-success' :
                    project.status === 'completed' ? 'badge-primary' :
                    'badge-gray'
                  }`}>
                    {project.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-500 truncate">
                  {project.clientName}
                </p>
                <p className="mt-2 text-xs text-gray-400">
                  Created {new Date(project.createdAt).toLocaleDateString()}
                </p>
              </div>
            </Link>
          ))}
        </div>

        {projects.length === 0 && (
          <div className="text-center py-12">
            <FolderIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No projects</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by creating a new audit project.
            </p>
            <div className="mt-6">
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="btn-primary"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                New Project
              </button>
            </div>
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
