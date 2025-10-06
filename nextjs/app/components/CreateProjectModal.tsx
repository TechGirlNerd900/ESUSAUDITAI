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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert'; // Corrected Alert components import path
import { AlertTriangle, RefreshCw } from 'lucide-react'; // Added icons
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch'; // Added authenticated fetch

import { 
  handleApiError, 
  handleApiSuccess, 
  showToast, // Renamed from showErrorToast
  shouldRetryError, 
  ErrorCategory,
  ApiErrorResult 
} from '@/lib/utils/errorHandler'; // Added error handling utility

interface Project { // Re-defined Project interface for consistency
  id: string;
  name: string;
  client_name: string;
  organization_id: string;
  created_at: string;
  deleted_at: string | null;
  tags?: string[];
  custom_fields?: Record<string, any>;
  document_count?: number;
  due_date?: string;
  audit_type?: string;
}

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: (project: Project) => void; // Renamed onSuccess to onProjectCreated
}

const CreateProjectModal = ({ isOpen, onClose, onProjectCreated }: CreateProjectModalProps) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    client_name: '',
    client_email: '',
    start_date: '',
    end_date: '',
    custom_fields: '{}',
    tags: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<ApiErrorResult | null>(null); // Changed error type
  const [fieldErrors, setFieldErrors] = useState<{ field: string; message: string }[] | null>(null); // Added field errors state
  const [retryCount, setRetryCount] = useState(0); // Added retry count state

  const authenticatedFetch = useAuthenticatedFetch(); // Initialize authenticatedFetch

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); // Clear previous errors
    setFieldErrors(null); // Clear previous field errors

    if (!formData.name || !formData.client_name) {
      setError({
        message: 'Project name and client name are required',
        category: ErrorCategory.VALIDATION_ERROR,
        statusCode: 400,
        shouldRetry: false,
        fieldErrors: [
          { field: 'name', message: 'Project name is required' },
          { field: 'client_name', message: 'Client name is required' }
        ],
        error: new Error('Validation Error'), // Added missing property
        isEmptyState: false, // Added missing property
        retryAfter: null // Corrected to null
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const body = {
        ...formData,
        custom_fields: formData.custom_fields ? JSON.parse(formData.custom_fields) : {},
        tags: formData.tags
          ? formData.tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
      };

      const response = await authenticatedFetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorResult = await handleApiError(response, { 
          endpoint: 'create project', 
          showToast: false 
        });
        setError(errorResult);
        setFieldErrors(errorResult.fieldErrors || null);
      } else {
        const successResult = await handleApiSuccess<{ project: Project }>(response);
        onProjectCreated(successResult.data!.project); // Use onProjectCreated
        showToast('Project created successfully!', 'default'); // Show success toast within the modal
        onClose();
        setFormData({
          name: '',
          description: '',
          client_name: '',
          client_email: '',
          start_date: '',
          end_date: '',
          custom_fields: '{}',
          tags: '',
        });
        setError(null); // Clear error on success
        setFieldErrors(null); // Clear field errors on success
      }
    } catch (e) {
      const errorResult = await handleApiError(null, { 
        endpoint: 'create project', 
        showToast: true,
        customMessage: 'Failed to connect to the server. Please check your internet connection.'
      });
      setError(errorResult);
      setFieldErrors(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>Fill in the details below to create a new project.</DialogDescription>
        </DialogHeader>
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription className="flex justify-between items-center">
              {error.message}
              {error.shouldRetry && shouldRetryError(error.category, retryCount) && (
                <Button variant="ghost" onClick={handleRetry} className="ml-4">
                  <RefreshCw className="mr-2 h-4 w-4" /> Retry
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Project Name *
            </Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={`col-span-3 ${fieldErrors?.some(err => err.field === 'name') ? 'border-red-500' : ''}`}
              required
            />
            {fieldErrors?.find(err => err.field === 'name') && (
              <p className="col-span-4 text-right text-sm text-red-500">{fieldErrors.find(err => err.field === 'name')?.message}</p>
            )}
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="client_name" className="text-right">
              Client Name *
            </Label>
            <Input
              id="client_name"
              name="client_name"
              value={formData.client_name}
              onChange={handleChange}
              className={`col-span-3 ${fieldErrors?.some(err => err.field === 'client_name') ? 'border-red-500' : ''}`}
              required
            />
            {fieldErrors?.find(err => err.field === 'client_name') && (
              <p className="col-span-4 text-right text-sm text-red-500">{fieldErrors.find(err => err.field === 'client_name')?.message}</p>
            )}
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="client_email" className="text-right">
              Client Email
            </Label>
            <Input
              id="client_email"
              name="client_email"
              type="email"
              value={formData.client_email}
              onChange={handleChange}
              className={`col-span-3 ${fieldErrors?.some(err => err.field === 'client_email') ? 'border-red-500' : ''}`}
            />
            {fieldErrors?.find(err => err.field === 'client_email') && (
              <p className="col-span-4 text-right text-sm text-red-500">{fieldErrors.find(err => err.field === 'client_email')?.message}</p>
            )}
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">
              Description
            </Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="start_date" className="text-right">
              Start Date
            </Label>
            <Input
              id="start_date"
              name="start_date"
              type="date"
              value={formData.start_date}
              onChange={handleChange}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="end_date" className="text-right">
              End Date
            </Label>
            <Input
              id="end_date"
              name="end_date"
              type="date"
              value={formData.end_date}
              onChange={handleChange}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="tags" className="text-right">
              Tags
            </Label>
            <Input
              id="tags"
              name="tags"
              value={formData.tags}
              onChange={handleChange}
              className="col-span-3"
              placeholder="tag1, tag2"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="custom_fields" className="text-right">
              Custom Fields
            </Label>
            <Textarea
              id="custom_fields"
              name="custom_fields"
              value={formData.custom_fields}
              onChange={handleChange}
              className="col-span-3"
              placeholder='{ "key": "value" }'
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateProjectModal;
