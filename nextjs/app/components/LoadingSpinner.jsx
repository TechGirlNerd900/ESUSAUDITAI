import React from 'react';
import clsx from 'clsx';

const LoadingSpinner = ({ size = 'md', className = '', variant = 'default', text = '' }) => {
  const sizeClasses = {
    xs: 'h-3 w-3',
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16'
  };

  const iconSizeClasses = {
    xs: 'h-2 w-2',
    sm: 'h-3 w-3',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12'
  };

  if (variant === 'dots') {
    return (
      <div className={clsx('flex items-center justify-center space-x-1', className)}>
        <div className="flex space-x-1">
          <div className={clsx('bg-blue-600 rounded-full animate-bounce', sizeClasses[size])} style={{ animationDelay: '0ms' }}></div>
          <div className={clsx('bg-blue-600 rounded-full animate-bounce', sizeClasses[size])} style={{ animationDelay: '150ms' }}></div>
          <div className={clsx('bg-blue-600 rounded-full animate-bounce', sizeClasses[size])} style={{ animationDelay: '300ms' }}></div>
        </div>
        {text && <span className="ml-3 text-sm text-gray-600 animate-pulse">{text}</span>}
      </div>
    );
  }

  if (variant === 'pulse') {
    return (
      <div className={clsx('flex items-center justify-center', className)}>
        <div className="relative">
          <div className={clsx('absolute inset-0 bg-blue-600 rounded-full animate-ping opacity-75', sizeClasses[size])}></div>
          <div className={clsx('relative bg-blue-600 rounded-full', sizeClasses[size])}></div>
        </div>
        {text && <span className="ml-3 text-sm text-gray-600 animate-pulse">{text}</span>}
      </div>
    );
  }

  // Default spinner
  return (
    <div className={clsx('flex items-center justify-center', className)}>
      <div className="relative">
        <div
          className={clsx(
            'animate-spin rounded-full border-2 border-gray-200',
            sizeClasses[size]
          )}
        >
          <div className={clsx(
            'absolute inset-0 rounded-full border-2 border-transparent border-t-blue-600 border-r-blue-600 animate-spin',
            sizeClasses[size]
          )}></div>
        </div>
      </div>
      {text && <span className="ml-3 text-sm text-gray-600 animate-pulse">{text}</span>}
    </div>
  );
};

export default LoadingSpinner;