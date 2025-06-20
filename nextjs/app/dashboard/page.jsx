'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorBoundary from '../components/ErrorBoundary';
import CreateProjectModal from '../components/CreateProjectModal';
import WelcomeModal from '../components/WelcomeModal';
import ChatWidget from '../components/ChatWidget';

const Dashboard = () => {
  const router = useRouter();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [statsVisible, setStatsVisible] = useState(false);
  const [projectsVisible, setProjectsVisible] = useState(false);
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [news, setNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [tagFilter, setTagFilter] = useState('')
  const [customFieldFilter, setCustomFieldFilter] = useState('')

  useEffect(() => {
    // Initialize user profile and check if first visit
    initializeUser();
    
    // Show UI elements with staggered animations
    const timer1 = setTimeout(() => setStatsVisible(true), 300);
    const timer2 = setTimeout(() => setProjectsVisible(true), 600);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  const initializeUser = async () => {
    try {
      // Get user profile to determine role and show welcome if needed
      const response = await fetch('/api/auth/profile');
      if (response.ok) {
        const profileData = await response.json();
        setUserProfile(profileData.profile);
        
        // Check if this is user's first visit (you could store this in localStorage or database)
        const hasSeenWelcome = localStorage.getItem(`welcome_seen_${profileData.profile.id}`);
        if (!hasSeenWelcome) {
          setShowWelcomeModal(true);
        }
      }
    } catch (error) {
      console.error('Failed to load user profile:', error);
    }
  };

  const loadProjects = async () => {
    if (isLoading) return; // Prevent duplicate calls
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/projects');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load projects');
      }
      const data = await response.json();
      setProjects(data.projects || []);
    } catch (error) {
      console.error('Failed to load projects:', error);
      setError(error);
    } finally {
      setIsLoading(false);
      setInitialLoad(false);
    }
  };

  const loadNews = async () => {
    if (newsLoading) return;
    
    // Check cache first - only fetch if data is older than 1 hour
    const cachedNews = localStorage.getItem('financial_news');
    const cacheTimestamp = localStorage.getItem('financial_news_timestamp');
    const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds
    
    if (cachedNews && cacheTimestamp && 
        (Date.now() - parseInt(cacheTimestamp)) < oneHour) {
      setNews(JSON.parse(cachedNews));
      return;
    }
    
    setNewsLoading(true);
    
    try {
      // Add delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const params = {
        api_token: 'kxhBSKgscIZZsZsYFQ3IiOoRxD0l692bTIK4CQ6h',
        categories: 'business',
        search: 'finance,sec,regulation',
        limit: '3' // Reduced to minimize API usage
      };

      const esc = encodeURIComponent;
      const query = Object.keys(params)
        .map(k => esc(k) + '=' + esc(params[k]))
        .join('&');

      const response = await fetch(`https://api.thenewsapi.com/v1/news/all?${query}`);
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }
      
      const data = await response.json();
      const newsData = data.data || [];
      
      // Cache the results
      localStorage.setItem('financial_news', JSON.stringify(newsData));
      localStorage.setItem('financial_news_timestamp', Date.now().toString());
      
      setNews(newsData);
    } catch (error) {
      console.error('Failed to load news:', error);
      // Fallback to cached data if available, otherwise use defaults
      const fallbackNews = cachedNews ? JSON.parse(cachedNews) : [
        {
          title: "SEC Updates Financial Reporting Guidelines",
          description: "New compliance requirements for public companies",
          published_at: new Date().toISOString(),
          url: "#"
        },
        {
          title: "ESG Reporting Standards Enhanced",
          description: "Environmental and governance disclosure updates",
          published_at: new Date().toISOString(),
          url: "#"
        },
        {
          title: "Financial Technology Trends 2024",
          description: "AI and automation in financial services",
          published_at: new Date().toISOString(),
          url: "#"
        }
      ];
      setNews(fallbackNews);
    } finally {
      setNewsLoading(false);
    }
  };

  const handleProjectCreated = (newProject) => {
    // Add the new project to the existing projects list
    setProjects(prevProjects => [newProject, ...prevProjects]);
  };

  const handleWelcomeTaskSelect = (taskId) => {
    // Mark welcome as seen
    if (userProfile) {
      localStorage.setItem(`welcome_seen_${userProfile.id}`, 'true');
    }

    // Handle different task selections
    switch (taskId) {
      case 'create-project':
        setShowCreateModal(true);
        break;
      case 'upload-documents':
        // Load projects first, then user can select which project to upload to
        loadProjectsData();
        break;
      case 'review-projects':
      case 'review-assigned':
        router.push('/projects');
        break;
      case 'manage-users':
        router.push('/admin');
        break;
      case 'chat':
        // Chat widget will handle this
        break;
      case 'view-analysis':
        loadProjectsData();
        break;
      case 'generate-reports':
        loadProjectsData();
        break;
      case 'system-analytics':
        router.push('/admin');
        break;
      default:
        loadProjectsData();
    }
  };

  const loadProjectsData = () => {
    if (!dataLoaded) {
      loadProjects();
      loadNews();
      setDataLoaded(true);
    }
  };

  const stats = [
    {
      name: 'Total Projects',
      value: dataLoaded ? projects.length : '—',
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
      value: dataLoaded ? projects.filter(p => p.status === 'active').length : '—',
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
      value: dataLoaded ? projects.filter(p => p.status === 'completed').length : '—',
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

  const filteredProjects = projects.filter(project => {
    const tagMatch = tagFilter ? (project.tags || []).includes(tagFilter) : true
    const customFieldMatch = customFieldFilter
      ? Object.values(project.custom_fields || {}).some(val =>
          String(val).toLowerCase().includes(customFieldFilter.toLowerCase())
        )
      : true
    return tagMatch && customFieldMatch
  })

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

  // Only show loading spinner after initial UI is displayed
  const showLoadingOverlay = isLoading && !initialLoad;

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

          <div className="flex gap-4 mb-4">
            <input
              type="text"
              placeholder="Filter by tag"
              value={tagFilter}
              onChange={e => setTagFilter(e.target.value)}
              className="input input-modern"
            />
            <input
              type="text"
              placeholder="Filter by custom field value"
              value={customFieldFilter}
              onChange={e => setCustomFieldFilter(e.target.value)}
              className="input input-modern"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.slice(0, 6).map((project, index) => (
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

          {/* Interactive Dashboard - Always Show */}
          <div className="space-y-8">
            {/* Quick Actions Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Create Project */}
              <button 
                onClick={() => setShowCreateModal(true)}
                className="card-gradient hover:shadow-lg cursor-pointer transform transition-all duration-200 hover:scale-[1.02] group"
              >
                <div className="card-body text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl mb-4 group-hover:scale-110 transition-transform duration-200">
                    <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">New Project</h3>
                  <p className="text-xs text-gray-600">Start a new audit engagement</p>
                </div>
              </button>

              {/* View Projects */}
              <button 
                onClick={() => { loadProjectsData(); router.push('/projects'); }}
                className="card-gradient hover:shadow-lg cursor-pointer transform transition-all duration-200 hover:scale-[1.02] group"
              >
                <div className="card-body text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl mb-4 group-hover:scale-110 transition-transform duration-200">
                    <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">View Projects</h3>
                  <p className="text-xs text-gray-600">Access your audit projects</p>
                </div>
              </button>

              {/* Upload Documents */}
              <button 
                onClick={() => loadProjectsData()}
                className="card-gradient hover:shadow-lg cursor-pointer transform transition-all duration-200 hover:scale-[1.02] group"
              >
                <div className="card-body text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl mb-4 group-hover:scale-110 transition-transform duration-200">
                    <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">Upload Files</h3>
                  <p className="text-xs text-gray-600">Add documents for AI analysis</p>
                </div>
              </button>

              {/* Refresh News */}
              <button 
                onClick={loadNews}
                className="card-gradient hover:shadow-lg cursor-pointer transform transition-all duration-200 hover:scale-[1.02] group"
              >
                <div className="card-body text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl mb-4 group-hover:scale-110 transition-transform duration-200">
                    {newsLoading ? (
                      <LoadingSpinner size="sm" variant="white" />
                    ) : (
                      <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h6.75" />
                      </svg>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">Market News</h3>
                  <p className="text-xs text-gray-600">Refresh financial updates</p>
                </div>
              </button>
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Projects Section */}
              <div className="lg:col-span-2">
                {/* Loading state */}
                {isLoading && (
                  <div className="flex items-center justify-center py-8">
                    <LoadingSpinner size="md" />
                    <span className="ml-3 text-gray-600">Loading projects...</span>
                  </div>
                )}

                {/* Welcome message when no data loaded */}
                {!dataLoaded && !isLoading && (
                  <div className="card-gradient">
                    <div className="card-body text-center py-12">
                      <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full mb-6">
                        <svg className="h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        Welcome to your AI-powered audit dashboard!
                      </h3>
                      <p className="text-gray-600 mb-6">
                        Choose an action above to get started, or click below to see your projects.
                      </p>
                      <button
                        onClick={loadProjectsData}
                        className="btn-primary group hover:shadow-lg transition-all duration-200 hover:scale-105"
                      >
                        <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                        </svg>
                        Load My Projects
                      </button>
                    </div>
                  </div>
                )}

                {/* Projects grid or empty state */}
                {dataLoaded && !isLoading && (
                  <>
                    {filteredProjects.length > 0 ? (
                      <div className="grid grid-cols-1 gap-6">
                        {filteredProjects.slice(0, 4).map((project, index) => (
                          <Link
                            key={project.id}
                            href={`/projects/${project.id}`}
                            className="card-gradient hover:shadow-lg cursor-pointer transform transition-all duration-200 hover:scale-[1.02] group"
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
                    ) : (
                      <div className="card-gradient">
                        <div className="card-body text-center py-12">
                          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full mb-6">
                            <svg className="h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                          </div>
                          <h3 className="text-xl font-semibold text-gray-900 mb-2">Ready to start your first audit?</h3>
                          <p className="text-gray-600 mb-6">
                            Create a project to organize your documents, collaborate with your team, and generate AI-powered audit reports.
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
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Recent Activity */}
                <div className="card-gradient">
                  <div className="card-body">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <svg className="h-5 w-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Recent Activity
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center text-sm text-gray-600">
                        <div className="w-2 h-2 bg-green-400 rounded-full mr-3"></div>
                        <span>System ready for new uploads</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <div className="w-2 h-2 bg-blue-400 rounded-full mr-3"></div>
                        <span>AI analysis engine online</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <div className="w-2 h-2 bg-purple-400 rounded-full mr-3"></div>
                        <span>Report templates updated</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Financial News */}
                <div className="card-gradient">
                  <div className="card-body">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <svg className="h-5 w-5 mr-2 text-orange-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h6.75" />
                      </svg>
                      Financial News
                      {newsLoading && <LoadingSpinner size="sm" className="ml-2" />}
                    </h3>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {news.slice(0, 3).map((article, index) => (
                        <div key={index} className={clsx(
                          "border-l-4 pl-3 cursor-pointer hover:bg-gray-50 rounded-r-lg p-2 transition-colors duration-200",
                          index === 0 ? "border-green-400" :
                          index === 1 ? "border-blue-400" : "border-purple-400"
                        )} onClick={() => article.url && article.url !== "#" && window.open(article.url, '_blank')}>
                          <p className="text-sm font-medium text-gray-900 leading-tight mb-1">
                            {article.title?.length > 60 ? article.title.substring(0, 60) + '...' : article.title}
                          </p>
                          <p className="text-xs text-gray-600 leading-tight mb-1">
                            {article.description?.length > 80 ? article.description.substring(0, 80) + '...' : article.description}
                          </p>
                          <p className="text-xs text-gray-400">
                            {new Date(article.published_at).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                      {news.length === 0 && !newsLoading && (
                        <div className="text-center py-4">
                          <p className="text-sm text-gray-500">Loading financial news...</p>
                        </div>
                      )}
                    </div>
                    <div className="mt-4 pt-3 border-t border-gray-200">
                      <button 
                        onClick={loadNews}
                        disabled={newsLoading}
                        className="text-xs text-blue-600 hover:text-blue-500 transition-colors duration-200 disabled:opacity-50"
                      >
                        {newsLoading ? 'Refreshing...' : 'Refresh News'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* AI Assistant */}
                <div className="card-gradient">
                  <div className="card-body">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <svg className="h-5 w-5 mr-2 text-indigo-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                      </svg>
                      AI Assistant
                    </h3>
                    <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg p-4 mb-4">
                      <p className="text-sm text-gray-700 mb-3">
                        👋 Ready to help with your audit needs! Try asking:
                      </p>
                      <div className="space-y-2 text-xs text-gray-600">
                        <p>• "What documents do I need for a financial audit?"</p>
                        <p>• "Show me compliance requirements for my industry"</p>
                        <p>• "Generate a risk assessment checklist"</p>
                      </div>
                    </div>
                    <button className="w-full btn-primary text-sm">
                      Start Chat
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Welcome Modal */}
      {userProfile && (
        <WelcomeModal
          isOpen={showWelcomeModal}
          onClose={() => setShowWelcomeModal(false)}
          user={userProfile}
          onTaskSelect={handleWelcomeTaskSelect}
        />
      )}

      {/* Create Project Modal */}
      <CreateProjectModal 
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleProjectCreated}
      />

      {/* Chat Widget */}
      <ChatWidget />
    </ErrorBoundary>
  );
};

export default Dashboard;