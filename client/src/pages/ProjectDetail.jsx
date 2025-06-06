import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from 'react-query';
import { Tab } from '@headlessui/react';
import toast from 'react-hot-toast';
import {
  DocumentTextIcon,
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  CloudArrowUpIcon,
  ExclamationCircleIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

import { projectsService } from '../services/api';
import { isDemoMode, demoService, demoData } from '../services/demoData';
import LoadingSpinner from '../components/LoadingSpinner';
import UploadComponent from '../components/UploadComponent';
import AskEsus from '../components/AskEsus';
import DocumentsList from '../components/DocumentsList';
import ReportsTab from '../components/ReportsTab';
import ErrorBoundary from '../components/ErrorBoundary';
import AnalysisResultsView from '../components/AnalysisResultsView';

const ProjectDetail = () => {
  const { projectId } = useParams();
  const [selectedTab, setSelectedTab] = useState(0);

  // Demo data simulation
  const getDemoProjectData = async () => {
    const project = demoData.projects.find(p => p.id === projectId);
    if (!project) throw new Error('Project not found');

    const documents = demoData.documents.filter(d => d.projectId === projectId);
    const analysisResults = demoData.analysisResults.filter(a =>
      documents.some(d => d.id === a.documentId)
    );

    return {
      project,
      documents,
      analysisResults
    };
  };

  const { data: projectData, isLoading, error, refetch } = useQuery(
    ['project', projectId],
    isDemoMode() ? getDemoProjectData : () => projectsService.getProject(projectId),
    {
      enabled: !!projectId,
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      onError: (error) => {
        console.error('Failed to load project:', error);
        if (!isDemoMode()) {
          toast.error(error.error || 'Failed to load project');
        }
      }
    }
  );

  const tabs = [
    { name: 'Documents', icon: DocumentTextIcon },
    { name: 'Upload', icon: CloudArrowUpIcon },
    { name: 'Ask Esus', icon: ChatBubbleLeftRightIcon },
    { name: 'Reports', icon: ChartBarIcon }
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900">Project not found</h3>
          <p className="mt-1 text-sm text-gray-500">
            The project you're looking for doesn't exist or you don't have access to it.
          </p>
        </div>
      </div>
    );
  }

  const project = projectData?.project;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      {/* Project Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{project?.name}</h1>
            <p className="mt-1 text-sm text-gray-500">
              Client: {project?.clientName}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <span className={`badge ${
              project?.status === 'active' ? 'badge-success' :
              project?.status === 'completed' ? 'badge-primary' :
              'badge-gray'
            }`}>
              {project?.status}
            </span>
          </div>
        </div>

        {project?.description && (
          <p className="mt-4 text-gray-700">{project.description}</p>
        )}

        {/* Project Stats */}
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
          <div className="card">
            <div className="card-body text-center">
              <div className="text-2xl font-semibold text-gray-900">
                {projectData?.documents?.length || 0}
              </div>
              <div className="text-sm text-gray-500">Documents</div>
            </div>
          </div>
          <div className="card">
            <div className="card-body text-center">
              <div className="text-2xl font-semibold text-gray-900">
                {projectData?.analysisResults?.length || 0}
              </div>
              <div className="text-sm text-gray-500">Analyzed</div>
            </div>
          </div>
          <div className="card">
            <div className="card-body text-center">
              <div className="text-2xl font-semibold text-danger-600">
                {projectData?.analysisResults?.reduce((acc, result) =>
                  acc + (result.redFlags?.length || 0), 0) || 0}
              </div>
              <div className="text-sm text-gray-500">Red Flags</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tab.Group selectedIndex={selectedTab} onChange={setSelectedTab}>
        <Tab.List className="flex space-x-1 rounded-xl bg-blue-900/20 p-1">
          {tabs.map((tab, index) => (
            <Tab
              key={tab.name}
              className={({ selected }) =>
                clsx(
                  'w-full rounded-lg py-2.5 text-sm font-medium leading-5',
                  'ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2',
                  selected
                    ? 'bg-white text-blue-700 shadow'
                    : 'text-blue-100 hover:bg-white/[0.12] hover:text-white'
                )
              }
            >
              <div className="flex items-center justify-center space-x-2">
                <tab.icon className="h-5 w-5" />
                <span>{tab.name}</span>
              </div>
            </Tab>
          ))}
        </Tab.List>

        <Tab.Panels className="mt-6">
          {/* Documents Tab */}
          <Tab.Panel>
            <DocumentsList
              documents={projectData?.documents || []}
              analysisResults={projectData?.analysisResults || []}
              projectId={projectId}
            />
          </Tab.Panel>

          {/* Upload Tab */}
          <Tab.Panel>
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-medium text-gray-900">Upload Documents</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Upload financial documents, invoices, and other audit-related files.
                </p>
              </div>
              <div className="card-body">
                <UploadComponent projectId={projectId} />
              </div>
            </div>
          </Tab.Panel>

          {/* Ask Esus Tab */}
          <Tab.Panel>
            <div className="card h-96">
              <AskEsus projectId={projectId} />
            </div>
          </Tab.Panel>

          {/* Reports Tab */}
          <Tab.Panel>
            <ReportsTab projectId={projectId} />
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>
    </div>
  );
};

export default ProjectDetail;
