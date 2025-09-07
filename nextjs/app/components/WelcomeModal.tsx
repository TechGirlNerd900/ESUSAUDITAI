'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Check,
  ChevronRight,
  Star,
  Users,
  BarChart,
  PlusCircle,
  Upload,
  Briefcase,
  CheckSquare,
  FileText,
  FileOutput,
} from 'lucide-react';

interface UserProfile {
  first_name: string;
  last_name: string;
  role: 'admin' | 'auditor' | 'reviewer';
  email: string;
}

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onTaskSelect: (task: string) => void;
}

interface TaskOption {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  href?: string;
  action?: () => void;
}

export default function WelcomeModal({ isOpen, onClose, user, onTaskSelect }: WelcomeModalProps) {
  const [currentStep, setCurrentStep] = useState<'welcome' | 'tasks'>('welcome');

  if (!isOpen) return null;

  const getTasksForRole = (role: string): TaskOption[] => {
    const commonTasks = [
      {
        id: 'chat',
        title: 'Ask Esus Questions',
        description: 'Get instant answers about audit procedures.',
        icon: <Star className="h-6 w-6 text-primary" />,
      },
    ];

    switch (role) {
      case 'admin':
        return [
          {
            id: 'manage-users',
            title: 'Manage Organization',
            description: 'Add users and configure settings.',
            icon: <Users className="h-6 w-6 text-primary" />,
            href: '/admin',
          },
          {
            id: 'system-analytics',
            title: 'View System Analytics',
            description: 'Monitor usage and system performance.',
            icon: <BarChart className="h-6 w-6 text-primary" />,
          },
          {
            id: 'create-project',
            title: 'Start New Audit Project',
            description: 'Create and configure new audit engagements.',
            icon: <PlusCircle className="h-6 w-6 text-primary" />,
          },
          ...commonTasks,
        ];

      case 'auditor':
        return [
          {
            id: 'create-project',
            title: 'Start New Audit Project',
            description: 'Create a new audit engagement.',
            icon: <PlusCircle className="h-6 w-6 text-primary" />,
          },
          {
            id: 'upload-documents',
            title: 'Upload Documents',
            description: 'Upload financial documents for analysis.',
            icon: <Upload className="h-6 w-6 text-primary" />,
          },
          {
            id: 'review-projects',
            title: 'Review Existing Projects',
            description: 'Continue work on ongoing audits.',
            icon: <Briefcase className="h-6 w-6 text-primary" />,
            href: '/projects',
          },
          ...commonTasks,
        ];

      case 'reviewer':
        return [
          {
            id: 'review-assigned',
            title: 'Review Assigned Projects',
            description: 'Review documents and analyses.',
            icon: <CheckSquare className="h-6 w-6 text-primary" />,
            href: '/projects',
          },
          {
            id: 'view-analysis',
            title: 'View Analysis Results',
            description: 'Review AI-generated findings.',
            icon: <FileText className="h-6 w-6 text-primary" />,
          },
          {
            id: 'generate-reports',
            title: 'Generate Reports',
            description: 'Create audit reports and summaries.',
            icon: <FileOutput className="h-6 w-6 text-primary" />,
          },
          ...commonTasks,
        ];

      default:
        return commonTasks;
    }
  };

  const tasks = getTasksForRole(user.role);

  const handleTaskClick = (task: TaskOption) => {
    if (task.href) {
      onTaskSelect(task.id);
      onClose();
    } else {
      onTaskSelect(task.id);
      onClose();
    }
  };

  const roleDescription = {
    admin: 'System Administrator',
    auditor: 'Lead Auditor',
    reviewer: 'Audit Reviewer',
  };

  const roleBenefits = {
    admin: [
      'Manage users and organizational settings',
      'Monitor system analytics and audit logs',
      'Oversee all audit projects and operations',
      'Configure AI models and system settings',
    ],
    auditor: [
      'Create and manage audit projects',
      'Upload documents for AI analysis',
      'Generate comprehensive audit reports',
      'Collaborate with team members',
    ],
    reviewer: [
      'Review assigned audit projects',
      'Validate AI-generated findings',
      'Generate final audit reports',
      'Ensure compliance with standards',
    ],
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl">
        {currentStep === 'welcome' ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-center text-3xl font-bold">
                Welcome to EsusAuditAI, {user.first_name}!
              </DialogTitle>
              <DialogDescription className="text-center text-lg">
                Your AI-powered audit assistant is ready to help you streamline your audit process.
              </DialogDescription>
            </DialogHeader>
            <div className="p-6">
              <Card>
                <CardHeader>
                  <CardTitle>As a {roleDescription[user.role]}, you can:</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  {roleBenefits[user.role].map((benefit, index) => (
                    <div key={index} className="flex items-start">
                      <Check className="h-5 w-5 text-green-500 mr-2 mt-1" />
                      <span>{benefit}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
            <DialogFooter className="justify-center">
              <Button onClick={() => setCurrentStep('tasks')} size="lg">
                Get Started <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
              <Button variant="ghost" onClick={onClose}>
                Skip for now
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-center text-2xl font-bold">
                What would you like to do first?
              </DialogTitle>
              <DialogDescription className="text-center">
                Choose a task to get started with EsusAuditAI.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
              {tasks.map((task) => (
                <Card
                  key={task.id}
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => handleTaskClick(task)}
                >
                  <CardHeader className="flex flex-row items-center gap-4">
                    {task.icon}
                    <CardTitle>{task.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{task.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <DialogFooter className="justify-center">
              <Button variant="outline" onClick={() => setCurrentStep('welcome')}>
                Back
              </Button>
              <Button variant="ghost" onClick={onClose}>
                Skip for now
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
