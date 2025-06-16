'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorBoundary from '../components/ErrorBoundary';

const Dashboard = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statsVisible, setStatsVisible] = useState(false);
  const [projectsVisible, setProjectsVisible] = useState(false);
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const timer1 = setTimeout(() => setStatsVisible(true), 300);
    const timer2 = setTimeout(() => setProjectsVisible(true), 600);
    loadProjects();
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  const loadProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      if (!response.ok) {
        throw new Error('Failed to load projects');
      }
      const data = await response.json();
      setProjects(data.projects || []);
    } catch (error) {
      console.error('Failed to load projects:', error);
      setError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const stats = [
    {
      name: 'Total Projects',
      value: projects.length,
      icon: (props) => (
        <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
        </svg>
      ),
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-gradient-to-br from-blue-50 to-blue-100',
      change: '+12%',
      trend: 'up'
    },
    {
      name: 'Active Projects',
      value: projects.filter(p => p.status === 'active').length,
      icon: (props) => (
        <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      ),
      color: 'from-green-500 to-emerald-600',
      bgColor: 'bg-gradient-to-br from-green-50 to-emerald-100',
      change: '+8%',
      trend: 'up'
    },
    {
      name: 'Completed Projects',
      value: projects.filter(p => p.status === 'completed').length,
      icon: (props) => (
        <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      ),
      color: 'from-purple-500 to-indigo-600',
      bgColor: 'bg-gradient-to-br from-purple-50 to-indigo-100',
      change: '+25%',
      trend: 'up'
    },
    {
      name: 'Issues Found',
      value: '12',
      icon: (props) => (
        <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      ),
      color: 'from-red-500 to-red-600',
      bgColor: 'bg-gradient-to-br from-red-50 to-red-100',
      change: '-15%',
      trend: 'down'
    }
  ];

  // Error state
  if (error) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-md mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <svg className="mx-auto h-12 w-12 text-red-500 mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <h3 className="text-lg font-medium text-red-900 mb-2">
              Unable to Load Dashboard
            </h3>
            <p className="text-sm text-red-700 mb-4">
              {error.message || 'Failed to load projects. Please check your connection and try again.'}
            </p>
            <button
              onClick={() => loadProjects()}
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
          <span className="ml-3 text-gray-600">Loading projects...</span>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="px-4 sm:px-6 lg:px-8 py-8">
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
              className="btn-primary group hover:shadow-lg transition-all duration-200 hover:scale-105"
            >
              <svg className="h-4 w-4 mr-2 group-hover:rotate-90 transition-transform duration-200" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New Project
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className={clsx(
          'mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 transition-all duration-700',
          statsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        )}>
          {stats.map((stat, index) => (
            <div 
              key={stat.name} 
              className="card-gradient hover:shadow-lg cursor-pointer transform transition-all duration-200 hover:scale-[1.02] stagger-item animate-fade-in-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className={clsx('p-3 rounded-xl bg-gradient-to-br shadow-sm', stat.color)}>
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
                    <div className={clsx(
                      'flex items-center text-sm font-medium',
                      stat.trend === 'up' ? 'text-green-600' : 'text-red-600'
                    )}>
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
        <div className={clsx(
          'mt-12 transition-all duration-700',
          projectsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        )}>
          <div className="sm:flex sm:items-center mb-6">
            <div className="sm:flex-auto">
              <h2 className="text-2xl font-semibold text-gray-900 flex items-center">
                <svg className="h-6 w-6 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Recent Projects
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Your latest audit projects and their current status
              </p>
            </div>
            <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
              <Link 
                href="/projects" 
                className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500 transition-colors duration-200 group"
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
                href={`/projects/${project.id}`}
                className="card-gradient hover:shadow-lg cursor-pointer transform transition-all duration-200 hover:scale-[1.02] group stagger-item animate-fade-in-up"
                style={{ animationDelay: `${index * 0.1 + 0.3}s` }}
              >
                <div className="card-body">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center">
                      <div className={clsx(
                        'status-dot mr-2',
                        project.status === 'active' ? 'status-dot-green' :
                        project.status === 'completed' ? 'bg-blue-400' :
                        'status-dot-gray'
                      )}></div>
                      <h3 className="text-lg font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors duration-200">
                        {project.name}
                      </h3>
                    </div>
                    <span className={clsx(
                      'badge',
                      project.status === 'active' ? 'badge-success' :
                      project.status === 'completed' ? 'badge-primary' :
                      'badge-gray'
                    )}>
                      {project.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    Client: <span className="font-medium">{project.client_name}</span>
                  </p>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Created {new Date(project.created_at).toLocaleDateString()}</span>
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
                <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No projects yet</h3>
              <p className="text-gray-500 mb-8 max-w-md mx-auto">
                Get started by creating your first audit project. Our AI-powered analysis will help you identify compliance issues and generate detailed reports.
              </p>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="btn-primary group hover:shadow-lg transition-all duration-200 hover:scale-105"
              >
                <svg className="h-5 w-5 mr-2 group-hover:rotate-90 transition-transform duration-200" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Create Your First Project
              </button>
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default Dashboard;