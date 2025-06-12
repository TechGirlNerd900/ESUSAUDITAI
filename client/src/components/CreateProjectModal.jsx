import React, { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useMutation } from 'react-query';
import toast from 'react-hot-toast';
import { projectsService } from '../services/api.js';
import LoadingSpinner from './LoadingSpinner.jsx';

const CreateProjectModal = ({ open, setOpen, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    clientName: '',
    clientEmail: '',
    startDate: '',
    endDate: ''
  });

  const createProjectMutation = useMutation(projectsService.createProject, {
    onSuccess: (data) => {
      toast.success('Project created successfully!');
      setFormData({
        name: '',
        description: '',
        clientName: '',
        clientEmail: '',
        startDate: '',
        endDate: ''
      });
      onSuccess(data);
    },
    onError: (error) => {
      toast.error(error.error || 'Failed to create project');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.clientName) {
      toast.error('Project name and client name are required');
      return;
    }

    createProjectMutation.mutate(formData);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={setOpen}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <div className="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
                  <button
                    type="button"
                    className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                    onClick={() => setOpen(false)}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>
                
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                    <Dialog.Title as="h3" className="text-base font-semibold leading-6 text-gray-900">
                      Create New Project
                    </Dialog.Title>
                    
                    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                      <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                          Project Name *
                        </label>
                        <input
                          type="text"
                          name="name"
                          id="name"
                          required
                          className="mt-1 input"
                          value={formData.name}
                          onChange={handleChange}
                          placeholder="Annual Audit 2024"
                        />
                      </div>

                      <div>
                        <label htmlFor="clientName" className="block text-sm font-medium text-gray-700">
                          Client Name *
                        </label>
                        <input
                          type="text"
                          name="clientName"
                          id="clientName"
                          required
                          className="mt-1 input"
                          value={formData.clientName}
                          onChange={handleChange}
                          placeholder="Acme Corporation"
                        />
                      </div>

                      <div>
                        <label htmlFor="clientEmail" className="block text-sm font-medium text-gray-700">
                          Client Email
                        </label>
                        <input
                          type="email"
                          name="clientEmail"
                          id="clientEmail"
                          className="mt-1 input"
                          value={formData.clientEmail}
                          onChange={handleChange}
                          placeholder="contact@acme.com"
                        />
                      </div>

                      <div>
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                          Description
                        </label>
                        <textarea
                          name="description"
                          id="description"
                          rows={3}
                          className="mt-1 input"
                          value={formData.description}
                          onChange={handleChange}
                          placeholder="Brief description of the audit project..."
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
                            Start Date
                          </label>
                          <input
                            type="date"
                            name="startDate"
                            id="startDate"
                            className="mt-1 input"
                            value={formData.startDate}
                            onChange={handleChange}
                          />
                        </div>

                        <div>
                          <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">
                            End Date
                          </label>
                          <input
                            type="date"
                            name="endDate"
                            id="endDate"
                            className="mt-1 input"
                            value={formData.endDate}
                            onChange={handleChange}
                          />
                        </div>
                      </div>

                      <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                        <button
                          type="submit"
                          disabled={createProjectMutation.isLoading}
                          className="inline-flex w-full justify-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 sm:ml-3 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {createProjectMutation.isLoading ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            'Create Project'
                          )}
                        </button>
                        <button
                          type="button"
                          className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                          onClick={() => setOpen(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
};

export default CreateProjectModal;
