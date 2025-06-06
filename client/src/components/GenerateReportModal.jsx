import React, { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from './LoadingSpinner';

const GenerateReportModal = ({ open, setOpen, projectId, onGenerate, isLoading }) => {
  const [formData, setFormData] = useState({
    reportName: '',
    includeCharts: false
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.reportName.trim()) {
      return;
    }

    onGenerate(formData.reportName.trim(), formData.includeCharts);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleClose = () => {
    if (!isLoading) {
      setOpen(false);
      setFormData({
        reportName: '',
        includeCharts: false
      });
    }
  };

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
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
                {!isLoading && (
                  <div className="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
                    <button
                      type="button"
                      className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                      onClick={handleClose}
                    >
                      <span className="sr-only">Close</span>
                      <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                    </button>
                  </div>
                )}
                
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                    <DocumentArrowDownIcon className="h-6 w-6 text-blue-600" aria-hidden="true" />
                  </div>
                  <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                    <Dialog.Title as="h3" className="text-base font-semibold leading-6 text-gray-900">
                      Generate Audit Report
                    </Dialog.Title>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Create a comprehensive audit report with AI-generated insights and analysis.
                      </p>
                    </div>

                    {isLoading ? (
                      <div className="mt-6 text-center py-8">
                        <LoadingSpinner size="lg" />
                        <p className="mt-4 text-sm text-gray-600">
                          Generating your audit report...
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          This may take a few minutes depending on the amount of data.
                        </p>
                      </div>
                    ) : (
                      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                        <div>
                          <label htmlFor="reportName" className="block text-sm font-medium text-gray-700">
                            Report Name *
                          </label>
                          <input
                            type="text"
                            name="reportName"
                            id="reportName"
                            required
                            className="mt-1 input"
                            value={formData.reportName}
                            onChange={handleChange}
                            placeholder="Annual Audit Report 2024"
                          />
                        </div>

                        <div className="flex items-center">
                          <input
                            id="includeCharts"
                            name="includeCharts"
                            type="checkbox"
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                            checked={formData.includeCharts}
                            onChange={handleChange}
                          />
                          <label htmlFor="includeCharts" className="ml-2 block text-sm text-gray-900">
                            Include charts and visualizations
                          </label>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <h4 className="text-sm font-medium text-blue-900">Report will include:</h4>
                          <ul className="mt-2 text-sm text-blue-700 space-y-1">
                            <li>• Executive summary</li>
                            <li>• Document analysis results</li>
                            <li>• Red flags and compliance issues</li>
                            <li>• Key findings and recommendations</li>
                            <li>• Statistical overview</li>
                            {formData.includeCharts && <li>• Charts and visualizations</li>}
                          </ul>
                        </div>

                        <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                          <button
                            type="submit"
                            disabled={!formData.reportName.trim()}
                            className="inline-flex w-full justify-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 sm:ml-3 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Generate Report
                          </button>
                          <button
                            type="button"
                            className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                            onClick={handleClose}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
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

export default GenerateReportModal;
