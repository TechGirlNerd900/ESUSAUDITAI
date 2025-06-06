import React, { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { 
  XMarkIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';

const DocumentAnalysisModal = ({ open, setOpen, document, analysis }) => {
  if (!document || !analysis) return null;

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl sm:p-6">
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
                  <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                    <DocumentTextIcon className="h-6 w-6 text-blue-600" aria-hidden="true" />
                  </div>
                  <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                    <Dialog.Title as="h3" className="text-base font-semibold leading-6 text-gray-900">
                      Document Analysis: {document.originalName}
                    </Dialog.Title>
                    
                    <div className="mt-2">
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span>{formatFileSize(document.fileSize)}</span>
                        <span>•</span>
                        <span>Uploaded {new Date(document.uploadedAt).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>Analyzed {new Date(analysis.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="mt-6 space-y-6">
                      {/* Summary */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 flex items-center">
                          <ChartBarIcon className="h-4 w-4 mr-2" />
                          AI Summary
                        </h4>
                        <div className="mt-2 p-4 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-700">{analysis.summary}</p>
                          <div className="mt-3 flex items-center justify-between">
                            <span className="text-xs text-gray-500">
                              Confidence Score: {(analysis.confidenceScore * 100).toFixed(0)}%
                            </span>
                            <div className="w-24 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-primary-600 h-2 rounded-full"
                                style={{ width: `${analysis.confidenceScore * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Red Flags */}
                      {analysis.redFlags && analysis.redFlags.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 flex items-center">
                            <ExclamationTriangleIcon className="h-4 w-4 mr-2 text-danger-500" />
                            Red Flags ({analysis.redFlags.length})
                          </h4>
                          <div className="mt-2 space-y-2">
                            {analysis.redFlags.map((flag, index) => (
                              <div key={index} className="flex items-start p-3 bg-danger-50 border border-danger-200 rounded-lg">
                                <ExclamationTriangleIcon className="h-4 w-4 text-danger-500 mt-0.5 mr-2 flex-shrink-0" />
                                <span className="text-sm text-danger-700">{flag}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Highlights */}
                      {analysis.highlights && analysis.highlights.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 flex items-center">
                            <CheckCircleIcon className="h-4 w-4 mr-2 text-success-500" />
                            Highlights ({analysis.highlights.length})
                          </h4>
                          <div className="mt-2 space-y-2">
                            {analysis.highlights.map((highlight, index) => (
                              <div key={index} className="flex items-start p-3 bg-success-50 border border-success-200 rounded-lg">
                                <CheckCircleIcon className="h-4 w-4 text-success-500 mt-0.5 mr-2 flex-shrink-0" />
                                <span className="text-sm text-success-700">{highlight}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Extracted Data Preview */}
                      {analysis.extractedData && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">Extracted Data</h4>
                          <div className="mt-2 p-4 bg-gray-50 rounded-lg">
                            <pre className="text-xs text-gray-600 whitespace-pre-wrap max-h-40 overflow-y-auto">
                              {JSON.stringify(analysis.extractedData, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-6 sm:flex sm:flex-row-reverse">
                      <button
                        type="button"
                        className="inline-flex w-full justify-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 sm:ml-3 sm:w-auto"
                        onClick={() => setOpen(false)}
                      >
                        Close
                      </button>
                    </div>
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

export default DocumentAnalysisModal;
