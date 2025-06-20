'use client'

import React, { useState } from 'react'
import clsx from 'clsx'
import Link from 'next/link'

interface UserProfile {
  first_name: string
  last_name: string
  role: 'admin' | 'auditor' | 'reviewer'
  email: string
}

interface WelcomeModalProps {
  isOpen: boolean
  onClose: () => void
  user: UserProfile
  onTaskSelect: (task: string) => void
}

interface TaskOption {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  href?: string
  action?: () => void
  variant: 'primary' | 'secondary' | 'accent'
}

export default function WelcomeModal({ isOpen, onClose, user, onTaskSelect }: WelcomeModalProps) {
  const [currentStep, setCurrentStep] = useState<'welcome' | 'tasks'>('welcome')

  if (!isOpen) return null

  // Role-specific task options
  const getTasksForRole = (role: string): TaskOption[] => {
    const commonTasks = [
      {
        id: 'chat',
        title: 'Ask Esus Questions',
        description: 'Get instant answers about audit procedures, compliance, and best practices',
        icon: (
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
          </svg>
        ),
        variant: 'accent' as const
      }
    ]

    switch (role) {
      case 'admin':
        return [
          {
            id: 'manage-users',
            title: 'Manage Organization',
            description: 'Add users, configure settings, and oversee audit operations',
            icon: (
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            ),
            href: '/admin',
            variant: 'primary' as const
          },
          {
            id: 'system-analytics',
            title: 'View System Analytics',
            description: 'Monitor usage, audit logs, and system performance',
            icon: (
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            ),
            variant: 'secondary' as const
          },
          {
            id: 'create-project',
            title: 'Start New Audit Project',
            description: 'Create and configure new audit engagements',
            icon: (
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            ),
            variant: 'secondary' as const
          },
          ...commonTasks
        ]

      case 'auditor':
        return [
          {
            id: 'create-project',
            title: 'Start New Audit Project',
            description: 'Create a new audit engagement and organize your work',
            icon: (
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            ),
            variant: 'primary' as const
          },
          {
            id: 'upload-documents',
            title: 'Upload Documents for Analysis',
            description: 'Upload financial documents and get AI-powered insights',
            icon: (
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            ),
            variant: 'secondary' as const
          },
          {
            id: 'review-projects',
            title: 'Review Existing Projects',
            description: 'Continue work on ongoing audit engagements',
            icon: (
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
              </svg>
            ),
            href: '/projects',
            variant: 'secondary' as const
          },
          ...commonTasks
        ]

      case 'reviewer':
        return [
          {
            id: 'review-assigned',
            title: 'Review Assigned Projects',
            description: 'Review documents and analyses assigned to you',
            icon: (
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
            href: '/projects',
            variant: 'primary' as const
          },
          {
            id: 'view-analysis',
            title: 'View Analysis Results',
            description: 'Review AI-generated findings and recommendations',
            icon: (
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            ),
            variant: 'secondary' as const
          },
          {
            id: 'generate-reports',
            title: 'Generate Reports',
            description: 'Create audit reports and summaries',
            icon: (
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5-3H12M8.25 9h2.25" />
              </svg>
            ),
            variant: 'secondary' as const
          },
          ...commonTasks
        ]

      default:
        return commonTasks
    }
  }

  const tasks = getTasksForRole(user.role)

  const handleTaskClick = (task: TaskOption) => {
    if (task.href) {
      onTaskSelect(task.id)
      onClose()
      // Navigation will be handled by parent component
    } else {
      onTaskSelect(task.id)
      onClose()
    }
  }

  const getVariantClasses = (variant: string) => {
    switch (variant) {
      case 'primary':
        return 'bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white border-blue-500'
      case 'secondary':
        return 'bg-gradient-to-br from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 text-gray-900 border-gray-200'
      case 'accent':
        return 'bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-indigo-500'
      default:
        return 'bg-white hover:bg-gray-50 text-gray-900 border-gray-200'
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {currentStep === 'welcome' && (
          <div className="p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="mx-auto w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mb-6">
                <svg className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Welcome to EsusAuditAI, {user.first_name}!
              </h1>
              <p className="text-lg text-gray-600 mb-6">
                Your AI-powered audit assistant is ready to help you streamline your audit process
              </p>
            </div>

            {/* Role-specific introduction */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-3">
                As a {user.role === 'admin' ? 'System Administrator' : user.role === 'auditor' ? 'Lead Auditor' : 'Audit Reviewer'}, you can:
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {user.role === 'admin' && (
                  <>
                    <div className="flex items-start">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3"></div>
                      <span className="text-gray-700">Manage users and organizational settings</span>
                    </div>
                    <div className="flex items-start">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3"></div>
                      <span className="text-gray-700">Monitor system analytics and audit logs</span>
                    </div>
                    <div className="flex items-start">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3"></div>
                      <span className="text-gray-700">Oversee all audit projects and operations</span>
                    </div>
                    <div className="flex items-start">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3"></div>
                      <span className="text-gray-700">Configure AI models and system settings</span>
                    </div>
                  </>
                )}
                {user.role === 'auditor' && (
                  <>
                    <div className="flex items-start">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3"></div>
                      <span className="text-gray-700">Create and manage audit projects</span>
                    </div>
                    <div className="flex items-start">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3"></div>
                      <span className="text-gray-700">Upload documents for AI analysis</span>
                    </div>
                    <div className="flex items-start">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3"></div>
                      <span className="text-gray-700">Generate comprehensive audit reports</span>
                    </div>
                    <div className="flex items-start">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3"></div>
                      <span className="text-gray-700">Collaborate with team members</span>
                    </div>
                  </>
                )}
                {user.role === 'reviewer' && (
                  <>
                    <div className="flex items-start">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3"></div>
                      <span className="text-gray-700">Review assigned audit projects</span>
                    </div>
                    <div className="flex items-start">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3"></div>
                      <span className="text-gray-700">Validate AI-generated findings</span>
                    </div>
                    <div className="flex items-start">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3"></div>
                      <span className="text-gray-700">Generate final audit reports</span>
                    </div>
                    <div className="flex items-start">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3"></div>
                      <span className="text-gray-700">Ensure compliance with standards</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => setCurrentStep('tasks')}
                className="btn-primary px-8 py-3 text-lg"
              >
                Get Started
              </button>
              <button
                onClick={onClose}
                className="px-8 py-3 text-lg text-gray-600 hover:text-gray-800 transition-colors duration-200"
              >
                Skip for now
              </button>
            </div>
          </div>
        )}

        {currentStep === 'tasks' && (
          <div className="p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                What would you like to do first?
              </h2>
              <p className="text-gray-600">
                Choose a task to get started with EsusAuditAI
              </p>
            </div>

            {/* Task grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {tasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => handleTaskClick(task)}
                  className={clsx(
                    'p-6 rounded-xl border-2 transition-all duration-200 transform hover:scale-105 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-left',
                    getVariantClasses(task.variant)
                  )}
                >
                  <div className="flex items-start mb-4">
                    <div className={clsx(
                      'flex-shrink-0 p-3 rounded-lg',
                      task.variant === 'secondary' ? 'bg-white shadow-sm' : 'bg-white bg-opacity-20'
                    )}>
                      <div className={clsx(
                        task.variant === 'secondary' ? 'text-gray-600' : 'text-current'
                      )}>
                        {task.icon}
                      </div>
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{task.title}</h3>
                  <p className={clsx(
                    'text-sm',
                    task.variant === 'secondary' ? 'text-gray-600' : 'text-current opacity-90'
                  )}>
                    {task.description}
                  </p>
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => setCurrentStep('welcome')}
                className="px-6 py-2 text-gray-600 hover:text-gray-800 transition-colors duration-200"
              >
                ← Back
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2 text-gray-600 hover:text-gray-800 transition-colors duration-200"
              >
                Skip for now
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}